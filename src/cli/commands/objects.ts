import type { Argv } from "yargs";
import { compileTarget } from "../../compiler/compile";
import { formatResolvedTarget, resolveSelection } from "../resolveSelection";
import { DocsClient } from "../../google/docsClient";
import { getToken } from "../../auth/oauth";
import { readTextFile } from "../../util/fs";
import { buildObjectEntries, matchesObjectType } from "../objectOutput";
import { buildDocumentModel } from "../../model/documentModel";
import type { BlockNode } from "../../model/types";

export function registerObjectCommands(yargs: Argv) {
  const fetchModel = async (docId: string) => {
    const token = await getToken();
    const client = new DocsClient(token.accessToken);
    const doc = await client.getDocument(docId);
    return buildDocumentModel(doc);
  };

  const blocksFromTarget = (target: { kind: string; block?: BlockNode; blocks?: BlockNode[]; textRange?: { paragraph: BlockNode } }): BlockNode[] => {
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
  };

  return yargs.command(
    "object",
    "Atomic object operations",
    (y) =>
      y
        .command(
          "list <type> <docId>",
          "List objects",
          (b) =>
            b
              .positional("type", { choices: ["image", "table", "hr", "embed"] as const })
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" }),
          async (args) => {
            const objectType = String(args.type) as "image" | "table" | "hr" | "embed";
            let model = await fetchModel(String(args.docId));
            let blocks: BlockNode[] | undefined;

            if (args.select) {
              const resolved = await resolveSelection({
                docId: String(args.docId),
                select: args.select,
                guard: args.guard,
                ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
                expect: args.expect,
              });
              model = resolved.model;
              blocks = blocksFromTarget(resolved.target);
              console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
            }

            const entries = buildObjectEntries(model, objectType, blocks);

            if (args.json) {
              console.log(JSON.stringify({ objects: entries }, null, 2));
              return;
            }

            if (entries.length === 0) {
              console.log("No objects found.");
              return;
            }

            entries.forEach((entry, index) => {
              const heading = entry.headingPath.length > 0 ? entry.headingPath.join(" > ") : "(root)";
              console.log(`[${index}] ${entry.type} ${heading} :: ${entry.description}`);
            });
          }
        )
        .command(
          "insert <type> <docId>",
          "Insert object",
          (b) =>
            b
              .positional("type", { choices: ["image", "table", "hr", "embed"] as const })
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("file", { type: "string" })
              .option("alt", { type: "string" })
              .option("rows", { type: "number", default: 2 })
              .option("cols", { type: "number", default: 2 }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const objectType = String(args.type);

            let data: Record<string, unknown> = {};
            if (objectType === "image" || objectType === "embed") {
              if (!args.file) {
                throw new Error("Provide --file with a public URL.");
              }
              const uri = (await readTextFile(String(args.file))).trim();
              if (!uri) {
                throw new Error("Image URL file is empty.");
              }
              data = { uri, altText: args.alt };
            }
            if (objectType === "table") {
              data = { rows: args.rows ?? 2, columns: args.cols ?? 2 };
            }

            const compiled = compileTarget(resolved.target, {
              kind: "objectInsert",
              objectType: objectType as "image" | "table" | "hr" | "embed",
              data,
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
            console.log("Object insert completed.");
          }
        )
        .command(
          "delete <type> <docId>",
          "Delete object",
          (b) =>
            b
              .positional("type", { choices: ["image", "table", "hr", "embed"] as const })
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            if (!resolved.target.block || !matchesObjectType(resolved.target.block, String(args.type) as any)) {
              throw new Error("Selected object does not match requested type.");
            }

            const compiled = compileTarget(resolved.target, {
              kind: "objectDelete",
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
            console.log("Object delete completed.");
          }
        )
        .demandCommand(1),
    () => {}
  );
}
