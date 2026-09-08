import { useEffect, useMemo, useRef, useState } from "react";
import programJson from "../../data/program.json";
import { Home } from "./screens/Home";
import { Rest } from "./screens/Rest";
import { Summary } from "./screens/Summary";
import { Workout } from "./screens/Workout";
import { commitAllLogs, commitSession } from "./github";
import { suggestWeights, todayIso } from "./progression";
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
  loadSent,
  loadWeights,
  markSent,
  mergeWeights,
  saveDraft,
  saveLogs,
  saveWeights,
  unsyncedLogs,
} from "./storage";
import type { DayId, DraftSession, ExerciseLog, Program, Session, View } from "./types";

const program = programJson as Program;
const SEND_FAIL = "Отчёт не ушёл. Нажми ещё раз.";

export function App() {
  const [weights, setWeights] = useState(loadWeights);
  const [logs, setLogs] = useState(loadLogs);
  const [sent, setSent] = useState(loadSent);
  const [draft, setDraft] = useState<DraftSession | null>(loadDraft);
  const [view, setView] = useState<View>(() => viewFromDraft(loadDraft()));
  const [pickedDay, setPickedDay] = useState<DayId>(() => nextDay(loadLogs()));
  const [github] = useState(loadGithub);
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
    const next = {
      ...base,
      phase: "summary" as const,
      confirmedWeights:
        Object.keys(base.confirmedWeights).length > 0 ? base.confirmedWeights : suggested,
      restEndsAt: undefined,
      restTotalSec: undefined,
    };
    persist(next);
    upsertLocal(next);
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

  function upsertLocal(d: DraftSession): { session: Session; nextLogs: Session[]; nextWeights: typeof weights } {
    const session = buildSession(d);
    const nextWeights = mergeWeights(weights, d.confirmedWeights);
    const idx = logs.findIndex((s) => s.date === session.date && s.day === session.day);
    const nextLogs =
      idx >= 0 ? logs.map((s, i) => (i === idx ? session : s)) : [...logs, session];
    saveLogs(nextLogs);
    saveWeights(nextWeights);
    setLogs(nextLogs);
    setWeights(nextWeights);
    return { session, nextLogs, nextWeights };
  }

  function finishHome(nextLogs: Session[]) {
    clearDraft();
    setDraft(null);
    setPickedDay(nextDay(nextLogs));
    setView("home");
  }

  function sendDraft(d: DraftSession) {
    setBusy(true);
    setStatus("");
    const { session, nextLogs, nextWeights } = upsertLocal(d);
    commitSession(github, session, nextWeights)
      .then(() => {
        setSent(markSent([session]));
        finishHome(nextLogs);
        setStatus("Отчёт отправлен");
      })
      .catch(() => setStatus(SEND_FAIL))
      .finally(() => setBusy(false));
  }

  function sendPending() {
    setBusy(true);
    setStatus("");
    const pending = unsyncedLogs(logs, sent);
    commitAllLogs(github, pending.length > 0 ? pending : logs, weights)
      .then(() => {
        setSent(markSent(pending.length > 0 ? pending : logs));
        setStatus("Отчёт отправлен");
      })
      .catch(() => setStatus(SEND_FAIL))
      .finally(() => setBusy(false));
  }

  const last = logs.filter((s) => s.completedAt).at(-1);
  const pending = unsyncedLogs(logs, sent).length;
  const remainingMs = draft?.restEndsAt ? draft.restEndsAt - Date.now() : 0;

  if (view === "summary" && draft) {
    return (
      <Summary
        draft={draft}
        program={program}
        status={status}
        busy={busy}
        onSend={() => sendDraft(draft)}
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
      pending={pending}
      program={program}
      busy={busy}
      onPickDay={setPickedDay}
      onStart={() => start(pickedDay)}
      onResume={() =>
        setView(
          draft?.phase === "rest" ? "rest" : draft?.phase === "summary" ? "summary" : "workout",
        )
      }
      onDiscard={() => {
        clearDraft();
        setDraft(null);
        setView("home");
      }}
      onSend={sendPending}
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
