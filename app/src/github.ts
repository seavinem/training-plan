import type { GithubSettings, Session, Weights } from "./types";
import { sessionFilename, todayIso } from "./progression";

export const REPORT_DEST = {
  owner: "seavinem",
  repo: "training-plan",
  branch: "master",
} as const;

export function withToken(token: string): GithubSettings {
  return { token: token.trim(), ...REPORT_DEST };
}

export function resolveToken(settings: GithubSettings): string {
  const fromEnv = (import.meta.env.VITE_REPORT_TOKEN as string | undefined)?.trim() ?? "";
  return fromEnv || settings.token?.trim() || "";
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

const SEND_FAIL = "Отчёт не ушёл. Нажми ещё раз.";

type PutError = Error & { status?: number };

function fail(status?: number): PutError {
  const err = new Error(SEND_FAIL) as PutError;
  err.status = status;
  return err;
}

async function putFileOnBranch(
  token: string,
  branch: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const api = `https://api.github.com/repos/${REPORT_DEST.owner}/${REPORT_DEST.repo}/contents/${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function shaOf(): Promise<string | undefined> {
    const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, {
      headers,
      cache: "no-store",
    });
    if (!existing.ok) return undefined;
    const body = (await existing.json()) as { sha?: string };
    return body.sha;
  }

  async function put(sha?: string): Promise<Response> {
    return fetch(api, {
      method: "PUT",
      cache: "no-store",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: toBase64(content),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
  }

  let sha = await shaOf();
  let res = await put(sha);
  if (res.status === 409 || res.status === 422) {
    sha = await shaOf();
    res = await put(sha);
  }
  if (!res.ok) throw fail(res.status);
}

async function putFile(token: string, path: string, content: string, message: string): Promise<void> {
  try {
    await putFileOnBranch(token, REPORT_DEST.branch, path, content, message);
  } catch (err) {
    const status = (err as PutError).status;
    if (status === 401 || status === 403) throw err;
    await putFileOnBranch(token, "main", path, content, message);
  }
}

async function writeSession(token: string, session: Session, weights: Weights): Promise<void> {
  const file = sessionFilename(session.date, session.day);
  await putFile(
    token,
    `data/logs/${file}`,
    JSON.stringify(session, null, 2) + "\n",
    `log: день ${session.day} ${session.date}`,
  );
  await putFile(
    token,
    "data/weights.json",
    JSON.stringify(weights, null, 2) + "\n",
    `weights: после дня ${session.day} ${session.date}`,
  );
}

export async function commitSession(
  settings: GithubSettings,
  session: Session,
  weights: Weights,
): Promise<void> {
  const token = resolveToken(settings);
  if (!token) throw fail();
  await writeSession(token, session, weights);
}

export async function commitAllLogs(
  settings: GithubSettings,
  sessions: Session[],
  weights: Weights,
): Promise<void> {
  const token = resolveToken(settings);
  if (!token) throw fail();
  const done = sessions.filter((s) => s.completedAt);
  if (done.length === 0) throw fail();
  for (const session of done) {
    const file = sessionFilename(session.date, session.day);
    await putFile(
      token,
      `data/logs/${file}`,
      JSON.stringify(session, null, 2) + "\n",
      `log: день ${session.day} ${session.date}`,
    );
  }
  const last = done[done.length - 1];
  await putFile(
    token,
    "data/weights.json",
    JSON.stringify(weights, null, 2) + "\n",
    `weights: после дня ${last.day} ${last.date}`,
  );
}

export async function shareReport(sessions: Session[], weights: Weights): Promise<"shared" | "copied"> {
  const payload = { sessions: sessions.filter((s) => s.completedAt), weights };
  const text = JSON.stringify(payload, null, 2) + "\n";
  const filename = `gym-report-${todayIso()}.json`;
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  try {
    const file = new File([text], filename, { type: "application/json" });
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
