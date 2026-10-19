# mint website

The official landing page, docs and browser playground for `@xnah/mint` and `mint guard`.

This folder is self-contained. It has its own package manifest, lockfile, TypeScript config and Next.js config. Deploy this directory as the Vercel project root.

## Requirements

- Node.js 20.9 or newer.
- npm 10 or newer.

The CLI itself supports Node.js 18. The site uses Next.js 16, which requires Node.js 20.9 or newer.

## Develop

```bash
cd site
npm ci
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Or run all four:

```bash
npm run check
```

`npm test` covers the browser generator logic: lengths, charsets, UUID versions, ULID shape, command output and error handling. The docs highlight code with Shiki at build time.

## Build and run locally

```bash
npm run build
npm start
```

There is no API route, database, upload endpoint or environment variable. The playground runs with Web Crypto in the browser. All pages are prerendered; the docs pages read their MDX at build time.

## Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel, choose **Add New > Project** and import the repository.
3. Set **Root Directory** to `site`. This is required. Do not deploy the repository root.
4. Leave **Framework Preset** at Next.js. The detected defaults are:
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. Do not add environment variables. None are needed.
6. Deploy.

The project is static-friendly. The only build-time file reads are the MDX docs in `site/content/docs/`; they are prerendered.

## Point mint.hanx.pro at Vercel

After the first deploy:

1. Open the Vercel project.
2. Go to **Settings > Domains**.
3. Add `mint.hanx.pro`.
4. At your DNS provider, create a CNAME record:

   | Type | Name | Value |
   | --- | --- | --- |
   | CNAME | `mint` | `cname.vercel-dns.com` |

   Use the exact target Vercel shows for the domain. Vercel may show a project-specific target.
5. Remove any conflicting A or AAAA record for the `mint` subdomain.
6. TTL can stay automatic or at 3600 seconds.
7. Wait for DNS propagation and for Vercel to issue the TLS certificate.

If the DNS zone is on Cloudflare, set the record to **DNS only** while Vercel validates the certificate. You can enable proxying after verification, but Vercel recommends leaving the record unproxied.

The site metadata, canonical URLs, sitemap and Open Graph image all use `https://mint.hanx.pro`.

## Routes

- `/` landing page
- `/docs` redirects to `/docs/getting-started`
- `/docs/[slug]` static docs pages
- `/playground` browser generators and guard scan
- `/sitemap.xml`, `/robots.txt`, `/opengraph-image`, `/twitter-image`
- `/icon.svg`

## Editing content

- Docs content: `content/docs/*.mdx`.
- Docs sidebar, order and metadata: `lib/docs-config.ts`.
- Docs MDX imports and TOC extraction: `lib/docs.ts`.
- Site metadata and package constants: `lib/site.ts`.
- Browser generators: `lib/playground.ts` and `lib/wordlist.ts`.
- Browser guard rules: `lib/guard.ts`.
- React Bits components: `components/reactbits/`.

Keep the browser playground in sync with the CLI when generator defaults or formats change.

## npm package exclusion

The root package whitelist in `../package.json` only ships `dist`, `README.md`, `CHANGELOG.md` and `LICENSE`. This `site/` folder is not included in the published tarball. Verify from the repository root with:

```bash
npm pack --dry-run
```
