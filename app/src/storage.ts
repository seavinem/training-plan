import seedWeights from "../../data/weights.json";
import type { DraftSession, GithubSettings, Session, Weights } from "./types";

const DRAFT = "gym-draft";
const LOGS = "gym-logs";
const WEIGHTS = "gym-weights";
const GITHUB = "gym-github";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
  return read<GithubSettings>(GITHUB, {
    token: "",
    owner: "",
    repo: "training-plan",
    branch: "main",
  });
}

export function saveGithub(settings: GithubSettings): void {
  localStorage.setItem(GITHUB, JSON.stringify(settings));
}

export function mergeWeights(current: Weights, next: Weights): Weights {
  return { ...current, ...next };
}
