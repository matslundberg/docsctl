import { describe, it, expect } from "bun:test";
import { buildDocumentModel } from "../src/model/documentModel";
import { parseSelector } from "../src/dsl/selector/parser";
import { parseGuard } from "../src/dsl/guard/parser";
import { resolveTarget } from "../src/resolver/resolve";
import { evaluateGuards } from "../src/resolver/guards";
import {
  AmbiguousMatchError,
  ExpectationFailedError,
  RevisionMismatchError,
  UnsupportedSelectionError,
} from "../src/resolver/errors";

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
      {
        startIndex: 22,
        endIndex: 36,
        paragraph: {
          elements: [
            {
              startIndex: 22,
              endIndex: 36,
              textRun: { content: "Hello again\n" },
            },
          ],
          paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
        },
      },
    ],
  },
};

describe("resolver", () => {
  it("resolves heading selectors", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('heading("Title")');
    const target = resolveTarget(model, selector, null);
    expect(target.kind).toBe("block");
    expect(target.block?.flags.isHeading).toBe(true);
  });

  it("resolves match occurrences", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("Hello", occurrence=2)');
    const target = resolveTarget(model, selector, null);
    expect(target.kind).toBe("textRange");
    expect(target.textRange?.startOffset).toBe(0);
    expect(target.textRange?.endOffset).toBe(5);
  });

  it("throws on ambiguous matches", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("Hello")');
    expect(() => resolveTarget(model, selector, null)).toThrow(AmbiguousMatchError);
  });

  it("evaluates guards", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("Hello", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    const guard = parseGuard('expectContains("world")');
    expect(() => evaluateGuards(model, target, guard)).not.toThrow();
  });

  it("fails guards when expectations do not match", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("Hello", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    const guard = parseGuard('expectNotContains("world")');
    expect(() => evaluateGuards(model, target, guard)).toThrow(ExpectationFailedError);
  });

  it("fails revision guards", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('match("Hello", occurrence=1)');
    const target = resolveTarget(model, selector, null);
    const guard = parseGuard('ifRevision("wrong")');
    expect(() => evaluateGuards(model, target, guard)).toThrow(RevisionMismatchError);
  });

  it("rejects range-only guards on block selections", () => {
    const model = buildDocumentModel(docFixture);
    const selector = parseSelector('heading("Title")');
    const target = resolveTarget(model, selector, null);
    const guard = parseGuard('expectRangeTextEquals("Title")');
    expect(() => evaluateGuards(model, target, guard)).toThrow(UnsupportedSelectionError);
  });

  it("selects inline images with objects selector", () => {
    const inlineDoc = {
      documentId: "doc-inline",
      revisionId: "rev-inline",
      body: {
        content: [
          {
            startIndex: 1,
            endIndex: 6,
            paragraph: {
              elements: [
                { startIndex: 1, endIndex: 2, textRun: { content: "A" } },
                { startIndex: 2, endIndex: 3, inlineObjectElement: {} },
                { startIndex: 3, endIndex: 6, textRun: { content: "\n" } },
              ],
              paragraphStyle: { namedStyleType: "NORMAL_TEXT" },
            },
          },
        ],
      },
    };

    const model = buildDocumentModel(inlineDoc);
    const selector = parseSelector('objects(type="image")');
    const target = resolveTarget(model, selector, null);
    expect(target.kind).toBe("block");
    expect(target.block?.nodeId.startsWith("inline-")).toBe(true);
  });
});
