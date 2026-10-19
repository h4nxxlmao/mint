import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  title,
  eyebrow,
  children,
  align = "left",
  className,
}: {
  id?: string;
  title: ReactNode;
  eyebrow?: string;
  children?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="eyebrow-line">{eyebrow}</p> : null}
      <h2
        id={id}
        className="mt-3 text-balance text-[clamp(2rem,4.2vw,3.35rem)] font-semibold leading-[1.06] tracking-[-0.045em] text-foreground"
      >
        {title}
      </h2>
      {children ? <p className="mt-4 max-w-[58ch] text-pretty text-base leading-7 text-muted md:text-lg">{children}</p> : null}
    </div>
  );
}
