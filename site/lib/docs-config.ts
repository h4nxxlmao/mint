export type DocGroup = "Start" | "Generators" | "mint guard" | "Project";

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  group: DocGroup;
}

export const DOC_GROUP_ORDER: readonly DocGroup[] = ["Start", "Generators", "mint guard", "Project"];

export const DOC_META: readonly DocMeta[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Install mint, generate your first value and meet mint guard.",
    group: "Start",
  },
  {
    slug: "installation",
    title: "Installation",
    description: "npm, npx, pnpm, bun, source installs and programmatic use.",
    group: "Start",
  },
  {
    slug: "quick-examples",
    title: "Quick examples",
    description: "Copy-and-paste commands for the common jobs.",
    group: "Start",
  },
  {
    slug: "generators-bytes",
    title: "Bytes and encodings",
    description: "Raw bytes, hex, base64, base32, base58 and binary.",
    group: "Generators",
  },
  {
    slug: "generators-characters",
    title: "Characters",
    description: "Chars, passwords, passphrases and PINs.",
    group: "Generators",
  },
  {
    slug: "generators-identifiers",
    title: "Identifiers",
    description: "UUID, ULID, KSUID, Nano ID, cuid2, ObjectID, snowflake and TypeID.",
    group: "Generators",
  },
  {
    slug: "generators-secrets",
    title: "Developer secrets",
    description: "JWT secrets, API keys, tokens, HMAC keys, AES, salts and sessions.",
    group: "Generators",
  },
  {
    slug: "generators-misc",
    title: "Numbers and misc",
    description: "Integers, dice, coins, choices, colors, addresses and ports.",
    group: "Generators",
  },
  {
    slug: "global-flags",
    title: "Global flags",
    description: "Count, JSON, env, entropy, copy, sizes and exit codes.",
    group: "Generators",
  },
  {
    slug: "guard-scan",
    title: "Scan",
    description: "Working tree, staged changes and git history.",
    group: "mint guard",
  },
  {
    slug: "guard-env",
    title: "Environment files",
    description: "Tracked, unignored and undocumented env files.",
    group: "mint guard",
  },
  {
    slug: "guard-config",
    title: "Config and baselines",
    description: "Config, ignore rules, inline suppression and baselines.",
    group: "mint guard",
  },
  {
    slug: "guard-output",
    title: "Output and exit codes",
    description: "Text, JSON, SARIF, Markdown and the exit code contract.",
    group: "mint guard",
  },
  {
    slug: "guard-hooks",
    title: "Hooks and rotation",
    description: "Pre-commit hooks, safe installs and provider rotation help.",
    group: "mint guard",
  },
  {
    slug: "guard-rules",
    title: "Rule list",
    description: "All 32 rules plus the entropy detector.",
    group: "mint guard",
  },
  {
    slug: "ci-recipes",
    title: "CI recipes",
    description: "GitHub Actions, pre-commit and a safe rollout.",
    group: "Project",
  },
  {
    slug: "security-model",
    title: "Security model",
    description: "CSPRNG guarantees, redaction and the limits of the scanner.",
    group: "Project",
  },
  {
    slug: "contributing",
    title: "Contributing",
    description: "Add a generator or rule, run the tests and work on the site.",
    group: "Project",
  },
  {
    slug: "faq",
    title: "FAQ",
    description: "Short answers to the questions people ask first.",
    group: "Project",
  },
];

export interface DocGroupNav {
  group: DocGroup;
  docs: readonly DocMeta[];
}

export const DOC_GROUPS: readonly DocGroupNav[] = DOC_GROUP_ORDER.map((group) => ({
  group,
  docs: DOC_META.filter((doc) => doc.group === group),
}));

export function getDocMeta(slug: string): DocMeta | undefined {
  return DOC_META.find((doc) => doc.slug === slug);
}

export function getDocGroup(group: DocGroup): readonly DocMeta[] {
  return DOC_META.filter((doc) => doc.group === group);
}
