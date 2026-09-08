import { useEffect, useRef } from "react";
import type { View } from "../types";

export function useViewHistory(view: View, onBack: () => void): void {
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      window.history.replaceState({ gymView: view }, "");
      return;
    }
    if (view !== "home") window.history.pushState({ gymView: view }, "");
  }, [view]);

  useEffect(() => {
    const handlePop = () => {
      if (view !== "home") onBack();
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [onBack, view]);
}
