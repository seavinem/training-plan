import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types";
import { Banner } from "../components/Banner";
import { TopBar } from "../components/TopBar";

type Props = {
  messages: ChatMessage[];
  busy: boolean;
  status?: string;
  elapsedSec?: number;
  onSend: (text: string) => void;
  onRetry: (id: string, text: string) => void;
  onStop: () => void;
  onHome: () => void;
};

const SUGGESTIONS = [
  "Оставь сгибания ног 40 кг на 10–12",
  "Наклон тяжёлый, что поменять?",
  "Проверь веса после сегодняшней тренировки",
];

export function Chat({
  messages,
  busy,
  status,
  elapsedSec = 0,
  onSend,
  onRetry,
  onStop,
  onHome,
}: Props) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const setDraft = (value: string) => {
    setText(value);
    const element = input.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
    }
  };

  return (
    <div className="shell chat-shell">
      <TopBar
        left={
          <button type="button" className="text-button" onClick={onHome}>
            ← Назад
          </button>
        }
        right={busy ? <button type="button" className="text-button" onClick={onStop}>Перестать ждать</button> : null}
      >
        Коуч
      </TopBar>
      <p className="muted chat-intro">Спроси про вес — ответ подхватится, даже если свернуть приложение.</p>
      {status ? <Banner tone="err">{status}</Banner> : null}

      <div className="chat-log" aria-busy={busy}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="muted">Выбери вопрос или напиши свой.</p>
            <div className="suggestion-list">
              {SUGGESTIONS.map((suggestion) => (
                <button type="button" className="suggestion-chip" key={suggestion} onClick={() => setDraft(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`bubble ${message.role} ${message.state === "failed" ? "failed" : ""} ${
                message.state === "sending" ? "sending" : ""
              }`}
            >
              {message.text}
              {message.state === "sending" ? <span className="bubble-state"> · отправляю…</span> : null}
              {message.state === "failed" ? (
                <button type="button" className="retry-link" onClick={() => onRetry(message.id, message.text)}>
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
        onSubmit={(event) => {
          event.preventDefault();
          const next = text.trim();
          if (!next) return;
          setDraft("");
          onSend(next);
        }}
      >
        <textarea
          ref={input}
          rows={2}
          value={text}
          aria-label="Сообщение коучу"
          id="coach-message"
          enterKeyHint="send"
          placeholder="Сообщение коучу"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Отправить
        </button>
      </form>
    </div>
  );
}
