import { useState } from "react";

type Props = {
  error?: string;
  onSubmit: (pin: string) => void;
};

export function Pin({ error, onSubmit }: Props) {
  const [pin, setPin] = useState("");

  return (
    <div className="shell stack">
      <h1>Код доступа</h1>
      <p className="muted">Один раз. Дальше приложение само пишет отчёты и зовёт коуча.</p>
      {error ? <div className="banner err">{error}</div> : null}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const next = pin.trim();
          if (next) onSubmit(next);
        }}
      >
        <label className="field">
          <span>PIN</span>
          <input
            autoFocus
            autoComplete="off"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!pin.trim()}>
          Войти
        </button>
      </form>
    </div>
  );
}
