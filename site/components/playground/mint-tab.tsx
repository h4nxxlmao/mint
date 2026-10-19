"use client";

import { Keyboard, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import {
  CHARSET_PRESETS,
  DEFAULT_OPTIONS,
  GENERATORS,
  generate,
  type GeneratorId,
  type MintOptions,
  type MintResult,
} from "@/lib/playground";
import { cn, formatNumber } from "@/lib/utils";

const groups = [...new Set(GENERATORS.map((generator) => generator.category))];
const sizes: Record<GeneratorId, number> = {
  hex: 32,
  base64url: 32,
  chars: 24,
  password: 20,
  passphrase: 6,
  "uuid-v4": 1,
  "uuid-v7": 1,
  ulid: 1,
  nanoid: 21,
  apikey: 32,
  "jwt-secret": 1,
  pin: 6,
  dice: 1,
};

export function MintTab() {
  const [options, setOptions] = useState<MintOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<MintResult>(() => generate(DEFAULT_OPTIONS));
  const [error, setError] = useState<string | null>(null);
  const baseId = useId();
  const generator = GENERATORS.find((item) => item.id === options.generator) ?? GENERATORS[0];

  const update = <K extends keyof MintOptions>(key: K, value: MintOptions[K]) => {
    setOptions((current) => ({ ...current, [key]: value }));
  };

  const changeGenerator = (id: GeneratorId) => {
    const next = GENERATORS.find((item) => item.id === id) ?? GENERATORS[0];
    setOptions((current) => ({
      ...current,
      generator: id,
      size: sizes[id],
      mode: next.sizeMode === "bytes" ? "bytes" : "chars",
    }));
  };

  const run = useCallback(() => {
    try {
      const next = generate(options);
      setResult(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not generate a value.");
    }
  }, [options]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [run]);

  const showSize =
    generator.sizeMode === "bytes" ||
    generator.sizeMode === "chars";
  const sizeLabel =
    generator.sizeMode === "bytes"
      ? options.mode === "bytes"
        ? "Bytes"
        : "Characters"
      : "Length";
  const sizeMax = generator.sizeMode === "bytes" && options.mode === "bytes" ? 4096 : generator.id === "pin" ? 32 : 512;

  const output = error ? "" : result.values.join("\n");
  const totalBits = error ? 0 : result.entropyBits * options.count;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-2xl border border-line bg-surface/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <span className="font-mono text-[0.62rem] text-subtle">client-side</span>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <label htmlFor={`${baseId}-generator`} className="mb-2 block text-xs font-medium text-muted">
              Generator
            </label>
            <select
              id={`${baseId}-generator`}
              value={options.generator}
              onChange={(event) => changeGenerator(event.target.value as GeneratorId)}
              className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
            >
              {groups.map((group) => (
                <optgroup key={group} label={group}>
                  {GENERATORS.filter((item) => item.category === group).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {generator.sizeMode === "bytes" ? (
            <fieldset>
              <legend className="mb-2 block text-xs font-medium text-muted">Size mode</legend>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-background p-1">
                {(["bytes", "chars"] as const).map((mode) => (
                  <label
                    key={mode}
                    className={cn(
                      "flex h-8 cursor-pointer items-center justify-center rounded-md font-mono text-[0.68rem] transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-mint",
                      options.mode === mode ? "bg-mint text-ink" : "text-muted hover:text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${baseId}-mode`}
                      value={mode}
                      checked={options.mode === mode}
                      onChange={() => update("mode", mode)}
                      className="sr-only"
                    />
                    {mode === "bytes" ? "Bytes" : "Characters"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {showSize ? (
            <div>
              <label htmlFor={`${baseId}-size`} className="mb-2 block text-xs font-medium text-muted">
                {sizeLabel}
              </label>
              <input
                id={`${baseId}-size`}
                type="number"
                min={1}
                max={sizeMax}
                value={options.size}
                onChange={(event) => update("size", Number(event.target.value))}
                className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
              />
              <p className="mt-1.5 text-[0.65rem] leading-4 text-subtle">
                {options.mode === "bytes" && generator.sizeMode === "bytes"
                  ? "Bytes are drawn from the CSPRNG, then encoded."
                  : "Characters are sampled uniformly from the target alphabet."}
              </p>
            </div>
          ) : null}

          {options.generator === "chars" ? (
            <div>
              <label htmlFor={`${baseId}-charset`} className="mb-2 block text-xs font-medium text-muted">
                Charset
              </label>
              <select
                id={`${baseId}-charset`}
                value={options.charset}
                onChange={(event) => update("charset", event.target.value as MintOptions["charset"])}
                className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
              >
                {Object.keys(CHARSET_PRESETS).map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
                <option value="custom">custom</option>
              </select>
              {options.charset === "custom" ? (
                <input
                  type="text"
                  aria-label="Custom character set"
                  value={options.customCharset}
                  onChange={(event) => update("customCharset", event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
                />
              ) : null}
            </div>
          ) : null}

          {options.generator === "password" ? (
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted">
              <input
                type="checkbox"
                checked={options.avoidAmbiguous}
                onChange={(event) => update("avoidAmbiguous", event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line bg-background accent-mint"
              />
              Avoid look-alike characters (0, O, o, 1, l, I, i)
            </label>
          ) : null}

          {options.generator === "passphrase" ? (
            <>
              <div>
                <label htmlFor={`${baseId}-words`} className="mb-2 block text-xs font-medium text-muted">
                  Words
                </label>
                <input
                  id={`${baseId}-words`}
                  type="number"
                  min={2}
                  max={24}
                  value={options.words}
                  onChange={(event) => update("words", Number(event.target.value))}
                  className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-separator`} className="mb-2 block text-xs font-medium text-muted">
                  Separator
                </label>
                <input
                  id={`${baseId}-separator`}
                  type="text"
                  maxLength={3}
                  value={options.separator}
                  onChange={(event) => update("separator", event.target.value)}
                  className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
                />
              </div>
            </>
          ) : null}

          {options.generator === "apikey" ? (
            <div>
              <label htmlFor={`${baseId}-prefix`} className="mb-2 block text-xs font-medium text-muted">
                Prefix
              </label>
              <input
                id={`${baseId}-prefix`}
                type="text"
                maxLength={32}
                value={options.prefix}
                onChange={(event) => update("prefix", event.target.value.replace(/[^A-Za-z0-9_-]/g, ""))}
                className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
              />
            </div>
          ) : null}

          {options.generator === "jwt-secret" ? (
            <div>
              <label htmlFor={`${baseId}-jwt`} className="mb-2 block text-xs font-medium text-muted">
                Algorithm
              </label>
              <select
                id={`${baseId}-jwt`}
                value={options.jwtAlgorithm}
                onChange={(event) => update("jwtAlgorithm", event.target.value as MintOptions["jwtAlgorithm"])}
                className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
              >
                <option value="hs256">HS256 / 32 bytes</option>
                <option value="hs384">HS384 / 48 bytes</option>
                <option value="hs512">HS512 / 64 bytes</option>
              </select>
            </div>
          ) : null}

          {options.generator === "dice" ? (
            <div>
              <label htmlFor={`${baseId}-dice`} className="mb-2 block text-xs font-medium text-muted">
                Dice notation
              </label>
              <input
                id={`${baseId}-dice`}
                type="text"
                value={options.diceNotation}
                onChange={(event) => update("diceNotation", event.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
              />
            </div>
          ) : null}

          <div>
            <label htmlFor={`${baseId}-count`} className="mb-2 block text-xs font-medium text-muted">
              Count
            </label>
            <input
              id={`${baseId}-count`}
              type="number"
              min={1}
              max={20}
              value={options.count}
              onChange={(event) => update("count", Number(event.target.value))}
              className="h-11 w-full rounded-lg border border-line bg-background px-3 font-mono text-sm text-foreground transition-colors focus:border-mint/60"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={run}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-mint px-4 text-sm font-semibold text-ink transition-colors hover:bg-mint-strong active:translate-y-px"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Generate
        </button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[0.65rem] text-subtle">
          <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
          or
          <kbd className="key">Ctrl</kbd>
          <span className="text-[0.6rem]">+</span>
          <kbd className="key">Enter</kbd>
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="rounded-2xl border border-line bg-[#080e0b]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[0.68rem] text-mint">output</span>
              <span className="font-mono text-[0.6rem] text-subtle">{generator.label.toLowerCase()}</span>
            </div>
            <CopyButton value={output} label="Copy result" iconOnly disabled={!output} />
          </div>

          <div className="min-h-[15rem] p-4" aria-live="polite">
            {error ? (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 font-mono text-xs leading-5 text-danger">
                {error}
              </p>
            ) : (
              <pre className="max-h-[22rem] overflow-auto whitespace-pre-wrap break-all font-mono text-[0.82rem] leading-[1.9] text-mint">
                {output}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 font-mono text-[0.65rem] text-subtle">
            <span>
              {formatNumber(Math.round(result.entropyBits))} bits
              {options.count > 1 ? ` per value · ${formatNumber(Math.round(totalBits))} total` : ""}
            </span>
            <span>{options.count} value{options.count === 1 ? "" : "s"}</span>
          </div>
        </div>

        {!error ? <p className="text-xs leading-5 text-subtle">{result.note}</p> : null}

        <div className="rounded-2xl border border-line bg-surface/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="mono-label">Equivalent CLI</p>
            <CopyButton value={error ? "" : result.command} iconOnly label="Copy CLI command" disabled={Boolean(error)} />
          </div>
          <code className="mt-2 block whitespace-pre-wrap break-all rounded-lg border border-line bg-background px-3 py-2.5 font-mono text-[0.7rem] text-foreground">
            {error ? "mint --help" : result.command}
          </code>
          <p className="mt-2 text-[0.65rem] leading-5 text-subtle">
            The playground uses Web Crypto. The CLI uses node:crypto. Both use rejection sampling, no modulo bias.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface/40 p-3.5">
          <p className="text-[0.68rem] leading-5 text-subtle">
            <span className="font-mono text-muted">passphrase note:</span> this demo embeds 64 words. The real CLI ships
            a 2048-word list, so six words carry 66 bits there; the equivalent command above uses the full list.
          </p>
        </div>
      </div>
    </div>
  );
}
