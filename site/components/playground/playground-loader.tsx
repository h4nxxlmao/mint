"use client";

import dynamic from "next/dynamic";

function PlaygroundSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the playground">
      <div className="grid gap-2 rounded-2xl border border-line bg-surface/60 p-1.5 sm:grid-cols-2">
        <div className="h-12 rounded-xl bg-raised" />
        <div className="h-12 rounded-xl bg-surface" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-surface/50 p-5">
          <div className="h-4 w-20 rounded bg-raised" />
          <div className="mt-6 h-10 rounded-lg bg-background" />
          <div className="mt-5 h-10 rounded-lg bg-background" />
          <div className="mt-5 h-10 rounded-lg bg-background" />
          <div className="mt-6 h-11 rounded-lg bg-mint/20" />
        </div>
        <div className="min-h-[24rem] rounded-2xl border border-line bg-[#080e0b] p-5">
          <div className="h-4 w-16 rounded bg-raised" />
          <div className="mt-8 h-4 w-3/4 rounded bg-raised" />
          <div className="mt-3 h-4 w-1/2 rounded bg-raised" />
          <div className="mt-8 h-4 w-2/3 rounded bg-raised" />
          <div className="mt-3 h-4 w-1/3 rounded bg-raised" />
        </div>
      </div>
      <span className="sr-only">Loading playground</span>
    </div>
  );
}

const LazyPlayground = dynamic(
  () => import("@/components/playground/playground").then((module) => module.Playground),
  {
    ssr: false,
    loading: () => <PlaygroundSkeleton />,
  },
);

export function PlaygroundLoader() {
  return <LazyPlayground />;
}
