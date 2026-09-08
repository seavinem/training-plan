import type { GithubSettings, Session, Weights } from "./types";
import { sessionFilename } from "./progression";

export const REPORT_DEST = {
  owner: "seavinem",
  repo: "training-plan",
  branch: "master",
} as const;

export function withToken(token: string): GithubSettings {
  return { token: token.trim(), ...REPORT_DEST };
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

function branchCandidates(): string[] {
  return [REPORT_DEST.branch, "master", "main"].filter(
    (branch, i, all) => branch && all.indexOf(branch) === i,
  );
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

  let sha: string | undefined;
  const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (existing.ok) {
    const body = (await existing.json()) as { sha?: string };
    sha = body.sha;
  }

  const res = await fetch(api, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: toBase64(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    throw new Error(SEND_FAIL);
  }
}

async function putFile(token: string, path: string, content: string, message: string): Promise<void> {
  let last: Error = new Error(SEND_FAIL);
  for (const branch of branchCandidates()) {
    try {
      await putFileOnBranch(token, branch, path, content, message);
      return;
    } catch (err) {
      last = err instanceof Error ? err : last;
    }
  }
  throw last;
}

function requireToken(settings: GithubSettings): string {
  const token = settings.token?.trim();
  if (!token) throw new Error(SEND_FAIL);
  return token;
}

export async function commitSession(
  settings: GithubSettings,
  session: Session,
  weights: Weights,
): Promise<void> {
  const token = requireToken(withToken(settings.token));
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

export async function commitAllLogs(
  settings: GithubSettings,
  sessions: Session[],
  weights: Weights,
): Promise<void> {
  const token = requireToken(withToken(settings.token));
  const done = sessions.filter((s) => s.completedAt);
  if (done.length === 0) throw new Error(SEND_FAIL);
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
