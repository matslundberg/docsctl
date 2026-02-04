import { describe, it, expect } from "bun:test";
import { parseSelector } from "../src/dsl/selector/parser";
import { normalizeSelector } from "../src/dsl/selector/normalize";
import { parseGuard } from "../src/dsl/guard/parser";
import { normalizeGuard } from "../src/dsl/guard/normalize";

describe("dsl", () => {
  it("parses and normalizes selector call chains", () => {
    const selector = parseSelector('under(heading("Title")).match("foo", occurrence=2).nth(1)');
    const normalized = normalizeSelector(selector);
    expect(normalized).toBe('under(heading("Title")).match("foo", occurrence=2).nth(1)');
  });

  it("parses and normalizes guard call chains", () => {
    const guard = parseGuard('all(ifRevision("REV"), expectContains("hi"))');
    const normalized = normalizeGuard(guard);
    expect(normalized).toBe('all(ifRevision("REV"), expectContains("hi"))');
  });

  it("parses named arguments with nested calls", () => {
    const selector = parseSelector('betweenHeadings("A", "B").paragraphs(in=under(heading("X"))).one()');
    const normalized = normalizeSelector(selector);
    expect(normalized).toBe('betweenHeadings("A", "B").paragraphs(in=under(heading("X"))).one()');
  });
});
