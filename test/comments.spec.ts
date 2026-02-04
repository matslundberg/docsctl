import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";
import { parseSelector } from "../src/dsl/selector/parser";
import { resolveTarget } from "../src/resolver/resolve";
import { mapOffsetToIndex } from "../src/compiler/rangeMap";
import { buildCommentAnchor } from "../src/cli/commentAnchor";

const docFixture = {
  documentId: "doc-5",
  revisionId: "rev-5",
  body: {
    content: [
      {
        startIndex: 1,
        endIndex: 10,
        paragraph: {
          elements: [
            {
              startIndex: 1,
              endIndex: 10,
              textRun: { content: "Comment\n" },
            },
          ],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
    ],
  },
};

describe("comments helpers", () => {
  it("maps comment anchor offsets", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("ment", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    if (!target.textRange) {
      throw new Error("Expected textRange");
    }
    const startIndex = mapOffsetToIndex(target.textRange.paragraph, target.textRange.startOffset);
    const endIndex = mapOffsetToIndex(target.textRange.paragraph, target.textRange.endOffset);
    expect(startIndex).toBe(4);
    expect(endIndex).toBe(8);
  });

  it("builds comment anchor with text and indices", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("ment", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    if (!target.textRange) {
      throw new Error("Expected textRange");
    }
    const anchor = buildCommentAnchor(
      target.textRange.paragraph,
      target.textRange.startOffset,
      target.textRange.endOffset
    );
    expect(anchor.anchor).toBe("text=ment&startIndex=4&endIndex=8");
  });

  it("uses text-only anchor for headings", () => {
    const headingDoc = {
      documentId: "doc-heading",
      revisionId: "rev-heading",
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 8,
            paragraph: {
              elements: [
                { startIndex: 1, endIndex: 8, textRun: { content: "Title\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
        ],
      },
    };
    const model = buildDocumentModel(headingDoc);
    const selector = parseSelector('match("Title", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    if (!target.textRange) throw new Error("Expected textRange");
    const anchor = buildCommentAnchor(
      target.textRange.paragraph,
      target.textRange.startOffset,
      target.textRange.endOffset
    );
    expect(anchor.anchor).toBe("text=Title");
  });
});
