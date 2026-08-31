import type { Program, QueueItem, QueueSet } from "../types";
import { formatKg, formatRest } from "../progression";
import { remainingExercises } from "../session";
import { Stepper } from "../components/Stepper";

type Props = {
  day: string;
  item: QueueItem;
  queue: QueueItem[];
  queueIndex: number;
  program: Program;
  weightKg: number;
  reps: number;
  onWeight: (n: number) => void;
  onReps: (n: number) => void;
  onDone: () => void;
  onHome: () => void;
};

export function Workout({
  day,
  item,
  queue,
  queueIndex,
  program,
  weightKg,
  reps,
  onWeight,
  onReps,
  onDone,
  onHome,
}: Props) {
  if (item.type === "warmup") {
    return (
      <div className="shell stack">
        <div className="topbar">
          <span className="pill">День {day}</span>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            На старт
          </button>
        </div>
        <h1>Разминка</h1>
        <div className="card stack">
          <p>Вело {program.warmup.bikeMin} мин</p>
          <p>Гипер без диска {program.warmup.hyper} — не рабочее</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Дальше
        </button>
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
      onWeight={onWeight}
      onReps={onReps}
      onDone={onDone}
      onHome={onHome}
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
  onWeight,
  onReps,
  onDone,
  onHome,
}: {
  day: string;
  item: QueueSet;
  queue: QueueItem[];
  queueIndex: number;
  weightKg: number;
  reps: number;
  onWeight: (n: number) => void;
  onReps: (n: number) => void;
  onDone: () => void;
  onHome: () => void;
}) {
  const upcoming = remainingExercises(queue, queueIndex);
  const restHint =
    item.restAfterSec === 0 && item.exerciseId === "hammer1"
      ? "Дальше сразу вторая рука / широко"
      : item.restAfterSec > 0
        ? `Отдых ${formatRest(item.restAfterSec)}`
        : "Потом итог";

  return (
    <div className="shell stack">
      <div className="topbar">
        <span className="pill">День {day}</span>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          На старт
        </button>
      </div>

      <div className="card">
        <div className="set-num">
          {item.kind === "ramp" ? "Рамп" : "Рабочий"} · подход {item.setNumber} / {item.totalSets}
        </div>
        <div className="set-name">{item.name}</div>
        <p className="target">
          Цель {formatKg(item.targetWeightKg)} кг · {item.repsMin}–{item.repsMax} повт.
          {item.rir ? ` · RIR ${item.rir}` : ""}
        </p>
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

      <button type="button" className="btn btn-primary" onClick={onDone}>
        Готово
      </button>
      <p className="hint">{restHint}</p>

      {upcoming.length > 0 ? (
        <div>
          <h2>Дальше</h2>
          <ul className="list">
            {upcoming.map((ex) => (
              <li key={ex.name} className={ex.current ? "current" : undefined}>
                {ex.current ? "Сейчас · " : ""}
                {ex.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
