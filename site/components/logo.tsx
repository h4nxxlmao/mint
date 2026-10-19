import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, asLink = true }: { className?: string; asLink?: boolean }) {
  const content = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="mint-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
          <path
            d="M12 20V9.5M12 13.5c0-3.3 2.2-6 5.5-6H20v1.2c0 3.5-2.7 6.3-6.2 6.3H12ZM12 10.5C12 7.5 9.8 5 6.5 5H4v1.1C4 9.6 6.7 12 10.2 12H12Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-mono text-[1.05rem] font-medium tracking-[-0.04em] text-foreground">
        mint<span className="text-mint">_</span>
      </span>
    </span>
  );

  if (!asLink) return content;

  return (
    <Link href="/" aria-label="mint home" className="rounded-md focus-visible:outline-offset-4">
      {content}
    </Link>
  );
}
