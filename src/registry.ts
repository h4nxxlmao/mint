import { assertKnownFlags } from './specs.js';
import { charsGenerator, passwordGenerator, pinGenerator } from './generators/chars.js';
import { passphraseGenerator } from './generators/passphrase.js';
import { rawGenerators } from './generators/raw.js';
import {
  cuidGenerator,
  ksuidGenerator,
  nanoidGenerator,
  objectIdGenerator,
  snowflakeGenerator,
  typeIdGenerator,
  uidGenerator,
  ulidGenerator,
  uuidGenerator,
} from './generators/ids.js';
import {
  aesGenerator,
  apikeyGenerator,
  hmacGenerator,
  jwtSecretGenerator,
  saltGenerator,
  sessionGenerator,
  tokenGenerator,
  webhookSecretGenerator,
} from './generators/secrets.js';
import {
  coinGenerator,
  colorGenerator,
  diceGenerator,
  intGenerator,
  ipv4Generator,
  ipv6Generator,
  macGenerator,
  pickGenerator,
  portGenerator,
  shuffleGenerator,
} from './generators/misc.js';
import type { Generator } from './types.js';

export interface Category {
  title: string;
  generators: readonly Generator[];
}

export const CATEGORIES: readonly Category[] = [
  { title: 'raw bytes & encodings', generators: rawGenerators },
  { title: 'characters', generators: [charsGenerator, passwordGenerator, passphraseGenerator, pinGenerator] },
  {
    title: 'identifiers',
    generators: [
      uuidGenerator,
      ulidGenerator,
      ksuidGenerator,
      nanoidGenerator,
      cuidGenerator,
      uidGenerator,
      objectIdGenerator,
      snowflakeGenerator,
      typeIdGenerator,
    ],
  },
  {
    title: 'developer secrets',
    generators: [
      jwtSecretGenerator,
      apikeyGenerator,
      tokenGenerator,
      hmacGenerator,
      aesGenerator,
      saltGenerator,
      sessionGenerator,
      webhookSecretGenerator,
    ],
  },
  {
    title: 'numbers, fun & misc',
    generators: [
      intGenerator,
      diceGenerator,
      coinGenerator,
      pickGenerator,
      shuffleGenerator,
      colorGenerator,
      macGenerator,
      ipv4Generator,
      ipv6Generator,
      portGenerator,
    ],
  },
];

export const GENERATORS: readonly Generator[] = CATEGORIES.flatMap((category) => [...category.generators]);

const BY_NAME = new Map<string, Generator>();
for (const generator of GENERATORS) {
  if (BY_NAME.has(generator.name)) throw new Error(`duplicate generator name: ${generator.name}`);
  BY_NAME.set(generator.name, generator);
  for (const alias of generator.aliases ?? []) {
    if (BY_NAME.has(alias)) throw new Error(`duplicate generator alias: ${alias}`);
    BY_NAME.set(alias, generator);
  }
}

export function findGenerator(name: string): Generator | undefined {
  return BY_NAME.get(name);
}

export function generatorNames(): string[] {
  return [...BY_NAME.keys()].sort();
}

/** Fails fast at import time when a generator declares a flag that does not exist. */
export function assertRegistryIntegrity(): void {
  for (const generator of GENERATORS) {
    assertKnownFlags(`generator ${generator.name}`, generator.flags ?? []);
  }
}

assertRegistryIntegrity();
