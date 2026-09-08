import { useEffect, useMemo, useRef, useState } from "react";
import {
  AuthError,
  authenticate,
  BusyError,
  loadState,
  pollRun,
  report,
  startChat,
  workerConfigured,
} from "./api";
import { Chat } from "./screens/Chat";
import { Home } from "./screens/Home";
import { Pin } from "./screens/Pin";
import { Rest } from "./screens/Rest";
import { Summary } from "./screens/Summary";
import { Workout } from "./screens/Workout";
import { suggestWeights, todayIso } from "./progression";
import { appendSet, buildQueue, defaultsForSet, nextDay } from "./session";
import {
  applyRemote,
  clearActiveRun,
  clearDraft,
  clearLastSendError,
  clearPendingRemote,
  clearPin,
  loadActiveRun,
  loadAgentId,
  loadChat,
  loadDraft,
  loadLastSendError,
  loadLogs,
  loadPendingRemote,
  loadPin,
  loadProgram,
  loadSent,
  loadWeights,
  markSent,
  mergeWeights,
  saveActiveRun,
  saveAgentId,
  saveChat,
  saveDraft,
  saveLastSendError,
  saveLogs,
  savePin,
  savePendingRemote,
  saveWeights,
  unsyncedLogs,
} from "./storage";
import type {
  ActiveRun,
  ChatMessage,
  DayId,
  DraftSession,
  ExerciseLog,
  Program,
  Session,
  View,
  Weights,
} from "./types";

const SEND_FAIL = "Отчёт не ушёл — уйдёт, когда будет сеть.";
const SEND_OK = "Отчёт ушёл";

