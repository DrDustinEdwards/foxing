import { describe, expect, it } from "vitest";
import { cleanBookMarkup } from "../src/domain/epub-clean";

describe("cleanBookMarkup", () => {
  it("removes script, frames, forms and meta refresh with their content", () => {
    const out = cleanBookMarkup(
      '<html><head><meta http-equiv="refresh" content="0;url=https://x.example"/><base href="https://x.example/"/>' +
        '<script>alert(1)</script></head><body><form action="/x"><input name="a"/></form>' +
        '<iframe src="https://x.example"><p>in</p></iframe><object data="a"/><p>kept</p></body></html>',
    );
    expect(out).toBe("<html><head></head><body><p>kept</p></body></html>");
  });

  it("removes event handlers and unsafe link schemes, keeps safe ones", () => {
    const out = cleanBookMarkup(
      '<p><a href="java&#x73;cript:alert(1)" onclick="x()">a</a><a href="  jav&Tab;ascript:1">b</a>' +
        '<a href="chapter2.xhtml#n1">c</a><a href="https://example.com/?a=1&amp;b=2">d</a>' +
        '<img src="data:image/png;base64,AAAA" alt="e"/><img src="data:text/html,x"/>' +
        '<svg><a xlink:href="javascript:1"><text onload="x()">f</text></a><set attributeName="href" to="javascript:1"/></svg></p>',
    );
    expect(out).toBe(
      "<p><a>a</a><a>b</a>" +
        '<a href="chapter2.xhtml#n1">c</a><a href="https://example.com/?a=1&amp;b=2">d</a>' +
        '<img src="data:image/png;base64,AAAA" alt="e"/><img/>' +
        "<svg><a><text>f</text></a></svg></p>",
    );
  });

  it("keeps the XML declaration and doctype intact", () => {
    const page = '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Hi</p></body></html>';
    const declared = `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n${page}`;
    expect(cleanBookMarkup(declared)).toBe(declared);
  });

  it("keeps entities, empty elements, comments and CDATA as written", () => {
    const input = '<p class="x">a&nbsp;b<br/><span></span><!--c--><![CDATA[<x>]]></p>';
    expect(cleanBookMarkup(input)).toBe(input);
  });
});
