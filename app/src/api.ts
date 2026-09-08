import type { Program, Session, Weights } from "./types";
import { loadLogs, loadPin, loadToken, saveToken } from "./storage";

const BASE = String(import.meta.env.VITE_WORKER_URL ?? "").replace(/\/$/, "");

export class AuthError extends Error {
  readonly kind: "pin" | "server";

  constructor(message = "Неверный код", kind: "pin" | "server" = "pin") {
    super(message);
    this.name = "AuthError";
    this.kind = kind;
  }
}

export class BusyError extends Error {
  constructor() {
    super("Коуч ещё дописывает прошлый ответ. Подожди немного.");
    this.name = "BusyError";
  }
}

export type ChatResult = {
  status: "done" | "error";
  text: string;
  agentId: string;
  warning?: string;
  weights?: Weights | null;
  program?: Program | null;
};

export type RunSnapshot = {
  status: "pending" | "done" | "error";
  text: string;
  agentId: string;
  runId: string;
  warning?: string;
  weights?: Weights | null;
  program?: Program | null;
};

export function workerConfigured(): boolean {
  return BASE.length > 0;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE) throw new Error("Сервер ещё не подключён");
  const pin = loadPin();
  if (!pin) throw new AuthError();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20_000);
  const onAbort = () => controller.abort();
  init.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const token = loadToken();
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-App-Pin": pin,
          ...(token ? { "X-App-Token": token } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError" && !init.signal?.aborted) {
        throw new Error("Сервер не ответил вовремя.");
      }
      throw error;
    }
    if (res.status === 401) throw new AuthError();
    const body = (await res.json().catch(() => ({}))) as T & {
      error?: unknown;
      busy?: boolean;
    };
    if (res.status === 409 || body.busy) throw new BusyError();
    if (res.status === 503) {
      throw new AuthError(errText(body.error, "Сервер временно недоступен"), "server");
    }
    if (!res.ok) throw new Error(errText(body.error, `Ошибка ${res.status}`));
    return body;
  } finally {
    window.clearTimeout(timer);
    init.signal?.removeEventListener("abort", onAbort);
  }
}

function errText(value: unknown, fallback: string): string {
  if (value == null || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const nested = errText(o.message ?? o.error ?? o.detail ?? o.msg, "");
    if (nested) return nested;
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function authenticate(pin: string): Promise<void> {
  const body = await api<{ token?: string }>("/auth", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
  if (body.token) saveToken(body.token);
}

export async function report(
  sessions: Session[],
  weights: Weights,
  signal?: AbortSignal,
): Promise<{ weights?: Weights }> {
  const done = sessions.filter((s) => s.completedAt);
  if (done.length === 0) throw new Error("Нет сессий для отчёта");
  return api<{ weights?: Weights }>("/report", {
    method: "POST",
    signal,
    body: JSON.stringify({ sessions: done, weights }),
  });
}

export async function loadState(): Promise<{ weights: Weights | null; program: Program | null }> {
  return api("/state");
}

export type StartChatResult =
  | { status: "pending"; agentId: string; runId: string; baseSha?: string }
  | ChatResult;

export async function startChat(
  message: string,
  agentId: string | null,
  signal?: AbortSignal,
): Promise<StartChatResult> {
  const sessions = loadLogs().filter((s) => s.completedAt).slice(-6);
  const started = await api<{
    status?: string;
    agentId?: string;
    runId?: string;
    baseSha?: string;
    text?: string;
    warning?: string;
    weights?: Weights | null;
    program?: Program | null;
    error?: unknown;
  }>("/chat", {
    method: "POST",
    signal,
    body: JSON.stringify({ message, agentId: agentId || undefined, sessions }),
  });

  if (started.status === "done" || started.status === "error") {
    return {
      status: started.status,
      text: started.text || (started.status === "error" ? "Коуч не смог ответить" : ""),
      agentId: started.agentId ?? agentId ?? "",
      warning: started.warning,
      weights: started.weights,
      program: started.program,
    };
  }

  const nextAgentId = started.agentId ?? agentId ?? "";
  const runId = started.runId ?? "";
  if (!nextAgentId || !runId) throw new Error(errText(started.error, "Коуч не запустился"));
  return { status: "pending", agentId: nextAgentId, runId, baseSha: started.baseSha };
}

export async function pollRun(
  agentId: string,
  runId: string,
  baseSha?: string,
  signal?: AbortSignal,
): Promise<RunSnapshot> {
  const query = new URLSearchParams({ agentId, runId });
  if (baseSha) query.set("baseSha", baseSha);
  const current = await api<{
    status?: string;
    text?: string;
    agentId?: string;
    runId?: string;
    warning?: string;
    weights?: Weights | null;
    program?: Program | null;
  }>(`/run?${query.toString()}`, { signal });
  return {
    status:
      current.status === "error"
        ? "error"
        : current.status === "done"
          ? "done"
          : "pending",
    text: current.text || (current.status === "error" ? "Коуч не смог ответить" : ""),
    agentId: current.agentId ?? agentId,
    runId: current.runId ?? runId,
    warning: current.warning,
    weights: current.weights,
    program: current.program,
  };
}

export async function runChat(
  message: string,
  agentId: string | null,
  signal?: AbortSignal,
  onTick?: (elapsedSec: number) => void,
): Promise<ChatResult> {
  const started = await startChat(message, agentId, signal);
  if (started.status !== "pending") return started;
  const startedAt = Date.now();

  for (;;) {
    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    onTick?.(elapsedSec);
    const delay = elapsedSec < 30 ? 2_000 : elapsedSec < 180 ? 5_000 : 10_000;
    await sleep(delay, signal);
    const current = await pollRun(started.agentId, started.runId, started.baseSha, signal);
    if (current.status !== "pending") {
      return {
        status: current.status,
        text: current.text,
        agentId: current.agentId,
        warning: current.warning,
        weights: current.weights,
        program: current.program,
      };
    }
    if (Date.now() - startedAt >= 10 * 60 * 1000) {
      throw new Error("Коуч не ответил за 10 минут. Он может ещё дописывать — загляни позже.");
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Отменено", "AbortError"));
    };
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
  });
}
