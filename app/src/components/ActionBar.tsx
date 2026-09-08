import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function ActionBar({ children, className = "" }: Props) {
  return <div className={`action-bar ${className}`.trim()}>{children}</div>;
}
