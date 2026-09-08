import { formatRest } from "../progression";
import { useEffect, useState } from "react";

type Props = {
  endsAt: number;
  totalSec: number;
  expired: boolean;
  onSkip: () => void;
  onPlus30: () => void;
};

export function Rest({ endsAt, totalSec, expired, onSkip, onPlus30 }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const sec = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const clock = `${m}:${String(s).padStart(2, "0")}`;

  return (
    <div className="shell stack">
      <h2>{expired ? "Отдых кончился" : `Отдых · ${formatRest(totalSec)}`}</h2>
      <div className="timer" aria-live="off" aria-label={`Осталось ${clock}`}>
        {clock}
      </div>
      <button type="button" className="btn btn-primary" onClick={onSkip}>
        Дальше
      </button>
      {!expired ? (
        <button type="button" className="btn" onClick={onPlus30}>
          +30 с
        </button>
      ) : null}
    </div>
  );
}
