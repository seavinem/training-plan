import { useRef, useState } from "react";

type Props = {
  label: string;
  value: number;
  step: number;
  min?: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
};

export function Stepper({ label, value, step, min = 0, format, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const inputId = `stepper-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const change = (direction: -1 | 1) =>
    onChange(Math.max(min, round(value + direction * step)));
  const stopRepeat = () => {
    if (repeatTimer.current !== null) {
      window.clearTimeout(repeatTimer.current);
      repeatTimer.current = null;
    }
  };
  const startRepeat = (direction: -1 | 1) => {
    stopRepeat();
    const repeat = () => {
      change(direction);
      repeatTimer.current = window.setTimeout(repeat, 90);
    };
    repeatTimer.current = window.setTimeout(repeat, 350);
  };

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          aria-label="Минус"
          onClick={() => change(-1)}
          onPointerDown={() => startRepeat(-1)}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onPointerLeave={stopRepeat}
        >
          −
        </button>
        <input
          id={inputId}
          className="value"
          inputMode="decimal"
          enterKeyHint="done"
          value={draft ?? format(value)}
          onFocus={() => setDraft(format(value))}
          onBlur={() => {
            if (draft !== null) {
              const n = Number(draft.replace(",", "."));
              if (Number.isFinite(n)) onChange(Math.max(min, n));
            }
            setDraft(null);
          }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <button
          type="button"
          aria-label="Плюс"
          onClick={() => change(1)}
          onPointerDown={() => startRepeat(1)}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onPointerLeave={stopRepeat}
        >
          +
        </button>
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 2) / 2;
}
