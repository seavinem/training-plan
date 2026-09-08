import { useState } from "react";

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
  const inputId = `stepper-${label.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          aria-label="Минус"
          onClick={() => onChange(Math.max(min, round(value - step)))}
        >
          −
        </button>
        <input
          id={inputId}
          className="value"
          inputMode="decimal"
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
        />
        <button type="button" aria-label="Плюс" onClick={() => onChange(round(value + step))}>
          +
        </button>
      </div>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 2) / 2;
}
