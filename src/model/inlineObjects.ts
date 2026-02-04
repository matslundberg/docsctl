import type { BlockFlags, EmbeddedObjectBlockNode, InlineImageNode, ParagraphBlockNode } from "./types";

export function inlineImageNodeId(paragraphNodeId: string, index: number): string {
  return `inline-${paragraphNodeId}-${index}`;
}

function buildInlineFlags(): BlockFlags {
  return {
    isAtomic: true,
    containsInlineAtomic: false,
    isHeading: false,
    isListItem: false,
    isCodePara: false,
  };
}

export function buildInlineImageBlock(
  paragraph: ParagraphBlockNode,
  inline: InlineImageNode,
  index: number
): EmbeddedObjectBlockNode {
  return {
    nodeId: inlineImageNodeId(paragraph.nodeId, index),
    type: "embed",
    parentContainerId: paragraph.parentContainerId,
    apiRange: inline.apiRange,
    headingPath: paragraph.headingPath,
    flags: buildInlineFlags(),
    raw: { inline: true, paragraphNodeId: paragraph.nodeId },
    objectKind: "inlineImage",
  };
}
