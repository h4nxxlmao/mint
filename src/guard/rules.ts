import type { RotationAdvice, Rule, Severity } from './types.js';

/**
 * Provider rotation playbooks. Kept separate from the rules so several rules can
 * share one playbook and so `mint guard rotate-help` has a single source of truth.
 */
export const PROVIDERS: Readonly<Record<string, RotationAdvice>> = {
  aws: {
    provider: 'AWS',
    steps: [
      'Create a new access key for the IAM user in the AWS console (IAM > Users > Security credentials).',
      'Deploy the new key to your secret manager, then to the workloads that need it.',
      'Verify the new key works, then deactivate the leaked key (do not delete it yet - deactivating is reversible).',
      'After a few days with no CloudTrail usage, delete the old access key permanently.',
      'Review CloudTrail for unexpected API calls made with the leaked key since it was committed.',
    ],
    links: ['https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'],
  },
  gcp: {
    provider: 'Google Cloud',
    steps: [
      'Create a new service account key in IAM & Admin > Service Accounts > Keys.',
      'Replace the key in your secret manager and redeploy.',
      'Delete the leaked key in the console.',
      'Check Cloud Audit Logs for activity from the leaked key.',
      'Prefer Workload Identity Federation or attached service accounts over long-lived JSON keys.',
    ],
    links: ['https://cloud.google.com/iam/docs/key-rotation'],
  },
  google: {
    provider: 'Google API',
    steps: [
      'Create a replacement key in the Google Cloud console (APIs & Services > Credentials).',
      'Apply API restrictions and HTTP referrer/IP restrictions to the new key.',
      'Delete the leaked key in the console.',
    ],
    links: ['https://cloud.google.com/docs/authentication/api-keys'],
  },
  github: {
    provider: 'GitHub',
    steps: [
      'Create a new token in Settings > Developer settings > Personal access tokens (or the GitHub App settings).',
      'Update your secret manager and redeploy before revoking anything.',
      'Revoke the leaked token immediately - GitHub tokens cannot be scoped again after the fact.',
      'If a fine-grained PAT was used, prefer a short expiry and minimal scopes for the replacement.',
    ],
    links: ['https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens'],
  },
  gitlab: {
    provider: 'GitLab',
    steps: [
      'Create a new personal access token or project access token in Settings > Access tokens.',
      'Store the replacement in your secret manager and redeploy.',
      'Revoke the leaked token in the same screen.',
    ],
    links: ['https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html'],
  },
  npm: {
    provider: 'npm',
    steps: [
      'Create a new granular access token at npmjs.com > Access Tokens, scoped to the minimum packages and permissions.',
      'Update every CI secret that used the old token.',
      'Revoke the leaked token.',
      'Check your packages for unexpected publishes while the token was live.',
    ],
    links: ['https://docs.npmjs.com/about-access-tokens'],
  },
  pypi: {
    provider: 'PyPI',
    steps: [
      'Create a new API token at pypi.org > Account settings > API tokens (scope it to a single project).',
      'Store it in your secret manager, then revoke the leaked token.',
    ],
    links: ['https://pypi.org/help/#apitoken'],
  },
  huggingface: {
    provider: 'Hugging Face',
    steps: [
      'Create a new access token in Settings > Access Tokens.',
      'Update your secret manager and any Space/Job secrets.',
      'Revoke the leaked token.',
    ],
    links: ['https://huggingface.co/docs/hub/security-tokens'],
  },
  openai: {
    provider: 'OpenAI',
    steps: [
      'Create a new API key in the platform dashboard (API keys page).',
      'Update your secret manager and redeploy.',
      'Revoke the leaked key.',
      'Check usage/billing for unexpected spend while the key was live.',
    ],
    links: ['https://platform.openai.com/api-keys'],
  },
  anthropic: {
    provider: 'Anthropic',
    steps: [
      'Create a new API key in the Console (Settings > API keys).',
      'Update your secret manager and redeploy.',
      'Delete the leaked key, then review usage for unexpected traffic.',
    ],
    links: ['https://docs.anthropic.com/en/api/getting-started'],
  },
  stripe: {
    provider: 'Stripe',
    steps: [
      'Roll the live key in the Stripe dashboard (Developers > API keys > Roll key).',
      'Update your secret manager and redeploy immediately.',
      'Review the API logs for requests made with the leaked key.',
      'Restricted keys (rk_live_) should be re-created with the minimum permissions needed.',
    ],
    links: ['https://docs.stripe.com/keys#rolling-keys'],
  },
  slack: {
    provider: 'Slack',
    steps: [
      'Install/rotate the app credentials in api.slack.com > Your Apps (OAuth & Permissions > Reinstall or rotate).',
      'Regenerate incoming webhooks in the app settings.',
      'Revoke the leaked token or webhook URL.',
    ],
    links: ['https://api.slack.com/authentication/rotation'],
  },
  discord: {
    provider: 'Discord',
    steps: [
      'Regenerate the bot token in the Discord Developer Portal (Bot > Reset Token).',
      'Re-invite or restart the bot with the new token.',
      'Delete and recreate any leaked webhook URL in the channel settings.',
    ],
    links: ['https://discord.com/developers/applications'],
  },
  twilio: {
    provider: 'Twilio',
    steps: [
      'Create a new API key/account SID pair in the Twilio console (Account > API keys & tokens).',
      'Update your secret manager and redeploy.',
      'Delete the leaked key or reset the auth token.',
      'Review usage logs for unexpected sends or calls.',
    ],
    links: ['https://www.twilio.com/docs/iam/keys/api-key'],
  },
  sendgrid: {
    provider: 'SendGrid',
    steps: [
      'Create a replacement API key in Settings > API Keys with the minimum permissions.',
      'Update your secret manager and redeploy.',
      'Delete the leaked key.',
      'Check the email activity log for unexpected sends.',
    ],
    links: ['https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys'],
  },
  mailgun: {
    provider: 'Mailgun',
    steps: [
      'Create a new sending key in Account settings > API keys, or create a domain-scoped key.',
      'Update your secret manager and redeploy.',
      'Delete the leaked key.',
    ],
    links: ['https://documentation.mailgun.com/en/latest/api-intro.html#authentication'],
  },
  telegram: {
    provider: 'Telegram',
    steps: [
      'Talk to @BotFather and use /token to generate a new bot token.',
      'Update your secret manager and restart the bot.',
      'The old token stops working as soon as it is revoked with /revoke.',
    ],
    links: ['https://core.telegram.org/bots/features#token'],
  },
  supabase: {
    provider: 'Supabase',
    steps: [
      'Rotate the JWT secret in Project Settings > API (this invalidates every anon/service key).',
      'Update all client and server environment variables, then redeploy.',
      'Re-create any personal access token that leaked.',
      'service_role keys bypass row level security: assume the database was reachable.',
    ],
    links: ['https://supabase.com/docs/guides/api/api-keys'],
  },
  firebase: {
    provider: 'Firebase',
    steps: [
      'Create a new server key in the Firebase console (Cloud Messaging > credentials).',
      'Update your secret manager and redeploy.',
      'Delete the leaked key.',
      'Prefer the HTTP v1 API with short-lived OAuth tokens over legacy server keys.',
    ],
    links: ['https://firebase.google.com/docs/cloud-messaging/migrate-v1'],
  },
  jwt: {
    provider: 'JWT signing key',
    steps: [
      'Generate a new signing secret with mint and deploy it as an environment variable.',
      'Rotate with a key id (kid) so existing tokens can be validated during the transition window.',
      'After the transition window, drop the old key so all previously issued tokens are invalid.',
      'Anyone holding the leaked key could mint valid tokens for your users.',
    ],
  },
  database: {
    provider: 'Database',
    steps: [
      'Change the password for the database user (ALTER USER ... WITH PASSWORD) to a freshly minted password.',
      'Update every service that connects with that credential, then restart them.',
      'Audit the database logs for queries from unexpected hosts while the credential was live.',
      'Give each service its own user and grant only the privileges it needs.',
    ],
  },
  generic: {
    provider: 'Generic secret',
    steps: [
      'Generate a replacement value with mint and store it in your secret manager or .env (never in the repo).',
      'Deploy the new value everywhere the old one was used.',
      'Revoke or invalidate the leaked value at the provider if they offer rotation.',
      'Assume the leaked value is compromised: deleting it from the file does not undo the exposure.',
    ],
  },
};

