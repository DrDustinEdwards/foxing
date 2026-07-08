import { describe, expect, it } from "vitest";
import { buyLinks } from "../src/config/affiliate";

describe("affiliate buyLinks", () => {
  it("orders Bookshop before Amazon, library last (house rule 4)", () => {
    const links = buyLinks(
      {
        title: "Middlemarch",
        author: "George Eliot",
        bookshopUrl: "https://bookshop.org/book/x",
        amazonUrl: "https://www.amazon.com/dp/X",
      },
      { amazonTag: "foxing-20", bookshopId: "12345" },
    );
    expect(links.map((l) => l.retailer)).toEqual(["bookshop", "amazon", "library"]);
  });

  it("builds the Bookshop affiliate deep link from isbn13 + affiliate id", () => {
    const bookshop = buyLinks(
      { title: "X", isbn13: "9780143105428" },
      { bookshopId: "12345" },
    ).find((l) => l.retailer === "bookshop");
    expect(bookshop?.url).toBe("https://bookshop.org/a/12345/9780143105428");
  });

  it("appends the Amazon tag to a stored canonical url", () => {
    const amazon = buyLinks(
      { title: "X", amazonUrl: "https://www.amazon.com/dp/ABC123" },
      { amazonTag: "foxing-20" },
    ).find((l) => l.retailer === "amazon");
    expect(amazon?.url).toContain("tag=foxing-20");
  });

  it("falls back to search links for a classic with no stored urls (every book page has links)", () => {
    const links = buyLinks({ title: "Frankenstein", author: "Mary Shelley" }, {});
    expect(links.map((l) => l.retailer)).toEqual(["bookshop", "amazon", "library"]);
    expect(links.every((l) => l.url.includes("Frankenstein"))).toBe(true);
    // The library link is not marked sponsored.
    expect(links.find((l) => l.retailer === "library")?.sponsored).toBe(false);
  });

  it("returns nothing when there is nothing to search or link", () => {
    expect(buyLinks({}, {})).toEqual([]);
  });
});
