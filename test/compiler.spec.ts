import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";
import { parseSelector } from "../src/dsl/selector/parser";
import { resolveTarget } from "../src/resolver/resolve";
import { compileTarget } from "../src/compiler/compile";

const docFixture = {
  documentId: "doc-1",
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
              textRun: { content: "Title\n" },
            },
          ],
          paragraphStyle: { namedStyleType: "HEADING_1" },
        },
      },
      {
        startIndex: 8,
        endIndex: 22,
        paragraph: {
          elements: [
            {
              startIndex: 8,
              endIndex: 22,
              textRun: { content: "Hello world\n" },
            },
          ],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
    ],
  },
};

describe("compiler", () => {
  it("compiles replace match to delete+insert", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("Hello", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "replaceMatch", text: "Hi" });

    expect(compiled.requests.length).toBe(2);
    const deleteReq = compiled.requests[0] as any;
    const insertReq = compiled.requests[1] as any;
    expect(deleteReq.deleteContentRange.range.startIndex).toBe(8);
    expect(deleteReq.deleteContentRange.range.endIndex).toBe(13);
    expect(insertReq.insertText.location.index).toBe(8);
    expect(insertReq.insertText.text).toBe("Hi");
  });

  it("compiles insert before paragraph", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('heading("Title")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "insert", position: "before", text: "Intro" });

    expect(compiled.requests.length).toBe(1);
    const insertReq = compiled.requests[0] as any;
    expect(insertReq.insertText.location.index).toBe(1);
    expect(insertReq.insertText.text).toBe("Intro\n");
  });

  it("compiles style set", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("world", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "styleSet", style: { bold: true } });

    expect(compiled.requests.length).toBe(1);
    const styleReq = compiled.requests[0] as any;
    expect(styleReq.updateTextStyle.range.startIndex).toBe(14);
    expect(styleReq.updateTextStyle.range.endIndex).toBe(19);
    expect(styleReq.updateTextStyle.textStyle.bold).toBe(true);
  });

  it("compiles paragraph style", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('heading("Title")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "paragraphStyle", style: { namedStyleType: "HEADING_2" } });

    expect(compiled.requests.length).toBe(1);
    const paraReq = compiled.requests[0] as any;
    expect(paraReq.updateParagraphStyle.paragraphStyle.namedStyleType).toBe("HEADING_2");
  });

  it("compiles code insert", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('heading("Title")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "codeInsert", text: "code" });

    expect(compiled.requests.length).toBe(3);
    const insertReq = compiled.requests[0] as any;
    const paraReq = compiled.requests[1] as any;
    const textReq = compiled.requests[2] as any;

    expect(insertReq.insertText.location.index).toBe(8);
    expect(insertReq.insertText.text).toBe("code\n");
    expect(paraReq.updateParagraphStyle.range.startIndex).toBe(8);
    expect(paraReq.updateParagraphStyle.range.endIndex).toBe(13);
    expect(textReq.updateTextStyle.range.startIndex).toBe(8);
    expect(textReq.updateTextStyle.range.endIndex).toBe(13);
  });

  it("compiles code format", () => {
    const sectionDoc = {
      documentId: "doc-3",
      revisionId: "rev-3",
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
            endIndex: 13,
            paragraph: {
              elements: [
                { startIndex: 7, endIndex: 13, textRun: { content: "Code\n" } },
              ],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
          {
            startIndex: 13,
            endIndex: 20,
            paragraph: {
              elements: [
                { startIndex: 13, endIndex: 20, textRun: { content: "Block\n" } },
              ],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
          {
            startIndex: 20,
            endIndex: 26,
            paragraph: {
              elements: [
                { startIndex: 20, endIndex: 26, textRun: { content: "Tail\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
        ],
      },
    };

    const model = buildDocumentModel(sectionDoc);
    const selector = parseSelector('betweenHeadings("Head", "Tail")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "codeFormat" });

    expect(compiled.requests.length).toBe(2);
    const paraReq = compiled.requests[0] as any;
    const textReq = compiled.requests[1] as any;
    expect(paraReq.updateParagraphStyle.range.startIndex).toBe(7);
    expect(paraReq.updateParagraphStyle.range.endIndex).toBe(20);
    expect(textReq.updateTextStyle.range.startIndex).toBe(7);
    expect(textReq.updateTextStyle.range.endIndex).toBe(20);
  });

  it("compiles replace section", () => {
    const sectionDoc = {
      documentId: "doc-2",
      revisionId: "rev-2",
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 7,
            paragraph: {
              elements: [
                { startIndex: 1, endIndex: 7, textRun: { content: "Start\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
          {
            startIndex: 7,
            endIndex: 13,
            paragraph: {
              elements: [
                { startIndex: 7, endIndex: 13, textRun: { content: "Alpha\n" } },
              ],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
          {
            startIndex: 13,
            endIndex: 18,
            paragraph: {
              elements: [
                { startIndex: 13, endIndex: 18, textRun: { content: "Beta\n" } },
              ],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
          {
            startIndex: 18,
            endIndex: 22,
            paragraph: {
              elements: [
                { startIndex: 18, endIndex: 22, textRun: { content: "End\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
        ],
      },
    };

    const model = buildDocumentModel(sectionDoc);
    const selector = parseSelector('betweenHeadings("Start", "End")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "replaceSection", text: "New" });

    expect(compiled.requests.length).toBe(3);
    const deleteReq = compiled.requests[0] as any;
    const insertReq = compiled.requests[1] as any;
    const styleReq = compiled.requests[2] as any;
    expect(deleteReq.deleteContentRange.range.startIndex).toBe(7);
    expect(deleteReq.deleteContentRange.range.endIndex).toBe(18);
    expect(insertReq.insertText.location.index).toBe(7);
    expect(insertReq.insertText.text).toBe("New\n");
    expect(styleReq.updateParagraphStyle.paragraphStyle.namedStyleType).toBe("NORMAL_TEXT");
  });

  it("compiles replace section with bullets", () => {
    const bulletDoc = {
      documentId: "doc-bullets",
      revisionId: "rev-bullets",
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 7,
            paragraph: {
              elements: [
                { startIndex: 1, endIndex: 7, textRun: { content: "Start\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
          {
            startIndex: 7,
            endIndex: 13,
            paragraph: {
              elements: [
                { startIndex: 7, endIndex: 13, textRun: { content: "Alpha\n" } },
              ],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
          {
            startIndex: 13,
            endIndex: 18,
            paragraph: {
              elements: [
                { startIndex: 13, endIndex: 18, textRun: { content: "End\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
        ],
      },
    };
    const model = buildDocumentModel(bulletDoc);
    const selector = parseSelector('betweenHeadings("Start", "End")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, {
      kind: "replaceSection",
      text: "- First\n- Second",
    });

    expect(compiled.requests.length).toBe(4);
    const insertReq = compiled.requests[1] as any;
    const bulletsReq = compiled.requests[3] as any;
    expect(insertReq.insertText.text).toBe("First\nSecond\n");
    expect(bulletsReq.createParagraphBullets.bulletPreset).toBe("BULLET_DISC_CIRCLE_SQUARE");
  });

  it("compiles replace section with numbers", () => {
    const bulletDoc = {
      documentId: "doc-num",
      revisionId: "rev-num",
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 7,
            paragraph: {
              elements: [
                { startIndex: 1, endIndex: 7, textRun: { content: "Start\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
          {
            startIndex: 7,
            endIndex: 13,
            paragraph: {
              elements: [
                { startIndex: 7, endIndex: 13, textRun: { content: "Alpha\n" } },
              ],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
          {
            startIndex: 13,
            endIndex: 18,
            paragraph: {
              elements: [
                { startIndex: 13, endIndex: 18, textRun: { content: "End\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
        ],
      },
    };
    const model = buildDocumentModel(bulletDoc);
    const selector = parseSelector('betweenHeadings("Start", "End")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, {
      kind: "replaceSection",
      text: "1. First\n2. Second",
    });

    expect(compiled.requests.length).toBe(4);
    const bulletsReq = compiled.requests[3] as any;
    expect(bulletsReq.createParagraphBullets.bulletPreset).toBe("NUMBERED_DECIMAL");
  });

  it("compiles object insert", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('heading("Title")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, {
      kind: "objectInsert",
      objectType: "embed",
      data: { uri: "https://example.com/embed.png", altText: "Alt" },
    });

    expect(compiled.requests.length).toBe(1);
    const req = compiled.requests[0] as any;
    expect(req.insertInlineImage.location.index).toBe(8);
    expect(req.insertInlineImage.uri).toBe("https://example.com/embed.png");
  });

  it("compiles object delete", () => {
    const objectDoc = {
      documentId: "doc-4",
      revisionId: "rev-4",
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 5,
            paragraph: {
              elements: [
                { startIndex: 1, endIndex: 5, textRun: { content: "Head\n" } },
              ],
              paragraphStyle: { namedStyleType: "HEADING_1" },
            },
          },
          {
            startIndex: 5,
            endIndex: 9,
            horizontalRule: {},
          },
        ],
      },
    };
    const model = buildDocumentModel(objectDoc);
    const selector = parseSelector('objects(type="hr")');
    const target = resolveTarget(model, selector, null);
    const compiled = compileTarget(target, { kind: "objectDelete" });

    expect(compiled.requests.length).toBe(1);
    const req = compiled.requests[0] as any;
    expect(req.deleteContentRange.range.startIndex).toBe(5);
    expect(req.deleteContentRange.range.endIndex).toBe(9);
  });
});
