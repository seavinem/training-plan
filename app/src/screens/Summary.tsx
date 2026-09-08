import type { DraftSession, Exercise, Program } from "../types";
import { formatKg } from "../progression";
import { findExercise } from "../session";

type Props = {
  draft: DraftSession;
  program: Program;
  status: string;
  busy: boolean;
  onSend: () => void;
};

export function Summary({ draft, program, status, busy, onSend }: Props) {
  return (
    <div className="shell stack">
      <h1>День {draft.day}</h1>
      <p className="muted">Готово. Отправь отчёт — я разберу веса.</p>

      <div className="card">
        {program.days[draft.day].exercises.map((ex) => (
          <ExerciseRow key={ex.id} ex={ex} draft={draft} program={program} />
        ))}
      </div>

      {status ? (
        <div className={`banner ${/не ушл/i.test(status) ? "err" : "ok"}`}>{status}</div>
      ) : null}

      <button type="button" className="btn btn-primary" disabled={busy} onClick={onSend}>
        {busy ? "Отправляю…" : "Отправить отчёт"}
      </button>
    </div>
  );
}

function ExerciseRow({
  ex,
  draft,
  program,
}: {
  ex: Exercise;
  draft: DraftSession;
  program: Program;
}) {
  const log = draft.logs.find((l) => l.id === ex.id);
  const work = log?.sets.filter((s) => !s.ramp) ?? [];
  const meta = findExercise(program, ex.id) ?? ex;
  const fact = work.map((s) => `${formatKg(s.weightKg)}×${s.reps}`).join(", ");

  return (
    <div className="summary-row">
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{meta.name}</div>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          {fact || "нет рабочих"}
        </div>
      </div>
    </div>
  );
}
