import type { ReactNode } from "react";

type Props = {
  tone?: "ok" | "err" | "info";
  children: ReactNode;
};

export function Banner({ tone = "info", children }: Props) {
  return (
    <div className={`banner ${tone}`} role={tone === "err" ? "alert" : "status"}>
      {children}
    </div>
  );
}
