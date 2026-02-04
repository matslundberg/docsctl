import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";
import { buildList, buildOutline } from "../src/cli/docOutput";

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
        endIndex: 30,
        table: {
          tableRows: [{ tableCells: [{ content: [] }] }],
        },
      },
      {
        startIndex: 30,
        endIndex: 31,
        horizontalRule: {},
      },
    ],
  },
};

describe("doc output helpers", () => {
  it("buildOutline returns heading entries", () => {
    const model = buildDocumentModel(docFixture);
    const outline = buildOutline(model, false);

    expect(outline.length).toBe(1);
    expect(outline[0].text).toBe("Title");
    expect(outline[0].level).toBe(1);
    expect(outline[0].path).toEqual(["Title"]);
    expect(outline[0].objects).toBeUndefined();
  });

  it("buildOutline includes object counts when enabled", () => {
    const model = buildDocumentModel(docFixture);
    const outline = buildOutline(model, true);

    expect(outline.length).toBe(1);
    expect(outline[0].objects).toEqual({
      atomic: 2,
      tables: 1,
      horizontalRules: 1,
      embeds: 0,
    });
  });

  it("buildList returns block snippets", () => {
    const model = buildDocumentModel(docFixture);
    const list = buildList(model);

    expect(list.length).toBe(4);
    expect(list[0].snippet).toBe("Title");
    expect(list[2].snippet).toBe("Table 1x1");
    expect(list[3].snippet).toBe("Horizontal rule");
  });

  it("buildList filters by blocks", () => {
    const model = buildDocumentModel(docFixture);
    const list = buildList(model, [model.blocks[0]]);
    expect(list.length).toBe(1);
    expect(list[0].snippet).toBe("Title");
  });
});
