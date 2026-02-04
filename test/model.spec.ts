import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";

const docFixture = {
  documentId: "doc-123",
  revisionId: "rev-1",
  body: {
    content: [
      {
        startIndex: 1,
        endIndex: 8,
        paragraph: {
          elements: [
            {
              startIndex: 1,
              endIndex: 7,
              textRun: {
                content: "Title\n",
                textStyle: {},
              },
            },
          ],
          paragraphStyle: { namedStyleType: "HEADING_1" },
        },
      },
      {
        startIndex: 8,
        endIndex: 21,
        paragraph: {
          elements: [
            {
              startIndex: 8,
              endIndex: 21,
              textRun: {
                content: "Hello world\n",
                textStyle: { bold: true },
              },
            },
          ],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
      {
        startIndex: 21,
        endIndex: 24,
        paragraph: {
          elements: [
            {
              startIndex: 21,
              endIndex: 22,
              textRun: {
                content: "A",
              },
            },
            {
              startIndex: 22,
              endIndex: 23,
              inlineObjectElement: {},
            },
            {
              startIndex: 23,
              endIndex: 24,
              textRun: {
                content: "\n",
              },
            },
          ],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
      {
        startIndex: 24,
        endIndex: 40,
        table: {
          tableRows: [{ tableCells: [{ content: [] }] }],
        },
      },
      {
        startIndex: 40,
        endIndex: 41,
        horizontalRule: {},
      },
    ],
  },
};

describe("buildDocumentModel", () => {
  it("builds blocks, headings, and flags", () => {
    const model = buildDocumentModel(docFixture);

    expect(model.docId).toBe("doc-123");
    expect(model.revisionId).toBe("rev-1");
    expect(model.blocks.length).toBe(5);

    const heading = model.blocks[0];
    expect(heading.type).toBe("paragraph");
    expect(heading.flags.isHeading).toBe(true);
    expect(heading.flags.headingLevel).toBe(1);
    expect(model.index.headingsInOrder.length).toBe(1);

    const para = model.blocks[1];
    expect(para.type).toBe("paragraph");
    expect(para.flags.isHeading).toBe(false);

    const inlinePara = model.blocks[2];
    expect(inlinePara.type).toBe("paragraph");
    expect(inlinePara.flags.containsInlineAtomic).toBe(true);

    const table = model.blocks[3];
    expect(table.type).toBe("table");
    expect(table.flags.isAtomic).toBe(true);

    const hr = model.blocks[4];
    expect(hr.type).toBe("horizontalRule");
    expect(hr.flags.isAtomic).toBe(true);
  });

  it("trims trailing newline in plainText and range map", () => {
    const model = buildDocumentModel(docFixture);
    const heading = model.blocks[0] as any;

    expect(heading.plainText).toBe("Title");
    expect(heading.rangeMap.textLength).toBe(5);
    expect(heading.rangeMap.segments.length).toBe(1);
    const segment = heading.rangeMap.segments[0];
    expect(segment.textStart).toBe(0);
    expect(segment.textEnd).toBe(5);
  });
});
