import type {
  BlockNode,
  DocumentModel,
  InlineImageNode,
  ParagraphBlockNode,
  ResolvedTarget,
} from "../model/types";
import type { SelectorAst } from "../dsl/selector/ast";
import type { GuardAst } from "../dsl/guard/ast";
import type { CallArg, CallExpr, CallValue } from "../dsl/shared/parser";
import {
  AmbiguousMatchError,
  NoMatchError,
  UnsupportedSelectionError,
} from "./errors";
import { detectConflicts } from "./conflicts";
import { evaluateGuards } from "./guards";
import { rankAmbiguousCandidates } from "./rank";
import { buildInlineImageBlock } from "../model/inlineObjects";

export interface ResolveOptions {
  allowAmbiguous?: boolean;
}

type BlockCandidate = { kind: "block"; block: BlockNode };
type BlockRangeCandidate = { kind: "blockRange"; blocks: BlockNode[] };
type TextRangeCandidate = {
  kind: "textRange";
  paragraph: ParagraphBlockNode;
  startOffset: number;
  endOffset: number;
};

type Candidate = BlockCandidate | BlockRangeCandidate | TextRangeCandidate;

type Terminal = { kind: "one" } | { kind: "nth"; index: number } | { kind: "first" };

function isCallValueCall(value: CallValue): value is CallExpr {
  return typeof value === "object" && value !== null && "type" in value;
}

function getNamedArg(call: CallExpr, name: string): CallValue | undefined {
  const arg = call.args.find((candidate) => candidate.kind === "named" && candidate.name === name);
  return arg?.value;
}

function getPositionalArg(call: CallExpr, index: number): CallValue | undefined {
  const positional = call.args.filter((arg) => arg.kind === "positional");
  return positional[index]?.value;
}

function callValueToString(value: CallValue | undefined): string {
  if (typeof value !== "string") {
    throw new Error("Expected string argument");
  }
  return value;
}

function callValueToNumber(value: CallValue | undefined): number {
  if (typeof value !== "number") {
    throw new Error("Expected number argument");
  }
  return value;
}

function callValueToBoolean(value: CallValue | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error("Expected boolean argument");
  }
  return value;
}

function normalizeHeadingText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function toBlockCandidates(blocks: BlockNode[]): Candidate[] {
  return blocks.map((block) => ({ kind: "block", block }));
}

function uniqueBlocks(model: DocumentModel, blocks: BlockNode[]): BlockNode[] {
  const ids = new Set(blocks.map((block) => block.nodeId));
  return model.blocks.filter((block) => ids.has(block.nodeId));
}

