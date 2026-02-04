import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";
import { paragraphEndIndex } from "../src/compiler/rangeMap";

const docFixture = {
  documentId: "doc-range",
  revisionId: "rev-range",
  body: {
    content: [
      {
        startIndex: 1,
        endIndex: 7,
        paragraph: {
          elements: [
            {
              startIndex: 1,
              endIndex: 7,
              textRun: { content: "Title\n" },
            },
          ],
          paragraphStyle: { namedStyleType: "HEADING_1" },
        },
      },
    ],
  },
};

describe("range map helpers", () => {
  it("returns paragraph end index including newline", () => {
    const model = buildDocumentModel(docFixture);
    const paragraph = model.blocks[0] as any;
    expect(paragraphEndIndex(paragraph)).toBe(7);
  });
});
