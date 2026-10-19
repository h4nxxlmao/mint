"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value?: string;
  getValue?: () => string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  iconOnly?: boolean;
  disabled?: boolean;
};

export function CopyButton({
  value,
  getValue,
  label = "Copy",
  copiedLabel = "Copied",
  className,
  iconOnly = false,
  disabled = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const text = getValue ? getValue() : (value ?? "");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line bg-raised px-2.5 font-mono text-[0.68rem] text-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:border-mint/40 hover:text-foreground active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40",
        iconOnly && "w-8 px-0",
        className,
      )}
      aria-label={copied ? copiedLabel : label}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-mint" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {iconOnly ? null : <span>{copied ? copiedLabel : label}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
