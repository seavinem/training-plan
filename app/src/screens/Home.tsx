import type { DayId, DraftSession, Program, Session } from "../types";
import { formatKg } from "../progression";
import { findExercise } from "../session";
import { ActionBar } from "../components/ActionBar";
import { Banner } from "../components/Banner";
import { ConfirmButton } from "../components/ConfirmButton";
import { TopBar } from "../components/TopBar";

type Props = {
  day: DayId;
  recommendedDay: DayId;
  hasDraft: boolean;
  draft: DraftSession | null;
  last: Session | undefined;
  pending: number;
  program: Program;
  busy: boolean;
  online: boolean;
  coachBusy: boolean;
  coachElapsed: number;
  status?: string;
  statusTone?: "ok" | "err" | "info";
  onPickDay: (d: DayId) => void;
  onStart: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onSend: () => void;
  onChat: () => void;
};

export function Home({
  day,
  recommendedDay,
  hasDraft,
  draft,
  last,
  pending,
  program,
  busy,
  online,
  coachBusy,
  coachElapsed,
  status,
  statusTone = "info",
  onPickDay,
  onStart,
  onResume,
  onDiscard,
  onSend,
  onChat,
}: Props) {
  const selected = day;
  const selectedProgram = program.days[selected];
  const completedSets = draft?.logs.reduce((total, row) => total + row.sets.length, 0) ?? 0;
  const lastRow = draft?.logs.at(-1);
  const lastExercise = lastRow ? findExercise(program, lastRow.id) : undefined;

  return (
    <div className="shell shell--bar stack">
      <TopBar
        left={<span className="brand-mark">Зал</span>}
        right={
          <div className="topbar-chips">
            <span className={`chip ${online ? "chip-online" : "chip-offline"}`}>
              {online ? "Онлайн" : "Офлайн"}
            </span>
            {pending > 0 ? <span className="chip">{pending} ждёт</span> : null}
          </div>
        }
      >
        {coachBusy ? (
          <button type="button" className="chip chip-coach" onClick={onChat}>
            Коуч пишет · {formatElapsed(coachElapsed)}
          </button>
        ) : null}
      </TopBar>

      {status ? <Banner tone={statusTone}>{status}</Banner> : null}

      {hasDraft && draft ? (
        <div className="card resume-card stack">
          <div className="eyebrow">Продолжить</div>
          <div className="resume-title">День {draft.day}</div>
          <p className="muted">
            Сделано {completedSets} подходов
            {lastExercise ? ` · последнее: ${lastExercise.name}` : ""}
          </p>
          <ConfirmButton onConfirm={onDiscard} />
        </div>
      ) : (
        <>
          <div className="card stack">
            <div className="eyebrow">Рекомендация</div>
            <div className="hero-day">{selected}</div>
            <p className="muted">
              {selected === recommendedDay
                ? `Рекомендую день ${recommendedDay}`
                : `Выбрал: ${selected} · по очереди дальше ${recommendedDay}`}
            </p>
            <div className="day-pick">
              {(["A", "B", "C"] as DayId[]).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className="day-button"
                  aria-pressed={selected === candidate}
                  onClick={() => onPickDay(candidate)}
                >
                  <strong>{candidate}</strong>
                  <span>{shortDay(program, candidate)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="card day-preview">
            <h2>Сегодня в плане</h2>
            <ul className="list">
              {selectedProgram.exercises.map((exercise) => (
                <li key={exercise.id}>
                  <span>{exercise.name}</span>
                  <strong>{formatKg(exercise.weightKg)} кг</strong>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <ActionBar>
        {hasDraft ? (
          <button type="button" className="btn btn-primary" onClick={onResume}>
            Продолжить день {draft?.day}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onStart}>
            Начать день {selected}
          </button>
        )}
      </ActionBar>

      <div className="secondary-actions">
        <button type="button" className="btn" onClick={onChat}>
          Чат с коучем
        </button>
        {pending > 0 ? (
          <button type="button" className="btn" disabled={busy} onClick={onSend}>
            {busy ? "Отправляю…" : `Дослать отчёт (${pending})`}
          </button>
        ) : null}
      </div>

      {last ? (
        <div className="card">
          <h2>Прошлый раз · день {last.day}</h2>
          <p className="muted" style={{ marginBottom: 8 }}>
            {relativeDate(last.date)}
          </p>
          <ul className="list">
            {last.exercises.map((exercise) => {
              const meta = findExercise(program, exercise.id);
              const work = exercise.sets.filter((set) => !set.ramp);
              const lastSet = work.at(-1);
              if (!lastSet) return null;
              return (
                <li key={exercise.id}>
                  <span>{meta?.name ?? exercise.id}</span>
                  <strong>
                    {formatKg(lastSet.weightKg)} кг × {lastSet.reps}
                  </strong>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function shortDay(program: Program, day: DayId): string {
  return program.days[day].exercises
    .slice(0, 2)
    .map((exercise) => exercise.name.split(" ")[0])
    .join(", ");
}

function relativeDate(value: string): string {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} ${plural(days, "день", "дня", "дней")} назад`;
}

function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
