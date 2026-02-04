import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";
import { buildObjectEntries, matchesObjectType } from "../src/cli/objectOutput";

const docFixture = {
  documentId: "doc-6",
  revisionId: "rev-6",
  body: {
    content: [
      {
        startIndex: 1,
        endIndex: 7,
        paragraph: {
          elements: [
            { startIndex: 1, endIndex: 7, textRun: { content: "Head\n" } },
          ],
          paragraphStyle: { namedStyleType: "HEADING_1" },
        },
      },
      {
        startIndex: 7,
        endIndex: 12,
        paragraph: {
          elements: [
            { startIndex: 7, endIndex: 9, textRun: { content: "A" } },
            { startIndex: 9, endIndex: 10, inlineObjectElement: {} },
            { startIndex: 10, endIndex: 12, textRun: { content: "\n" } },
          ],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
      {
        startIndex: 12,
        endIndex: 25,
        table: {
          tableRows: [{ tableCells: [{ content: [] }, { content: [] }] }],
        },
      },
      {
        startIndex: 25,
        endIndex: 26,
        horizontalRule: {},
      },
      {
        startIndex: 26,
        endIndex: 35,
        embeddedObject: { description: "Image" },
      },
    ],
  },
};

describe("object output", () => {
  it("builds object entries by type", () => {
    const model = buildDocumentModel(docFixture);
    const tables = buildObjectEntries(model, "table");
    const hrs = buildObjectEntries(model, "hr");
    const images = buildObjectEntries(model, "image");

    expect(tables.length).toBe(1);
    expect(tables[0].description).toContain("Table");
    expect(hrs.length).toBe(1);
    expect(images.length).toBe(2);
    expect(images[0].type).toBe("image");
  });

  it("matches object types", () => {
    const model = buildDocumentModel(docFixture);
    const table = model.blocks.find((block) => block.type === "table");
    if (!table) throw new Error("Missing table");
    expect(matchesObjectType(table, "table")).toBe(true);
    expect(matchesObjectType(table, "hr")).toBe(false);
  });
});