/**
 * The detection rules. Data-driven on purpose: add an entry with an id, a regex,
 * a severity, keywords for the cheap pre-filter and a rotation playbook key.
 */
export const RULES: readonly Rule[] = [
  {
    id: 'private-key-block',
    name: 'Private key',
    regex: String.raw`-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----`,
    severity: 'critical',
    keywords: ['private key', 'begin'],
    why: 'A private key in the tree lets anyone impersonate the service, decrypt traffic or sign tokens.',
    mintCommand: 'mint passphrase --words 6',
    rotation: 'generic',
  },
  {
    id: 'aws-access-key-id',
    name: 'AWS access key ID',
    regex: String.raw`\b(?:A3T[A-Z0-9]|AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b`,
    severity: 'high',
    keywords: ['akia', 'asia', 'agpa', 'aida', 'aroa', 'a3t', 'aws'],
    why: 'AWS access key IDs identify the account; paired with the secret key they grant API access.',
    mintCommand: 'mint base64url --length 40',
    rotation: 'aws',
  },
  {
    id: 'aws-secret-access-key',
    name: 'AWS secret access key',
    regex: String.raw`(?:aws_?secret_?(?:access_?)?key|awssecret|secret_?access_?key)["']?\s*[:=]\s*["']?([A-Za-z0-9/+=]{20,})`,
    flags: 'giu',
    capture: 1,
    severity: 'critical',
    keywords: ['secret_access_key', 'awssecret', 'aws_secret', 'secretaccesskey', 'secret_key'],
    why: 'This is the AWS signing secret: with an access key ID it gives full API access to the account.',
    mintCommand: 'mint base64url --length 40',
    rotation: 'aws',
  },
  {
    id: 'gcp-service-account-json',
    name: 'GCP service account key',
    regex: String.raw`"private_key"\s*:\s*"?(-----BEGIN [A-Z ]*PRIVATE KEY-----)`,
    flags: 'giu',
    capture: 1,
    requires: ['"type": "service_account"', 'service_account'],
    severity: 'critical',
    keywords: ['private_key', 'private key'],
    why: 'A service account JSON key is a long-lived credential for your whole GCP project.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'gcp',
  },
  {
    id: 'google-api-key',
    name: 'Google API key',
    regex: String.raw`\bAIza[0-9A-Za-z_-]{35}\b`,
    severity: 'high',
    keywords: ['aiza', 'google', 'api_key', 'maps'],
    why: 'Google API keys bill your project and, unscoped, can call any enabled API.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'google',
  },
  {
    id: 'github-token',
    name: 'GitHub token',
    regex: String.raw`\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b`,
    severity: 'critical',
    keywords: ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_', 'github', 'token'],
    why: 'A GitHub token can read or push code, and often every repo the account can reach.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'github',
  },
  {
    id: 'gitlab-token',
    name: 'GitLab token',
    regex: String.raw`\bglpat-[A-Za-z0-9_-]{20,}\b`,
    severity: 'critical',
    keywords: ['glpat-', 'gitlab'],
    why: 'A GitLab personal access token grants API access to projects and groups.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'gitlab',
  },
  {
    id: 'npm-token',
    name: 'npm token',
    regex: String.raw`\bnpm_[A-Za-z0-9]{36}\b`,
    severity: 'critical',
    keywords: ['npm_', '_authtoken', 'registry.npmjs'],
    why: 'An npm token can publish packages - a classic supply chain attack vector.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'npm',
  },
  {
    id: 'pypi-token',
    name: 'PyPI token',
    regex: String.raw`\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}\b`,
    severity: 'critical',
    keywords: ['pypi-agei', 'pypi'],
    why: 'A PyPI token can publish releases for your project.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'pypi',
  },
  {
    id: 'huggingface-token',
    name: 'Hugging Face token',
    regex: String.raw`\bhf_[A-Za-z0-9]{34,}\b`,
    severity: 'high',
    keywords: ['hf_', 'huggingface'],
    why: 'A Hugging Face token can read private models and datasets, and push to your repos.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'huggingface',
  },
  {
    id: 'anthropic-api-key',
    name: 'Anthropic API key',
    regex: String.raw`\bsk-ant-[A-Za-z0-9_-]{20,}\b`,
    severity: 'critical',
    keywords: ['sk-ant-', 'anthropic'],
    why: 'An Anthropic API key bills your account and can be abused for unlimited inference.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'anthropic',
  },
  {
    id: 'openai-api-key',
    name: 'OpenAI API key',
    regex: String.raw`\bsk-(?!ant-)[A-Za-z0-9_-]{20,}\b`,
    severity: 'critical',
    keywords: ['sk-', 'openai'],
    why: 'An OpenAI API key bills your account and is frequently scraped within minutes of a push.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'openai',
  },
  {
    id: 'mint-apikey',
    name: 'mint API key',
    regex: String.raw`\bmint_[A-Za-z0-9]{16,}\b`,
    severity: 'critical',
    keywords: ['mint_'],
    why: 'A key generated by "mint apikey --prefix mint_" was committed instead of kept in a secret store.',
    mintCommand: 'mint apikey --prefix mint_ --checksum',
    rotation: 'generic',
  },
  {
    id: 'stripe-secret-key',
    name: 'Stripe secret key',
    regex: String.raw`\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b`,
    severity: 'critical',
    keywords: ['sk_live_', 'rk_live_', 'stripe'],
    why: 'A live Stripe key can move money: create charges, issue refunds and read customer data.',
    mintCommand: 'mint apikey --prefix sk_live_ --length 32 --checksum',
    rotation: 'stripe',
  },
  {
    id: 'slack-token',
    name: 'Slack token',
    regex: String.raw`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`,
    severity: 'high',
    keywords: ['xox', 'slack'],
    why: 'A Slack token can read messages and post as your app in every channel it was installed in.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'slack',
  },
  {
    id: 'slack-webhook',
    name: 'Slack webhook URL',
    regex: String.raw`https://hooks\.slack\.com/services/T[A-Za-z0-9_]+/B[A-Za-z0-9_]+/[A-Za-z0-9_]+`,
    severity: 'high',
    keywords: ['hooks.slack.com'],
    why: 'Anyone with this URL can post arbitrary messages into your workspace channel.',
    mintCommand: 'mint webhook-secret',
    rotation: 'slack',
  },
  {
    id: 'discord-bot-token',
    name: 'Discord bot token',
    regex: String.raw`\b[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27,}\b`,
    severity: 'high',
    keywords: ['discord', 'bot', 'token'],
    why: 'A Discord bot token grants full control of the bot: reading messages and joining servers.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'discord',
  },
  {
    id: 'discord-webhook',
    name: 'Discord webhook URL',
    regex: String.raw`https://discord(?:app)?\.com/api/webhooks/\d{17,20}/[A-Za-z0-9_-]{20,}`,
    severity: 'high',
    keywords: ['discord.com/api/webhooks', 'discordapp.com/api/webhooks'],
    why: 'A Discord webhook URL lets anyone post into your channel.',
    mintCommand: 'mint webhook-secret',
    rotation: 'discord',
  },
  {
    id: 'twilio-auth-token',
    name: 'Twilio auth token',
    regex: String.raw`(?:auth_?token|twilio)["']?\s*[:=]\s*["']?([0-9a-f]{32})\b`,
    flags: 'giu',
    capture: 1,
    severity: 'critical',
    keywords: ['auth_token', 'authtoken', 'twilio'],
    why: 'The Twilio auth token can send messages and calls on your account, and rack up real charges.',
    mintCommand: 'mint token --bytes 24 --format hex',
    rotation: 'twilio',
  },
  {
    id: 'twilio-account-sid',
    name: 'Twilio account SID',
    regex: String.raw`\bAC[0-9a-f]{32}\b`,
    severity: 'medium',
    keywords: ['twilio', 'account_sid', 'accountsid', 'ac'],
    why: 'The account SID identifies your Twilio account; it is only dangerous together with the auth token.',
    mintCommand: 'mint token --bytes 24',
    rotation: 'twilio',
  },
  {
    id: 'sendgrid-api-key',
    name: 'SendGrid API key',
    regex: String.raw`\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b`,
    severity: 'high',
    keywords: ['sg.', 'sendgrid'],
    why: 'A SendGrid key can send mail as your domain, which damages sender reputation.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'sendgrid',
  },
  {
    id: 'mailgun-api-key',
    name: 'Mailgun API key',
    regex: String.raw`\bkey-[0-9a-zA-Z]{32}\b`,
    severity: 'high',
    keywords: ['mailgun', 'key-'],
    why: 'A Mailgun key can send mail as your domain and read delivery logs.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'mailgun',
  },
  {
    id: 'telegram-bot-token',
    name: 'Telegram bot token',
    regex: String.raw`\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b`,
    severity: 'high',
    keywords: ['telegram', 'bot'],
    why: 'A Telegram bot token gives full control of the bot, including every chat it is in.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'telegram',
  },
  {
    id: 'supabase-service-role',
    name: 'Supabase service role key',
    regex: String.raw`\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b`,
    requires: ['service_role'],
    severity: 'critical',
    keywords: ['eyj', 'service_role'],
    why: 'A service_role key bypasses row level security, giving full read/write access to your database.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'supabase',
  },
  {
    id: 'supabase-token',
    name: 'Supabase access token',
    regex: String.raw`\bsbp_[0-9a-f]{40}\b`,
    severity: 'high',
    keywords: ['sbp_', 'supabase'],
    why: 'A Supabase access token can manage projects, database and secrets through the management API.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'supabase',
  },
  {
    id: 'firebase-server-key',
    name: 'Firebase server key',
    regex: String.raw`\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140,}\b`,
    severity: 'medium',
    keywords: ['aaaa', 'firebase', 'fcm'],
    why: 'A legacy FCM server key can push notifications to all of your app installs.',
    mintCommand: 'mint token --bytes 32',
    rotation: 'firebase',
  },
  {
    id: 'jwt',
    name: 'JSON Web Token',
    regex: String.raw`\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\b`,
    severity: 'medium',
    keywords: ['eyj', 'bearer', 'jwt', 'token'],
    why: 'A committed JWT is a live credential until it expires - and session tokens often last for days.',
    mintCommand: 'mint jwt-secret --algo hs512',
    rotation: 'jwt',
  },
  {
    id: 'database-url-password',
    name: 'Database URL with password',
    regex: String.raw`\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|mssql|clickhouse):\/\/[^\s:@/]+:([^\s:@/]{3,})@`,
    flags: 'giu',
    capture: 1,
    severity: 'critical',
    keywords: ['://', 'postgres', 'mysql', 'mongo', 'redis', 'amqp', 'mssql', 'clickhouse'],
    why: 'A connection string with an inline password hands over the database to anyone reading the repo.',
    mintCommand: 'mint password --length 32 --no-ambiguous',
    rotation: 'database',
  },
  {
    id: 'generic-assignment',
    name: 'Hard-coded credential',
    regex: String.raw`(?:^|[\s,{;(\[])[A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|auth[_-]?token|client[_-]?secret|private[_-]?key)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-./+=]{6,})`,
    flags: 'giu',
    capture: 1,
    severity: 'medium',
    keywords: ['pass', 'secret', 'token', 'key', 'pwd', 'auth'],
    why: 'A credential committed next to its name is readable by anyone with repository access.',
    mintCommand: 'mint password --length 32 --no-ambiguous',
    rotation: 'generic',
  },
];

/** Rule id used by the entropy detector. */
export const ENTROPY_RULE_ID = 'entropy-string';

export const ENTROPY_RULE: Rule = {
  id: ENTROPY_RULE_ID,
  name: 'High-entropy string',
  regex: '',
  severity: 'high',
  keywords: [],
  entropy: true,
  why: 'The string looks like a random secret (high entropy, no known format) sitting in a file.',
  mintCommand: 'mint token --bytes 32',
  rotation: 'generic',
};

export interface RuleOverrideInput {
  severity?: Severity;
  disabled?: boolean;
}

export function findRule(id: string, rules: readonly Rule[] = RULES): Rule | undefined {
  return rules.find((rule) => rule.id === id);
}

/** Case-insensitive keyword pre-filter: a rule without keywords always runs. */
export function lineMatchesKeywords(line: string, rule: Rule): boolean {
  const keywords = rule.keywords;
  if (!keywords || keywords.length === 0) return true;
  const lower = line.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export function defaultRotation(rotation: string): RotationAdvice {
  return PROVIDERS[rotation] ?? PROVIDERS.generic;
}

/** Rules that need the whole file to be present before they can fire. */
export function requiredMarkers(rule: Rule): readonly string[] {
  return rule.requires ?? [];
}
