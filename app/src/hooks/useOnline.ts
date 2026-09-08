import { useEffect, useState } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onlineNow = () => setOnline(true);
    const offlineNow = () => setOnline(false);
    window.addEventListener("online", onlineNow);
    window.addEventListener("offline", offlineNow);
    return () => {
      window.removeEventListener("online", onlineNow);
      window.removeEventListener("offline", offlineNow);
    };
  }, []);

  return online;
}
