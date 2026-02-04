import { compileTarget } from "../compiler/compile";
import { buildCommentAnchor } from "./commentAnchor";
import { computeDiffPreview, type DiffParams } from "../diff/preview";
import { parseCommandTokens, type ParsedCommand, type CommandFlags } from "./commandParser";
import { resolveSelection, formatResolvedTarget } from "./resolveSelection";
import { readTextFile } from "../util/fs";
import type { ResolvedSelection } from "./resolveSelection";

type CommandExecution = {
  parsed: ParsedCommand;
  resolved?: ResolvedSelection;
  compiled?: { requests: unknown[] };
  diffParams?: DiffParams;
  commentPayload?: Record<string, unknown>;
  message?: string;
};

function getStringFlag(flags: CommandFlags, key: string): string | undefined {
  const value = flags[key];
  if (value === undefined) {
    return undefined;
  }
  return String(value);
}

function getGuardInputs(flags: CommandFlags) {
  return {
    guard: getStringFlag(flags, "guard"),
    ifRevision: getStringFlag(flags, "if-revision") ?? getStringFlag(flags, "ifRevision"),
    expect: getStringFlag(flags, "expect"),
  };
}

function parseToggle(value?: string): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === "on" || normalized === "true") return true;
  if (normalized === "off" || normalized === "false") return false;
  throw new Error(`Invalid toggle value: ${value}`);
}

async function resolveText(flags: CommandFlags, primaryKey: "text" | "with"): Promise<string> {
  const file = getStringFlag(flags, "file");
  if (file) {
    return readTextFile(file);
  }
  const value = getStringFlag(flags, primaryKey);
  if (value === undefined) {
    throw new Error(`Provide --${primaryKey} or --file.`);
  }
  return value;
}

async function resolveSelectionForFlags(docId: string, flags: CommandFlags): Promise<ResolvedSelection> {
  return resolveSelection({
    docId,
    select: getStringFlag(flags, "select"),
    ...getGuardInputs(flags),
  });
}

