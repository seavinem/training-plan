import type { DayId, Session } from "../types";
import { formatKg } from "../progression";
import { findExercise } from "../session";
import type { Program } from "../types";

type Props = {
  day: DayId;
  hasDraft: boolean;
  last: Session | undefined;
  pending: number;
  program: Program;
  busy: boolean;
  onPickDay: (d: DayId) => void;
  onStart: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onSend: () => void;
  status?: string;
};

export function Home({
  day,
  hasDraft,
  last,
  pending,
  program,
  busy,
  onPickDay,
  onStart,
  onResume,
  onDiscard,
  onSend,
  status,
}: Props) {
  return (
    <div className="shell stack">
      <h1>Зал</h1>
      {status ? (
        <div className={`banner ${/не ушл/i.test(status) ? "err" : "ok"}`}>{status}</div>
      ) : null}

      <div className="card">
        <h2>Следующий день</h2>
        <div className="hero-day">{day}</div>
        <div className="day-pick" style={{ marginTop: 14 }}>
          {(["A", "B", "C"] as DayId[]).map((d) => (
            <button
              key={d}
              type="button"
              className="btn"
              aria-pressed={day === d}
              onClick={() => onPickDay(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {hasDraft ? (
        <div className="stack">
          <button type="button" className="btn btn-primary" onClick={onResume}>
            Продолжить тренировку
          </button>
          <button type="button" className="btn btn-danger" onClick={onDiscard}>
            Сбросить черновик
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={onStart}>
          Начать день {day}
        </button>
      )}

      {pending > 0 ? (
        <button type="button" className="btn" disabled={busy} onClick={onSend}>
          {busy ? "Отправляю…" : "Отправить отчёт"}
        </button>
      ) : null}

      {last ? (
        <div className="card">
          <h2>Прошлый раз · день {last.day}</h2>
          <p className="muted" style={{ marginBottom: 8 }}>
            {last.date}
          </p>
          <ul className="list">
            {last.exercises.map((ex) => {
              const meta = findExercise(program, ex.id);
              const work = ex.sets.filter((s) => !s.ramp);
              const lastSet = work[work.length - 1];
              if (!lastSet) return null;
              return (
                <li key={ex.id}>
                  {meta?.name ?? ex.id}: {formatKg(lastSet.weightKg)} кг × {lastSet.reps}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
