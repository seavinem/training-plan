import { formatRest } from "../progression";

type Props = {
  remainingMs: number;
  totalSec: number;
  onSkip: () => void;
  onPlus30: () => void;
};

export function Rest({ remainingMs, totalSec, onSkip, onPlus30 }: Props) {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const clock = `${m}:${String(s).padStart(2, "0")}`;

  return (
    <div className="shell stack">
      <h2>Отдых · {formatRest(totalSec)}</h2>
      <div className="timer">{clock}</div>
      <button type="button" className="btn btn-primary" onClick={onSkip}>
        Дальше
      </button>
      <button type="button" className="btn" onClick={onPlus30}>
        +30 с
      </button>
    </div>
  );
}
