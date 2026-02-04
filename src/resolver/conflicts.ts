import type { BlockNode, ParagraphBlockNode, ResolvedTarget } from "../model/types";

export interface ConflictResult {
  inlineAtomic: string[];
  atomicBlocks: string[];
}

function collectBlocks(target: ResolvedTarget): BlockNode[] {
  if (target.kind === "block" && target.block) {
    return [target.block];
  }
  if (target.kind === "blockRange" && target.blocks) {
    return target.blocks;
  }
  if (target.kind === "textRange" && target.textRange) {
    return [target.textRange.paragraph];
  }
  return [];
}

export function detectConflicts(target: ResolvedTarget): ConflictResult {
  const inlineAtomic: string[] = [];
  const atomicBlocks: string[] = [];
  const blocks = collectBlocks(target);

  for (const block of blocks) {
    if (block.flags.isAtomic) {
      atomicBlocks.push(block.nodeId);
    }
    if (block.type === "paragraph") {
      const paragraph = block as ParagraphBlockNode;
      if (paragraph.flags.containsInlineAtomic) {
        inlineAtomic.push(paragraph.nodeId);
      }
    }
  }

  return { inlineAtomic, atomicBlocks };
}
