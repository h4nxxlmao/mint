# mint

Zero-dependency CLI that mints cryptographically secure random secrets, tokens, passwords and identifiers.

```console
$ mint password
rAktQB3}A]>X
$ mint jwt-secret --env JWT_SECRET
JWT_SECRET=your-256-bit-secret-here
$ mint uuid --v7
01a14f70-5d77-7dfe-9505-11c851de07b4
$ mint passphrase --words 4
material-orchard-peasant-front
$ mint 32
3d9aa94476b28bc36822a7a3efa6a73e14672366423e38836d55769d9f4cb5da
```

- **CSPRNG only.** Everything comes from `node:crypto`. `Math.random()` appears nowhere in this codebase.
- **No modulo bias.** Characters are sampled with rejection sampling, so every symbol is equally likely.
- **No dependencies.** Not at runtime, not in your `node_modules` tree.
- **Pipe friendly.** One value on stdout, newline terminated, colors only on a TTY.
- **45+ generators**, one consistent flag surface, hand-rolled argument parser with helpful errors.
- **A real toolbox.** `mint list`, shell completions, `mint doctor`, raw byte output for key files,
  and `mint guard` for the other side of the problem.
- **Protect what you generate.** `mint guard` scans a project for leaked secrets, gates CI, and
  tells you how to rotate them — *generate with mint, protect with mint guard*.

## Install

```console
# globally
npm install -g @xnah/mint

# or run it without installing
npx @xnah/mint uuid

# or from source
git clone https://github.com/h4nxxlmao/mint
cd mint && npm install && npm run build && node dist/cli.js --help
```

The package installs a `mint` binary. Requires Node.js 18 or newer.

> **Note:** this package was previously published as `@npm-install-hanx/mint`. That name is
> deprecated — use `@xnah/mint`.

## Generators

