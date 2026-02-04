import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";
import { parseSelector } from "../src/dsl/selector/parser";
import { resolveTarget } from "../src/resolver/resolve";
import { computeDiffPreview } from "../src/diff/preview";

const docFixture = {
  documentId: "doc-7",
  revisionId: "rev-7",
  body: {
    content: [
      {
        startIndex: 1,
        endIndex: 8,
        paragraph: {
          elements: [
            { startIndex: 1, endIndex: 7, textRun: { content: "Title\n" } },
          ],
          paragraphStyle: { namedStyleType: "HEADING_1" },
        },
      },
      {
        startIndex: 8,
        endIndex: 22,
        paragraph: {
          elements: [
            { startIndex: 8, endIndex: 22, textRun: { content: "Hello world\n" } },
          ],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
    ],
  },
};

describe("diff preview", () => {
  it("computes replace preview", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("Hello", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    const preview = computeDiffPreview(target, { kind: "replace", text: "Hi" });
    expect(preview.before).toBe("Hello");
    expect(preview.after).toBe("Hi");
  });

  it("computes insert preview", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('heading("Title")');
    const target = resolveTarget(model, selector, null);
    const preview = computeDiffPreview(target, { kind: "insert", position: "after", text: "Intro" });
    expect(preview.after).toContain("Intro");
  });
});
