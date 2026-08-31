import { useEffect, useMemo, useRef, useState } from "react";
import programJson from "../../data/program.json";
import { Home } from "./screens/Home";
import { Rest } from "./screens/Rest";
import { Settings } from "./screens/Settings";
import { Summary } from "./screens/Summary";
import { Workout } from "./screens/Workout";
import { commitSession, downloadJson, shareOrCopy } from "./github";
import { sessionFilename, suggestWeights, todayIso } from "./progression";
import {
  appendSet,
  buildQueue,
  defaultsForSet,
  nextDay,
} from "./session";
import {
  clearDraft,
  loadDraft,
  loadGithub,
  loadLogs,
  loadWeights,
  mergeWeights,
  saveDraft,
  saveGithub,
  saveLogs,
  saveWeights,
} from "./storage";
import type {
  DayId,
  DraftSession,
  ExerciseLog,
  GithubSettings,
  Program,
  Session,
  View,
} from "./types";

const program = programJson as Program;

export function App() {
  const [weights, setWeights] = useState(loadWeights);
  const [logs, setLogs] = useState(loadLogs);
  const [draft, setDraft] = useState<DraftSession | null>(loadDraft);
  const [view, setView] = useState<View>(() => viewFromDraft(loadDraft()));
  const [pickedDay, setPickedDay] = useState<DayId>(() => nextDay(loadLogs()));
  const [github, setGithub] = useState(loadGithub);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const restLock = useRef(false);

  const queue = useMemo(
    () => (draft ? buildQueue(draft.day, program, weights) : []),
    [draft, weights],
  );

  useEffect(() => {
    if (view !== "workout" && view !== "rest") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    let sentinel: { release: () => Promise<void> } | undefined;
    const grab = () => {
      nav.wakeLock
        ?.request("screen")
        .then((s) => {
          sentinel = s;
        })
        .catch(() => undefined);
    };
    grab();
    const onVis = () => {
      if (document.visibilityState === "visible") grab();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release();
    };
  }, [view]);

  useEffect(() => {
    if (view !== "rest") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [view]);

  useEffect(() => {
    if (view !== "rest" || !draft?.restEndsAt) return;
    if (Date.now() < draft.restEndsAt) return;
    const token = String(draft.restEndsAt);
    if (sessionStorage.getItem("gym-rest-consumed") === token) return;
    sessionStorage.setItem("gym-rest-consumed", token);
    restLock.current = true;
    try {
      navigator.vibrate?.(200);
    } catch {
      /* ignore */
    }
    enterIndex(draft, draft.logs, draft.queueIndex + 1);
  }, [view, draft, tick]);

  function persist(next: DraftSession) {
    setDraft(next);
    saveDraft(next);
  }

  function enterIndex(base: DraftSession, sessionLogs: ExerciseLog[], index: number) {
    if (index >= queue.length && queue.length > 0) {
      goSummary({ ...base, logs: sessionLogs });
      return;
    }
    const built = buildQueue(base.day, program, weights);
    if (index >= built.length) {
      goSummary({ ...base, logs: sessionLogs });
      return;
    }
    const item = built[index];
    let currentWeightKg = base.currentWeightKg;
    let currentReps = base.currentReps;
    if (item.type === "set") {
      const d = defaultsForSet(item, sessionLogs);
      currentWeightKg = d.weightKg;
      currentReps = d.reps;
    }
    persist({
      ...base,
      logs: sessionLogs,
      queueIndex: index,
      currentWeightKg,
      currentReps,
      phase: "workout",
      restEndsAt: undefined,
      restTotalSec: undefined,
    });
    setView("workout");
  }

  function goSummary(base: DraftSession) {
    const suggested = suggestWeights(base.day, program, base.logs);
    persist({
      ...base,
      phase: "summary",
      confirmedWeights:
        Object.keys(base.confirmedWeights).length > 0 ? base.confirmedWeights : suggested,
      restEndsAt: undefined,
      restTotalSec: undefined,
    });
    setView("summary");
  }

  function start(day: DayId) {
    restLock.current = false;
    persist({
      date: todayIso(),
      day,
      cycle: program.cycle,
      queueIndex: 0,
      logs: [],
      currentWeightKg: 0,
      currentReps: 0,
      phase: "workout",
      confirmedWeights: {},
    });
    setView("workout");
  }

  function completeCurrent() {
    if (!draft) return;
    const item = queue[draft.queueIndex];
    if (!item) return;
    if (item.type === "warmup") {
      enterIndex(draft, draft.logs, draft.queueIndex + 1);
      return;
    }
    const sessionLogs = appendSet(
      draft.logs,
      item,
      draft.currentWeightKg,
      draft.currentReps,
    );
    if (draft.queueIndex + 1 >= queue.length) {
      goSummary({ ...draft, logs: sessionLogs });
      return;
    }
    if (item.restAfterSec > 0) {
      restLock.current = false;
      persist({
        ...draft,
        logs: sessionLogs,
        phase: "rest",
        restEndsAt: Date.now() + item.restAfterSec * 1000,
        restTotalSec: item.restAfterSec,
      });
      setView("rest");
      return;
    }
    enterIndex({ ...draft, logs: sessionLogs }, sessionLogs, draft.queueIndex + 1);
  }

  function buildSession(d: DraftSession): Session {
    return {
      date: d.date,
      day: d.day,
      cycle: d.cycle,
      exercises: d.logs,
      completedAt: new Date().toISOString(),
    };
  }

  function saveLocal(d: DraftSession): { session: Session; nextWeights: typeof weights } {
    const session = buildSession(d);
    const nextLogs = [...logs, session];
    const nextWeights = mergeWeights(weights, d.confirmedWeights);
    saveLogs(nextLogs);
    saveWeights(nextWeights);
    setLogs(nextLogs);
    setWeights(nextWeights);
    clearDraft();
    setDraft(null);
    setPickedDay(nextDay(nextLogs));
    setView("home");
    return { session, nextWeights };
  }

  const last = logs.filter((s) => s.completedAt).at(-1);
  const remainingMs = draft?.restEndsAt ? draft.restEndsAt - Date.now() : 0;

  if (view === "settings") {
    return (
      <Settings
        value={github}
        onChange={(next: GithubSettings) => {
          setGithub(next);
          saveGithub(next);
        }}
        onBack={() => setView(draft ? draft.phase : "home")}
      />
    );
  }

  if (view === "summary" && draft) {
    return (
      <Summary
        draft={draft}
        program={program}
        status={status}
        busy={busy}
        onWeight={(id, kg) =>
          persist({ ...draft, confirmedWeights: { ...draft.confirmedWeights, [id]: kg } })
        }
        onSave={() => {
          saveLocal(draft);
          setStatus("Сохранено на телефоне");
        }}
        onDownload={() =>
          downloadJson(sessionFilename(draft.date, draft.day), buildSession(draft))
        }
        onShare={() => {
          void shareOrCopy(sessionFilename(draft.date, draft.day), buildSession(draft))
            .then(setStatus)
            .catch(() => setStatus("Не удалось поделиться"));
        }}
        onGithub={() => {
          setBusy(true);
          setStatus("");
          const { session, nextWeights } = saveLocal(draft);
          commitSession(github, session, nextWeights)
            .then(() => setStatus("Закоммичено в GitHub"))
            .catch((err: unknown) =>
              setStatus(err instanceof Error ? err.message : "Ошибка GitHub"),
            )
            .finally(() => setBusy(false));
        }}
      />
    );
  }

  if (view === "rest" && draft) {
    return (
      <Rest
        remainingMs={remainingMs}
        totalSec={draft.restTotalSec ?? 0}
        onSkip={() => {
          restLock.current = true;
          enterIndex(draft, draft.logs, draft.queueIndex + 1);
        }}
        onPlus30={() =>
          persist({
            ...draft,
            restEndsAt: (draft.restEndsAt ?? Date.now()) + 30_000,
            restTotalSec: (draft.restTotalSec ?? 0) + 30,
          })
        }
      />
    );
  }

  if (view === "workout" && draft && queue[draft.queueIndex]) {
    return (
      <Workout
        day={draft.day}
        item={queue[draft.queueIndex]}
        queue={queue}
        queueIndex={draft.queueIndex}
        program={program}
        weightKg={draft.currentWeightKg}
        reps={draft.currentReps}
        onWeight={(n) => persist({ ...draft, currentWeightKg: n })}
        onReps={(n) => persist({ ...draft, currentReps: n })}
        onDone={completeCurrent}
        onHome={() => setView("home")}
      />
    );
  }

  return (
    <Home
      day={pickedDay}
      hasDraft={Boolean(draft)}
      last={last}
      program={program}
      onPickDay={setPickedDay}
      onStart={() => start(pickedDay)}
      onResume={() => setView(draft?.phase === "rest" ? "rest" : draft?.phase === "summary" ? "summary" : "workout")}
      onDiscard={() => {
        clearDraft();
        setDraft(null);
        setView("home");
      }}
      onSettings={() => setView("settings")}
      status={status}
    />
  );
}

function viewFromDraft(d: DraftSession | null): View {
  if (!d) return "home";
  if (d.phase === "rest") return "rest";
  if (d.phase === "summary") return "summary";
  return "workout";
}
