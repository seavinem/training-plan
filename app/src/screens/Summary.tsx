import { useState } from "react";
import type { DraftSession, Exercise, Program, Weights } from "../types";
import { formatKg } from "../progression";
import { findExercise } from "../session";
import { ActionBar } from "../components/ActionBar";
import { Banner } from "../components/Banner";
import { Stepper } from "../components/Stepper";
import { TopBar } from "../components/TopBar";

type Props = {
  draft: DraftSession;
  program: Program;
  status?: string;
  statusTone?: "ok" | "err" | "info";
  busy: boolean;
  sendState: "idle" | "sending" | "ok" | "failed";
  suggestions: Weights;
  onUpdateSet: (
    exerciseId: string,
    setIndex: number,
    patch: { weightKg?: number; reps?: number },
  ) => void;
  onWeightConfirm: (exerciseId: string, weightKg: number) => void;
  onSend: () => void;
  onHome: () => void;
};

export function Summary({
  draft,
  program,
  status,
  statusTone = "info",
  busy,
  sendState,
  suggestions,
  onUpdateSet,
  onWeightConfirm,
  onSend,
  onHome,
}: Props) {
  const totalSets = draft.logs.reduce((total, row) => total + row.sets.length, 0);
  const duration = draft.startedAt ? Math.max(0, Math.round((Date.now() - draft.startedAt) / 1000)) : 0;

  return (
    <div className="shell shell--bar stack">
      <TopBar
        left={<span className="pill">День {draft.day}</span>}
        right={<span className="chip">{totalSets} подходов</span>}
      >
        Итог
      </TopBar>
      <h1>Тренировка готова</h1>
      <p className="muted">
        {totalSets} подходов{duration > 0 ? ` · ${formatDuration(duration)}` : ""}.
        Проверь записи перед отправкой.
      </p>

      {status ? <Banner tone={statusTone}>{status}</Banner> : null}
      {sendState === "sending" ? <Banner>Отправляю отчёт…</Banner> : null}

      <div className="card stack">
        <h2>Что сделал</h2>
        {program.days[draft.day].exercises.map((exercise) => (
          <ExerciseRow
            key={exercise.id}
            ex={exercise}
            draft={draft}
            program={program}
            onUpdateSet={onUpdateSet}
          />
        ))}
      </div>

      <div className="card stack">
        <h2>Веса на следующий раз</h2>
        <p className="hint">Поправь, если поднимал не так. Эти значения попадут в следующий день.</p>
        {program.days[draft.day].exercises.map((exercise) => {
          const current = draft.confirmedWeights[exercise.id] ?? exercise.weightKg;
          const suggested = suggestions[exercise.id];
          return (
            <div className="weight-row" key={exercise.id}>
              <div className="grow">
                <strong>{exercise.name}</strong>
                {suggested && suggested > current ? (
                  <span className="increase-badge">+{formatKg(suggested - current)}</span>
                ) : null}
              </div>
              <div className="summary-weight">
                <Stepper
                  label="кг"
                  value={current}
                  step={2.5}
                  format={formatKg}
                  onChange={(value) => onWeightConfirm(exercise.id, value)}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ActionBar className="action-bar-split">
        <button type="button" className="btn" disabled={busy || sendState !== "failed"} onClick={onSend}>
          Повторить отправку
        </button>
        <button type="button" className="btn btn-primary" onClick={onHome}>
          На главную
        </button>
      </ActionBar>
    </div>
  );
}

function ExerciseRow({
  ex,
  draft,
  program,
  onUpdateSet,
}: {
  ex: Exercise;
  draft: DraftSession;
  program: Program;
  onUpdateSet: Props["onUpdateSet"];
}) {
  const [expanded, setExpanded] = useState(false);
  const log = draft.logs.find((row) => row.id === ex.id);
  const sets = log?.sets ?? [];
  const meta = findExercise(program, ex.id) ?? ex;

  return (
    <div className="summary-exercise">
      <button type="button" className="summary-toggle" onClick={() => setExpanded((value) => !value)}>
        <span>
          <strong>{meta.name}</strong>
          <span className="summary-facts">
            {sets.length > 0
              ? sets.map((set) => `${formatKg(set.weightKg)}×${set.reps}`).join(" · ")
              : "нет записей"}
          </span>
        </span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded
        ? sets.map((set, index) => (
            <div className="compact-set" key={`${ex.id}-${index}`}>
              <span>Подход {index + 1}</span>
              <Stepper
                label="кг"
                value={set.weightKg}
                step={2.5}
                format={formatKg}
                onChange={(weightKg) => onUpdateSet(ex.id, index, { weightKg })}
              />
              <Stepper
                label="повт."
                value={set.reps}
                step={1}
                format={(value) => String(Math.round(value))}
                onChange={(reps) => onUpdateSet(ex.id, index, { reps: Math.round(reps) })}
              />
            </div>
          ))
        : null}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}
