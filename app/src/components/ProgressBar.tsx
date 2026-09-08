type Props = {
  value: number;
  max: number;
  label: string;
};

export function ProgressBar({ value, max, label }: Props) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress-wrap" aria-label={label}>
      <div className="progress-track">
        <div className="progress-value" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-label">{label}</div>
    </div>
  );
}
