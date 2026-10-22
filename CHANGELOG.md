# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning: [SemVer](https://semver.org/).

## [1.3.0] - 2026-10-22

### Added

- **`mint uuid --v3` / `--v5`** — RFC 9562 name-based UUIDs (MD5 / SHA-1) with `--name` and an
  optional `--namespace` (DNS by default). Deterministic, so they report 0 bits of entropy.
- **`mint license`** — grouped license keys in Crockford base32 (`XXXXX-XXXXX-XXXXX-XXXXX-CCCCC`)
  with `--groups`, `--group-size` and a checksum group that catches typos (`--no-checksum`).
- **`mint nonce`** — 96-bit nonce for AES-GCM / ChaCha20-Poly1305, base64url by default.
- **`mint alias`** — memorable slug such as `brave-otter-42` from the bundled word list, for
  names and usernames rather than passwords.
- **`mint list [--json]`** — machine-readable catalog of every generator, guard command and tool.
- **`mint completions bash|zsh|fish|powershell`** — completion scripts generated from the registry,
  including guard subcommands.
- **`mint doctor [--json]`** — checks Node, draws fresh CSPRNG bytes, and reports on the clipboard
  helper, git and the guard config. Exits 1 only when a required check fails.
- **`mint <n> --raw`** — writes the raw random bytes to stdout (`mint 32 --raw > key.bin`), with
  `--entropy` still available on stderr.
- `mint guard scan --exit-zero` (audit mode: report but never fail) and `mint guard env --exit-zero`.
- `mint guard rules --severity low,medium,...` to narrow the rule table.

### Changed

- `mint --help` gained a tools section; `mint help list|completions|doctor` shows tool help.
- README documents the new generators and the CLI tools.

## [1.2.0] - 2026-10-19

### Added

- **`mint keypair`** — Ed25519 (default) or RSA key pairs as PEM, with `--public` for the SPKI
  public key and `--openssh` for an `ssh-ed25519` authorized_keys line (`--comment` included).
  Keys are generated with `node:crypto` and printed to stdout; mint writes no files.
- **`mint mnemonic`** — BIP-39 recovery phrases (12/15/18/21/24 words) with a real SHA-256
  checksum, built on the bundled 2048-word list. `--bytes`/`--bits` round up to the next valid
  phrase length. mint generates the phrase only; it does not derive wallet keys.
- **`mint totp-secret`** — RFC 4226 shared secret for authenticator apps, base32 by default
  (160 bits), with `--bytes`, `--bits` and `--format`.
- **`mint guard check [value]`** — triage a single value (argument or stdin) against the full rule
  set: what it looks like, why it matters, and the mint command that replaces it. Redacted output,
  `--json`, and exit codes 0/1/2 so it works in scripts.
- **`mint guard scan --diff <rev>`** — scan only the lines a revision added (`<rev>...HEAD`), which
  is the right mode for pull-request CI.
- **`mint guard scan <file>`** — scan a single file instead of a directory.
- `--staged`, `--diff` and `--history` now honour the path argument and `.mintguardignore`, so a
  `test/` entry hides those files in every mode.
- `mint guard env` now covers `.envrc` (direnv) files alongside `.env*`.

### Fixed

- `--env`, `--prefix` and `--suffix` apply to every line of multi-line values (`pick`, `shuffle`)
  instead of only the first or last one. `--env` numbers them (`NAME_1`, `NAME_2`, ...).
- `--no-newline` also strips a trailing newline that the value itself carries (PEM keys).
- `mint 0` now says the size must be at least 1 instead of claiming it "does not look like a size".
- Guard is harder to trip on code: short identifiers (`privatePem`) and dotted member access
  (`config.apiKey`) are no longer reported as hard-coded credentials, while JWTs still are.
- Guard reports files it could not read instead of silently skipping them.

## [1.1.0] - 2026-10-19

### Added

