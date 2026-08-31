import type { GithubSettings } from "../types";

type Props = {
  value: GithubSettings;
  onChange: (next: GithubSettings) => void;
  onBack: () => void;
};

export function Settings({ value, onChange, onBack }: Props) {
  function patch(partial: Partial<GithubSettings>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="shell stack">
      <div className="topbar">
        <h1>GitHub</h1>
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Назад
        </button>
      </div>
      <p className="muted">
        Fine-grained PAT только на этот репозиторий, право Contents. Пока репо без origin —
        достаточно скачать JSON.
      </p>
      <label className="field">
        <span>Owner</span>
        <input value={value.owner} onChange={(e) => patch({ owner: e.target.value })} />
      </label>
      <label className="field">
        <span>Repo</span>
        <input value={value.repo} onChange={(e) => patch({ repo: e.target.value })} />
      </label>
      <label className="field">
        <span>Branch</span>
        <input value={value.branch} onChange={(e) => patch({ branch: e.target.value })} />
      </label>
      <label className="field">
        <span>Token</span>
        <input
          type="password"
          autoComplete="off"
          value={value.token}
          onChange={(e) => patch({ token: e.target.value })}
        />
      </label>
    </div>
  );
}
