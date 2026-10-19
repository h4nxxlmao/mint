"use client";

import { useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { packageManagers } from "@/lib/site";
import { cn } from "@/lib/utils";

export function InstallTabs() {
  const [active, setActive] = useState<(typeof packageManagers)[number]["id"]>(packageManagers[0].id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeManager = packageManagers.find((manager) => manager.id === active) ?? packageManagers[0];

  const select = (index: number) => {
    setActive(packageManagers[index].id);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select((index + 1) % packageManagers.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select((index - 1 + packageManagers.length) % packageManagers.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(packageManagers.length - 1);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface/80 p-3">
      <div role="tablist" aria-label="Package manager" className="flex flex-wrap gap-1">
        {packageManagers.map((manager, index) => (
          <button
            key={manager.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`install-tab-${manager.id}`}
            aria-selected={active === manager.id}
            aria-controls="install-panel"
            tabIndex={active === manager.id ? 0 : -1}
            onClick={() => setActive(manager.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-11 rounded-lg px-3 py-2 font-mono text-xs transition-colors sm:min-h-8 sm:py-1.5",
              active === manager.id ? "bg-mint text-ink" : "text-muted hover:bg-raised hover:text-foreground",
            )}
          >
            {manager.label}
          </button>
        ))}
      </div>

      <div
        id="install-panel"
        role="tabpanel"
        aria-labelledby={`install-tab-${activeManager.id}`}
        className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-background/90 p-3 sm:p-4"
      >
        <span aria-hidden="true" className="font-mono text-xs text-mint">
          $
        </span>
        <code className="install-command min-w-0 flex-1 font-mono text-[0.72rem] leading-6 text-foreground sm:text-sm">
          {activeManager.command}
        </code>
        <CopyButton value={activeManager.command} label="Copy command" iconOnly className="shrink-0" />
      </div>

      <p className="mt-2 px-1 text-[0.68rem] leading-5 text-subtle">
        Node.js 18 or newer. The package installs a <code className="font-mono text-muted">mint</code> binary. No
        postinstall script, no telemetry.
      </p>
    </div>
  );
}
