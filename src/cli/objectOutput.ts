import type {
  BlockNode,
  DocumentModel,
  EmbeddedObjectBlockNode,
  ParagraphBlockNode,
  TableBlockNode,
} from "../model/types";
import { buildInlineImageBlock } from "../model/inlineObjects";

export type ObjectEntry = {
  nodeId: string;
  type: "image" | "table" | "hr" | "embed";
  headingPath: string[];
  apiRange: { start: number; end: number };
  description: string;
};

function isImageBlock(block: EmbeddedObjectBlockNode): boolean {
  const kind = block.objectKind?.toLowerCase() ?? "";
  return kind.includes("image") || kind.includes("img");
}

function getObjectType(block: BlockNode): "image" | "table" | "hr" | "embed" | null {
  if (block.type === "table") return "table";
  if (block.type === "horizontalRule") return "hr";
  if (block.type === "embed") {
    if (block.raw?.inline) {
      return "image";
    }
    return isImageBlock(block as EmbeddedObjectBlockNode) ? "image" : "embed";
  }
  return null;
}

function describeObject(block: BlockNode): string {
  if (block.type === "table") {
    const table = block as TableBlockNode;
    return `Table ${table.nRows}x${table.nCols}`;
  }
  if (block.type === "horizontalRule") {
    return "Horizontal rule";
  }
  if (block.type === "embed") {
    const embed = block as EmbeddedObjectBlockNode;
    return isImageBlock(embed) ? "Image" : `Embed ${embed.objectKind ?? ""}`.trim();
  }
  return block.type;
}

export function buildObjectEntries(
  model: DocumentModel,
  type: "image" | "table" | "hr" | "embed",
  blocks?: BlockNode[]
): ObjectEntry[] {
  const scopeBlocks = blocks ?? model.blocks;
  const scopeParagraphs = scopeBlocks.filter(
    (block): block is ParagraphBlockNode => block.type === "paragraph"
  );

  const inlineBlocks = scopeParagraphs.flatMap((paragraph) =>
    paragraph.runs
      .map((run, index) => ({ run, index }))
      .filter(({ run }) => run.kind === "inlineImage")
      .map(({ run, index }) => buildInlineImageBlock(paragraph, run, index))
  );

  const atomicBlocks = scopeBlocks.filter((block) => getObjectType(block));
  const allBlocks = [...atomicBlocks, ...inlineBlocks];

  return allBlocks
    .map((block) => ({ block, objectType: getObjectType(block) }))
    .filter(({ objectType }) => objectType === type)
    .map(({ block, objectType }) => ({
      nodeId: block.nodeId,
      type: objectType as ObjectEntry["type"],
      headingPath: block.headingPath.map((heading) => heading.text),
      apiRange: block.apiRange,
      description: describeObject(block),
    }));
}

export function matchesObjectType(block: BlockNode, type: "image" | "table" | "hr" | "embed"): boolean {
  const objectType = getObjectType(block);
  return objectType === type;
}
