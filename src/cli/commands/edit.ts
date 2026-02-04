import type { Argv } from "yargs";
import { compileTarget } from "../../compiler/compile";
import { readTextFile } from "../../util/fs";
import { formatResolvedTarget, resolveSelection } from "../resolveSelection";
import { DocsClient } from "../../google/docsClient";
import { getToken } from "../../auth/oauth";

export function registerEditCommands(yargs: Argv) {
  return yargs.command(
    "edit",
    "Edit document content",
    (y) =>
      y
        .command(
          "insert <position> <docId>",
          "Insert text before/after a selection",
          (b) =>
            b
              .positional("position", { choices: ["before", "after"] as const })
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("text", { type: "string" })
              .option("file", { type: "string" }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const textInput = args.file ? await readTextFile(String(args.file)) : args.text;
            if (textInput === undefined) {
              throw new Error("Provide --text or --file for insert.");
            }
            const text = String(textInput);
            const compiled = compileTarget(resolved.target, {
              kind: "insert",
              position: String(args.position) === "after" ? "after" : "before",
              text,
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
            console.log("Insert completed.");
          }
        )
        .command(
          "replace <kind> <docId>",
          "Replace section or match",
          (b) =>
            b
              .positional("kind", { choices: ["section", "match"] as const })
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("file", { type: "string" })
              .option("with", { type: "string" })
              .option("mode", { type: "string" }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const isMatch = String(args.kind) === "match";
            const isSection = String(args.kind) === "section";

            if (!isMatch && !isSection) {
              throw new Error("Unsupported replace kind.");
            }

            const textInput = args.file ? await readTextFile(String(args.file)) : args.with;
            if (textInput === undefined) {
              throw new Error("Provide --with or --file for replace.");
            }
            const text = String(textInput);

            const compiled = compileTarget(resolved.target, {
              kind: isMatch ? "replaceMatch" : "replaceSection",
              text,
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
            console.log("Replace completed.");
          }
        )
        .command(
          "delete <docId>",
          "Delete a selection",
          (b) => b.positional("docId", { type: "string", demandOption: true }).option("select", { type: "string" }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            const compiled = compileTarget(resolved.target, { kind: "delete" });

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
            console.log("Delete completed.");
          }
        )
        .demandCommand(1),
    () => {}
  );
}
