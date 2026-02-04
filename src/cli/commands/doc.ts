import type { Argv } from "yargs";
import { getToken } from "../../auth/oauth";
import { DocsClient } from "../../google/docsClient";
import { buildDocumentModel } from "../../model/documentModel";
import type { BlockNode } from "../../model/types";
import { buildList, buildOutline, type OutlineEntry } from "../docOutput";
import { resolveSelection } from "../resolveSelection";
import { notImplemented } from "./_shared";

async function fetchModel(docId: string) {
  const token = await getToken();
  const client = new DocsClient(token.accessToken);
  const doc = await client.getDocument(docId);
  return buildDocumentModel(doc);
}

function blocksFromTarget(target: { kind: string; block?: BlockNode; blocks?: BlockNode[]; textRange?: { paragraph: BlockNode } }): BlockNode[] {
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

function formatHeadingPath(path: string[]): string {
  if (path.length === 0) {
    return "(root)";
  }
  return path.join(" > ");
}

export function registerDocCommands(yargs: Argv) {
  return yargs.command(
    "doc",
    "Document operations",
    (y) =>
      y
        .command(
          "info <docId>",
          "Show document info",
          (b) => b.positional("docId", { type: "string", demandOption: true }),
          async (args) => {
            const token = await getToken();
            const client = new DocsClient(token.accessToken);
            const doc = await client.getDocument(String(args.docId));

            const payload = {
              docId: doc.documentId ?? null,
              title: doc.title ?? null,
              revisionId: doc.revisionId ?? null,
            };

            if (args.json) {
              console.log(JSON.stringify(payload, null, 2));
              return;
            }

            console.log(`Doc ID: ${payload.docId}`);
            console.log(`Title: ${payload.title ?? "(untitled)"}`);
            console.log(`Revision: ${payload.revisionId ?? "(unknown)"}`);
          }
        )
        .command(
          "outline <docId>",
          "Show document outline",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("objects", { type: "boolean", default: false }),
          async (args) => {
            const model = await fetchModel(String(args.docId));
            const outline: OutlineEntry[] = buildOutline(model, Boolean(args.objects));

            if (args.json) {
              console.log(JSON.stringify({ headings: outline }, null, 2));
              return;
            }

            if (outline.length === 0) {
              console.log("No headings found.");
              return;
            }

            for (const heading of outline) {
              const level = Number(heading.level ?? 1);
              const indent = "  ".repeat(Math.max(0, level - 1));
              const text = String(heading.text ?? "");
              let line = `${indent}${text}`;
              if (args.objects) {
                const objects = heading.objects;
                if (objects) {
                  line += ` [objects: atomic=${objects.atomic}, tables=${objects.tables}, hr=${objects.horizontalRules}, embeds=${objects.embeds}]`;
                }
              }
              console.log(line);
            }
          }
        )
        .command(
          "ls <docId>",
          "List blocks in document",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" }),
          async (args) => {
            const model = await fetchModel(String(args.docId));
            let items = buildList(model);

            if (args.select) {
              const resolved = await resolveSelection({
                docId: String(args.docId),
                select: args.select,
                guard: args.guard,
                ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
                expect: args.expect,
              });
              const blocks = blocksFromTarget(resolved.target);
              items = buildList(model, blocks);
            }

            if (args.json) {
              console.log(JSON.stringify({ blocks: items }, null, 2));
              return;
            }

            for (const item of items) {
              const heading = formatHeadingPath(item.headingPath);
              console.log(
                `[${item.index}] ${item.type} ${heading} :: ${item.snippet}`
              );
            }
          }
        )
        .command(
          "dump <docId>",
          "Dump internal model",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("format", { type: "string", default: "json" }),
          async (args) => {
            const model = await fetchModel(String(args.docId));

            if (args.format !== "json") {
              throw new Error(`Unsupported format: ${args.format}`);
            }

            console.log(JSON.stringify(model, null, 2));
          }
        )
        .demandCommand(1),
    notImplemented
  );
}
