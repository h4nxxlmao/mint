import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Test fixtures.
 *
 * Secret-shaped strings are assembled from fragments at run time so the repository
 * itself never contains a complete pattern that GitHub's secret scanning (or any
 * other scanner) would flag. The values are obviously fake and unused.
 */

const HEX32 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const HEX40 = 'c4f19a72e08b3d56f9a1c7e3405b8d26a91f4c07';

function alnum(length: number, seed = 0): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let index = 0; index < length; index++) {
    out += alphabet[(index * 7 + seed * 13 + 11) % alphabet.length];
  }
  return out;
}

/** One realistic (fake) sample per rule id. Each entry is a whole line/file body. */
export const RULE_SAMPLES: Readonly<Record<string, string>> = {
  'private-key-block': `-----BEGIN ${'RSA'} PRIVATE KEY-----\nMIIEowIBAAKCAQEA${'x'}${'\n'}-----END RSA PRIVATE KEY-----`,
  'aws-access-key-id': `aws_access_key_id = 'AKIA${'Z7Q3XK9W2M4N6P8R'}'`,
  'aws-secret-access-key': `aws_secret_access_key = '${'kR9dLm2Qw8Zx4Vb7Nc1Mf5Hg3Js6Pt0YaEu2Ri4Oo'}'`,
  'gcp-service-account-json': [
    '{',
    '  "type": "service_account",',
    `  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC${'BKcw'}...",`,
    `  "client_email": "deploy@project.iam.gserviceaccount.com"`,
    '}',
  ].join('\n'),
  'google-api-key': `maps_key = 'AIza${alnum(35, 1)}'`,
  'github-token': `token: ghp_${alnum(36, 2)}`,
  'gitlab-token': `GITLAB_TOKEN=glpat-${alnum(20, 3)}`,
  'npm-token': `//registry.npmjs.org/:_authToken=npm_${alnum(36, 4)}`,
  'pypi-token': `password = pypi-AgEIcHlwaS5vcmc${alnum(52, 5)}`,
  'huggingface-token': `HF_TOKEN=hf_${alnum(34, 6)}`,
  'anthropic-api-key': `ANTHROPIC_API_KEY=sk-ant-api03-${alnum(30, 7)}`,
  'openai-api-key': `OPENAI_API_KEY=sk-proj-${alnum(30, 8)}`,
  'mint-apikey': `api_key = 'mint_${alnum(24, 9)}'`,
  'stripe-secret-key': `stripe.apiKey = 'sk_live_${alnum(24, 10)}'`,
  'slack-token': `SLACK_TOKEN=xoxb-${alnum(12, 20)}-${alnum(12, 21)}`,
  'slack-webhook': `https://hooks.slack.com/services/T8Q2M5X7K/B3N9R4W6P/${alnum(24, 22)}`,
  'discord-bot-token': `DISCORD_TOKEN = 'M${alnum(23, 3)}.${alnum(6, 4)}.${alnum(27, 5)}'`,
  'discord-webhook': `https://discord.com/api/webhooks/874205936184027531/${alnum(30, 6)}`,
  'twilio-auth-token': `TWILIO_AUTH_TOKEN = '${HEX32}'`,
  'twilio-account-sid': `account_sid = 'AC${HEX32}'`,
  'sendgrid-api-key': `SENDGRID_API_KEY=SG.${alnum(22, 7)}.${alnum(43, 8)}`,
  'mailgun-api-key': `MAILGUN_KEY=key-${alnum(32, 9)}`,
  'telegram-bot-token': `BOT_TOKEN=874205936:AA${alnum(33, 10)}`,
  'supabase-service-role': [
    `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.${alnum(32, 11)}`,
    'service_role',
  ].join('\n'),
  'supabase-token': `SUPABASE_ACCESS_TOKEN=sbp_${HEX40}`,
  'firebase-server-key': `FCM_SERVER_KEY=AAAA${alnum(7, 12)}:${alnum(150, 13)}`,
  jwt: `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.${alnum(32, 14)}`,
  'database-url-password': `DATABASE_URL=postgres://app:${'S3cr3tP4ssw0rd'}@db.internal:5432/app`,
  'generic-assignment': `DB_PASSWORD = '${'Xk9mQ2pL7wR4vT8nB3cF6hJ1'}'`,
  'entropy-string': `SESSION_VALUE = '${'Qm7Zx2Lp9Rt4Vb8Nc1Md6Kf3Hg5Js0Da'}'`,
  'env-file-tracked': 'API_KEY=value',
  'env-file-not-ignored': 'API_KEY=value',
  'env-no-example': '',
};

/** Placeholder values that must never produce a finding, for every rule. */
export const PLACEHOLDERS: readonly string[] = [
  'changeme',
  'CHANGE_ME',
  'your_api_key_here',
  'your-key-here',
  'replace-me',
  'placeholder',
  'xxxxxxxxxxxxxxxxxxxxxxxx',
  '****************',
  '<your-token>',
  '${API_KEY}',
  '{{ apiKey }}',
  'process.env.API_KEY',
  'os.environ["API_KEY"]',
  'TODO',
  'null',
  'undefined',
  '123e4567-e89b-42d3-a456-426614174000',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg',
  'string',
  'number',
  'https://example.com/docs/api-keys',
  'abcdefghijklmnopqrstuvwxyz',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '0123456789abcdef',
];

export interface TempTree {
  dir: string;
  write(relativePath: string, content: string): string;
  mkdir(relativePath: string): string;
  cleanup(): void;
}

export function makeTempTree(prefix = 'mint-guard-'): TempTree {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  return {
    dir,
    write(relativePath: string, content: string): string {
      const absolute = join(dir, relativePath);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content, 'utf8');
      return absolute;
    },
    mkdir(relativePath: string): string {
      const absolute = join(dir, relativePath);
      mkdirSync(absolute, { recursive: true });
      return absolute;
    },
    cleanup(): void {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Absolute path of the compiled CLI (dist-test/src/cli.js). */
export function cliPath(): string {
  return fileURLToPath(new URL('../src/cli.js', import.meta.url));
}
