"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Aurora = dynamic(() => import("@/components/reactbits/Aurora/Aurora"), { ssr: false });

export function AuroraBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const idle = window.requestIdleCallback?.(() => setReady(true), { timeout: 1800 }) as number | undefined;
    const fallback = idle === undefined ? window.setTimeout(() => setReady(true), 900) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (fallback !== undefined) window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_62%_10%,rgba(44,129,94,0.2),transparent_65%)]" />
      {ready ? (
        <Aurora
          colorStops={["#0b3a29", "#8df0c3", "#113c2c"]}
          amplitude={0.8}
          blend={0.6}
          speed={0.38}
          height={0.56}
          scale={1.2}
          glow={0.45}
          brightness={0.8}
          opacity={0.34}
          layers={2}
          mouseInteraction={false}
          intro
          className="h-full w-full"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/25 to-background" />
    </div>
  );
}