export function App() {
  const [program, setProgram] = useState<Program>(loadProgram);
  const [weights, setWeights] = useState(loadWeights);
  const [logs, setLogs] = useState(loadLogs);
  const [sent, setSent] = useState(loadSent);
  const [draft, setDraft] = useState<DraftSession | null>(loadDraft);
  const [view, setView] = useState<View>(() => viewFromDraft(loadDraft()));
  const [pickedDay, setPickedDay] = useState<DayId>(() => nextDay(loadLogs()));
  const [pin, setPin] = useState(loadPin);
  const [pinError, setPinError] = useState("");
  const [status, setStatus] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [sendState, setSendState] = useState<"idle" | "sending" | "ok" | "failed">("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [agentId, setAgentId] = useState(loadAgentId);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatElapsed, setChatElapsed] = useState(0);
  const [chatError, setChatError] = useState("");
  const [restExpired, setRestExpired] = useState(false);
  const reporting = useRef(new Set<string>());
  const retriedAt = useRef(0);
  const lastDoneTap = useRef(0);
  const chatAbort = useRef<AbortController | null>(null);
  const activeRun = useRef<ActiveRun | null>(loadActiveRun());

  const queue = useMemo(
    () => (draft ? buildQueue(draft.day, program, weights) : []),
    [draft, program, weights],
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
        .then((next) => {
          sentinel = next;
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
    if (view !== "rest" || !draft?.restEndsAt) return;
    const endsAt = draft.restEndsAt;
    const elapsed = Date.now() - endsAt;
    setRestExpired(elapsed > 60_000);
    if (elapsed > 60_000) return;
    const id = window.setTimeout(() => {
      if (Date.now() - endsAt > 60_000) {
        setRestExpired(true);
      } else {
        advanceRest();
      }
    }, Math.max(0, endsAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [view, draft?.queueIndex, draft?.restEndsAt]);

  useEffect(() => {
    if (!pin || view !== "home") return;
    const pending = unsyncedLogs(loadLogs(), loadSent());
    if (pending.length === 0) {
      void pullState();
      return;
    }
    if (Date.now() - retriedAt.current < 60_000) return;
    retriedAt.current = Date.now();
    void deliver(pending, loadWeights());
  }, [pin, view]);

  useEffect(() => {
    if (!pin || view !== "summary" || !draft) return;
    const key = `${draft.date}-${draft.day}`;
    if (sent.includes(key) || reporting.current.has(key)) return;
    reporting.current.add(key);
    const { session, nextWeights } = upsertLocal(draft);
    void deliver([session], nextWeights).finally(() => {
      reporting.current.delete(key);
    });
  }, [pin, view, draft?.date, draft?.day]);

  useEffect(() => {
    const retry = () => {
      if (document.visibilityState !== "visible" || !pin || view !== "home") return;
      if (Date.now() - retriedAt.current < 60_000) return;
      const pending = unsyncedLogs(loadLogs(), loadSent());
      if (pending.length === 0) return;
      retriedAt.current = Date.now();
      void deliver(pending, loadWeights());
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [pin, view]);

  useEffect(() => {
    if (view !== "chat" || chatBusy) return;
    const run = activeRun.current;
    if (!run || Date.now() - run.startedAt > 15 * 60 * 1000) {
      if (run) {
        activeRun.current = null;
        clearActiveRun();
      }
      return;
    }
    setChatBusy(true);
    void resumeRun(run);
  }, [view]);

  function persist(next: DraftSession) {
    setDraft(next);
    saveDraft(next);
  }

  function applyQueuedRemote() {
    const pending = loadPendingRemote();
    if (!pending) return;
    const next = applyRemote(pending.program, pending.weights);
    setProgram(next.program);
    setWeights(next.weights);
    clearPendingRemote();
    if (next.programRejected) setStatus("Коуч прислал битую программу — оставил старую.");
  }

  function enterIndex(base: DraftSession, sessionLogs: ExerciseLog[], index: number) {
    const built = buildQueue(base.day, program, weights);
    if (index >= built.length) {
      goSummary({ ...base, logs: sessionLogs });
      return;
    }
    const item = built[index];
    let currentWeightKg = base.currentWeightKg;
    let currentReps = base.currentReps;
    if (item.type === "set") {
      const defaults = defaultsForSet(item, sessionLogs);
      currentWeightKg = defaults.weightKg;
      currentReps = defaults.reps;
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
    setRestExpired(false);
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
    applyQueuedRemote();
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

  function advanceRest() {
    if (!draft || draft.restDoneIndex === draft.queueIndex) return;
    persist({ ...draft, restDoneIndex: draft.queueIndex });
    enterIndex(
      { ...draft, restDoneIndex: draft.queueIndex },
      draft.logs,
      draft.queueIndex + 1,
    );
  }

  function completeCurrent() {
    if (!draft || Date.now() - lastDoneTap.current < 400) return;
    lastDoneTap.current = Date.now();
    const built = buildQueue(draft.day, program, weights);
    const item = built[draft.queueIndex];
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
    if (draft.queueIndex + 1 >= built.length) {
      goSummary({ ...draft, logs: sessionLogs });
      return;
    }
    if (item.restAfterSec > 0) {
      persist({
        ...draft,
        logs: sessionLogs,
        phase: "rest",
        restDoneIndex: undefined,
        restEndsAt: Date.now() + item.restAfterSec * 1000,
        restTotalSec: item.restAfterSec,
      });
      setRestExpired(false);
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

  function upsertLocal(d: DraftSession): { session: Session; nextWeights: Weights } {
    const session = buildSession(d);
    const nextWeights = mergeWeights(weights, d.confirmedWeights);
    const idx = logs.findIndex((item) => item.date === session.date && item.day === session.day);
    const nextLogs =
      idx >= 0 ? logs.map((item, i) => (i === idx ? session : item)) : [...logs, session];
    saveLogs(nextLogs);
    saveWeights(nextWeights);
    setLogs(nextLogs);
    setWeights(nextWeights);
    return { session, nextWeights };
  }

  function finishHome(nextLogs: Session[]) {
    clearDraft();
    setDraft(null);
    applyQueuedRemote();
    setPickedDay(nextDay(nextLogs));
    setView("home");
  }

  function onAuthFail(error: AuthError) {
    if (!draft && error.kind === "pin") {
      clearPin();
      setPin("");
      setPinError(error.message);
    } else {
      setStatus(
        error.kind === "server"
          ? "Сервер не настроен или временно недоступен. Тренировка сохранена."
          : "Сервер не принял код. Тренировка сохранена, отчёт дошлём.",
      );
    }
  }

  async function pullState() {
    if (!workerConfigured() || !loadPin()) return;
    try {
      const remote = await loadState();
      if (loadDraft()) {
        savePendingRemote(remote);
        return;
      }
      const next = applyRemote(remote.program, remote.weights);
      setProgram(next.program);
      setWeights(next.weights);
      if (next.programRejected) setStatus("Коуч прислал битую программу — оставил старую.");
    } catch (error) {
      if (error instanceof AuthError) onAuthFail(error);
      else setStatus(error instanceof Error ? error.message : "Не удалось обновить программу.");
    }
  }

  async function deliver(sessions: Session[], nextWeights: Weights): Promise<boolean> {
    setReportBusy(true);
    setSendState("sending");
    setStatus("");
    try {
      const result = await report(sessions, nextWeights);
      const merged = result.weights;
      if (merged) {
        saveWeights(merged);
        setWeights(merged);
      }
      setSent(markSent(sessions));
      clearLastSendError();
      setSendState("ok");
      setStatus(SEND_OK);
      return true;
    } catch (error) {
      saveLastSendError();
      setSendState("failed");
      if (error instanceof AuthError) onAuthFail(error);
      else setStatus(error instanceof Error ? error.message || SEND_FAIL : SEND_FAIL);
      return false;
    } finally {
      setReportBusy(false);
    }
  }

  function sendPending() {
    const pending = unsyncedLogs(logs, sent);
    void deliver(
      pending.length > 0 ? pending : logs.filter((item) => item.completedAt),
      weights,
    );
  }

  function setMessageState(id: string, state: ChatMessage["state"]) {
    setMessages((current) => {
      const next = current.map((message) => (message.id === id ? { ...message, state } : message));
      saveChat(next);
      return next;
    });
  }

  function addAssistant(text: string, userId: string, result: { program?: Program | null; weights?: Weights | null; warning?: string }) {
    setMessageState(userId, "sent");
    const assistant: ChatMessage = {
      id: makeId(),
      role: "assistant",
      text: result.warning ? `${text}\n\n${result.warning}` : text,
      state: "sent",
    };
    setMessages((current) => {
      const next = [...current, assistant];
      saveChat(next);
      return next;
    });
    if (loadDraft()) {
      savePendingRemote({ program: result.program ?? null, weights: result.weights ?? null });
      return;
    }
    const next = applyRemote(result.program, result.weights);
    setProgram(next.program);
    setWeights(next.weights);
    if (next.programRejected) setChatError("Коуч прислал битую программу — оставил старую.");
  }

  async function finishRun(run: ActiveRun, userId?: string) {
    const startedAt = run.startedAt;
    for (;;) {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setChatElapsed(elapsed);
      const delay = elapsed < 30 ? 2_000 : elapsed < 180 ? 5_000 : 10_000;
      await wait(delay, chatAbort.current?.signal);
      const current = await pollRun(run.agentId, run.runId, run.baseSha, chatAbort.current?.signal);
      if (current.status !== "pending") {
        clearActiveRun();
        activeRun.current = null;
        if (userId) addAssistant(current.text || "Готово.", userId, current);
        setChatError(current.status === "error" ? current.text : current.warning ?? "");
        return;
      }
      if (Date.now() - startedAt >= 10 * 60 * 1000) {
        throw new Error("Коуч не ответил за 10 минут. Он может ещё дописывать — загляни позже.");
      }
    }
  }

  async function resumeRun(run: ActiveRun) {
    try {
      await finishRun(run);
    } catch (error) {
      if (isAbort(error)) return;
      setChatError(error instanceof Error ? error.message : "Коуч не ответил.");
    } finally {
      setChatBusy(false);
    }
  }

  async function sendChat(text: string) {
    const userId = makeId();
    const userMessage: ChatMessage = { id: userId, role: "user", text, state: "sending" };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    saveChat(nextMessages);
    setChatBusy(true);
    setChatError("");
    setChatElapsed(0);
    const controller = new AbortController();
    chatAbort.current = controller;
    try {
      const started = await startChat(text, agentId || null, controller.signal);
      if (started.agentId) {
        setAgentId(started.agentId);
        saveAgentId(started.agentId);
      }
      if (started.status === "pending") {
        const run: ActiveRun = {
          agentId: started.agentId,
          runId: started.runId,
          startedAt: Date.now(),
          baseSha: started.baseSha,
        };
        activeRun.current = run;
        saveActiveRun(run);
        await finishRun(run, userId);
      } else {
        addAssistant(started.text || "Готово.", userId, started);
        setChatError(started.status === "error" ? started.text : started.warning ?? "");
      }
    } catch (error) {
      if (isAbort(error)) return;
      setMessageState(userId, "failed");
      if (error instanceof AuthError) onAuthFail(error);
      else if (error instanceof BusyError) setChatError(error.message);
      else setChatError(error instanceof Error ? error.message : "Чат не отправился.");
    } finally {
      setChatBusy(false);
      chatAbort.current = null;
    }
  }

  function onChatHome() {
    chatAbort.current?.abort();
    setChatBusy(false);
    setView("home");
  }

  const last = logs.filter((item) => item.completedAt).at(-1);
  const pending = unsyncedLogs(logs, sent).length;

  if (!pin) {
    return (
      <Pin
        error={pinError || (!workerConfigured() ? "Сервер ещё не прописан в сборке." : "")}
        onSubmit={(next) => {
          savePin(next);
          setPin(next);
          setPinError("");
          void authenticate(next).catch(() => undefined);
        }}
      />
    );
  }

  if (view === "chat") {
    return (
      <Chat
        messages={messages}
        busy={chatBusy}
        status={chatError}
        elapsedSec={chatElapsed}
        onSend={(text) => void sendChat(text)}
        onRetry={(text) => void sendChat(text)}
        onHome={onChatHome}
      />
    );
  }

  if (view === "summary" && draft) {
    const key = `${draft.date}-${draft.day}`;
    return (
      <Summary
        draft={draft}
        program={program}
        status={status}
        busy={reportBusy}
        sendState={sent.includes(key) ? "ok" : sendState}
        onSend={() => {
          const { session, nextWeights } = upsertLocal(draft);
          void deliver([session], nextWeights);
        }}
        onHome={() => finishHome(loadLogs())}
      />
    );
  }

  if (view === "rest" && draft?.restEndsAt) {
    return (
      <Rest
        endsAt={draft.restEndsAt}
        totalSec={draft.restTotalSec ?? 0}
        expired={restExpired}
        onSkip={advanceRest}
        onPlus30={() => {
          persist({
            ...draft,
            restEndsAt: draft.restEndsAt! + 30_000,
            restTotalSec: (draft.restTotalSec ?? 0) + 30,
            restDoneIndex: undefined,
          });
          setRestExpired(false);
        }}
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
        onWeight={(value) => persist({ ...draft, currentWeightKg: value })}
        onReps={(value) => persist({ ...draft, currentReps: value })}
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
      busy={reportBusy}
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
      onChat={() => {
        setStatus("");
        setView("chat");
      }}
      status={status || (loadLastSendError() ? SEND_FAIL : "")}
    />
  );
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    const abort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Отменено", "AbortError"));
    };
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function viewFromDraft(draft: DraftSession | null): View {
  if (!draft) return "home";
  if (draft.phase === "rest") return "rest";
  if (draft.phase === "summary") return "summary";
  return "workout";
}
