import seedProgram from "../../data/program.json";
import seedWeights from "../../data/weights.json";
import type {
  ActiveRun,
  ChatMessage,
  DraftSession,
  PendingRemote,
  Program,
  Session,
  Weights,
} from "./types";

const DRAFT = "gym-draft";
const LOGS = "gym-logs";
const WEIGHTS = "gym-weights";
const SENT = "gym-sent";
const PIN = "gym-pin";
const AGENT = "gym-agent";
const CHAT = "gym-chat";
const PROGRAM = "gym-program";
const ACTIVE_RUN = "gym-active-run";
const REMOTE_PENDING = "gym-remote-pending";
const TOKEN = "gym-token";
const LAST_SEND_ERROR = "gym-last-send-error";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function sessionKey(session: Session): string {
  return `${session.date}-${session.day}`;
}

export function loadWeights(): Weights {
  return sanitizeWeights(read<Weights>(WEIGHTS, seedWeights as Weights));
}

export function saveWeights(weights: Weights): void {
  localStorage.setItem(WEIGHTS, JSON.stringify(weights));
}

export function loadProgram(): Program {
  const saved = read<unknown>(PROGRAM, seedProgram as Program);
  return isValidProgram(saved) ? saved : (seedProgram as Program);
}

export function saveProgram(program: Program): void {
  localStorage.setItem(PROGRAM, JSON.stringify(program));
}

export function applyRemote(
  program: Program | null | undefined,
  weights: Weights | null | undefined,
): { program: Program; weights: Weights; programRejected: boolean } {
  const localProgram = loadProgram();
  const programRejected = program != null && !isValidProgram(program);
  const nextProgram = programRejected ? localProgram : (program ?? localProgram);
  const nextWeights = weights ? mergeWeights(loadWeights(), sanitizeWeights(weights)) : loadWeights();
  const days = { ...nextProgram.days };
  for (const day of Object.keys(days) as Array<keyof typeof days>) {
    days[day] = {
      ...days[day],
      exercises: days[day].exercises.map((ex) => ({
        ...ex,
        weightKg: nextWeights[ex.id] ?? ex.weightKg,
      })),
    };
  }
  const merged = { ...nextProgram, days };
  saveProgram(merged);
  saveWeights(nextWeights);
  return { program: merged, weights: nextWeights, programRejected };
}

export function isValidProgram(value: unknown): value is Program {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<Program> & { days?: unknown };
  if (
    !Number.isFinite(candidate.cycle) ||
    !candidate.warmup ||
    typeof candidate.warmup !== "object" ||
    !Number.isFinite((candidate.warmup as { bikeMin?: unknown }).bikeMin) ||
    typeof (candidate.warmup as { hyper?: unknown }).hyper !== "string"
  ) {
    return false;
  }
  const days = candidate.days;
  if (!days || typeof days !== "object" || Array.isArray(days)) return false;
  const dayMap = days as Record<string, unknown>;
  return (["A", "B", "C"] as const).every((day) => {
    const item = dayMap[day];
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as { exercises?: unknown; ramp?: unknown };
    if (!Array.isArray(row.exercises) || row.exercises.length === 0) return false;
    if (row.ramp !== undefined) {
      if (!row.ramp || typeof row.ramp !== "object" || Array.isArray(row.ramp)) return false;
      const ramp = row.ramp as { exerciseId?: unknown; sets?: unknown; restSec?: unknown };
      if (
        typeof ramp.exerciseId !== "string" ||
        !Array.isArray(ramp.sets) ||
        typeof ramp.restSec !== "number" ||
        !Number.isFinite(ramp.restSec) ||
        !ramp.sets.every(
          (set) =>
            Boolean(set) &&
            typeof set === "object" &&
            typeof (set as { weightKg?: unknown }).weightKg === "number" &&
            Number.isFinite((set as { weightKg?: unknown }).weightKg) &&
            typeof (set as { reps?: unknown }).reps === "number" &&
            Number.isFinite((set as { reps?: unknown }).reps),
        )
      ) {
        return false;
      }
    }
    return row.exercises.every((exercise) => {
      if (!exercise || typeof exercise !== "object" || Array.isArray(exercise)) return false;
      const ex = exercise as Record<string, unknown>;
      return (
        typeof ex.id === "string" &&
        ex.id.length > 0 &&
        typeof ex.name === "string" &&
        Number.isFinite(ex.sets) &&
        Number.isFinite(ex.repsMin) &&
        Number.isFinite(ex.repsMax) &&
        Number.isFinite(ex.weightKg)
      );
    });
  });
}

