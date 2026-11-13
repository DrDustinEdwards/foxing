import { describe, expect, it } from "vitest";
import { fuzzyExpr, sanitize, strictExpr } from "../src/repositories/catalog/search";

describe("search sanitize", () => {
  it("lowercases, strips FTS operators, collapses whitespace", () => {
    expect(sanitize('  Pride & "Prejudice"!  ')).toBe("pride prejudice");
    expect(sanitize("O'Brien")).toBe("o brien");
  });
});

describe("strictExpr", () => {
  it("quotes each usable token and ANDs them", () => {
    expect(strictExpr("jane austen")).toBe('"jane" AND "austen"');
  });

  it("drops tokens shorter than a trigram", () => {
    expect(strictExpr("a to war")).toBe('"war"');
  });

  it("returns null when nothing is usable", () => {
    expect(strictExpr("a i")).toBeNull();
  });
});

describe("fuzzyExpr (the misspelled-author obligation)", () => {
  it("ORs the overlapping trigrams of the query", () => {
    expect(fuzzyExpr("war")).toBe('"war"');
    expect(fuzzyExpr("warn")).toBe('"war" OR "arn"');
  });
});
