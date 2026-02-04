import type { DocumentModel, ParagraphBlockNode, ResolvedTarget } from "../model/types";
import type { GuardAst } from "../dsl/guard/ast";
import type { CallArg, CallExpr, CallValue } from "../dsl/shared/parser";
import {
  ExpectationFailedError,
  RevisionMismatchError,
  UnsupportedSelectionError,
} from "./errors";

function getDocText(model: DocumentModel): string {
  return model.blocks
    .filter((block) => block.type === "paragraph")
    .map((block) => (block as ParagraphBlockNode).plainText)
    .join("\n");
}

function getTextRangeText(target: ResolvedTarget): string {
  if (target.kind !== "textRange" || !target.textRange) {
    throw new UnsupportedSelectionError({ guard: "expectRangeTextEquals" });
  }
  const { paragraph, startOffset, endOffset } = target.textRange;
  return paragraph.plainText.slice(startOffset, endOffset);
}

function getHeadingContext(target: ResolvedTarget): { level?: number; text?: string } {
  const block =
    target.kind === "block"
      ? target.block
      : target.kind === "blockRange"
      ? target.blocks?.[0]
      : target.textRange?.paragraph;
  if (!block) {
    return {};
  }
  if (block.flags.isHeading) {
    return { level: block.flags.headingLevel, text: (block as ParagraphBlockNode).plainText };
  }
  const lastHeading = block.headingPath[block.headingPath.length - 1];
  return lastHeading ? { level: lastHeading.level, text: lastHeading.text } : {};
}

function getNextHeadingText(model: DocumentModel, target: ResolvedTarget): string | null {
  const block =
    target.kind === "block"
      ? target.block
      : target.kind === "blockRange"
      ? target.blocks?.[target.blocks.length - 1]
      : target.textRange?.paragraph;
  if (!block) {
    return null;
  }
  const index = model.blocks.findIndex((candidate) => candidate.nodeId === block.nodeId);
  if (index === -1) {
    return null;
  }
  for (let i = index + 1; i < model.blocks.length; i += 1) {
    const next = model.blocks[i];
    if (next.flags.isHeading && next.type === "paragraph") {
      return (next as ParagraphBlockNode).plainText;
    }
  }
  return null;
}

function getArgValue(args: CallArg[], index: number): CallValue | undefined {
  const arg = args[index];
  if (!arg) {
    return undefined;
  }
  return arg.value;
}

function callArgToString(arg: CallValue | undefined): string {
  if (typeof arg !== "string") {
    throw new Error("Expected string argument");
  }
  return arg;
}

function callArgToNumber(arg: CallValue | undefined): number {
  if (typeof arg !== "number") {
    throw new Error("Expected number argument");
  }
  return arg;
}

function callArgToBoolean(arg: CallValue | undefined): boolean {
  if (typeof arg !== "boolean") {
    throw new Error("Expected boolean argument");
  }
  return arg;
}

function evalGuardCall(call: CallExpr, model: DocumentModel, target: ResolvedTarget): boolean {
  switch (call.name) {
    case "all":
      return call.args.every((arg) => evalGuardArg(arg, model, target));
    case "any":
      return call.args.some((arg) => evalGuardArg(arg, model, target));
    case "not":
      if (call.args.length !== 1) {
        throw new Error("not() expects one argument");
      }
      return !evalGuardArg(call.args[0], model, target);
    case "ifRevision": {
      const revision = callArgToString(getArgValue(call.args, 0));
      if (model.revisionId !== revision) {
        throw new RevisionMismatchError({ expected: revision, actual: model.revisionId });
      }
      return true;
    }
    case "expectContains": {
      const snippet = callArgToString(getArgValue(call.args, 0));
      const docText = getDocText(model);
      return docText.includes(snippet);
    }
    case "expectNotContains": {
      const snippet = callArgToString(getArgValue(call.args, 0));
      const docText = getDocText(model);
      return !docText.includes(snippet);
    }
    case "expectRegex": {
      const pattern = callArgToString(getArgValue(call.args, 0));
      const regex = new RegExp(pattern);
      const docText = getDocText(model);
      return regex.test(docText);
    }
    case "expectRangeTextEquals": {
      const expected = callArgToString(getArgValue(call.args, 0));
      const actual = getTextRangeText(target);
      return actual === expected;
    }
    case "expectHasNoAtomicObjects": {
      const blocks =
        target.kind === "blockRange"
          ? target.blocks ?? []
          : target.kind === "block" && target.block
          ? [target.block]
          : [];
      return blocks.every((block) => !block.flags.isAtomic);
    }
    case "expectHasNoInlineAtomic": {
      if (target.kind === "textRange" && target.textRange) {
        return !target.textRange.paragraph.flags.containsInlineAtomic;
      }
      const blocks =
        target.kind === "blockRange"
          ? target.blocks ?? []
          : target.kind === "block" && target.block
          ? [target.block]
          : [];
      return blocks.every((block) => !block.flags.containsInlineAtomic);
    }
    case "expectNextHeadingIs": {
      const expected = callArgToString(getArgValue(call.args, 0));
      const nextHeading = getNextHeadingText(model, target);
      return nextHeading === expected;
    }
    case "expectHeadingLevelIs": {
      const expected = callArgToNumber(getArgValue(call.args, 0));
      const context = getHeadingContext(target);
      return context.level === expected;
    }
    default:
      throw new Error(`Unsupported guard: ${call.name}`);
  }
}

function evalGuardArg(arg: CallArg, model: DocumentModel, target: ResolvedTarget): boolean {
  if (arg.kind === "named") {
    throw new Error("Guard functions do not accept named args in v1");
  }
  if (typeof arg.value === "object" && arg.value && "type" in arg.value) {
    return evalGuardCall(arg.value as CallExpr, model, target);
  }
  const literal = arg.value;
  return callArgToBoolean(literal);
}

export function evaluateGuards(model: DocumentModel, target: ResolvedTarget, guard: GuardAst): void {
  if (guard.callChain.chain.length > 0) {
    throw new Error("Guard chaining is not supported; use combinators instead.");
  }
  const result = evalGuardCall(guard.callChain.head, model, target);
  if (!result) {
    throw new ExpectationFailedError({ guard: guard.callChain.head.name });
  }
}
