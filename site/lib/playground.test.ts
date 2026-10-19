import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  generate,
  randomIntBelow,
  sampleChars,
  type MintOptions,
} from "./playground";
import { DEMO_WORDLIST } from "./wordlist";

function mint(overrides: Partial<MintOptions>) {
  return generate({ ...DEFAULT_OPTIONS, ...overrides });
}

describe("playground generators", () => {
  it("generates hex bytes of the expected length", () => {
    const result = mint({ generator: "hex", size: 8, count: 3 });
    expect(result.values).toHaveLength(3);
    for (const value of result.values) {
      expect(value).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(result.entropyBits).toBe(64);
    expect(result.command).toBe("mint hex --bytes 8 --count 3");
  });

  it("samples hex characters without leaving the alphabet", () => {
    const result = mint({ generator: "hex", mode: "chars", size: 40 });
    expect(result.values[0]).toHaveLength(40);
    expect(result.values[0]).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unpadded URL-safe base64", () => {
    const result = mint({ generator: "base64url", mode: "bytes", size: 32 });
    expect(result.values[0]).toHaveLength(43);
    expect(result.values[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.values[0]).not.toContain("=");
  });

  it("respects charset presets and avoids ambiguous characters when asked", () => {
    const result = mint({ generator: "chars", charset: "safe", size: 80 });
    expect(result.values[0]).toHaveLength(80);
    expect(result.values[0]).not.toMatch(/[0Oo1lIi]/);
    expect(mint({ generator: "chars", charset: "digits", size: 12 }).values[0]).toMatch(/^[0-9]{12}$/);
  });

  it("generates custom charsets", () => {
    const result = mint({ generator: "chars", charset: "custom", customCharset: "abc123", size: 24 });
    expect(result.values[0]).toHaveLength(24);
    expect(result.values[0]).toMatch(/^[abc123]+$/);
  });

  it("generates passwords with every required class", () => {
    const result = mint({ generator: "password", size: 32, avoidAmbiguous: true });
    const value = result.values[0];
    expect(value).toHaveLength(32);
    expect(value).toMatch(/[a-z]/);
    expect(value).toMatch(/[A-Z]/);
    expect(value).toMatch(/[0-9]/);
    expect(value).toMatch(/[^A-Za-z0-9]/);
    expect(value).not.toMatch(/[0Oo1lIi]/);
    expect(result.command).toContain("--no-ambiguous");
  });

  it("generates passphrases from the embedded demo list", () => {
    const result = mint({ generator: "passphrase", words: 6, separator: "." });
    const words = result.values[0].split(".");
    expect(words).toHaveLength(6);
    for (const word of words) expect(DEMO_WORDLIST).toContain(word as (typeof DEMO_WORDLIST)[number]);
    expect(result.entropyBits).toBe(36);
  });

  it("generates versioned UUIDs", () => {
    const v4 = mint({ generator: "uuid-v4", count: 20 }).values;
    expect(new Set(v4).size).toBe(20);
    for (const value of v4) {
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }

    const v7 = mint({ generator: "uuid-v7", count: 5 }).values;
    for (const value of v7) {
      expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("generates ULIDs and Nano IDs", () => {
    const ulid = mint({ generator: "ulid", count: 20 }).values;
    expect(new Set(ulid).size).toBe(20);
    for (const value of ulid) expect(value).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const nanoid = mint({ generator: "nanoid", size: 16 }).values[0];
    expect(nanoid).toHaveLength(16);
    expect(nanoid).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("applies API key prefixes and JWT sizes", () => {
    const apiKey = mint({ generator: "apikey", prefix: "mint_", size: 24 }).values[0];
    expect(apiKey).toMatch(/^mint_[A-Za-z0-9]{24}$/);

    const jwt = mint({ generator: "jwt-secret", jwtAlgorithm: "hs512" });
    expect(jwt.entropyBits).toBe(512);
    expect(jwt.values[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(jwt.values[0]).toHaveLength(86);
  });

  it("generates PINs and dice totals within range", () => {
    const pin = mint({ generator: "pin", size: 8 }).values[0];
    expect(pin).toMatch(/^[0-9]{8}$/);

    const dice = mint({ generator: "dice", diceNotation: "4d6+2", count: 5 });
    expect(dice.values).toHaveLength(5);
    for (const value of dice.values) {
      const total = Number(value);
      expect(total).toBeGreaterThanOrEqual(6);
      expect(total).toBeLessThanOrEqual(26);
    }
  });

  it("keeps the CLI command and entropy metadata in sync", () => {
    const result = mint({ generator: "password", size: 20, count: 2 });
    expect(result.command).toBe("mint password --length 20 --no-ambiguous --count 2");
    expect(result.values).toHaveLength(2);
    expect(result.entropyBits).toBeGreaterThan(100);
    expect(result.note).toContain("lowercase");
  });

  it("reports invalid settings", () => {
    expect(() => mint({ generator: "dice", diceNotation: "banana" })).toThrow(/Dice notation/);
    expect(() => mint({ generator: "password", size: 2 })).toThrow(/at least 4/);
    expect(() => mint({ generator: "chars", charset: "custom", customCharset: "a" })).toThrow(/two distinct/);
  });

  it("uses rejection sampling helpers within bounds", () => {
    for (let index = 0; index < 2000; index += 1) {
      const value = randomIntBelow(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
    const chars = sampleChars(500, "abc");
    expect(chars).toHaveLength(500);
    expect(chars).toMatch(/^[abc]+$/);
  });
});
