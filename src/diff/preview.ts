import type { ParagraphBlockNode, ResolvedTarget } from "../model/types";

export interface DiffPreview {
  before: string;
  after: string;
}

export type DiffParams =
  | { kind: "insert"; position: "before" | "after"; text: string }
  | { kind: "replace"; text: string }
  | { kind: "delete" };

function extractTargetText(target: ResolvedTarget): string {
  if (target.kind === "textRange" && target.textRange) {
    const { paragraph, startOffset, endOffset } = target.textRange;
    return paragraph.plainText.slice(startOffset, endOffset);
  }
  if (target.kind === "block" && target.block?.type === "paragraph") {
    return (target.block as ParagraphBlockNode).plainText;
  }
  if (target.kind === "blockRange" && target.blocks) {
    return target.blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => (block as ParagraphBlockNode).plainText)
      .join("\n");
  }
  return target.context.snippet;
}

export function computeDiffPreview(target: ResolvedTarget, params: DiffParams): DiffPreview {
  const before = extractTargetText(target);

  switch (params.kind) {
    case "insert": {
      if (params.position === "before") {
        return { before, after: `${params.text}\n${before}`.trimEnd() };
      }
      return { before, after: `${before}\n${params.text}`.trimEnd() };
    }
    case "replace": {
      return { before, after: params.text };
    }
    case "delete": {
      return { before, after: "" };
    }
    default:
      return { before, after: "" };
  }
}
