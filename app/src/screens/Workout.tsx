import type { Program, QueueItem, QueueSet } from "../types";
import { formatKg, formatRest } from "../progression";
import { remainingExercises } from "../session";
import { Stepper } from "../components/Stepper";
import { ActionBar } from "../components/ActionBar";
import { ProgressBar } from "../components/ProgressBar";
import { TopBar } from "../components/TopBar";

type Props = {
  day: string;
  item: QueueItem;
  queue: QueueItem[];
  queueIndex: number;
  program: Program;
  weightKg: number;
  reps: number;
  progressDone: number;
  progressTotal: number;
  onWeight: (n: number) => void;
  onReps: (n: number) => void;
  onDone: () => void;
  onBack: () => void;
  onHome: () => void;
  onSkipExercise: () => void;
};

export function Workout({
  day,
  item,
  queue,
  queueIndex,
  program,
  weightKg,
  reps,
  progressDone,
  progressTotal,
  onWeight,
  onReps,
  onDone,
  onBack,
  onHome,
  onSkipExercise,
}: Props) {
  const progressLabel = `Подход ${progressDone} из ${progressTotal}`;
  if (item.type === "warmup") {
    return (
      <div className="shell shell--bar stack">
        <TopBar
          left={
            <button type="button" className="text-button" onClick={onHome}>
              На главную
            </button>
          }
          right={<span className="pill">День {day}</span>}
        >
          Разминка
        </TopBar>
        <ProgressBar value={0} max={progressTotal} label={progressLabel} />
        <h1>Разогрейся</h1>
        <div className="card stack">
          <p>Вело {program.warmup.bikeMin} мин</p>
          <p>Гипер без диска {program.warmup.hyper} — не рабочее</p>
        </div>
        <ActionBar>
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Дальше
          </button>
        </ActionBar>
      </div>
    );
  }

  return (
    <SetCard
      day={day}
      item={item}
      queue={queue}
      queueIndex={queueIndex}
      weightKg={weightKg}
      reps={reps}
      progressDone={progressDone}
      progressTotal={progressTotal}
      onWeight={onWeight}
      onReps={onReps}
      onDone={onDone}
      onBack={onBack}
      onHome={onHome}
      onSkipExercise={onSkipExercise}
    />
  );
}

function SetCard({
  day,
  item,
  queue,
  queueIndex,
  weightKg,
  reps,
  progressDone,
  progressTotal,
  onWeight,
  onReps,
  onDone,
  onBack,
  onHome,
  onSkipExercise,
}: {
  day: string;
  item: QueueSet;
  queue: QueueItem[];
  queueIndex: number;
  weightKg: number;
  reps: number;
  progressDone: number;
  progressTotal: number;
  onWeight: (n: number) => void;
  onReps: (n: number) => void;
  onDone: () => void;
  onBack: () => void;
  onHome: () => void;
  onSkipExercise: () => void;
}) {
  const upcoming = remainingExercises(queue, queueIndex);
  const nextItem = queue[queueIndex + 1];
  const clusterHint =
    item.restAfterSec === 0 && nextItem?.type === "set"
      ? "Дальше сразу следующий элемент пары"
      : item.restAfterSec > 0
        ? `Отдых ${formatRest(item.restAfterSec)}`
        : "Потом итог";

  return (
    <div className="shell shell--bar stack">
      <TopBar
        left={
          <button type="button" className="text-button" onClick={onBack}>
            ← Назад
          </button>
        }
        right={
          <button type="button" className="text-button" onClick={onHome}>
            На главную
          </button>
        }
      >
        <span className="pill">День {day}</span>
      </TopBar>

      <ProgressBar
        value={progressDone}
        max={progressTotal}
        label={`Подход ${progressDone} из ${progressTotal}`}
      />

      <div className="card set-card">
        <div className="set-num">
          {item.kind === "ramp" ? "Рамп" : "Рабочий"} · подход {item.setNumber} / {item.totalSets}
        </div>
        <div className="set-name">{item.name}</div>
        <p className="target">
          Цель {formatKg(item.targetWeightKg)} кг · {item.repsMin}–{item.repsMax} повт.
          {item.rir ? ` · RIR ${item.rir}` : ""}
        </p>
        <div className="next-hint">{clusterHint}</div>
      </div>

      <div className="card stack">
        <Stepper
          label="Вес, кг"
          value={weightKg}
          step={2.5}
          format={formatKg}
          onChange={onWeight}
        />
        <Stepper
          label="Повторы"
          value={reps}
          step={1}
          min={0}
          format={(n) => String(Math.round(n))}
          onChange={(n) => onReps(Math.max(0, Math.round(n)))}
        />
      </div>

      <div className="exercise-menu">
        <button type="button" className="text-button" onClick={onSkipExercise}>
          Тренажёр занят — пропустить упражнение
        </button>
      </div>

      {upcoming.length > 0 ? (
        <div>
          <h2>Дальше</h2>
          <ul className="list">
            {upcoming.map((exercise) => (
              <li key={exercise.name} className={exercise.current ? "current" : undefined}>
                {exercise.current ? "Сейчас · " : ""}
                {exercise.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ActionBar>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Готово
        </button>
      </ActionBar>
    </div>
  );
}
