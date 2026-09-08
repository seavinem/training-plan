import { useState } from "react";
import { Banner } from "../components/Banner";

type Props = {
  error?: string;
  onSubmit: (pin: string) => Promise<void> | void;
};

export function Pin({ error, onSubmit }: Props) {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);

  return (
    <div className="shell stack pin-shell">
      <div className="pin-mark">ЗАЛ</div>
      <h1>Код доступа</h1>
      <p className="muted">Введи PIN один раз. Тренировка работает и без сети.</p>
      {error ? <Banner tone="err">{error}</Banner> : null}
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const next = pin.trim();
          if (!next || checking) return;
          setChecking(true);
          try {
            await onSubmit(next);
          } finally {
            setChecking(false);
          }
        }}
      >
        <label className="field">
          <span>PIN</span>
          <input
            autoFocus
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="go"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!pin.trim() || checking}>
          {checking ? "Проверяю…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
