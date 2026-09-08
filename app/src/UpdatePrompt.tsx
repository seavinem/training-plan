import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [safe, setSafe] = useState(false);

  useEffect(() => {
    const handleView = (event: Event) => {
      const detail = (event as CustomEvent<{ safe?: boolean }>).detail;
      setSafe(Boolean(detail?.safe));
    };
    window.addEventListener("gym-safe-update", handleView);
    return () => window.removeEventListener("gym-safe-update", handleView);
  }, []);

  if (!needRefresh || !safe) return null;
  return (
    <div className="update-prompt" role="status">
      <span>Есть обновление</span>
      <button type="button" className="btn btn-primary" onClick={() => void updateServiceWorker(true)}>
        Обновить
      </button>
      <button type="button" className="text-button" onClick={() => setNeedRefresh(false)}>
        Позже
      </button>
    </div>
  );
}