function sanitizeWeights(value: unknown): Weights {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, kg]) =>
        /^[a-zA-Z0-9_-]+$/.test(key) &&
        typeof kg === "number" &&
        Number.isFinite(kg) &&
        kg >= 0 &&
        kg <= 500,
    ),
  );
}

export function loadLogs(): Session[] {
  return read<Session[]>(LOGS, []);
}

export function saveLogs(logs: Session[]): void {
  localStorage.setItem(LOGS, JSON.stringify(logs));
}

export function loadDraft(): DraftSession | null {
  return read<DraftSession | null>(DRAFT, null);
}

export function saveDraft(draft: DraftSession): void {
  localStorage.setItem(DRAFT, JSON.stringify(draft));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT);
}

export function loadPin(): string {
  try {
    return localStorage.getItem(PIN)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function savePin(pin: string): void {
  localStorage.setItem(PIN, pin.trim());
}

export function clearPin(): void {
  localStorage.removeItem(PIN);
}

export function loadAgentId(): string {
  try {
    return localStorage.getItem(AGENT)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveAgentId(id: string): void {
  if (id) localStorage.setItem(AGENT, id);
}

export function loadChat(): ChatMessage[] {
  return read<ChatMessage[]>(CHAT, [])
    .filter((message) => message && (message.role === "user" || message.role === "assistant"))
    .slice(-100)
    .map((message, index) => ({
      ...message,
      id: message.id || `${Date.now()}-${index}`,
      state: message.state === "sending" ? "failed" : message.state ?? "sent",
    }));
}

export function saveChat(messages: ChatMessage[]): void {
  localStorage.setItem(CHAT, JSON.stringify(messages));
}

export function loadSent(): string[] {
  return read<string[]>(SENT, []);
}

export function markSent(sessions: Session[]): string[] {
  const next = [...new Set([...loadSent(), ...sessions.map(sessionKey)])];
  localStorage.setItem(SENT, JSON.stringify(next));
  return next;
}

export function unsyncedLogs(logs: Session[], sent: string[]): Session[] {
  return logs.filter((s) => s.completedAt && !sent.includes(sessionKey(s)));
}

export function mergeWeights(current: Weights, next: Weights): Weights {
  return { ...current, ...next };
}

export function savePendingRemote(remote: PendingRemote): void {
  localStorage.setItem(REMOTE_PENDING, JSON.stringify(remote));
}

export function loadPendingRemote(): PendingRemote | null {
  return read<PendingRemote | null>(REMOTE_PENDING, null);
}

export function clearPendingRemote(): void {
  localStorage.removeItem(REMOTE_PENDING);
}

export function saveActiveRun(run: ActiveRun): void {
  localStorage.setItem(ACTIVE_RUN, JSON.stringify(run));
}

export function loadActiveRun(): ActiveRun | null {
  return read<ActiveRun | null>(ACTIVE_RUN, null);
}

export function clearActiveRun(): void {
  localStorage.removeItem(ACTIVE_RUN);
}

export function loadToken(): string {
  return localStorage.getItem(TOKEN)?.trim() ?? "";
}

export function saveToken(token: string): void {
  if (token) localStorage.setItem(TOKEN, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN);
}

export function saveLastSendError(): void {
  localStorage.setItem(LAST_SEND_ERROR, new Date().toISOString());
}

export function loadLastSendError(): string {
  return localStorage.getItem(LAST_SEND_ERROR) ?? "";
}

export function clearLastSendError(): void {
  localStorage.removeItem(LAST_SEND_ERROR);
}