function blocksFromCandidates(model: DocumentModel, candidates: Candidate[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  for (const candidate of candidates) {
    if (candidate.kind === "block") {
      blocks.push(candidate.block);
    } else if (candidate.kind === "blockRange") {
      blocks.push(...candidate.blocks);
    } else if (candidate.kind === "textRange") {
      blocks.push(candidate.paragraph);
    }
  }
  return uniqueBlocks(model, blocks);
}

function evaluateHeading(model: DocumentModel, title: string, level?: number): Candidate[] {
  const normalized = normalizeHeadingText(title);
  const ids = model.index.headingTextToNodes.get(normalized) ?? [];
  const blocks = ids
    .map((id) => model.index.nodeById.get(id))
    .filter((block): block is ParagraphBlockNode => !!block && block.type === "paragraph")
    .filter((block) => (level ? block.flags.headingLevel === level : true));
  return blocks.map((block) => ({ kind: "block", block }));
}

function evaluateBetweenHeadings(
  model: DocumentModel,
  fromTitle: string,
  toTitle: string
): Candidate[] {
  const fromBlocks = evaluateHeading(model, fromTitle);
  const toBlocks = evaluateHeading(model, toTitle);
  const ranges: Candidate[] = [];

  const indexById = new Map(model.blocks.map((block, index) => [block.nodeId, index]));
  const toIndices = toBlocks
    .map((candidate) => indexById.get(candidate.block.nodeId))
    .filter((index): index is number => typeof index === "number")
    .sort((a, b) => a - b);

  for (const candidate of fromBlocks) {
    const fromIndex = indexById.get(candidate.block.nodeId);
    if (fromIndex === undefined) {
      continue;
    }
    const nextTo = toIndices.find((index) => index > fromIndex);
    if (nextTo === undefined) {
      continue;
    }
    const blocks = model.blocks.slice(fromIndex + 1, nextTo);
    ranges.push({ kind: "blockRange", blocks });
  }

  return ranges;
}

function evaluateSection(
  model: DocumentModel,
  fromExpr: CallExpr,
  toExpr: CallExpr
): Candidate[] {
  const fromBlocks = evaluateCall(model, [], fromExpr).filter(
    (candidate): candidate is BlockCandidate => candidate.kind === "block"
  );
  const toBlocks = evaluateCall(model, [], toExpr).filter(
    (candidate): candidate is BlockCandidate => candidate.kind === "block"
  );
  const indexById = new Map(model.blocks.map((block, index) => [block.nodeId, index]));
  const toIndices = toBlocks
    .map((candidate) => indexById.get(candidate.block.nodeId))
    .filter((index): index is number => typeof index === "number")
    .sort((a, b) => a - b);

  const ranges: Candidate[] = [];
  for (const candidate of fromBlocks) {
    const fromIndex = indexById.get(candidate.block.nodeId);
    if (fromIndex === undefined) {
      continue;
    }
    const nextTo = toIndices.find((index) => index > fromIndex);
    if (nextTo === undefined) {
      continue;
    }
    const blocks = model.blocks.slice(fromIndex + 1, nextTo);
    ranges.push({ kind: "blockRange", blocks });
  }

  return ranges;
}

function evaluateUnder(model: DocumentModel, scope: Candidate[]): Candidate[] {
  const blocks: BlockNode[] = [];
  for (const candidate of scope) {
    if (candidate.kind === "block" && candidate.block.flags.isHeading) {
      const ids = model.index.blocksUnderHeading.get(candidate.block.nodeId) ?? [];
      for (const id of ids) {
        if (id === candidate.block.nodeId) {
          continue;
        }
        const block = model.index.nodeById.get(id);
        if (block) {
          blocks.push(block);
        }
      }
      continue;
    }
    if (candidate.kind === "blockRange") {
      blocks.push(...candidate.blocks);
      continue;
    }
    if (candidate.kind === "textRange") {
      blocks.push(candidate.paragraph);
    }
  }
  return toBlockCandidates(uniqueBlocks(model, blocks));
}

function evaluateBlocks(model: DocumentModel, candidates: Candidate[], call: CallExpr): Candidate[] {
  const inArg = getNamedArg(call, "in");
  const scopeCandidates = inArg && isCallValueCall(inArg) ? evaluateCall(model, [], inArg) : candidates;
  if (scopeCandidates.length === 0 && !inArg) {
    return toBlockCandidates(model.blocks);
  }
  const blocks = blocksFromCandidates(model, scopeCandidates);
  return toBlockCandidates(blocks);
}

function evaluateParagraphs(model: DocumentModel, candidates: Candidate[], call: CallExpr): Candidate[] {
  const blocks = evaluateBlocks(model, candidates, call).filter(
    (candidate): candidate is BlockCandidate =>
      candidate.kind === "block" && candidate.block.type === "paragraph"
  );
  return blocks;
}

function evaluateObjects(model: DocumentModel, candidates: Candidate[], call: CallExpr): Candidate[] {
  const typeArg = getNamedArg(call, "type");
  const type = typeof typeArg === "string" ? typeArg : undefined;
  const blocks = evaluateBlocks(model, candidates, call).filter(
    (candidate): candidate is BlockCandidate => candidate.kind === "block"
  );

  const inlineBlocks: BlockCandidate[] = [];
  for (const candidate of blocks) {
    const block = candidate.block;
    if (block.type !== "paragraph") {
      continue;
    }
    const paragraph = block as ParagraphBlockNode;
    paragraph.runs.forEach((run, index) => {
      if (run.kind !== "inlineImage") {
        return;
      }
      const inlineBlock = buildInlineImageBlock(paragraph, run as InlineImageNode, index);
      inlineBlocks.push({ kind: "block", block: inlineBlock });
    });
  }

  const filtered = [...blocks, ...inlineBlocks].filter((candidate) => {
    const block = candidate.block;
    if (!block.flags.isAtomic) {
      return false;
    }
    if (!type) {
      return true;
    }
    if (type === "table") {
      return block.type === "table";
    }
    if (type === "hr" || type === "horizontalRule") {
      return block.type === "horizontalRule";
    }
    if (type === "embed" || type === "object") {
      return block.type === "embed";
    }
    if (type === "image") {
      return block.type === "embed" && String((block as any).objectKind ?? "").toLowerCase().includes("image");
    }
    return false;
  });

  return filtered;
}

function evaluateMatch(model: DocumentModel, candidates: Candidate[], call: CallExpr): Candidate[] {
  const pattern = callValueToString(getPositionalArg(call, 0));
  const regex = callValueToBoolean(getNamedArg(call, "regex"), false);
  const occurrence = getNamedArg(call, "occurrence");
  const occurrenceIndex = typeof occurrence === "number" ? occurrence : undefined;
  const inArg = getNamedArg(call, "in");
  const scopeCandidates = inArg && isCallValueCall(inArg) ? evaluateCall(model, [], inArg) : candidates;

  const blocks = blocksFromCandidates(model, scopeCandidates.length > 0 ? scopeCandidates : toBlockCandidates(model.blocks));
  const paragraphs = blocks.filter((block): block is ParagraphBlockNode => block.type === "paragraph");

  const matches: TextRangeCandidate[] = [];
  for (const paragraph of paragraphs) {
    const text = paragraph.plainText;
    if (!text) {
      continue;
    }
    if (regex) {
      const regexObj = new RegExp(pattern, "g");
      for (const match of text.matchAll(regexObj)) {
        if (match.index === undefined) {
          continue;
        }
        matches.push({
          kind: "textRange",
          paragraph,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
        });
      }
      continue;
    }

    let index = text.indexOf(pattern);
    while (index !== -1 && pattern.length > 0) {
      matches.push({
        kind: "textRange",
        paragraph,
        startOffset: index,
        endOffset: index + pattern.length,
      });
      index = text.indexOf(pattern, index + pattern.length);
    }
  }

  if (occurrenceIndex !== undefined) {
    const target = matches[occurrenceIndex - 1];
    return target ? [target] : [];
  }

  return matches;
}

function evaluateFilter(model: DocumentModel, candidates: Candidate[], call: CallExpr): Candidate[] {
  const blocks = blocksFromCandidates(model, candidates);
  const predicates = call.args
    .filter((arg) => arg.kind === "positional")
    .map((arg) => arg.value)
    .filter((value): value is CallExpr => isCallValueCall(value));

  const filtered = blocks.filter((block) =>
    predicates.every((predicate) => evaluatePredicate(block, predicate))
  );

  return toBlockCandidates(filtered);
}

function evaluatePredicate(block: BlockNode, predicate: CallExpr): boolean {
  switch (predicate.name) {
    case "textEquals": {
      if (block.type !== "paragraph") return false;
      const expected = callValueToString(getPositionalArg(predicate, 0));
      return (block as ParagraphBlockNode).plainText === expected;
    }
    case "textContains": {
      if (block.type !== "paragraph") return false;
      const expected = callValueToString(getPositionalArg(predicate, 0));
      return (block as ParagraphBlockNode).plainText.includes(expected);
    }
    case "styleIs": {
      if (block.type !== "paragraph") return false;
      const expected = callValueToString(getPositionalArg(predicate, 0));
      return (block as ParagraphBlockNode).paraStyle.namedStyleType === expected;
    }
    case "isCode": {
      return block.flags.isCodePara;
    }
    case "and": {
      const args = predicate.args
        .filter((arg) => arg.kind === "positional")
        .map((arg) => arg.value)
        .filter((value): value is CallExpr => isCallValueCall(value));
      return args.every((arg) => evaluatePredicate(block, arg));
    }
    default:
      throw new Error(`Unsupported filter predicate: ${predicate.name}`);
  }
}

function evaluateCall(model: DocumentModel, candidates: Candidate[], call: CallExpr): Candidate[] {
  switch (call.name) {
    case "heading": {
      const title = callValueToString(getPositionalArg(call, 0));
      const level = getNamedArg(call, "level");
      return evaluateHeading(model, title, typeof level === "number" ? level : undefined);
    }
    case "betweenHeadings": {
      const from = callValueToString(getPositionalArg(call, 0));
      const to = callValueToString(getPositionalArg(call, 1));
      return evaluateBetweenHeadings(model, from, to);
    }
    case "section": {
      const fromArg = getNamedArg(call, "from");
      const toArg = getNamedArg(call, "to");
      if (!fromArg || !toArg || !isCallValueCall(fromArg) || !isCallValueCall(toArg)) {
        throw new Error("section() requires from= and to= selector expressions");
      }
      return evaluateSection(model, fromArg, toArg);
    }
    case "under": {
      const scopeValue = getPositionalArg(call, 0) ?? getNamedArg(call, "in");
      if (!scopeValue || !isCallValueCall(scopeValue)) {
        throw new Error("under() requires a selector expression");
      }
      return evaluateUnder(model, evaluateCall(model, [], scopeValue));
    }
    case "blocks":
      return evaluateBlocks(model, candidates, call);
    case "paragraphs":
      return evaluateParagraphs(model, candidates, call);
    case "objects":
      return evaluateObjects(model, candidates, call);
    case "match":
      return evaluateMatch(model, candidates, call);
    case "filter":
      return evaluateFilter(model, candidates, call);
    default:
      throw new Error(`Unsupported selector function: ${call.name}`);
  }
}

function parseTerminal(call: CallExpr): Terminal | null {
  if (call.name === "one") {
    return { kind: "one" };
  }
  if (call.name === "first") {
    return { kind: "first" };
  }
  if (call.name === "nth") {
    const index = callValueToNumber(getPositionalArg(call, 0));
    return { kind: "nth", index };
  }
  return null;
}

function candidateSnippet(candidate: Candidate): string {
  if (candidate.kind === "block") {
    if (candidate.block.type === "paragraph") {
      return (candidate.block as ParagraphBlockNode).plainText;
    }
    return candidate.block.type;
  }
  if (candidate.kind === "blockRange") {
    if (candidate.blocks.length === 0) return "";
    const first = candidate.blocks[0];
    if (first.type === "paragraph") {
      return (first as ParagraphBlockNode).plainText;
    }
    return first.type;
  }
  const text = candidate.paragraph.plainText;
  return text.slice(candidate.startOffset, candidate.endOffset);
}

function candidateHeadingPath(candidate: Candidate): string[] {
  const block =
    candidate.kind === "block"
      ? candidate.block
      : candidate.kind === "blockRange"
      ? candidate.blocks[0]
      : candidate.paragraph;
  if (!block) {
    return [];
  }
  return block.headingPath.map((heading) => heading.text);
}

function applyTerminal(
  candidates: Candidate[],
  terminal: Terminal | undefined,
  options: ResolveOptions
): Candidate {
  const selectedTerminal = terminal ?? { kind: "one" };
  if (selectedTerminal.kind === "first") {
    if (!options.allowAmbiguous) {
      throw new UnsupportedSelectionError({ terminal: "first" });
    }
    if (candidates.length === 0) {
      throw new NoMatchError();
    }
    return candidates[0];
  }
  if (selectedTerminal.kind === "nth") {
    const index = Math.floor(selectedTerminal.index) - 1;
    if (index < 0 || index >= candidates.length) {
      throw new NoMatchError({ terminal: "nth", requested: selectedTerminal.index });
    }
    return candidates[index];
  }
  if (candidates.length === 0) {
    throw new NoMatchError();
  }
  if (candidates.length > 1 && !options.allowAmbiguous) {
    const hints = rankAmbiguousCandidates(candidates).map((hint) => hint.message);
    throw new AmbiguousMatchError({ count: candidates.length, hints });
  }
  return candidates[0];
}

export function resolveTarget(
  model: DocumentModel,
  selector: SelectorAst,
  guard: GuardAst | null,
  options: ResolveOptions = {}
): ResolvedTarget {
  let candidates = evaluateCall(model, [], selector.callChain.head);
  let terminal: Terminal | undefined;

  for (let i = 0; i < selector.callChain.chain.length; i += 1) {
    const call = selector.callChain.chain[i];
    const parsedTerminal = parseTerminal(call);
    if (parsedTerminal) {
      if (terminal) {
        throw new UnsupportedSelectionError({ terminal: call.name });
      }
      if (i !== selector.callChain.chain.length - 1) {
        throw new UnsupportedSelectionError({ terminal: call.name, position: "not-last" });
      }
      terminal = parsedTerminal;
      continue;
    }
    candidates = evaluateCall(model, candidates, call);
  }

  const selected = applyTerminal(candidates, terminal, options);

  const resolved: ResolvedTarget = {
    kind: selected.kind,
    block: selected.kind === "block" ? selected.block : undefined,
    blocks: selected.kind === "blockRange" ? selected.blocks : undefined,
    textRange:
      selected.kind === "textRange"
        ? {
            paragraph: selected.paragraph,
            startOffset: selected.startOffset,
            endOffset: selected.endOffset,
          }
        : undefined,
    context: {
      headingPath: candidateHeadingPath(selected),
      snippet: candidateSnippet(selected),
      conflicts: [],
    },
  };

  const conflicts = detectConflicts(resolved);
  resolved.context.conflicts = [
    ...conflicts.atomicBlocks.map((id) => `atomic:${id}`),
    ...conflicts.inlineAtomic.map((id) => `inline:${id}`),
  ];

  if (guard) {
    evaluateGuards(model, resolved, guard);
  }

  return resolved;
}
