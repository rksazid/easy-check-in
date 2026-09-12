import { describe, expect, it } from "vitest";

import { gravatarHash, gravatarUrl } from "./avatar";
import { initialsOf } from "./initials";

// Reference digest: printf '%s' 'test@example.com' | shasum -a 256
const TEST_HASH =
  "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b";

describe("gravatarHash", () => {
  it("hashes a normalised address with SHA-256", () => {
    expect(gravatarHash("test@example.com")).toBe(TEST_HASH);
  });

  it("ignores surrounding whitespace and letter case", () => {
    expect(gravatarHash("  TEST@Example.COM  ")).toBe(TEST_HASH);
  });

  it("treats different addresses as different people", () => {
    expect(gravatarHash("user@example.com")).not.toBe(TEST_HASH);
  });
});

describe("gravatarUrl", () => {
  it("requests the given size", () => {
    expect(gravatarUrl("test@example.com", { size: 128 })).toBe(
      `https://gravatar.com/avatar/${TEST_HASH}?s=128&d=404`,
    );
  });

  it("asks for a 404 by default so a missing avatar is detectable", () => {
    expect(gravatarUrl("test@example.com")).toContain("d=404");
  });

  it("can serve a generated fallback instead of 404ing", () => {
    expect(gravatarUrl("test@example.com", { fallback: "mp" })).toContain(
      "d=mp",
    );
  });
});

describe("initialsOf", () => {
  it("takes the first letter of the first and last name", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
  });

  it("uses a single letter for a one-word name", () => {
    expect(initialsOf("Prince")).toBe("P");
  });

  it("skips middle names", () => {
    expect(initialsOf("Mary Anne Evans")).toBe("ME");
  });

  it("copes with extra whitespace", () => {
    expect(initialsOf("  ada   lovelace  ")).toBe("AL");
  });

  it("falls back to a placeholder for an empty name", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});
