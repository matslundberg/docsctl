import type {
  ApiRange,
  BlockFlags,
  BlockNode,
  ContainerNode,
  DocumentModel,
  EmbeddedObjectBlockNode,
  HeadingRef,
  HorizontalRuleBlockNode,
  InlineImageNode,
  InlineNode,
  ModelIndex,
  ParagraphBlockNode,
  ParagraphStyle,
  RangeMap,
  RangeMapSegment,
  TableBlockNode,
  TableCellNode,
  TextRunInlineNode,
  TextStyle,
} from "./types";
import type { DocsDocument } from "../google/types";

type DocsElement = Record<string, any>;

function normalizeHeadingText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildBlockFlags(overrides: Partial<BlockFlags>): BlockFlags {
  return {
    isAtomic: false,
    containsInlineAtomic: false,
    isHeading: false,
    isListItem: false,
    isCodePara: false,
    ...overrides,
  };
}

function parseParagraphStyle(rawStyle: Record<string, any> | undefined): ParagraphStyle {
  if (!rawStyle) {
    return {};
  }
  return {
    namedStyleType: rawStyle.namedStyleType,
    alignment: rawStyle.alignment,
    indentStart: rawStyle.indentStart?.magnitude,
    indentEnd: rawStyle.indentEnd?.magnitude,
    lineSpacing: rawStyle.lineSpacing,
    shading: rawStyle.shading?.backgroundColor?.color?.rgbColor
      ? JSON.stringify(rawStyle.shading.backgroundColor.color.rgbColor)
      : undefined,
  };
}

function parseTextStyle(rawStyle: Record<string, any> | undefined): TextStyle {
  if (!rawStyle) {
    return {};
  }
  return {
    bold: rawStyle.bold,
    italic: rawStyle.italic,
    underline: rawStyle.underline,
    link: rawStyle.link?.url,
    fontFamily: rawStyle.fontFamily,
    fontSize: rawStyle.fontSize?.magnitude,
  };
}

function trimTrailingNewlines(text: string, segments: RangeMapSegment[]): { text: string; segments: RangeMapSegment[] } {
  let trimmed = 0;
  while (text.endsWith("\n")) {
    text = text.slice(0, -1);
    trimmed += 1;
  }

  if (trimmed === 0) {
    return { text, segments };
  }

  const updated = [...segments];
  let remaining = trimmed;
  for (let i = updated.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const segment = updated[i];
    const length = segment.textEnd - segment.textStart;
    if (length <= remaining) {
      remaining -= length;
      updated.pop();
    } else {
      segment.textEnd -= remaining;
      segment.docEnd -= remaining;
      remaining = 0;
    }
  }

  return { text, segments: updated };
}

function buildRangeMap(
  elements: DocsElement[]
): { plainText: string; runs: InlineNode[]; rangeMap: RangeMap; containsInlineAtomic: boolean } {
  let plainText = "";
  let cursor = 0;
  const segments: RangeMapSegment[] = [];
  const runs: InlineNode[] = [];
  let containsInlineAtomic = false;

  for (const element of elements) {
    const startIndex = typeof element.startIndex === "number" ? element.startIndex : 0;
    const endIndex = typeof element.endIndex === "number" ? element.endIndex : startIndex;

    if (element.textRun) {
      const content = String(element.textRun.content ?? "");
      const style = parseTextStyle(element.textRun.textStyle);
      const textStart = cursor;
      const textEnd = cursor + content.length;
      segments.push({
        textStart,
        textEnd,
        docStart: startIndex,
        docEnd: startIndex + content.length,
      });
      cursor = textEnd;
      plainText += content;
      const run: TextRunInlineNode = {
        kind: "text",
        text: content,
        style,
        apiRange: { start: startIndex, end: endIndex },
      };
      runs.push(run);
      continue;
    }

    if (element.inlineObjectElement) {
      containsInlineAtomic = true;
      const inline: InlineImageNode = {
        kind: "inlineImage",
        apiRange: { start: startIndex, end: endIndex },
      };
      runs.push(inline);
      continue;
    }
  }

  const trimmed = trimTrailingNewlines(plainText, segments);
  plainText = trimmed.text;

  return {
    plainText,
    runs,
    rangeMap: {
      segments: trimmed.segments,
      textLength: plainText.length,
    },
    containsInlineAtomic,
  };
}

function buildTableCells(rows: DocsElement[]): TableCellNode[][] {
  const cells: TableCellNode[][] = [];
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    const rowCells = Array.isArray(row?.tableCells) ? row.tableCells : [];
    const cellRow: TableCellNode[] = [];
    for (let c = 0; c < rowCells.length; c += 1) {
      cellRow.push({ row: r, col: c, blocks: [] });
    }
    cells.push(cellRow);
  }
  return cells;
}

