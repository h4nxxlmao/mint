"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

type Example = {
  command: string;
  output: string;
  note: string;
};

type Category = {
  id: string;
  label: string;
  blurb: string;
  examples: Example[];
};

const categories: Category[] = [
  {
    id: "secrets",
    label: "Secrets",
    blurb: "Bearer tokens, signing keys and API keys with an optional checksum.",
    examples: [
      {
        command: "mint jwt-secret --algo hs512",
        output: "dW3t...ExQ",
        note: "512-bit HS512 signing secret, 64 bytes (sample redacted)",
      },
      {
        command: "mint apikey --prefix sk_live_ --length 24 --checksum",
        output: "sk_live_BAkCh...ACTE",
        note: "API key with a typo-catching checksum (sample redacted)",
      },
      {
        command: "mint token --bytes 16",
        output: "kZGXmckPRMI68kk82oTP0A",
        note: "Generic URL-safe bearer token",
      },
    ],
  },
  {
    id: "ids",
    label: "IDs",
    blurb: "Time-sortable identifiers for databases, queues and distributed systems.",
    examples: [
      {
        command: "mint uuid --v7",
        output: "01a15481-e41d-707a-8cac-7a82e7033404",
        note: "RFC 9562 UUID v7 with 74 random bits",
      },
      {
        command: "mint ulid --lower",
        output: "01m5a83sa8v2avwx3eryqp203z",
        note: "48-bit timestamp plus 80 random bits",
      },
      {
        command: "mint typeid user",
        output: "user_06gn90fe35re7d4xhyhhqd9vzr",
        note: "Typed, sortable ID built on UUID v7",
      },
    ],
  },
  {
    id: "passwords",
    label: "Passwords",
    blurb: "Human-readable passphrases and high-entropy passwords, without the clipboard tax.",
    examples: [
      {
        command: "mint password --length 32",
        output: "+@<,+YXIt-;u,hL,8{%]pQ3#vN!8sKd...",
        note: "Every character class guaranteed",
      },
      {
        command: "mint passphrase --words 5 --capitalize",
        output: "Shield-Pave-Carpet-Program-Orbit",
        note: "11 bits per word from a 2048-word list",
      },
      {
        command: "mint pin --length 6 --no-leading-zero",
        output: "482071",
        note: "Bias-free numeric PIN",
      },
    ],
  },
  {
    id: "dev-keys",
    label: "Dev keys",
    blurb: "Sized for the algorithm you are actually using, so you do not have to remember the RFC.",
    examples: [
      {
        command: "mint aes --bits 256 --iv",
        output: "297ac2cbd70f34496ed5a42043797bc8...:1d1e4a9210f51c57...",
        note: "AES-256 key and a 128-bit IV",
      },
      {
        command: "mint hmac --algo sha512",
        output: "58ade3f7dac936dc3556afe741be9a20f5b6...",
        note: "64-byte HMAC key for SHA-512",
      },
      {
        command: "mint webhook-secret --bytes 32",
        output: "whsec_fIQ2...m1U=",
        note: "Webhook signing secret with the whsec_ prefix (sample redacted)",
      },
    ],
  },
  {
    id: "fun",
    label: "Fun",
    blurb: "The useful bits that do not need a security review.",
    examples: [
      {
        command: "mint dice 4d6+2",
        output: "16",
        note: "Dice notation with a modifier, rolled independently",
      },
      {
        command: "mint coin --count 3",
        output: "heads\ntails\nheads",
        note: "One CSPRNG draw per flip",
      },
      {
        command: "mint color --format hsl",
        output: "hsl(213, 64%, 41%)",
        note: "A random color in hex, rgb or hsl",
      },
    ],
  },
];

export function GenerateTabs() {
  const [active, setActive] = useState(categories[0].id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeCategory = categories.find((category) => category.id === active) ?? categories[0];

  const select = (index: number) => {
    const category = categories[index];
    setActive(category.id);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select((index + 1) % categories.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select((index - 1 + categories.length) % categories.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(categories.length - 1);
    }
  };

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label="mint generator categories"
        className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1.5"
      >
        {categories.map((category, index) => (
          <button
            key={category.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`generate-tab-${category.id}`}
            type="button"
            role="tab"
            aria-selected={active === category.id}
            aria-controls={`generate-panel-${category.id}`}
            tabIndex={active === category.id ? 0 : -1}
            onClick={() => setActive(category.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-11 shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active === category.id
                ? "bg-raised text-foreground shadow-[inset_0_0_0_1px_rgba(141,240,195,0.16)]"
                : "text-muted hover:text-foreground",
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div
        id={`generate-panel-${activeCategory.id}`}
        role="tabpanel"
        aria-labelledby={`generate-tab-${activeCategory.id}`}
        className="mt-4"
      >
        <p className="text-sm leading-6 text-muted">{activeCategory.blurb}</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {activeCategory.examples.map((example) => (
            <div
              key={example.command}
              className="flex flex-col rounded-xl border border-line bg-surface/80 p-4 transition-colors hover:border-mint/25"
            >
              <div className="flex items-start justify-between gap-3">
                <code className="break-all font-mono text-[0.72rem] leading-5 text-mint">{example.command}</code>
                <CopyButton value={example.command} iconOnly label="Copy command" className="shrink-0" />
              </div>
              <div className="mt-4 rounded-md border border-line bg-background/80 px-3 py-2.5">
                <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[0.68rem] leading-5 text-foreground/90">
                  {example.output}
                </pre>
              </div>
              <p className="mt-3 text-xs leading-5 text-subtle">{example.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="font-mono text-[0.68rem] text-subtle">Sample output. Every value is generated locally with your CSPRNG.</p>
        <Link
          href="/docs/generators-secrets"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-mint"
        >
          Browse every generator
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
