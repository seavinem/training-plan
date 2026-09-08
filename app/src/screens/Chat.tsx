import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";

type Props = {
  messages: ChatMessage[];
  busy: boolean;
  status?: string;
  elapsedSec?: number;
  onSend: (text: string) => void;
  onRetry: (text: string) => void;
  onHome: () => void;
};

export function Chat({ messages, busy, status, elapsedSec = 0, onSend, onRetry, onHome }: Props) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  return (
    <div className="shell chat-shell">
      <div className="topbar">
        <h1 style={{ margin: 0 }}>Коуч</h1>
        <button type="button" className="btn btn-ghost" onClick={onHome}>
          Назад
        </button>
      </div>
      <p className="muted" style={{ marginBottom: 8 }}>
        Спроси про вес — коуч поправит программу в репо.
      </p>
      {status ? <div className="banner err">{status}</div> : null}

      <div className="chat-log" aria-busy={busy}>
        {messages.length === 0 ? (
          <p className="muted">Например: «сгибания ног тяжело, оставь 40, но 10–12, не 15».</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role} ${m.state === "failed" ? "failed" : ""}`}>
              {m.text}
              {m.state === "failed" ? (
                <button type="button" className="retry-link" onClick={() => onRetry(m.text)}>
                  Повторить
                </button>
              ) : null}
            </div>
          ))
        )}
        {busy ? (
          <div className="bubble assistant muted">
            Коуч думает… {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, "0")}
            {elapsedSec >= 60 ? <div>Первый запуск может занять 3–5 минут.</div> : null}
          </div>
        ) : null}
        <div ref={end} />
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          const next = text.trim();
          if (!next) return;
          setText("");
          onSend(next);
        }}
      >
        <textarea
          rows={2}
          value={text}
          aria-label="Сообщение коучу"
          id="coach-message"
          placeholder="Сообщение"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Отправить
        </button>
      </form>
    </div>
  );
}
