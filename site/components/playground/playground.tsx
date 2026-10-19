"use client";

import { ShieldCheck, Terminal } from "lucide-react";
import { useRef, useState } from "react";
import { GuardTab } from "@/components/playground/guard-tab";
import { MintTab } from "@/components/playground/mint-tab";
import { cn } from "@/lib/utils";

type PlaygroundTab = "mint" | "guard";

const tabs: Array<{ id: PlaygroundTab; label: string; icon: typeof Terminal; description: string }> = [
  { id: "mint", label: "Mint", icon: Terminal, description: "Generate secrets and IDs" },
  { id: "guard", label: "Guard", icon: ShieldCheck, description: "Scan text for leaks" },
];

export function Playground() {
  const [active, setActive] = useState<PlaygroundTab>("mint");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (index: number) => {
    const tab = tabs[index];
    setActive(tab.id);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select((index + 1) % tabs.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select((index - 1 + tabs.length) % tabs.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(tabs.length - 1);
    }
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Playground tools"
        className="flex gap-2 rounded-2xl border border-line bg-surface/70 p-1.5"
      >
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`playground-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`playground-panel-${tab.id}`}
              tabIndex={active === tab.id ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                active === tab.id
                  ? "bg-raised text-foreground shadow-[inset_0_0_0_1px_rgba(141,240,195,0.16)]"
                  : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{tab.label}</span>
              <span className="hidden font-mono text-[0.6rem] text-subtle sm:inline">{tab.description}</span>
            </button>
          );
        })}
      </div>

      <div
        id="playground-panel-mint"
        role="tabpanel"
        aria-labelledby="playground-tab-mint"
        hidden={active !== "mint"}
        className="mt-5"
      >
        <MintTab />
      </div>
      <div
        id="playground-panel-guard"
        role="tabpanel"
        aria-labelledby="playground-tab-guard"
        hidden={active !== "guard"}
        className="mt-5"
      >
        <GuardTab />
      </div>
    </div>
  );
}
