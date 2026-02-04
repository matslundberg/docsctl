import { describe, it, expect } from "bun:test";
import { buildGuardExpression } from "../src/cli/resolveSelection";
import { parseGuard } from "../src/dsl/guard/parser";
import { normalizeGuard } from "../src/dsl/guard/normalize";

describe("cli guard wiring", () => {
  it("builds guard expression from sugar flags", () => {
    const expr = buildGuardExpression({ ifRevision: "rev-1", expect: "hello" });
    expect(expr).toBe('all(ifRevision("rev-1"), expectContains("hello"))');
  });

  it("returns raw guard when no sugar", () => {
    const expr = buildGuardExpression({ guard: 'expectContains("hi")' });
    expect(expr).toBe('expectContains("hi")');
  });

  it("normalizes combined guard expression", () => {
    const expr = buildGuardExpression({
      guard: 'expectNotContains("x")',
      ifRevision: "rev-1",
    });
    expect(expr).toBe('all(ifRevision("rev-1"), expectNotContains("x"))');
    const guard = parseGuard(expr ?? "");
    expect(normalizeGuard(guard)).toBe('all(ifRevision("rev-1"), expectNotContains("x"))');
  });
});
