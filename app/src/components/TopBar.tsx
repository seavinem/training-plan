import type { ReactNode } from "react";

type Props = {
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
};

export function TopBar({ left, right, children }: Props) {
  return (
    <div className="topbar">
      <div className="topbar-slot topbar-left">{left}</div>
      <div className="topbar-center">{children}</div>
      <div className="topbar-slot topbar-right">{right}</div>
    </div>
  );
}
