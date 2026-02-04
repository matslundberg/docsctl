import { describe, it, expect } from "bun:test";
import { parseCommandTokens } from "../src/cli/commandParser";

describe("command parser", () => {
  it("parses edit insert", () => {
    const parsed = parseCommandTokens([
      "edit",
      "insert",
      "before",
      "doc-1",
      "--select",
      'heading("Title")',
      "--text",
      "Hello",
    ]);
    expect(parsed.type).toBe("editInsert");
    if (parsed.type !== "editInsert") return;
    expect(parsed.position).toBe("before");
    expect(parsed.docId).toBe("doc-1");
    expect(parsed.flags.select).toBe('heading("Title")');
  });

  it("parses style code format", () => {
    const parsed = parseCommandTokens([
      "style",
      "code",
      "format",
      "doc-2",
      "--select",
      'betweenHeadings("A", "B")',
    ]);
    expect(parsed.type).toBe("code");
    if (parsed.type !== "code") return;
    expect(parsed.action).toBe("format");
    expect(parsed.docId).toBe("doc-2");
  });

  it("parses multi-word flag values", () => {
    const parsed = parseCommandTokens([
      "comments",
      "add",
      "doc-3",
      "--text",
      "Needs",
      "more",
      "detail",
      "--select",
      'match("detail")',
    ]);
    expect(parsed.type).toBe("commentsAdd");
    if (parsed.type !== "commentsAdd") return;
    expect(parsed.flags.text).toBe("Needs more detail");
  });

  it("parses boolean flags", () => {
    const parsed = parseCommandTokens([
      "comments",
      "add",
      "doc-4",
      "--select",
      'match("Role")',
      "--text",
      "Hello",
      "--unanchored",
    ]);
    expect(parsed.type).toBe("commentsAdd");
    if (parsed.type !== "commentsAdd") return;
    expect(parsed.flags.unanchored).toBe(true);
  });
});
