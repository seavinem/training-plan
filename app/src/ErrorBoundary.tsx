import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    /* Keep the locally saved workout intact. */
  }

  resetProgram = () => {
    localStorage.removeItem("gym-program");
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="shell stack">
        <h1>Что-то сломалось</h1>
        <p className="muted">
          Тренировка и отчёты сохранены. Можно сбросить только локальную копию программы.
        </p>
        <button type="button" className="btn btn-primary" onClick={this.resetProgram}>
          Сбросить программу
        </button>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Перезагрузить
        </button>
      </div>
    );
  }
}