export async function executeCommand(tokens: string[]): Promise<CommandExecution> {
  const parsed = parseCommandTokens(tokens);

  switch (parsed.type) {
    case "editInsert": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      const text = await resolveText(parsed.flags, "text");
      const compiled = compileTarget(resolved.target, {
        kind: "insert",
        position: parsed.position,
        text,
      });
      return { parsed, resolved, compiled, diffParams: { kind: "insert", position: parsed.position, text } };
    }
    case "editReplace": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      const text = await resolveText(parsed.flags, "with");
      const compiled = compileTarget(resolved.target, {
        kind: parsed.replaceKind === "match" ? "replaceMatch" : "replaceSection",
        text,
      });
      return { parsed, resolved, compiled, diffParams: { kind: "replace", text } };
    }
    case "editDelete": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      const compiled = compileTarget(resolved.target, { kind: "delete" });
      return { parsed, resolved, compiled, diffParams: { kind: "delete" } };
    }
    case "styleSet": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      const style: Record<string, unknown> = {};
      const bold = parseToggle(getStringFlag(parsed.flags, "bold"));
      const italic = parseToggle(getStringFlag(parsed.flags, "italic"));
      const underline = parseToggle(getStringFlag(parsed.flags, "underline"));
      if (bold !== undefined) style.bold = bold;
      if (italic !== undefined) style.italic = italic;
      if (underline !== undefined) style.underline = underline;
      if (Object.keys(style).length === 0) {
        throw new Error("No style flags provided.");
      }
      const compiled = compileTarget(resolved.target, { kind: "styleSet", style });
      return { parsed, resolved, compiled };
    }
    case "styleLink": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      const url = getStringFlag(parsed.flags, "url");
      if (!url) throw new Error("Missing --url");
      const compiled = compileTarget(resolved.target, { kind: "styleLink", url });
      return { parsed, resolved, compiled };
    }
    case "code": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      if (parsed.action === "insert") {
        const file = getStringFlag(parsed.flags, "file");
        if (!file) throw new Error("Provide --file for code insert.");
        const text = await readTextFile(file);
        const compiled = compileTarget(resolved.target, { kind: "codeInsert", text });
        return { parsed, resolved, compiled };
      }
      const compiled = compileTarget(resolved.target, { kind: "codeFormat" });
      return { parsed, resolved, compiled };
    }
    case "objectInsert": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      let data: Record<string, unknown> = {};
      if (parsed.objectType === "image" || parsed.objectType === "embed") {
        const file = getStringFlag(parsed.flags, "file");
        if (!file) throw new Error("Provide --file with a public image URL.");
        const uri = (await readTextFile(file)).trim();
        if (!uri) throw new Error("Image URL file is empty.");
        data = { uri, altText: getStringFlag(parsed.flags, "alt") };
      }
      if (parsed.objectType === "table") {
        const rows = Number(getStringFlag(parsed.flags, "rows") ?? 2);
        const cols = Number(getStringFlag(parsed.flags, "cols") ?? 2);
        data = { rows, columns: cols };
      }
      const compiled = compileTarget(resolved.target, {
        kind: "objectInsert",
        objectType: parsed.objectType === "hr" ? "hr" : parsed.objectType,
        data,
      });
      return { parsed, resolved, compiled };
    }
    case "objectDelete": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      const compiled = compileTarget(resolved.target, { kind: "objectDelete" });
      return { parsed, resolved, compiled };
    }
    case "commentsAdd": {
      const resolved = await resolveSelectionForFlags(parsed.docId, parsed.flags);
      if (resolved.target.kind !== "textRange" || !resolved.target.textRange) {
        throw new Error("Comments add requires a textRange selection.");
      }
      const text = getStringFlag(parsed.flags, "text");
      if (!text) throw new Error("Missing --text");
      const { paragraph, startOffset, endOffset } = resolved.target.textRange;
      const payload: Record<string, unknown> = { content: text };
      const unanchored = Boolean(parsed.flags.unanchored);
      if (!unanchored) {
        const anchor = buildCommentAnchor(paragraph, startOffset, endOffset);
        payload.quotedFileContent = {
          mimeType: "text/html",
          value: anchor.quotedText,
        };
        payload.anchor = anchor.anchor;
      }
      return { parsed, resolved, commentPayload: payload };
    }
    case "commentsReply": {
      const id = getStringFlag(parsed.flags, "id");
      const text = getStringFlag(parsed.flags, "text");
      if (!id || !text) throw new Error("Missing --id or --text");
      return { parsed, commentPayload: { id, content: text }, message: `Reply to ${id}` };
    }
    case "commentsResolve": {
      const id = getStringFlag(parsed.flags, "id");
      if (!id) throw new Error("Missing --id");
      return {
        parsed,
        commentPayload: { id, action: "resolve", content: getStringFlag(parsed.flags, "text") ?? "Resolved." },
        message: `Resolve ${id}`,
      };
    }
    case "commentsReopen": {
      const id = getStringFlag(parsed.flags, "id");
      if (!id) throw new Error("Missing --id");
      return {
        parsed,
        commentPayload: { id, action: "reopen", content: getStringFlag(parsed.flags, "text") ?? "Reopened." },
        message: `Reopen ${id}`,
      };
    }
    default:
      return { parsed };
  }
}

export async function buildExplainOutput(tokens: string[]) {
  const execution = await executeCommand(tokens);
  const resolved = execution.resolved;
  const compiled = execution.compiled;
  return {
    command: execution.parsed.type,
    selector: resolved?.selector ?? null,
    guard: resolved?.guard ?? null,
    target: resolved?.target ?? null,
    targetSummary: resolved ? formatResolvedTarget(resolved.target) : null,
    requests: compiled?.requests ?? null,
    requestCount: compiled?.requests.length ?? 0,
    comment: execution.commentPayload ?? null,
    message: execution.message ?? null,
  };
}

export async function buildDiffOutput(tokens: string[]) {
  const execution = await executeCommand(tokens);
  const resolved = execution.resolved;
  const compiled = execution.compiled;
  const diff = resolved && execution.diffParams ? computeDiffPreview(resolved.target, execution.diffParams) : null;
  return {
    command: execution.parsed.type,
    selector: resolved?.selector ?? null,
    guard: resolved?.guard ?? null,
    target: resolved?.target ?? null,
    targetSummary: resolved ? formatResolvedTarget(resolved.target) : null,
    diff,
    requests: compiled?.requests ?? null,
    requestCount: compiled?.requests.length ?? 0,
    comment: execution.commentPayload ?? null,
    message: execution.message ?? null,
  };
}
