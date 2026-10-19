"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOC_GROUPS } from "@/lib/docs-config";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation">
      {DOC_GROUPS.map((group) => (
        <div key={group.group} className="mb-6 last:mb-0">
          <p className="mono-label mb-2 px-3">{group.group}</p>
          <ul className="space-y-0.5">
            {group.docs.map((doc) => {
              const active = pathname === `/docs/${doc.slug}`;
              return (
                <li key={doc.slug}>
                  <Link
                    href={`/docs/${doc.slug}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block min-h-11 rounded-md px-3 py-2.5 text-[0.82rem] leading-5 transition-colors lg:min-h-0 lg:py-1.5",
                      active
                        ? "bg-mint/8 text-foreground shadow-[inset_2px_0_0_var(--color-mint)]"
                        : "text-muted hover:bg-surface hover:text-foreground",
                    )}
                  >
                    {doc.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <details
        className="mb-7 rounded-xl border border-line bg-surface/60 lg:hidden"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
          Documentation menu
          <ChevronDown className={cn("h-4 w-4 text-subtle transition-transform", open && "rotate-180")} aria-hidden="true" />
        </summary>
        <div className="border-t border-line px-2 py-4">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </div>
      </details>

      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-3">
          <SidebarContent />
        </div>
      </aside>
    </>
  );
}
