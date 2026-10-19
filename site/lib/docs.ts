import type { ComponentType } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import GettingStarted from "@/content/docs/getting-started.mdx";
import Installation from "@/content/docs/installation.mdx";
import QuickExamples from "@/content/docs/quick-examples.mdx";
import GeneratorBytes from "@/content/docs/generators-bytes.mdx";
import GeneratorCharacters from "@/content/docs/generators-characters.mdx";
import GeneratorIdentifiers from "@/content/docs/generators-identifiers.mdx";
import GeneratorSecrets from "@/content/docs/generators-secrets.mdx";
import GeneratorMisc from "@/content/docs/generators-misc.mdx";
import GlobalFlags from "@/content/docs/global-flags.mdx";
import GuardScan from "@/content/docs/guard-scan.mdx";
import GuardEnv from "@/content/docs/guard-env.mdx";
import GuardConfig from "@/content/docs/guard-config.mdx";
import GuardOutput from "@/content/docs/guard-output.mdx";
import GuardHooks from "@/content/docs/guard-hooks.mdx";
import GuardRules from "@/content/docs/guard-rules.mdx";
import CiRecipes from "@/content/docs/ci-recipes.mdx";
import SecurityModel from "@/content/docs/security-model.mdx";
import Contributing from "@/content/docs/contributing.mdx";
import Faq from "@/content/docs/faq.mdx";
import { DOC_META, type DocMeta } from "@/lib/docs-config";
import { slugifyHeading } from "@/lib/utils";

export interface Doc extends DocMeta {
  component: ComponentType;
}

export interface TocEntry {
  id: string;
  title: string;
  depth: 2 | 3;
}

const COMPONENTS: Record<string, ComponentType> = {
  "getting-started": GettingStarted,
  installation: Installation,
  "quick-examples": QuickExamples,
  "generators-bytes": GeneratorBytes,
  "generators-characters": GeneratorCharacters,
  "generators-identifiers": GeneratorIdentifiers,
  "generators-secrets": GeneratorSecrets,
  "generators-misc": GeneratorMisc,
  "global-flags": GlobalFlags,
  "guard-scan": GuardScan,
  "guard-env": GuardEnv,
  "guard-config": GuardConfig,
  "guard-output": GuardOutput,
  "guard-hooks": GuardHooks,
  "guard-rules": GuardRules,
  "ci-recipes": CiRecipes,
  "security-model": SecurityModel,
  contributing: Contributing,
  faq: Faq,
};

export const DOCS: readonly Doc[] = DOC_META.map((meta) => {
  const component = COMPONENTS[meta.slug];
  if (!component) throw new Error(`Missing MDX component for docs/${meta.slug}.mdx`);
  return { ...meta, component };
});

export function getDoc(slug: string): Doc | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}

export function getAdjacentDocs(slug: string): { previous?: DocMeta; next?: DocMeta } {
  const index = DOC_META.findIndex((doc) => doc.slug === slug);
  if (index === -1) return {};
  return {
    previous: index > 0 ? DOC_META[index - 1] : undefined,
    next: index < DOC_META.length - 1 ? DOC_META[index + 1] : undefined,
  };
}

function cleanHeading(value: string): string {
  return value
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function getDocToc(slug: string): TocEntry[] {
  const source = readFileSync(join(process.cwd(), "content", "docs", `${slug}.mdx`), "utf8");
  const entries: TocEntry[] = [];
  let inFence = false;

  for (const line of source.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(##|###)\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const title = cleanHeading(match[2]);
    if (!title) continue;
    entries.push({
      id: slugifyHeading(title),
      title,
      depth: match[1] === "##" ? 2 : 3,
    });
  }

  return entries;
}
