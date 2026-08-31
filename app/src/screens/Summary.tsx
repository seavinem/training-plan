import type { DraftSession, Exercise, Program } from "../types";
import { formatKg } from "../progression";
import { findExercise } from "../session";

type Props = {
  draft: DraftSession;
  program: Program;
  status: string;
  busy: boolean;
  onWeight: (id: string, kg: number) => void;
  onSave: () => void;
  onDownload: () => void;
  onShare: () => void;
  onGithub: () => void;
};

export function Summary({
  draft,
  program,
  status,
  busy,
  onWeight,
  onSave,
  onDownload,
  onShare,
  onGithub,
}: Props) {
  return (
    <div className="shell stack">
      <h1>День {draft.day}</h1>
      <p className="muted">Факт и вес на следующий раз. Можно поправить.</p>

      <div className="card">
        {program.days[draft.day].exercises.map((ex) => (
          <ExerciseRow
            key={ex.id}
            ex={ex}
            draft={draft}
            program={program}
            onWeight={onWeight}
          />
        ))}
      </div>

      {status ? <div className="banner ok">{status}</div> : null}

      <button type="button" className="btn btn-primary" disabled={busy} onClick={onSave}>
        Сохранить
      </button>
      <button type="button" className="btn" onClick={onDownload}>
        Скачать лог JSON
      </button>
      <button type="button" className="btn" onClick={onShare}>
        Поделиться / копировать
      </button>
      <button type="button" className="btn" disabled={busy} onClick={onGithub}>
        Закоммитить в GitHub
      </button>
      <p className="hint">
        Файл лога: data/logs/{draft.date}-{draft.day}.json. После сохранения веса живут на
        телефоне и в data/weights.json, если коммит прошёл.
      </p>
    </div>
  );
}

function ExerciseRow({
  ex,
  draft,
  program,
  onWeight,
}: {
  ex: Exercise;
  draft: DraftSession;
  program: Program;
  onWeight: (id: string, kg: number) => void;
}) {
  const log = draft.logs.find((l) => l.id === ex.id);
  const work = log?.sets.filter((s) => !s.ramp) ?? [];
  const meta = findExercise(program, ex.id) ?? ex;
  const next = draft.confirmedWeights[ex.id] ?? meta.weightKg;
  const fact = work.map((s) => `${formatKg(s.weightKg)}×${s.reps}`).join(", ");

  return (
    <div className="summary-row">
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{meta.name}</div>
        <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          {fact || "нет рабочих"}
        </div>
      </div>
      <input
        inputMode="decimal"
        value={formatKg(next)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(",", "."));
          if (!Number.isNaN(n)) onWeight(ex.id, n);
        }}
        aria-label={`Вес ${meta.name}`}
      />
    </div>
  );
}
