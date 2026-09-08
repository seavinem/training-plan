import type {
  DayId,
  Exercise,
  ExerciseLog,
  Program,
  QueueItem,
  QueueSet,
  Weights,
} from "./types";

export function findExercise(program: Program, id: string): Exercise | undefined {
  for (const day of Object.values(program.days)) {
    const found = day.exercises.find((ex) => ex.id === id);
    if (found) return found;
  }
  return undefined;
}

export function workingWeight(weights: Weights, ex: Exercise): number {
  return weights[ex.id] ?? ex.weightKg;
}

export function buildQueue(
  day: DayId,
  program: Program,
  weights: Weights,
): QueueItem[] {
  const d = program.days[day];
  const items: QueueItem[] = [{ type: "warmup" }];

  if (d.ramp) {
    const ex = findExercise(program, d.ramp.exerciseId);
    const name = ex ? `${ex.name} · рамп` : "Рамп";
    const n = d.ramp.sets.length;
    for (let i = 0; i < n; i++) {
      const s = d.ramp.sets[i];
      items.push({
        type: "set",
        exerciseId: d.ramp.exerciseId,
        name,
        setNumber: i + 1,
        totalSets: n,
        kind: "ramp",
        targetWeightKg: s.weightKg,
        repsMin: s.reps,
        repsMax: s.reps,
        restAfterSec: d.ramp.restSec,
      });
    }
  }

  const consumed = new Set<string>();
  for (const ex of d.exercises) {
    if (consumed.has(ex.id)) continue;

    if (ex.clusterPair) {
      const pair = d.exercises.find((e) => e.id === ex.clusterPair);
      if (!pair) continue;
      consumed.add(pair.id);
      const w1 = workingWeight(weights, ex);
      const w2 = workingWeight(weights, pair);
      for (let i = 0; i < ex.sets; i++) {
        items.push({
          type: "set",
          exerciseId: ex.id,
          name: ex.name,
          setNumber: i + 1,
          totalSets: ex.sets,
          kind: "work",
          targetWeightKg: w1,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          rir: ex.rir,
          restAfterSec: 0,
        });
        items.push({
          type: "set",
          exerciseId: pair.id,
          name: pair.name,
          setNumber: i + 1,
          totalSets: pair.sets,
          kind: "work",
          targetWeightKg: w2,
          repsMin: pair.repsMin,
          repsMax: pair.repsMax,
          rir: pair.rir,
          restAfterSec: pair.restSec,
        });
      }
      continue;
    }

    const w = workingWeight(weights, ex);
    for (let i = 0; i < ex.sets; i++) {
      items.push({
        type: "set",
        exerciseId: ex.id,
        name: ex.name,
        setNumber: i + 1,
        totalSets: ex.sets,
        kind: "work",
        targetWeightKg: w,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        rir: ex.rir,
        restAfterSec: ex.restSec,
      });
    }
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === "set") {
      item.restAfterSec = 0;
      break;
    }
  }

  return items;
}

export function appendSet(
  logs: ExerciseLog[],
  item: QueueSet,
  weightKg: number,
  reps: number,
): ExerciseLog[] {
  const next = logs.map((e) => ({ ...e, sets: [...e.sets] }));
  let row = next.find((e) => e.id === item.exerciseId);
  if (!row) {
    row = { id: item.exerciseId, sets: [] };
    next.push(row);
  }
  row.sets.push({
    weightKg,
    reps,
    ...(item.kind === "ramp" ? { ramp: true } : {}),
  });
  return next;
}

export function dropLastSet(logs: ExerciseLog[], exerciseId: string): ExerciseLog[] {
  return logs
    .map((row) =>
      row.id === exerciseId ? { ...row, sets: row.sets.slice(0, -1) } : { ...row, sets: [...row.sets] },
    )
    .filter((row) => row.sets.length > 0);
}

export function updateSet(
  logs: ExerciseLog[],
  exerciseId: string,
  setIndex: number,
  patch: Partial<ExerciseLog["sets"][number]>,
): ExerciseLog[] {
  return logs.map((row) =>
    row.id !== exerciseId
      ? row
      : {
          ...row,
          sets: row.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)),
        },
  );
}

export function defaultsForSet(
  item: QueueSet,
  logs: ExerciseLog[],
): { weightKg: number; reps: number } {
  if (item.kind === "ramp") {
    return { weightKg: item.targetWeightKg, reps: item.repsMin };
  }
  const row = logs.find((e) => e.id === item.exerciseId);
  const prev = row?.sets.filter((s) => Boolean(s.ramp) === (item.kind === "ramp"));
  if (prev && prev.length > 0) {
    const last = prev[prev.length - 1];
    return { weightKg: last.weightKg, reps: last.reps };
  }
  return { weightKg: item.targetWeightKg, reps: item.repsMin };
}

const NEXT: Record<DayId, DayId> = { A: "B", B: "C", C: "A" };

export function nextDay(sessions: { day: DayId; completedAt?: string }[]): DayId {
  const done = sessions.filter((s) => s.completedAt);
  if (done.length === 0) return "B";
  return NEXT[done[done.length - 1].day];
}

export function remainingExercises(
  queue: QueueItem[],
  fromIndex: number,
): { name: string; current: boolean }[] {
  const seen = new Set<string>();
  const out: { name: string; current: boolean }[] = [];
  for (let i = fromIndex; i < queue.length; i++) {
    const item = queue[i];
    if (item.type !== "set" || item.kind === "ramp") continue;
    const key = item.exerciseId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: item.name, current: i === fromIndex });
  }
  return out;
}
