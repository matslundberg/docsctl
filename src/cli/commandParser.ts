export type CommandFlags = Record<string, string | boolean>;

export type ParsedCommand =
  | { type: "editInsert"; docId: string; position: "before" | "after"; flags: CommandFlags }
  | { type: "editReplace"; docId: string; replaceKind: "match" | "section"; flags: CommandFlags }
  | { type: "editDelete"; docId: string; flags: CommandFlags }
  | { type: "styleSet"; docId: string; flags: CommandFlags }
  | { type: "styleLink"; docId: string; flags: CommandFlags }
  | { type: "code"; docId: string; action: "insert" | "format"; flags: CommandFlags }
  | { type: "objectInsert"; docId: string; objectType: "image" | "table" | "hr" | "embed"; flags: CommandFlags }
  | { type: "objectDelete"; docId: string; objectType: "image" | "table" | "hr" | "embed"; flags: CommandFlags }
  | { type: "commentsAdd"; docId: string; flags: CommandFlags }
  | { type: "commentsReply"; docId: string; flags: CommandFlags }
  | { type: "commentsResolve"; docId: string; flags: CommandFlags }
  | { type: "commentsReopen"; docId: string; flags: CommandFlags };

function parseTokens(tokens: string[]): { positionals: string[]; flags: CommandFlags } {
  const positionals: string[] = [];
  const flags: CommandFlags = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.startsWith("--")) {
      const raw = token.slice(2);
      const [key, inlineValue] = raw.split("=");
      if (inlineValue !== undefined) {
        flags[key] = inlineValue;
        continue;
      }
      const next = tokens[i + 1];
      if (next && !next.startsWith("--")) {
        const values: string[] = [next];
        let j = i + 2;
        while (j < tokens.length && !tokens[j].startsWith("--")) {
          values.push(tokens[j]);
          j += 1;
        }
        flags[key] = values.length > 1 ? values.join(" ") : values[0];
        i = j - 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positionals.push(token);
  }
  return { positionals, flags };
}

function requirePositional(positionals: string[], index: number, label: string): string {
  const value = positionals[index];
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
  return value;
}

export function parseCommandTokens(tokens: string[]): ParsedCommand {
  const { positionals, flags } = parseTokens(tokens);
  const command = requirePositional(positionals, 0, "command");

  switch (command) {
    case "edit": {
      const action = requirePositional(positionals, 1, "edit action");
      if (action === "insert") {
        const position = requirePositional(positionals, 2, "position") as "before" | "after";
        const docId = requirePositional(positionals, 3, "docId");
        return { type: "editInsert", docId, position, flags };
      }
      if (action === "replace") {
        const replaceKind = requirePositional(positionals, 2, "replace kind") as "match" | "section";
        const docId = requirePositional(positionals, 3, "docId");
        return { type: "editReplace", docId, replaceKind, flags };
      }
      if (action === "delete") {
        const docId = requirePositional(positionals, 2, "docId");
        return { type: "editDelete", docId, flags };
      }
      throw new Error("Unsupported edit action");
    }
    case "style": {
      const action = requirePositional(positionals, 1, "style action");
      if (action === "set") {
        const docId = requirePositional(positionals, 2, "docId");
        return { type: "styleSet", docId, flags };
      }
      if (action === "link") {
        const docId = requirePositional(positionals, 2, "docId");
        return { type: "styleLink", docId, flags };
      }
      if (action === "code") {
        const codeAction = requirePositional(positionals, 2, "code action") as "insert" | "format";
        const docId = requirePositional(positionals, 3, "docId");
        return { type: "code", docId, action: codeAction, flags };
      }
      throw new Error("Unsupported style action");
    }
    case "object": {
      const action = requirePositional(positionals, 1, "object action");
      if (action === "insert") {
        const objectType = requirePositional(positionals, 2, "object type") as
          | "image"
          | "table"
          | "hr"
          | "embed";
        const docId = requirePositional(positionals, 3, "docId");
        return { type: "objectInsert", docId, objectType, flags };
      }
      if (action === "delete") {
        const objectType = requirePositional(positionals, 2, "object type") as
          | "image"
          | "table"
          | "hr"
          | "embed";
        const docId = requirePositional(positionals, 3, "docId");
        return { type: "objectDelete", docId, objectType, flags };
      }
      throw new Error("Unsupported object action");
    }
    case "comments": {
      const action = requirePositional(positionals, 1, "comments action");
      const docId = requirePositional(positionals, 2, "docId");
      if (action === "add") {
        return { type: "commentsAdd", docId, flags };
      }
      if (action === "reply") {
        return { type: "commentsReply", docId, flags };
      }
      if (action === "resolve") {
        return { type: "commentsResolve", docId, flags };
      }
      if (action === "reopen") {
        return { type: "commentsReopen", docId, flags };
      }
      throw new Error("Unsupported comments action");
    }
    default:
      throw new Error("Unsupported command for explain/diff");
  }
}