Every generator accepts `--length <n>` (characters), `--bytes <n>` or `--bits <n>` (entropy), plus the
[output flags](#output-flags) below.

| Command | What you get | Example |
| --- | --- | --- |
| `mint 32` | shorthand for 32 random bytes in hex | `3d9aa944…cb5da` |
| `mint bytes` | raw random bytes, hex by default | `mint bytes --base64` |
| `mint hex` | lowercase hex, 2 chars per byte | `mint hex --bytes 32` → 64 chars |
| `mint base64` | standard padded base64 | `mint base64 --bytes 32` |
| `mint base64url` | URL-safe, unpadded base64 | `mint base64url --length 43` |
| `mint base32` | RFC 4648 base32 (`A-Z`, `2-7`) | `mint base32 --bytes 20 --no-padding` |
| `mint base58` | Bitcoin base58, no look-alikes | `mint base58 --bytes 16` |
| `mint crockford` | Crockford base32 (no `I L O U`) | `mint crockford --bytes 16` |
| `mint binary` | a string of `0` and `1` | `mint binary --bits 128` |
| `mint chars` | characters from a preset or custom charset | `mint chars --charset safe --length 24` |
| `mint password` | strong password with digits and symbols | `mint password --length 32` |
| `mint passphrase` | diceware-style words from 2048-word list | `mint passphrase --words 6 --separator -` |
| `mint mnemonic` | BIP-39 recovery phrase, 12 to 24 words | `mint mnemonic --words 24` |
| `mint alias` | memorable slug (`brave-otter-42`) | `mint alias --words 3` |
| `mint pin` | numeric PIN | `mint pin --length 4` |
| `mint uuid` | RFC 9562 UUID v4, v7, v1 or nil | `mint uuid --v7 --upper` |
| `mint ulid` | ULID: timestamp + 80 random bits | `mint ulid --lower` |
| `mint ksuid` | KSUID, base62 | `mint ksuid --format hex` |
| `mint nanoid` | compact URL-safe id | `mint nanoid --size 12` |
| `mint cuid` | cuid2-style SHA-512 id | `mint cuid --length 32` |
| `mint uid` | short URL-safe unique id | `mint uid --sortable` |
| `mint objectid` | MongoDB-style 12-byte ObjectId | `mint objectid` |
| `mint snowflake` | Twitter-style 64-bit id | `mint snowflake --worker 7` |
| `mint typeid` | type prefix + UUIDv7 in base32 | `mint typeid user` |
| `mint jwt-secret` | HS256/384/512 sized signing secret | `mint jwt-secret --algo hs512` |
| `mint totp-secret` | TOTP/HOTP shared secret (base32) | `mint totp-secret --bytes 20` |
| `mint otpauth` | otpauth:// URI with a fresh TOTP secret | `mint otpauth --issuer GitHub --account me@example.com` |
| `mint nonce` | 96-bit nonce for AES-GCM/ChaCha20 | `mint nonce --format hex` |
| `mint apikey` | API key with prefix and optional checksum | `mint apikey --prefix sk_live_ --checksum` |
| `mint license` | grouped license key with typo checksum | `mint license --groups 4` |
| `mint token` | generic bearer token | `mint token --format hex` |
| `mint hmac` | HMAC key sized for sha256/sha512 | `mint hmac --algo sha512` |
| `mint aes` | AES-128/192/256 key, optional IV | `mint aes --bits 256 --iv` |
| `mint keypair` | Ed25519 or RSA key pair (PEM, `--openssh`) | `mint keypair --openssh --comment me@host` |
| `mint salt` | salt for password hashing | `mint salt --bytes 16` |
| `mint session` | session id, 256-bit | `mint session` |
| `mint webhook-secret` | webhook signing secret (`whsec_…`) | `mint webhook-secret` |
| `mint int` | random integer in a range, bias-free | `mint int --min 1 --max 100` |
| `mint dice` | dice rolls in `NdM` notation | `mint dice 4d6+2` |
| `mint coin` | coin flip | `mint coin --count 5` |
| `mint pick` | random choice from the arguments | `mint pick red green blue` |
| `mint shuffle` | shuffle the arguments | `mint shuffle a b c d` |
| `mint color` | random color | `mint color --format hsl` |
| `mint mac` | random locally-administered MAC address | `mint mac --separator -` |
| `mint ipv4` | random IPv4 address | `mint ipv4 --public` |
| `mint ipv6` | random IPv6 address | `mint ipv6 --compressed` |
| `mint port` | random TCP/UDP port | `mint port --min 1024` |

Run `mint --help` for the summary screen and `mint <command> --help` for a single generator.

## Sizes

Three ways to say how much randomness you want, never mixed:

```console
$ mint hex --bytes 32        # 32 bytes of entropy -> 64 hex characters
$ mint hex --bits 256        # same thing, in bits
$ mint hex --length 64       # exactly 64 characters
```

- `--bytes`/`--bits` describe **entropy**: that many random bytes are drawn and then encoded.
- `--length` describes **output characters**: characters are drawn uniformly from the encoding
  alphabet, so a 7-character `--length` is just as unbiased as a 64-character one.
- `--length` accepts `k`/`m` suffixes: `mint hex --length 1k` → 1024 characters.

## Output flags

| Flag | Effect |
| --- | --- |
| `--count <n>` | generate n values, one per line |
| `--json` | JSON with `generator`, `value`, `entropyBits` and generator-specific fields |
| `--no-newline` (`-n`) | no trailing newline |
| `--copy` | copy the value to the clipboard (`pbcopy`, `clip`, `xclip`, `wl-copy`, `xsel`) |
| `--entropy` | print the entropy in bits to stderr |
| `--env NAME` | print `NAME=value` (`NAME_1`, `NAME_2`, … with `--count`) |
| `--prefix <str>` / `--suffix <str>` | wrap the value |
| `--no-color` | disable colors (also honors `NO_COLOR`) |
| `--help`, `--version` | help and version |

```console
$ mint hex --bytes 4 --count 3 --json
[
  {
    "generator": "hex",
    "value": "9f4c1a2b",
    "entropyBits": 32,
    "encoding": "hex",
    "bytes": 4
  },
  ...
]

$ mint jwt-secret --env JWT_SECRET --copy
$ mint aes --bits 128 --iv            # key:iv, hex by default
$ mint uuid --entropy                 # value on stdout, "entropy: 122 bits" on stderr
```

## mint guard

`mint guard` finds leaked secrets and risky files in a project, explains why each one
matters, and points at the `mint` command that generates a replacement.

> **generate with mint, protect with mint guard**

It is offline by design: no network calls, no telemetry, and it never writes a secret
to disk, a report or a baseline file.

### Quick start

```console
$ mint guard scan                                  # scan the working tree
$ mint guard scan src/config.ts                    # or a single file
$ mint guard scan --staged                         # only the git index (pre-commit)
$ mint guard scan --diff origin/main               # only what this branch adds (CI)
$ mint guard scan --history --since "2 weeks ago"  # every commit, with hash/author/date
$ mint guard check "sk_live_..."                   # triage one value
$ mint guard env                                   # .env hygiene only
$ mint guard init                                  # write .mintguard.json + .mintguardignore
$ mint guard baseline                              # accept today's findings, gate on new ones
$ mint guard install-hook                          # block commits that contain secrets
$ mint guard rotate-help aws-access-key-id         # how to rotate + what to generate
```

Exit codes: **0** clean, **1** findings at or above `--fail-on` (default `medium`), **2** usage or runtime error.
`--exit-zero` turns a scan into an audit: findings are still reported, but the exit code stays 0.
`mint guard rules --severity critical` narrows the rule list when you only care about one level.

### What it scans

`scan` skips `node_modules`, `.git`, build output (`dist`, `build`, `out`, `coverage`,
`.next`, `vendor`, `target`, ...), lockfiles, binary files and anything larger than
`--max-file-size` (default 1 MB). It honours `.gitignore` (including nested files and
negations), `.mintguardignore` and the config `exclude` list. Lines longer than 8 KB
are skipped so minified bundles cannot stall a scan.

A path may be a directory or a single file. `--staged`, `--diff` and `--history` only
report files under that path, and they apply `.mintguardignore` the same way the
working-tree scan does (a `test/` entry hides those files in every mode).

- `--staged` reads the index (`git diff --cached`), so it sees exactly what a commit
  would contain.
- `--diff <rev>` streams `git diff <rev>...HEAD` and reports only added lines, with
  their line numbers in the new file. This is the mode for pull-request CI.
- `--history` streams `git log -p --all` with a bounded buffer and reports the commit
  hash, author and date that introduced each secret.

```console
$ mint guard baseline
mint guard baseline

  wrote 12 finding hashes to .mintguard-baseline.json
  4 new since the last baseline
  ...
```

Add `--prune` to drop entries whose finding no longer exists, so the file does not grow forever
after you rotate and remove the offending code.

`mint guard scan --verbose` prints every skipped file and the reason (gitignored, ignored, binary,
too large, outside the target) to stderr, which is the fastest way to answer "why is that file not
being scanned?".

### Triage one value

`mint guard check` runs the same rules against a single string, which is what you want
when a value turns up in a log, a chat message or a config file:

```console
$ pbpaste | mint guard check
mint guard check

  ! looks like a secret (Stripe)

  CRITICAL stripe-secret-key - Stripe secret key
           preview: sk_l...L2
           why: A live Stripe key can move money: create charges, issue refunds and read customer data.
           replace: mint apikey --prefix sk_live_ --length 32 --checksum
           rotation: mint guard rotate-help stripe-secret-key

  rotate it first - the value is compromised the moment it was shared.
```

Prefer stdin over an argument: a value passed on the command line ends up in your
shell history. Exit codes are the same as `scan` (0 clean, 1 detected, 2 error), so
`mint guard check` works as a guard in scripts.

### Rules

Pattern rules are data-driven (`src/guard/rules.ts`): id, name, regex, severity,
keywords, why and a replacement command. Run `mint guard rules` for the live list.

| Rule | Severity | Finds |
| --- | --- | --- |
| `private-key-block` | critical | `BEGIN … PRIVATE KEY` blocks (RSA, EC, OpenSSH, PGP) |
| `aws-secret-access-key` | critical | AWS secret keys in `aws_secret_access_key = …` assignments |
| `gcp-service-account-json` | critical | service account JSON with an embedded private key |
| `github-token` | critical | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` tokens |
| `gitlab-token` | critical | `glpat-` personal access tokens |
| `npm-token` | critical | `npm_` tokens (including `.npmrc` auth tokens) |
| `pypi-token` | critical | `pypi-AgEIcHlwaS5vcmc…` upload tokens |
| `openai-api-key` | critical | `sk-…` and `sk-proj-…` keys |
| `anthropic-api-key` | critical | `sk-ant-…` keys |
| `stripe-secret-key` | critical | `sk_live_` and `rk_live_` keys |
| `mint-apikey` | critical | keys minted with `mint apikey --prefix mint_` |
| `database-url-password` | critical | `postgres://`, `mysql://`, `mongodb+srv://`, `redis://` … with an inline password |
| `twilio-auth-token` | critical | Twilio auth tokens |
| `supabase-service-role` | critical | `service_role` JWTs (they bypass row level security) |
| `aws-access-key-id` | high | `AKIA…`, `ASIA…` and other access key ids |
| `google-api-key` | high | `AIza…` API keys |
| `huggingface-token` | high | `hf_…` tokens |
| `slack-token` | high | `xoxb-`, `xoxp-`, `xoxa-`, `xoxr-`, `xoxs-` tokens |
| `slack-webhook` | high | `hooks.slack.com/services/…` URLs |
| `discord-bot-token` | high | Discord bot tokens |
| `discord-webhook` | high | `discord.com/api/webhooks/…` URLs |
| `twilio-account-sid` | medium | Twilio account SIDs |
| `sendgrid-api-key` | high | `SG.…` API keys |
| `mailgun-api-key` | high | `key-…` API keys |
| `telegram-bot-token` | high | `<id>:AA…` bot tokens |
| `supabase-token` | high | `sbp_…` management tokens |
| `firebase-server-key` | medium | legacy FCM server keys |
| `jwt` | medium | compact JWTs (`eyJ….eyJ….…`) |
| `generic-assignment` | medium | `password=`, `secret=`, `api_key=`, `token=` … with a non-placeholder value |
| `entropy-string` | high | high-entropy quoted/assigned strings with no known format |

Env-only rules (used by `mint guard env`): `env-file-tracked` (critical),
`env-file-not-ignored` (high), `env-no-example` (low).

### Entropy detection

Unknown formats are caught by Shannon entropy over quoted strings and assignment
values: at least 20 characters, at most 200, and at least `--entropy-threshold`
bits per character (default 4.5). These are rejected as false positives:

- UUIDs, SHA/MD5 digests, git hashes, lockfile integrity strings
- `data:image/…`, URLs, file paths and source snippets
- alphabets and sample lists (long ascending/descending runs)
- placeholders: `changeme`, `your_key_here`, `replace-me`, `xxxx`, `<…>`, `${…}`,
  `{{ … }}`, `process.env.*`, `os.environ[…]`, type names, `TODO`, `null`
- anything already matched by a pattern rule on the same span

Tune it with `--entropy-threshold 5` (strict) or `--entropy-threshold 4` (noisy), or
disable it with `"entropySeverity"` / `"disabledRules": ["entropy-string"]`.

### Suppression

```ts
const token = '…';                    // mintguard:ignore
// mintguard:ignore-next-line
const other = '…';
const scoped = '…';                   // mintguard:ignore generic-assignment
```

- `.mintguardignore` — gitignore-style paths, shared with the team.
- `.mintguard.json` → `disabledRules: ["rule-id"]` or `rules: { "rule-id": { "disabled": true } }`.
- **Baseline** — `mint guard baseline` writes a salted hash per finding to
  `.mintguard-baseline.json`. Later scans ignore those and fail only on new leaks.
  The file contains no secrets and no previews, only `sha256(salt ‖ rule ‖ file ‖ secret)`.

### Configuration (`.mintguard.json`)

| Key | Default | Meaning |
| --- | --- | --- |
| `failOn` | `"medium"` | severity that makes a scan exit 1 |
| `entropyThreshold` | `4.5` | bits per character for entropy findings |
| `entropyMinLength` | `20` | minimum candidate length |
| `entropyMaxLength` | `200` | maximum candidate length |
| `entropySeverity` | `"high"` | severity for entropy findings |
| `maxFileSize` | `1048576` | skip larger files |
| `includeLockfiles` | `false` | scan lockfiles too |
| `disabledRules` | `[]` | rule ids to skip |
| `rules` | `{}` | per-rule `{ severity, disabled }` overrides |
| `customRules` | `[]` | your own `{ id, name, regex, severity, keywords, why, mintCommand }` |
| `exclude` | `[]` | extra gitignore-style paths |
| `baselineFile` | `".mintguard-baseline.json"` | where the baseline lives |
| `ignoreFiles` | `[".mintguardignore"]` | ignore files to read |
| `inlineComments` | `true` | honour `mintguard:ignore` comments |

A custom rule:

```json
{
  "customRules": [
    {
      "id": "internal-key",
      "name": "Internal service key",
      "regex": "INTERNAL_[A-Za-z0-9]{24}",
      "severity": "critical",
      "keywords": ["internal_"]
    }
  ]
}
```

### Pre-commit hook

```console
$ mint guard install-hook
$ mint guard install-hook --fail-on high
$ mint guard uninstall-hook
```

The hook runs `mint guard scan --staged --fail-on medium`. It never replaces an
existing hook unless you pass `--force`, and even then it inserts its block after the
shebang so the previous hook keeps running. If `mint` is not installed the hook warns
and lets the commit through, so tooling never blocks you by accident.

### GitHub Actions

Copy [`.github/workflows/mintguard.yml`](./.github/workflows/mintguard.yml) — it runs
`mint guard scan --fail-on high --format sarif` and uploads the result to GitHub code
scanning:

```yaml
permissions:
  contents: read
  security-events: write

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 22
  - run: npm install --no-save --no-package-lock --omit=dev @xnah/mint
  - run: ./node_modules/.bin/mint guard scan --fail-on high --format sarif > mintguard.sarif
  - uses: github/codeql-action/upload-sarif@v3
    if: always()
    with:
      sarif_file: mintguard.sarif
```

### Rotation

Deleting a line does not undo an exposure: assume the secret was scraped the moment it
was pushed. `mint guard rotate-help <finding-id|rule-id>` prints the provider playbook
and the exact command to mint a replacement:

```console
$ mint guard rotate-help stripe-secret-key
Stripe - Stripe secret key
  rotate it
    1. Roll the live key in the Stripe dashboard (Developers > API keys > Roll key).
    ...
  generate the replacement with mint
    mint apikey --prefix sk_live_ --length 32 --checksum
```

`--fix` prints the same plan without touching any file, and never rewrites history.
History cleanup is shown as text only (`git filter-repo --path <file> --invert-paths`).

### What guard never does

- No network requests, no telemetry, no update checks, no remote rule feeds.
- No full secret in the terminal report, JSON, SARIF, markdown or the baseline file —
  previews show the first four and last two characters, shorter values are fully masked.
- No file edits, no `git add`, no history rewriting. `--fix` only prints instructions.
- No execution of repository code, hooks or scripts while scanning.

## CLI tools

Beyond the generators, these commands make mint comfortable to live with:

```console
$ mint list --json                       # every generator, guard command and tool as JSON
$ mint completions bash                  # or zsh, fish, powershell
$ mint doctor                            # CSPRNG, Node, git, clipboard, config and baseline checks
$ mint inspect 01M57Q0QNXBP0EZ0SD577CK4QF # what is this value?
$ mint 32 --raw > key.bin                # write the raw bytes, no encoding
$ ls | mint pick                         # pick and shuffle read stdin when given no arguments
```

`mint list` is what editor plugins and your own scripts should read: it returns names, summaries,
usage lines, examples and accepted flags. `mint doctor` draws fresh bytes from the CSPRNG, parses
`.mintguard.json` and the baseline file, and reports whether `--copy` and the guard git modes will
work here; it exits 1 only when something mint genuinely needs is missing. `--raw` is available on
the byte generators and refuses to be combined with `--json`, `--env`, `--prefix` or `--suffix`, so
a pipe can never be corrupted by decoration.

`mint inspect` is the inverse of the generators: give it a UUID, ULID, KSUID, TypeID, ObjectId,
snowflake, JWT, PEM block or plain encoding and it tells you what it is, how much entropy it carries
and whether it looks like a leaked secret. It never echoes the value back and exits 1 when nothing
matches, which makes it usable as a validator in scripts.

## Security notes

**What mint guarantees**

- **Every value comes from a CSPRNG.** The only entropy source is `crypto.randomBytes` via
  `node:crypto`. There is no `Math.random()` in the source, and no seeding, clock-derived
  fallback or PRNG state to leak.
- **No modulo bias.** Mapping bytes onto a charset of size *k* is done with rejection sampling:
  bytes ≥ ⌊256 / k⌋ · k are discarded and redrawn, so every symbol has probability exactly 1/k.
  For alphabet sizes that divide 256 (16, 32, 64, 128) nothing is ever discarded. Integers and
  array indices use the same technique over 32-bit or arbitrary-width values.
- **Uniform helpers, not ad-hoc math.** `randomIntBelow`, `randomBigIntBelow`, `randomInRange`,
  `sampleChars`, `sampleOne`, `sampleMany` and `shuffle` (Fisher-Yates) are the only ways mint
  consumes randomness; every generator is built from these.
- **Exact entropy accounting.** `--entropy` and `--json` report the real number of CSPRNG bits in
  the value: 8 × bytes for encoded byte strings, length × log₂(alphabet) for sampled strings,
  and the random portion only for time-sortable ids (a ULID is reported as 80 bits, not 128,
  because its 48-bit timestamp is not secret).
- **Verified by tests.** Every generator has format, length and charset tests, uniqueness across
  hundreds of runs, and uniformity checks (χ-style sigma bounds) over tens of thousands of draws
  for the sampling primitives — including the 58-symbol base58 path where modulo bias would
  otherwise be visible. `npm run verify` then drives every generator, flag and output mode through
  the built CLI for another 1200+ end-to-end checks.

**What mint does not do**

- It does not store, log, transmit or persist secrets. Nothing touches the network, and there is
  no config file, history file or telemetry.
- It does not encrypt, sign or manage keys. `mint keypair` prints a freshly generated key pair
  (Ed25519 or RSA) to stdout for you to store somewhere safe; mint never writes it to disk.
- It does not evaluate password strength or check breach lists. `mint mnemonic` generates a
  BIP-39 phrase but does not derive wallet keys or addresses from it.
- It does not hide secrets from your shell: values passed through `--env`, printed to a terminal
  or copied to the clipboard can end up in scrollback, history, or your OS clipboard manager.
  Prefer `--copy`, write to a file with a restrictive umask, or pipe directly into your secret
  manager.
- `--copy` shells out to the platform clipboard tool. If none is available it warns on stderr and
  still prints the value; it never fails the command.
- `mint uuid --nil` is deliberately not random and reports 0 bits of entropy.

**Reporting a problem**

Security issues: please open a [private security advisory](https://github.com/h4nxxlmao/mint/security/advisories/new)
rather than a public issue.

## Programmatic use

```js
import { mint, mintValue, sampleChars, randomIntBelow } from '@xnah/mint';

mint('uuid');                                 // { value: '…', entropyBits: 122, fields: { version: 4 } }
mintValue('hex', { bytes: 32 });              // '…' (64 hex characters)
mintValue('pick', {}, ['red', 'green']);      // 'green'
sampleChars(12, 'abc');                        // uniform characters, no modulo bias
randomIntBelow(6) + 1;                         // uniform 1-6
```

The package is ESM-only (`"type": "module"`) and has no runtime dependencies. Use `import` from
Node 18+, or `require('@xnah/mint')` on Node 22.12+ where `require(esm)` is supported
(on Node 18/20 use `const { mint } = await import('@xnah/mint')`).

## Contributing

```console
git clone https://github.com/h4nxxlmao/mint
cd mint
npm install
npm run build      # dist/
npm test           # compiles the tests, then runs node:test
npm run verify     # 1400+ end-to-end checks over the built CLI
npm run coverage   # same tests with Node's built-in coverage report (Node 20+)
npm run typecheck
node dist/cli.js --help
```

`npm run verify` drives the real command line: every generator, every flag it declares, every
output mode, every help screen and the error paths (exit codes 0/1/2). Point it at an installed
binary to check a release artifact instead of the build:

```console
node scripts/verify.mjs --bin mint
```

Guidelines:

1. **New generators are one file plus a registry entry.** Add them to the matching
   `src/generators/*.ts` module, give them a one-line summary, usage line, examples and the list of
   flags they accept, then add them to a category in `src/registry.ts`.
2. **New guard rules are one object.** Add `{ id, name, regex, severity, keywords, why,
   mintCommand, rotation }` to `RULES` in `src/guard/rules.ts`, add a sample to
   `test/guard-fixtures.ts`, and the rule test will check the regex, the placeholder
   filters and that `mintCommand` is a valid mint invocation.
3. **Never use `Math.random()`.** Build on `src/random.ts` so the rejection sampling and entropy
   accounting stay in one place.
4. **Never print a raw secret.** Reports and the baseline only ever see `previewSecret()`
   output or a salted hash; `test/guard-redact.test.ts` enforces it across all formats.
5. **Every generator needs tests** in `test/generators.test.ts` covering format, length, charset,
   uniqueness over many runs and, where relevant, bias. Guard tests live in `test/guard-*.test.ts`
   and build their fixtures in temp directories at run time.
6. **Keep the CLI surface honest.** If a generator cannot support a flag, do not declare it — the
   dispatcher rejects unsupported flags with a helpful message.
7. Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), no AI/co-author trailers.

## License

Copyright (C) 2026 h4nxxlmao.

mint is free software: you can redistribute it and/or modify it under the terms of the GNU
General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

mint is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
[GNU General Public License](./LICENSE) for more details.

The bundled passphrase word list is the BIP-39 English list (2048 words), redistributed from
[`@scure/bip39`](https://github.com/paulmillr/scure-bip39) under the MIT license; the full notice
lives in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
