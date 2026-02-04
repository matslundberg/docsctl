import type { BlockNode, DocumentModel, ParagraphBlockNode } from "../model/types";

export type OutlineEntry = {
  nodeId: string;
  level: number | null;
  text: string;
  path: string[];
  objects?: { tables: number; horizontalRules: number; embeds: number; atomic: number };
};

export type ListEntry = {
  index: number;
  nodeId: string;
  type: string;
  headingPath: string[];
  snippet: string;
  apiRange: { start: number; end: number };
  flags: BlockNode["flags"];
};

export function buildOutline(model: DocumentModel, includeObjects: boolean): OutlineEntry[] {
  const headings = model.index.headingsInOrder
    .map((id) => model.index.nodeById.get(id))
    .filter((node): node is ParagraphBlockNode => !!node && node.type === "paragraph");

  return headings.map((heading) => {
    const path = heading.headingPath.map((h) => h.text);
    const entry: OutlineEntry = {
      nodeId: heading.nodeId,
      level: heading.flags.headingLevel ?? null,
      text: heading.plainText,
      path,
    };

    if (includeObjects) {
      const blockIds = model.index.blocksUnderHeading.get(heading.nodeId) ?? [];
      const counts = { tables: 0, horizontalRules: 0, embeds: 0, atomic: 0 };
      for (const id of blockIds) {
        if (id === heading.nodeId) {
          continue;
        }
        const block = model.index.nodeById.get(id);
        if (!block) {
          continue;
        }
        if (block.flags.isAtomic) {
          counts.atomic += 1;
        }
        if (block.type === "table") counts.tables += 1;
        if (block.type === "horizontalRule") counts.horizontalRules += 1;
        if (block.type === "embed") counts.embeds += 1;
      }
      entry.objects = counts;
    }

    return entry;
  });
}

export function buildList(model: DocumentModel, blocks?: BlockNode[]): ListEntry[] {
  const allowList = blocks ? new Set(blocks.map((block) => block.nodeId)) : null;
  return model.blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => (allowList ? allowList.has(block.nodeId) : true))
    .map(({ block, index }) => {
      const path = block.headingPath.map((h) => h.text);
      return {
        index,
        nodeId: block.nodeId,
        type: block.type,
        headingPath: path,
        snippet: buildBlockSnippet(block),
        apiRange: block.apiRange,
        flags: block.flags,
      };
    });
}

function buildBlockSnippet(block: BlockNode): string {
  if (block.type === "paragraph") {
    const text = (block as ParagraphBlockNode).plainText;
    return text.length > 80 ? `${text.slice(0, 77)}...` : text;
  }
  if (block.type === "table") {
    const table = block as any;
    return `Table ${table.nRows}x${table.nCols}`;
  }
  if (block.type === "horizontalRule") {
    return "Horizontal rule";
  }
  if (block.type === "embed") {
    const embed = block as any;
    return `Embed ${embed.objectKind ?? ""}`.trim();
  }
  if (block.type === "sectionBreak") {
    return "Section break";
  }
  if (block.type === "pageBreak") {
    return "Page break";
  }
  return block.type;
}
