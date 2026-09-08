import seedWeights from "../../data/weights.json";
import { withToken } from "./github";
import type { DraftSession, GithubSettings, Session, Weights } from "./types";

const DRAFT = "gym-draft";
const LOGS = "gym-logs";
const WEIGHTS = "gym-weights";
const GITHUB = "gym-github";
const SENT = "gym-sent";

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
  return read<Weights>(WEIGHTS, seedWeights as Weights);
}

export function saveWeights(weights: Weights): void {
  localStorage.setItem(WEIGHTS, JSON.stringify(weights));
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

export function loadGithub(): GithubSettings {
  const stored = read<GithubSettings>(GITHUB, {
    token: "",
    owner: "",
    repo: "",
    branch: "",
  });
  const next = withToken(stored.token || "");
  saveGithub(next);
  return next;
}

export function saveGithub(settings: GithubSettings): void {
  localStorage.setItem(GITHUB, JSON.stringify(withToken(settings.token)));
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
