import type { DayId, ExerciseLog, Program, Weights } from "./types";

export function suggestWeights(
  day: DayId,
  program: Program,
  logs: ExerciseLog[],
): Weights {
  const result: Weights = {};
  for (const ex of program.days[day].exercises) {
    const row = logs.find((l) => l.id === ex.id);
    const working = row?.sets.filter((s) => !s.ramp) ?? [];
    if (working.length === 0) continue;
    const lastKg = working[working.length - 1].weightKg;
    const hitTop =
      working.length >= ex.sets && working.every((s) => s.reps >= ex.repsMax);
    result[ex.id] = hitTop ? lastKg + ex.incrementKg : lastKg;
  }
  return result;
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
}

export function formatRest(sec: number): string {
  if (sec <= 0) return "сразу";
  if (sec % 60 === 0) {
    const m = sec / 60;
    return m === 1 ? "1 мин" : `${m} мин`;
  }
  if (sec > 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m} мин ${s} с`;
  }
  return `${sec} с`;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sessionFilename(date: string, day: string): string {
  return `${date}-${day}.json`;
}
