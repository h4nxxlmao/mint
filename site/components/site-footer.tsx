import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

const linkGroups = [
  {
    title: "Product",
    links: [
      { href: "/docs/getting-started", label: "Documentation" },
      { href: "/playground", label: "Playground" },
      { href: "/docs/guard-scan", label: "mint guard" },
      { href: "/docs/security-model", label: "Security model" },
    ],
  },
  {
    title: "Package",
    links: [
      { href: site.github, label: "GitHub", external: true },
      { href: site.npm, label: "npm", external: true },
      { href: `${site.github}/releases`, label: "Releases", external: true },
      { href: `${site.github}/blob/main/LICENSE`, label: "MIT license", external: true },
    ],
  },
  {
    title: "More",
    links: [
      { href: "/docs/faq", label: "FAQ" },
      { href: "/docs/contributing", label: "Contributing" },
      { href: site.authorUrl, label: "Made by hanx", external: true },
      { href: `${site.github}/security/advisories/new`, label: "Report a vulnerability", external: true },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="wrap py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
              Generate with mint. Protect with mint guard. Both run locally, with zero runtime dependencies.
            </p>
            <p className="mt-5 font-mono text-xs text-subtle">
              <span className="text-mint">$</span> {site.install}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {linkGroups.map((group) => (
              <div key={group.title}>
                <p className="mono-label">{group.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {"external" in link && link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
                        >
                          {link.label}
                          <ArrowUpRight className="h-3 w-3 text-subtle" aria-hidden="true" />
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-muted transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="text-muted">mint</span> and <span className="text-muted">mint guard</span> are open source under the MIT license.
          </p>
          <p>
            Made by{" "}
            <a
              href={site.authorUrl}
              target="_blank"
              rel="me noreferrer"
              className="text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-mint"
            >
              hanx
            </a>
            . No trackers, no telemetry.
          </p>
        </div>
      </div>
    </footer>
  );
}