- **`mint guard`** — an offline secret-leak scanner that ships with mint and keeps the
  zero-dependency guarantee (only `node:fs`, `node:path`, `node:child_process`, `node:crypto`).
  - `mint guard scan [path]` — working tree scan that honours `.gitignore` (including nested
    files and negations), `.mintguardignore` and `.mintguard.json`; skips `node_modules`, `.git`,
    build output, lockfiles, binaries and files over `--max-file-size` (default 1 MB).
  - `mint guard scan --staged` — scans only the git index, for pre-commit use.
  - `mint guard scan --history [--since <rev|date>]` — streams `git log -p` and reports the
    commit hash, author, date, file and line for every secret ever added.
  - `mint guard env` — `.env` hygiene: tracked or unignored env files, missing `.env.example`,
    and example files that contain real-looking values.
  - `mint guard baseline` — writes salted hashes so existing findings are ignored and only new
    leaks fail a scan.
  - `mint guard rotate-help <finding-id|rule-id>` — provider-specific rotation steps plus the
    exact `mint` command that generates the replacement.
  - `mint guard install-hook` / `uninstall-hook` — a marker-delimited pre-commit hook that never
    clobbers an existing hook without `--force`.
  - `mint guard init` — creates `.mintguard.json` and `.mintguardignore`.
  - `mint guard rules` — lists every rule with its severity and replacement command.
- 30 data-driven detection rules covering AWS, Google/GCP, GitHub, GitLab, npm, PyPI, Hugging
  Face, OpenAI, Anthropic, Stripe, Slack, Discord, Twilio, SendGrid, Mailgun, Telegram, Supabase,
  Firebase, JWTs, private key blocks, database URLs and generic credential assignments, plus a
  `mint_` prefix rule for keys generated by `mint apikey`.
- Shannon-entropy detection for unknown secret formats, with filters for UUIDs, digests, base64
  images, URLs, paths, alphabets, source snippets and placeholders.
- Suppression: `mintguard:ignore` / `mintguard:ignore-next-line` comments (optionally scoped to a
  rule id), `.mintguardignore`, config disables and the baseline.
- Output formats: `text`, `json`, `sarif` (2.1.0, for GitHub code scanning) and `markdown`;
  `--fail-on low|medium|high|critical` gating; exit codes 0 clean, 1 findings, 2 error.
- A "protect" section in `mint --help` and the tagline *generate with mint, protect with mint guard*.
- `.github/workflows/mintguard.yml` — a copy-paste GitHub Actions job that scans and uploads SARIF.

### Changed

- The package is published as **`@xnah/mint`**. The previous name,
  `@npm-install-hanx/mint`, is deprecated and points here. The `mint` binary name is unchanged.

### Security

- Findings, reports and baseline files only ever contain redacted previews (first four and last
  two characters) or salted hashes. Tests assert that no format leaks a raw secret.
- `--fix` never edits files or rewrites history; it prints remediation only, and rotation is
  always presented before deletion.
- No network access, no telemetry, no execution of repository code while scanning.

## [1.0.0] - 2026-10-18

### Added

- Zero-dependency CLI with 40+ generators: bytes/hex/base64/base64url/base32/base58/Crockford/
  binary, chars, password, passphrase, pin, uuid (v1/v4/v7/nil), ulid, ksuid, nanoid, cuid, uid,
  objectid, snowflake, typeid, jwt-secret, apikey, token, hmac, aes, salt, session,
  webhook-secret, int, dice, coin, pick, shuffle, color, mac, ipv4, ipv6 and port.
- CSPRNG-only randomness with rejection sampling for every charset, integer and shuffle.
- `--length` / `--bytes` / `--bits`, `--count`, `--json`, `--no-newline`, `--copy`, `--entropy`,
  `--env`, `--prefix` / `--suffix`, `mint <n>` shorthand and colored help.
- 2048-word passphrase list, MIT-licensed, attributed in the LICENSE file.
