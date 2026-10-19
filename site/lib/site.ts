export const site = {
  name: "mint",
  packageName: "@xnah/mint",
  version: "1.1.0",
  url: "https://mint.hanx.pro",
  description:
    "Zero-dependency CLI that mints cryptographically secure secrets, tokens, passwords and identifiers, with an offline secret scanner built in.",
  shortDescription: "Cryptographically secure secrets and IDs from your terminal.",
  github: "https://github.com/h4nxxlmao/mint",
  githubIssues: "https://github.com/h4nxxlmao/mint/issues",
  npm: "https://www.npmjs.com/package/@xnah/mint",
  author: "hanx",
  authorUrl: "https://hanx.pro",
  license: "MIT",
  install: "npm install -g @xnah/mint",
  generatorCount: 39,
  guardRuleCount: 32,
} as const;

export const navigation = [
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
] as const;

export const packageManagers = [
  { id: "npm", label: "npm", command: "npm install -g @xnah/mint" },
  { id: "npx", label: "npx", command: "npx @xnah/mint uuid" },
  { id: "pnpm", label: "pnpm", command: "pnpm add -g @xnah/mint" },
  { id: "bun", label: "bun", command: "bun add -g @xnah/mint" },
] as const;

export const faqs = [
  {
    question: "Does mint use Math.random anywhere?",
    answer:
      "No. The only entropy source is node:crypto. Every character, integer and shuffle is drawn through rejection sampling, so mapping randomness onto a shorter alphabet never introduces modulo bias.",
  },
  {
    question: "Do I need to be online to use it?",
    answer:
      "No. The package has zero runtime dependencies and never makes a network request. mint guard is offline too, including its rule set and rotation guidance.",
  },
  {
    question: "Can I use the output in scripts and pipelines?",
    answer:
      "Yes. Values go to stdout, one per line, and colors only appear on a TTY. Use --json for structured output, --env for environment assignments, and --no-newline when a tool needs an exact value.",
  },
  {
    question: "Does mint guard ever print the full secret?",
    answer:
      "No. Text, JSON, SARIF, Markdown and baseline output only contain a redacted preview (first four and last two characters) or a salted hash. Values shorter than 12 characters are fully masked.",
  },
  {
    question: "Does mint guard rewrite my files or git history?",
    answer:
      "No. It reads your project and reports findings. --fix only prints the rotation plan. History cleanup is shown as a command in the guidance, never executed.",
  },
  {
    question: "Is the playground connected to the CLI or to a server?",
    answer:
      "No. Every generator and every guard check on this site runs in your browser with Web Crypto. Nothing you type or generate is sent anywhere.",
  },
] as const;