export function buildDocumentModel(doc: DocsDocument): DocumentModel {
  const bodyContent = Array.isArray(doc.body?.content) ? doc.body?.content ?? [] : [];
  const blocks: BlockNode[] = [];
  const body: ContainerNode = {
    containerId: "body",
    children: [],
    apiRange: { start: 0, end: 0 },
  };

  const index: ModelIndex = {
    headingsInOrder: [],
    headingTextToNodes: new Map(),
    blocksUnderHeading: new Map(),
    nodeById: new Map(),
  };

  let nodeCounter = 1;
  let headingStack: HeadingRef[] = [];

  const pushBlock = (block: BlockNode) => {
    blocks.push(block);
    body.children.push(block);
    index.nodeById.set(block.nodeId, block);
    for (const heading of block.headingPath) {
      const list = index.blocksUnderHeading.get(heading.nodeId) ?? [];
      list.push(block.nodeId);
      index.blocksUnderHeading.set(heading.nodeId, list);
    }
  };

  for (const element of bodyContent) {
    const startIndex = typeof element.startIndex === "number" ? element.startIndex : 0;
    const endIndex = typeof element.endIndex === "number" ? element.endIndex : startIndex;
    const apiRange: ApiRange = { start: startIndex, end: endIndex };
    const nodeId = `node-${nodeCounter++}`;

    if (element.paragraph) {
      const paragraph = element.paragraph as DocsElement;
      const paragraphElements = Array.isArray(paragraph.elements) ? paragraph.elements : [];
      const { plainText, runs, rangeMap, containsInlineAtomic } = buildRangeMap(paragraphElements);
      const paraStyle = parseParagraphStyle(paragraph.paragraphStyle);
      const namedStyle = paraStyle.namedStyleType;
      const isHeading = typeof namedStyle === "string" && namedStyle.startsWith("HEADING_");
      const headingLevel = isHeading ? Number(namedStyle.split("_")[1]) : undefined;
      const isListItem = !!paragraph.bullet;

      const flags = buildBlockFlags({
        isHeading,
        headingLevel: headingLevel && Number.isFinite(headingLevel) ? headingLevel : undefined,
        isListItem,
        containsInlineAtomic,
      });

      let headingPath = [...headingStack];
      let headingRef: HeadingRef | null = null;

      if (isHeading && headingLevel) {
        headingRef = {
          nodeId,
          text: plainText,
          level: headingLevel,
        };
        headingPath = [...headingStack, headingRef];
      }

      const block: ParagraphBlockNode = {
        nodeId,
        type: "paragraph",
        parentContainerId: "body",
        apiRange,
        headingPath,
        flags,
        raw: {},
        plainText,
        runs,
        paraStyle,
        rangeMap,
      };

      pushBlock(block);

      if (headingRef) {
        headingStack = [...headingStack.filter((h) => h.level < headingRef.level), headingRef];
        index.headingsInOrder.push(nodeId);
        const key = normalizeHeadingText(headingRef.text);
        const existing = index.headingTextToNodes.get(key) ?? [];
        existing.push(nodeId);
        index.headingTextToNodes.set(key, existing);
      }

      continue;
    }

    if (element.table) {
      const table = element.table as DocsElement;
      const rows = Array.isArray(table.tableRows) ? table.tableRows : [];
      const cells = buildTableCells(rows);
      const nRows = rows.length;
      const nCols = rows[0]?.tableCells ? rows[0].tableCells.length : 0;

      const block: TableBlockNode = {
        nodeId,
        type: "table",
        parentContainerId: "body",
        apiRange,
        headingPath: [...headingStack],
        flags: buildBlockFlags({ isAtomic: true }),
        raw: {},
        nRows,
        nCols,
        cells,
      };

      pushBlock(block);
      continue;
    }

    if (element.horizontalRule) {
      const block: HorizontalRuleBlockNode = {
        nodeId,
        type: "horizontalRule",
        parentContainerId: "body",
        apiRange,
        headingPath: [...headingStack],
        flags: buildBlockFlags({ isAtomic: true }),
        raw: {},
      };
      pushBlock(block);
      continue;
    }

    if (element.sectionBreak) {
      const block: BlockNode = {
        nodeId,
        type: "sectionBreak",
        parentContainerId: "body",
        apiRange,
        headingPath: [...headingStack],
        flags: buildBlockFlags({}),
        raw: {},
      };
      pushBlock(block);
      continue;
    }

    if (element.pageBreak) {
      const block: BlockNode = {
        nodeId,
        type: "pageBreak",
        parentContainerId: "body",
        apiRange,
        headingPath: [...headingStack],
        flags: buildBlockFlags({}),
        raw: {},
      };
      pushBlock(block);
      continue;
    }

    if (element.embeddedObject) {
      const block: EmbeddedObjectBlockNode = {
        nodeId,
        type: "embed",
        parentContainerId: "body",
        apiRange,
        headingPath: [...headingStack],
        flags: buildBlockFlags({ isAtomic: true }),
        raw: {},
        objectKind: String(element.embeddedObject?.description ?? "embedded"),
      };
      pushBlock(block);
      continue;
    }
  }

  if (body.children.length > 0) {
    body.apiRange = {
      start: body.children[0].apiRange.start,
      end: body.children[body.children.length - 1].apiRange.end,
    };
  }

  return {
    docId: doc.documentId ?? "",
    revisionId: doc.revisionId ?? "",
    body,
    blocks,
    index,
  };
}
