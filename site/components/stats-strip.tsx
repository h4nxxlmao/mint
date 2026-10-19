import CountUp from "@/components/reactbits/CountUp/CountUp";

const stats = [
  { value: 39, label: "generators", note: "one flag surface" },
  { value: 32, label: "guard rules", note: "plus entropy detection" },
  { value: 0, label: "runtime deps", note: "Node 18 and nothing else" },
  { value: 4, label: "report formats", note: "text, JSON, SARIF, Markdown" },
];

export function StatsStrip() {
  return (
    <div className="border-y border-line bg-background/55">
      <dl className="wrap grid grid-cols-2 divide-x divide-line/80 md:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={
              index > 1
                ? "border-t border-line/80 px-4 py-5 md:border-t-0 md:px-6 md:py-7"
                : "px-4 py-5 md:px-6 md:py-7"
            }
          >
            <dt className="mono-label">{stat.label}</dt>
            <dd className="mt-2 flex items-baseline gap-2">
              <span className="tabular text-2xl font-semibold tracking-[-0.04em] text-foreground md:text-3xl">
                <CountUp to={stat.value} duration={1.2} easing="easeOut" trigger="view" />
              </span>
              <span className="text-xs text-subtle">{stat.note}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
