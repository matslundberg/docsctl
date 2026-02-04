import type { ParagraphBlockNode, ResolvedTarget } from "../model/types";
import { mapOffsetToIndex, paragraphEndIndex } from "./rangeMap";
import {
  deleteRangeRequest,
  createParagraphBulletsRequest,
  insertTextRequest,
  insertInlineImageRequest,
  insertHorizontalRuleRequest,
  insertTableRequest,
  updateParagraphStyleRequest,
  updateTextStyleRequest,
} from "./requests";
import {
  AtomicObjectConflictError,
  InlineObjectConflictError,
  UnsupportedSelectionError,
} from "../resolver/errors";

export interface CompileResult {
  requests: unknown[];
}

export type CompileParams =
  | { kind: "insert"; position: "before" | "after"; text: string }
  | { kind: "replaceMatch"; text: string }
  | { kind: "replaceSection"; text: string }
  | { kind: "codeInsert"; text: string }
  | { kind: "codeFormat" }
  | { kind: "objectInsert"; objectType: "image" | "table" | "hr" | "embed"; data: Record<string, unknown> }
  | { kind: "objectDelete" }
  | { kind: "delete" }
  | { kind: "styleSet"; style: Record<string, unknown> }
  | { kind: "styleLink"; url: string }
  | { kind: "paragraphStyle"; style: Record<string, unknown> };

function ensureNoInlineAtomic(target: ResolvedTarget) {
  if (target.context.conflicts.some((conflict) => conflict.startsWith("inline:"))) {
    throw new InlineObjectConflictError({ conflicts: target.context.conflicts });
  }
}

function ensureNoAtomic(target: ResolvedTarget) {
  if (target.context.conflicts.some((conflict) => conflict.startsWith("atomic:"))) {
    throw new AtomicObjectConflictError({ conflicts: target.context.conflicts });
  }
}

function getParagraphRangeIndexes(paragraph: ParagraphBlockNode, startOffset: number, endOffset: number) {
  const startIndex = mapOffsetToIndex(paragraph, startOffset);
  const endIndex = mapOffsetToIndex(paragraph, endOffset);
  if (endIndex < startIndex) {
    throw new Error("Invalid range for paragraph offsets");
  }
  return { startIndex, endIndex };
}

