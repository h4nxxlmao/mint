"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { navigation, site } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-background/85 backdrop-blur-md">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground",
                isActive(item.href) && "text-foreground",
              )}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <a
            href={site.github}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a
            href={site.npm}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            npm
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <Link
            href="/docs/installation"
            className="ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-mint px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-mint-strong active:translate-y-px"
          >
            Install
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-foreground md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
        >
          {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <div id="mobile-navigation" ref={menuRef} className="border-t border-line bg-background px-4 pb-5 pt-3 md:hidden">
          <nav aria-label="Mobile primary" className="flex flex-col">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-base text-foreground"
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={site.github}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 text-base text-foreground"
            >
              GitHub<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href={site.npm}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 text-base text-foreground"
            >
              npm<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Link
              href="/docs/installation"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-mint px-4 font-semibold text-ink"
            >
              Install mint
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
