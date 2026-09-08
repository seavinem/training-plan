import { useEffect, useState } from "react";

type Props = {
  onConfirm: () => void;
};

export function ConfirmButton({ onConfirm }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(id);
  }, [armed]);

  if (!armed) {
    return (
      <button type="button" className="text-button danger-text" onClick={() => setArmed(true)}>
        Сбросить черновик
      </button>
    );
  }

  return (
    <div className="confirm-row">
      <button type="button" className="text-button danger-text" onClick={onConfirm}>
        Точно сбросить?
      </button>
      <button type="button" className="text-button" onClick={() => setArmed(false)}>
        Отмена
      </button>
    </div>
  );
}
