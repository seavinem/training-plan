import { useEffect, useState, type CSSProperties } from "react";
import { formatKg, formatRest } from "../progression";
import type { QueueItem } from "../types";
import { ActionBar } from "../components/ActionBar";
import { TopBar } from "../components/TopBar";
import { setSoundEnabled, soundEnabled } from "../alerts";

type Props = {
  day: string;
  endsAt: number;
  totalSec: number;
  expired: boolean;
  next?: QueueItem;
  onBack: () => void;
  onHome: () => void;
  onSkip: () => void;
  onPlus30: () => void;
};

export function Rest({
  day,
  endsAt,
  totalSec,
  expired,
  next,
  onBack,
  onHome,
  onSkip,
  onPlus30,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(soundEnabled);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const sec = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const clock = `${m}:${String(s).padStart(2, "0")}`;
  const progress = totalSec > 0 ? Math.min(100, (sec / totalSec) * 100) : 0;

  return (
    <div className="shell shell--bar stack">
      <TopBar
        left={
          <button type="button" className="text-button" onClick={onBack}>
            ← Исправить
          </button>
        }
        right={
          <div className="topbar-actions">
            <button
              type="button"
              className="text-button"
              aria-pressed={sound}
              onClick={() => {
                const nextSound = !sound;
                setSound(nextSound);
                setSoundEnabled(nextSound);
              }}
            >
              Звук {sound ? "вкл" : "выкл"}
            </button>
            <button type="button" className="text-button" onClick={onHome}>
              На главную
            </button>
          </div>
        }
      >
        <span className="pill">День {day}</span>
      </TopBar>

      <div className="rest-heading">
        <h1>{expired ? "Отдых окончен" : "Отдых"}</h1>
        <p className="muted">{formatRest(totalSec)}</p>
      </div>
      <div
        className={`rest-ring ${expired ? "rest-ring-expired" : ""}`}
        style={{ "--rest-progress": `${progress}%` } as CSSProperties}
      >
        <div className="timer" aria-live="off" aria-label={`Осталось ${clock}`}>
          {clock}
        </div>
      </div>

      {next?.type === "set" ? (
        <div className="card next-card">
          <div className="eyebrow">Дальше</div>
          <strong>{next.name}</strong>
          <span className="muted">
            Подход {next.setNumber} из {next.totalSets} · цель {formatKg(next.targetWeightKg)} кг
          </span>
        </div>
      ) : null}

      <ActionBar className="action-bar-split">
        {!expired ? (
          <button type="button" className="btn" onClick={onPlus30}>
            +30 с
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="btn btn-primary" onClick={onSkip}>
          Дальше
        </button>
      </ActionBar>
    </div>
  );
}
