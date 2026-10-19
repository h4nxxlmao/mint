"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import DecryptedText from "@/components/reactbits/DecryptedText/DecryptedText";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type TerminalScript = {
  command: string;
  output: Array<{ text: string; tone?: "mint" | "muted" | "warn" | "danger" | "plain" }>;
};

const scripts: TerminalScript[] = [
  {
    command: "mint uuid",
    output: [{ text: "33c6e3de-6cb2-4075-b21c-1547149ccbde", tone: "mint" }],
  },
  {
    command: "mint password --length 24",
    output: [{ text: "+@<,+YXIt-;u,hL,8{%]pQ3#", tone: "mint" }],
  },
  {
    command: "mint jwt-secret --algo hs512 --env JWT_SECRET",
    output: [
      { text: "JWT_SECRET=<redacted>", tone: "mint" },
      { text: "entropy: 512 bits", tone: "muted" },
    ],
  },
  {
    command: "mint guard scan",
    output: [
      { text: "mint guard · worktree scan", tone: "muted" },
      { text: "! 2 findings in 3 scanned files", tone: "warn" },
      { text: "CRITICAL  src/lib/stripe.ts:21  sk_l...Xq", tone: "danger" },
      { text: "HIGH      .env.local:4          ghp_...9f", tone: "danger" },
      { text: "next: mint guard rotate-help stripe-secret-key", tone: "muted" },
    ],
  },
];

const TYPING_MS = 42;

export function TerminalDemo() {
  const [scriptIndex, setScriptIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "output" | "paused">("typing");
  const [userPaused, setUserPaused] = useState(false);
  const reduceMotion = useRef(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const active = scripts[scriptIndex];

  const clearTimers = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(callback, delay);
    timers.current.push(timer);
  };

  useEffect(() => {
    reduceMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduceMotion.current) {
      setTyped(active.command);
      setPhase("output");
    }
    return clearTimers;
    // The initial reduced-motion read is intentionally one-time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduceMotion.current || userPaused) return;
    clearTimers();
    setPhase("typing");
    setTyped("");

    let position = 0;
    const tick = () => {
      position += 1;
      setTyped(active.command.slice(0, position));
      if (position < active.command.length) {
        schedule(tick, TYPING_MS);
        return;
      }
      setPhase("output");
      schedule(() => setPhase("paused"), 2800);
      schedule(() => {
        setScriptIndex((index) => (index + 1) % scripts.length);
      }, 3300);
    };

    schedule(tick, 220);
    return clearTimers;
  }, [scriptIndex, active.command, userPaused]);

  const replay = () => {
    setUserPaused(false);
    setScriptIndex((index) => (index + 1) % scripts.length);
  };

  const srSummary = useMemo(
    () => scripts.map((script) => `${script.command}: ${script.output.map((line) => line.text).join(" ")}`).join(". "),
    [],
  );

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="mono-label">Terminal demo</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setUserPaused((value) => !value)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 font-mono text-[0.65rem] text-muted transition-colors hover:text-foreground active:translate-y-px"
            aria-label={userPaused ? "Resume terminal animation" : "Pause terminal animation"}
          >
            {userPaused ? <Play className="h-3 w-3" aria-hidden="true" /> : <Pause className="h-3 w-3" aria-hidden="true" />}
            {userPaused ? "Play" : "Pause"}
          </button>
          <button
            type="button"
            onClick={replay}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 font-mono text-[0.65rem] text-muted transition-colors hover:text-foreground active:translate-y-px"
            aria-label="Replay terminal animation"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Replay
          </button>
        </div>
      </div>

      <div className="terminal-shadow scan-line overflow-hidden rounded-2xl border border-line bg-[#080e0b]">
        <div className="flex h-11 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.68rem] text-muted">mint</span>
            <span className="font-mono text-[0.62rem] text-subtle">session</span>
          </div>
          <span className="font-mono text-[0.6rem] text-subtle">v{site.version}</span>
        </div>

        <div className="flex min-h-[15rem] flex-col px-4 py-4 font-mono text-[0.73rem] leading-[1.8] sm:min-h-[16rem] sm:px-5 sm:text-[0.8rem]">
          <div aria-hidden="true" className="flex flex-1 flex-col">
            <div className="flex min-h-6 items-start gap-2">
              <span className="select-none text-mint">$</span>
              <span className="break-all text-foreground">
                {typed || <span className="text-subtle">&nbsp;</span>}
                <span className="blinking-cursor" />
              </span>
            </div>

            {phase !== "typing" ? (
              <div className="mt-2 space-y-1 border-l border-line/80 pl-4">
                {active.output.map((line, index) => (
                  <p
                    key={`${active.command}-${index}`}
                    className={cn(
                      "break-all",
                      line.tone === "mint" && "text-mint",
                      line.tone === "muted" && "text-subtle",
                      line.tone === "warn" && "text-warning",
                      line.tone === "danger" && "text-danger",
                      (!line.tone || line.tone === "plain") && "text-foreground/90",
                    )}
                  >
                    {index === 0 && active.command === "mint password --length 24" ? (
                      <DecryptedText
                        text={line.text}
                        animateOn="view"
                        speed={35}
                        maxIterations={8}
                        useOriginalCharsOnly
                        effect="fade"
                      />
                    ) : (
                      line.text
                    )}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-auto flex items-center gap-2 pt-5 text-[0.65rem] text-subtle">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-mint/60" />
              <span>local only · CSPRNG · no network</span>
            </div>
          </div>

          <p className="sr-only">
            Example terminal output. {srSummary}. This demo is decorative and runs only in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

