import type { GithubSettings, Session, Weights } from "./types";
import { sessionFilename } from "./progression";

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

async function putFile(
  settings: GithubSettings,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const { owner, repo, branch, token } = settings;
  const api = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let sha: string | undefined;
  const existing = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, {
    headers,
  });
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
    const text = await res.text();
    throw new Error(text.slice(0, 280) || `GitHub ${res.status}`);
  }
}

export async function commitSession(
  settings: GithubSettings,
  session: Session,
  weights: Weights,
): Promise<void> {
  if (!settings.token || !settings.owner || !settings.repo) {
    throw new Error("Заполни token, owner и repo в настройках");
  }
  const file = sessionFilename(session.date, session.day);
  await putFile(
    settings,
    `data/logs/${file}`,
    JSON.stringify(session, null, 2) + "\n",
    `log: день ${session.day} ${session.date}`,
  );
  await putFile(
    settings,
    "data/weights.json",
    JSON.stringify(weights, null, 2) + "\n",
    `weights: после дня ${session.day} ${session.date}`,
  );
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareOrCopy(filename: string, data: unknown): Promise<string> {
  const text = JSON.stringify(data, null, 2) + "\n";
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  try {
    const file = new File([text], filename, { type: "application/json" });
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return "Отправлено";
    }
  } catch {
    /* fall through */
  }
  await navigator.clipboard.writeText(text);
  return "Скопировано в буфер";
}