function normalizeInsertText(text: string): string {
  if (text.length === 0) {
    return text;
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

type ListStyle = "bullet" | "number";

function stripListPrefix(line: string): { text: string; style: ListStyle } | null {
  if (line.startsWith("• ")) {
    return { text: line.slice(2), style: "bullet" };
  }
  if (line.startsWith("- ")) {
    return { text: line.slice(2), style: "bullet" };
  }
  if (line.startsWith("* ")) {
    return { text: line.slice(2), style: "bullet" };
  }
  const orderedMatch = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
  if (orderedMatch) {
    return { text: orderedMatch[2], style: "number" };
  }
  return null;
}

function normalizeListText(text: string): { text: string; listStyle: ListStyle | null } {
  const trimmed = text.replace(/\s+$/u, "");
  if (!trimmed) {
    return { text: "", listStyle: null };
  }
  const lines = trimmed.split(/\r?\n/);
  let detectedStyle: ListStyle | null = null;
  const normalizedLines = lines.map((line) => {
    const stripped = stripListPrefix(line.trimEnd());
    if (stripped !== null) {
      detectedStyle = detectedStyle ?? stripped.style;
      return stripped.text;
    }
    return line;
  });

  const hasNonBullet = normalizedLines.some((line, index) => {
    if (lines[index].trim() === "") {
      return false;
    }
    return stripListPrefix(lines[index].trimEnd()) === null;
  });

  if (detectedStyle && !hasNonBullet) {
    return { text: normalizeInsertText(normalizedLines.join("\n")), listStyle: detectedStyle };
  }

  return { text: normalizeInsertText(text), listStyle: null };
}

function getCodeParagraphStyle() {
  return {
    shading: {
      backgroundColor: {
        color: {
          rgbColor: { red: 0.96, green: 0.96, blue: 0.96 },
        },
      },
    },
  };
}

function getCodeTextStyle() {
  return {
    fontFamily: "Courier New",
  };
}

function collectParagraphs(target: ResolvedTarget): ParagraphBlockNode[] {
  if (target.kind === "block" && target.block?.type === "paragraph") {
    return [target.block as ParagraphBlockNode];
  }
  if (target.kind === "blockRange" && target.blocks) {
    const paragraphs = target.blocks.filter(
      (block): block is ParagraphBlockNode => block.type === "paragraph"
    );
    if (paragraphs.length !== target.blocks.length) {
      throw new UnsupportedSelectionError({ expected: "paragraph blocks" });
    }
    return paragraphs;
  }
  throw new UnsupportedSelectionError({ expected: "paragraph blocks" });
}

export function compileTarget(target: ResolvedTarget, params: CompileParams): CompileResult {
  switch (params.kind) {
    case "insert": {
      if (target.kind !== "block" || !target.block || target.block.type !== "paragraph") {
        throw new UnsupportedSelectionError({ expected: "block(paragraph)" });
      }
      ensureNoInlineAtomic(target);
      const text = normalizeInsertText(params.text);
      const paragraph = target.block as ParagraphBlockNode;
      const insertIndex =
        params.position === "before" ? paragraph.apiRange.start : paragraphEndIndex(paragraph);
      return { requests: [insertTextRequest(insertIndex, text)] };
    }
    case "replaceMatch": {
      if (target.kind !== "textRange" || !target.textRange) {
        throw new UnsupportedSelectionError({ expected: "textRange" });
      }
      ensureNoInlineAtomic(target);
      const { paragraph, startOffset, endOffset } = target.textRange;
      const { startIndex, endIndex } = getParagraphRangeIndexes(paragraph, startOffset, endOffset);
      return {
        requests: [
          deleteRangeRequest(startIndex, endIndex),
          insertTextRequest(startIndex, params.text),
        ],
      };
    }
    case "replaceSection": {
      if (
        (target.kind === "blockRange" && target.blocks && target.blocks.length > 0) ||
        (target.kind === "block" && target.block)
      ) {
        ensureNoInlineAtomic(target);
        ensureNoAtomic(target);
        const start =
          target.kind === "blockRange"
            ? target.blocks![0].apiRange.start
            : target.block!.apiRange.start;
        const end =
          target.kind === "blockRange"
            ? target.blocks![target.blocks!.length - 1].apiRange.end
            : target.block!.apiRange.end;
        const requests = [deleteRangeRequest(start, end)];
        const normalized = normalizeListText(params.text);
        if (normalized.text.length > 0) {
          requests.push(insertTextRequest(start, normalized.text));
          const insertedEnd = start + normalized.text.length;
          requests.push(updateParagraphStyleRequest(start, insertedEnd, { namedStyleType: "NORMAL_TEXT" }));
          if (normalized.listStyle) {
            const preset = normalized.listStyle === "number" ? "NUMBERED_DECIMAL" : "BULLET_DISC_CIRCLE_SQUARE";
            requests.push(createParagraphBulletsRequest(start, insertedEnd, preset));
          }
        }
        return { requests };
      }
      throw new UnsupportedSelectionError({ expected: "blockRange" });
    }
    case "delete": {
      if (target.kind === "block" && target.block) {
        ensureNoInlineAtomic(target);
        return { requests: [deleteRangeRequest(target.block.apiRange.start, target.block.apiRange.end)] };
      }
      if (target.kind === "blockRange" && target.blocks && target.blocks.length > 0) {
        ensureNoInlineAtomic(target);
        const start = target.blocks[0].apiRange.start;
        const end = target.blocks[target.blocks.length - 1].apiRange.end;
        return { requests: [deleteRangeRequest(start, end)] };
      }
      throw new UnsupportedSelectionError({ expected: "block|blockRange" });
    }
    case "styleSet": {
      if (target.kind !== "textRange" || !target.textRange) {
        throw new UnsupportedSelectionError({ expected: "textRange" });
      }
      ensureNoInlineAtomic(target);
      const { paragraph, startOffset, endOffset } = target.textRange;
      const { startIndex, endIndex } = getParagraphRangeIndexes(paragraph, startOffset, endOffset);
      return { requests: [updateTextStyleRequest(startIndex, endIndex, params.style)] };
    }
    case "styleLink": {
      if (target.kind !== "textRange" || !target.textRange) {
        throw new UnsupportedSelectionError({ expected: "textRange" });
      }
      ensureNoInlineAtomic(target);
      const { paragraph, startOffset, endOffset } = target.textRange;
      const { startIndex, endIndex } = getParagraphRangeIndexes(paragraph, startOffset, endOffset);
      return {
        requests: [updateTextStyleRequest(startIndex, endIndex, { link: { url: params.url } })],
      };
    }
    case "paragraphStyle": {
      ensureNoInlineAtomic(target);
      ensureNoAtomic(target);
      const paragraphs = collectParagraphs(target);
      if (paragraphs.length === 0) {
        throw new UnsupportedSelectionError({ expected: "paragraph blocks" });
      }
      const start = paragraphs[0].apiRange.start;
      const end = paragraphs[paragraphs.length - 1].apiRange.end;
      return { requests: [updateParagraphStyleRequest(start, end, params.style)] };
    }
    case "codeInsert": {
      if (target.kind !== "block" || !target.block || target.block.type !== "paragraph") {
        throw new UnsupportedSelectionError({ expected: "block(paragraph)" });
      }
      ensureNoInlineAtomic(target);
      const paragraph = target.block as ParagraphBlockNode;
      const text = normalizeInsertText(params.text);
      const insertIndex = paragraphEndIndex(paragraph);
      const endIndex = insertIndex + text.length;
      const requests = [
        insertTextRequest(insertIndex, text),
        updateParagraphStyleRequest(insertIndex, endIndex, getCodeParagraphStyle()),
        updateTextStyleRequest(insertIndex, endIndex, getCodeTextStyle()),
      ];
      return { requests };
    }
    case "codeFormat": {
      ensureNoInlineAtomic(target);
      ensureNoAtomic(target);
      const paragraphs = collectParagraphs(target);
      if (paragraphs.length === 0) {
        throw new UnsupportedSelectionError({ expected: "paragraph blocks" });
      }
      const start = paragraphs[0].apiRange.start;
      const end = paragraphs[paragraphs.length - 1].apiRange.end;
      const requests = [
        updateParagraphStyleRequest(start, end, getCodeParagraphStyle()),
        updateTextStyleRequest(start, end, getCodeTextStyle()),
      ];
      return { requests };
    }
    case "objectInsert": {
      if (target.kind !== "block" || !target.block || target.block.type !== "paragraph") {
        throw new UnsupportedSelectionError({ expected: "block(paragraph)" });
      }
      ensureNoInlineAtomic(target);
      const paragraph = target.block as ParagraphBlockNode;
      const insertIndex = paragraphEndIndex(paragraph);
      switch (params.objectType) {
        case "image": {
          const uri = String(params.data.uri ?? "");
          if (!uri) {
            throw new Error("Image insert requires uri");
          }
          const altText = typeof params.data.altText === "string" ? params.data.altText : undefined;
          return { requests: [insertInlineImageRequest(insertIndex, uri, altText)] };
        }
        case "table": {
          const rows = Number(params.data.rows ?? 1);
          const columns = Number(params.data.columns ?? 1);
          return { requests: [insertTableRequest(insertIndex, rows, columns)] };
        }
        case "hr": {
          return { requests: [insertHorizontalRuleRequest(insertIndex)] };
        }
        case "embed": {
          const uri = String(params.data.uri ?? "");
          if (!uri) {
            throw new Error("Embed insert requires uri");
          }
          const altText = typeof params.data.altText === "string" ? params.data.altText : undefined;
          return { requests: [insertInlineImageRequest(insertIndex, uri, altText)] };
        }
        default:
          throw new Error("Unsupported object insert type");
      }
    }
    case "objectDelete": {
      if (target.kind !== "block" || !target.block) {
        throw new UnsupportedSelectionError({ expected: "block" });
      }
      if (!target.block.flags.isAtomic) {
        throw new UnsupportedSelectionError({ expected: "atomic block" });
      }
      return { requests: [deleteRangeRequest(target.block.apiRange.start, target.block.apiRange.end)] };
    }
    default:
      throw new Error("Unsupported compile command");
  }
}
