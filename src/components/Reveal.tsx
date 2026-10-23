import type { ElementType, ReactNode } from "react";

/** Content shows immediately (no scroll animations on the public site). */
export function Reveal({
  children,
  className,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  variant?: string;
  delay?: number;
  as?: ElementType;
}) {
  return <As className={className}>{children}</As>;
}
