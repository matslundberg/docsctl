import type { Argv } from "yargs";
import { compileTarget } from "../../compiler/compile";
import { DocsClient } from "../../google/docsClient";
import { getToken } from "../../auth/oauth";
import { formatResolvedTarget, resolveSelection } from "../resolveSelection";
import { readTextFile } from "../../util/fs";

function parseToggle(value?: string): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === "on" || normalized === "true") {
    return true;
  }
  if (normalized === "off" || normalized === "false") {
    return false;
  }
  throw new Error(`Invalid toggle value: ${value}`);
}

export function registerStyleCommands(yargs: Argv) {
  return yargs.command(
    "style",
    "Style document content",
    (y) =>
      y
        .command(
          "set <docId>",
          "Set text styles",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("bold", { type: "string" })
              .option("italic", { type: "string" })
              .option("underline", { type: "string" }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const style: Record<string, unknown> = {};
            const bold = parseToggle(args.bold);
            const italic = parseToggle(args.italic);
            const underline = parseToggle(args.underline);
            if (bold !== undefined) style.bold = bold;
            if (italic !== undefined) style.italic = italic;
            if (underline !== undefined) style.underline = underline;

            if (Object.keys(style).length === 0) {
              throw new Error("No style flags provided.");
            }

            const compiled = compileTarget(resolved.target, { kind: "styleSet", style });

            const dryRun = Boolean((args as any)["dry-run"] ?? (args as any).dryRun);
            if (dryRun) {
              if (args.json) {
                console.log(JSON.stringify({ requests: compiled.requests }, null, 2));
                return;
              }
              console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
              console.log(`Requests: ${compiled.requests.length}`);
              return;
            }

            const token = await getToken();
            const client = new DocsClient(token.accessToken);
            await client.batchUpdate(String(args.docId), compiled.requests);

            if (args.json) {
              console.log(
                JSON.stringify({
                  target: resolved.target,
                  selector: resolved.selector,
                  guard: resolved.guard,
                  requests: compiled.requests.length,
                })
              );
              return;
            }

            console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
            console.log("Style set completed.");
          }
        )
        .command(
          "link <docId>",
          "Apply link to selection",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("url", { type: "string", demandOption: true }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const url = String(args.url);
            const compiled = compileTarget(resolved.target, { kind: "styleLink", url });

            const dryRun = Boolean((args as any)["dry-run"] ?? (args as any).dryRun);
            if (dryRun) {
              if (args.json) {
                console.log(JSON.stringify({ requests: compiled.requests }, null, 2));
                return;
              }
              console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
              console.log(`Requests: ${compiled.requests.length}`);
              return;
            }

            const token = await getToken();
            const client = new DocsClient(token.accessToken);
            await client.batchUpdate(String(args.docId), compiled.requests);

            if (args.json) {
              console.log(
                JSON.stringify({
                  target: resolved.target,
                  selector: resolved.selector,
                  guard: resolved.guard,
                  requests: compiled.requests.length,
                })
              );
              return;
            }

            console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
            console.log("Style link completed.");
          }
        )
        .command(
          "heading <docId>",
          "Apply heading style to paragraphs",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("level", { type: "number", default: 2 }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const level = Number(args.level ?? 2);
            if (!Number.isInteger(level) || level < 1 || level > 6) {
              throw new Error("Heading level must be between 1 and 6.");
            }

            const compiled = compileTarget(resolved.target, {
              kind: "paragraphStyle",
              style: { namedStyleType: `HEADING_${level}` },
            });

            const dryRun = Boolean((args as any)["dry-run"] ?? (args as any).dryRun);
            if (dryRun) {
              if (args.json) {
                console.log(JSON.stringify({ requests: compiled.requests }, null, 2));
                return;
              }
              console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
              console.log(`Requests: ${compiled.requests.length}`);
              return;
            }

            const token = await getToken();
            const client = new DocsClient(token.accessToken);
            await client.batchUpdate(String(args.docId), compiled.requests);

            if (args.json) {
              console.log(
                JSON.stringify({
                  target: resolved.target,
                  selector: resolved.selector,
                  guard: resolved.guard,
                  requests: compiled.requests.length,
                })
              );
              return;
            }

            console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
            console.log("Heading style applied.");
          }
        )
        .command(
          "code <action> <docId>",
          "Insert or format code blocks",
          (b) =>
            b
              .positional("action", { choices: ["insert", "format"] as const })
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("file", { type: "string" })
              .option("lang", { type: "string" }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const isInsert = String(args.action) === "insert";
            const isFormat = String(args.action) === "format";
            if (!isInsert && !isFormat) {
              throw new Error("Unsupported code action.");
            }

            let compiled;
            if (isInsert) {
              if (!args.file) {
                throw new Error("Provide --file for code insert.");
              }
              const text = await readTextFile(String(args.file));
              compiled = compileTarget(resolved.target, { kind: "codeInsert", text });
            } else {
              compiled = compileTarget(resolved.target, { kind: "codeFormat" });
            }

            const dryRun = Boolean((args as any)["dry-run"] ?? (args as any).dryRun);
            if (dryRun) {
              if (args.json) {
                console.log(JSON.stringify({ requests: compiled.requests }, null, 2));
                return;
              }
              console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
              console.log(`Requests: ${compiled.requests.length}`);
              return;
            }

            const token = await getToken();
            const client = new DocsClient(token.accessToken);
            await client.batchUpdate(String(args.docId), compiled.requests);

            if (args.json) {
              console.log(
                JSON.stringify({
                  target: resolved.target,
                  selector: resolved.selector,
                  guard: resolved.guard,
                  requests: compiled.requests.length,
                })
              );
              return;
            }

            console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
            console.log("Code command completed.");
          }
        )
        .demandCommand(1),
    () => {}
  );
}
