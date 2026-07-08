import { describe, expect, it } from "vitest";
import { buyLinks } from "../src/config/affiliate";

describe("affiliate buyLinks", () => {
  it("orders Bookshop before Amazon (house rule 4)", () => {
    const links = buyLinks(
      { bookshopUrl: "https://bookshop.org/book/x", amazonUrl: "https://www.amazon.com/dp/X" },
      { amazonTag: "foxing-20", bookshopId: "12345" },
    );
    expect(links.map((l) => l.retailer)).toEqual(["bookshop", "amazon"]);
  });

  it("builds the Bookshop affiliate deep link from isbn13 + affiliate id", () => {
    const [bookshop] = buyLinks({ isbn13: "9780143105428" }, { bookshopId: "12345" });
    expect(bookshop.url).toBe("https://bookshop.org/a/12345/9780143105428");
  });

  it("appends the Amazon tag to a stored canonical url", () => {
    const links = buyLinks({ amazonUrl: "https://www.amazon.com/dp/ABC123" }, { amazonTag: "foxing-20" });
    expect(links[0].url).toContain("tag=foxing-20");
  });

  it("returns nothing when there is nothing to link", () => {
    expect(buyLinks({}, {})).toEqual([]);
  });
});
