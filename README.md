# mint

Zero-dependency CLI that mints cryptographically secure random secrets, tokens, passwords and identifiers.

```console
$ mint password
rAktQB3}A]>X
$ mint jwt-secret --env JWT_SECRET
JWT_SECRET=2aT1b6zjj-J-CqZR_xhEFMormS-AU_DGl2pszNKdcGxGO2WQZkRA_j0JCJUtfCVrvlaEmWcLiL1hm8medHdDZw
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
- **40+ generators**, one consistent flag surface, hand-rolled argument parser with helpful errors.

## Install

```console
# globally
npm install -g @npm-install-hanx/mint

# or run it without installing
npx @npm-install-hanx/mint uuid

# or from source
git clone https://github.com/h4nxxlmao/mint
cd mint && npm install && npm run build && node dist/cli.js --help
```

The package installs a `mint` binary. Requires Node.js 18 or newer.

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
| `mint apikey` | API key with prefix and optional checksum | `mint apikey --prefix sk_live_ --checksum` |
| `mint token` | generic bearer token | `mint token --format hex` |
| `mint hmac` | HMAC key sized for sha256/sha512 | `mint hmac --algo sha512` |
| `mint aes` | AES-128/192/256 key, optional IV | `mint aes --bits 256 --iv` |
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
- It does not encrypt anything, manage keys, or generate RSA/EC key pairs. For asymmetric keys use
  `ssh-keygen`, `openssl` or your platform's keystore.
- It does not evaluate password strength, check breach lists, or implement BIP-39 mnemonics. The
  bundled word list is used only as a source of distinct words for passphrases.
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
import { mint, mintValue, sampleChars, randomIntBelow } from '@npm-install-hanx/mint';

mint('uuid');                                 // { value: '…', entropyBits: 122, fields: { version: 4 } }
mintValue('hex', { bytes: 32 });              // '…' (64 hex characters)
mintValue('pick', {}, ['red', 'green']);      // 'green'
sampleChars(12, 'abc');                        // uniform characters, no modulo bias
randomIntBelow(6) + 1;                         // uniform 1-6
```

The package is ESM-only (`"type": "module"`) and has no runtime dependencies. Use `import` from
Node 18+, or `require('@npm-install-hanx/mint')` on Node 22.12+ where `require(esm)` is supported
(on Node 18/20 use `const { mint } = await import('@npm-install-hanx/mint')`).

## Contributing

```console
git clone https://github.com/h4nxxlmao/mint
cd mint
npm install
npm run build      # dist/
npm test           # compiles the tests, then runs node:test
npm run verify     # 1200+ end-to-end checks over the built CLI
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
2. **Never use `Math.random()`.** Build on `src/random.ts` so the rejection sampling and entropy
   accounting stay in one place.
3. **Every generator needs tests** in `test/generators.test.ts` covering format, length, charset,
   uniqueness over many runs and, where relevant, bias.
4. **Keep the CLI surface honest.** If a generator cannot support a flag, do not declare it — the
   dispatcher rejects unsupported flags with a helpful message.
5. Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), no AI/co-author trailers.

## License

[MIT](./LICENSE). The bundled passphrase word list is the BIP-39 English list (2048 words),
redistributed from [`@scure/bip39`](https://github.com/paulmillr/scure-bip39) under the MIT
license; see the LICENSE file for details.
