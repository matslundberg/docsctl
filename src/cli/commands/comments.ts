import type { Argv } from "yargs";
import { formatResolvedTarget, resolveSelection } from "../resolveSelection";
import { DriveClient } from "../../google/driveClient";
import { getToken } from "../../auth/oauth";
import { buildCommentAnchor } from "../commentAnchor";

export function registerCommentCommands(yargs: Argv) {
  return yargs.command(
    "comments",
    "Comment operations",
    (y) =>
      y
        .command(
          "list <docId>",
          "List comments",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("open", { type: "boolean" })
              .option("resolved", { type: "boolean" }),
          async (args) => {
            const token = await getToken();
            const client = new DriveClient(token.accessToken);
            let comments = await client.listComments(String(args.docId));

            if (args.open) {
              comments = comments.filter((comment) => !comment.resolved);
            }
            if (args.resolved) {
              comments = comments.filter((comment) => comment.resolved);
            }

            if (args.json) {
              console.log(JSON.stringify({ comments }, null, 2));
              return;
            }

            if (comments.length === 0) {
              console.log("No comments.");
              return;
            }

            for (const comment of comments) {
              const author = comment.author?.displayName ?? comment.author?.emailAddress ?? "unknown";
              const status = comment.resolved ? "resolved" : "open";
              console.log(`[${comment.id}] ${status} ${author}: ${comment.content ?? ""}`);
            }
          }
        )
        .command(
          "add <docId>",
          "Add comment",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("select", { type: "string" })
              .option("text", { type: "string", demandOption: true })
              .option("unanchored", { type: "boolean", default: false }),
          async (args) => {
            const resolved = await resolveSelection({
              docId: String(args.docId),
              select: args.select,
              guard: args.guard,
              ifRevision: (args as any)["if-revision"] ?? (args as any).ifRevision,
              expect: args.expect,
            });

            if (resolved.target.kind !== "textRange" || !resolved.target.textRange) {
              throw new Error("Comments add requires a textRange selection.");
            }

            const { paragraph, startOffset, endOffset } = resolved.target.textRange;
            const text = String(args.text);
            const payload: Record<string, unknown> = {
              content: text,
            };

            if (!args.unanchored) {
              console.warn(
                "Warning: Drive API anchored comments are not supported for Google Docs editor files. The comment may show 'Original content deleted' in the UI."
              );
              const anchor = buildCommentAnchor(paragraph, startOffset, endOffset);
              payload.quotedFileContent = {
                mimeType: "text/html",
                value: anchor.quotedText,
              };
              payload.anchor = anchor.anchor;
            }

            const token = await getToken();
            const client = new DriveClient(token.accessToken);
            const comment = await client.addComment(String(args.docId), payload);

            if (args.json) {
              console.log(JSON.stringify({ comment }, null, 2));
              return;
            }

            console.log(`Resolved target: ${formatResolvedTarget(resolved.target)}`);
            console.log(`Comment created: ${comment.id}`);
          }
        )
        .command(
          "reply <docId>",
          "Reply to comment",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("id", { type: "string", demandOption: true })
              .option("text", { type: "string", demandOption: true }),
          async (args) => {
            const token = await getToken();
            const client = new DriveClient(token.accessToken);
            const reply = await client.replyToComment(String(args.docId), String(args.id), {
              content: String(args.text),
            });

            if (args.json) {
              console.log(JSON.stringify({ reply }, null, 2));
              return;
            }

            console.log(`Reply created for ${args.id}.`);
          }
        )
        .command(
          "resolve <docId>",
          "Resolve comment",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("id", { type: "string", demandOption: true })
              .option("text", { type: "string" }),
          async (args) => {
            const token = await getToken();
            const client = new DriveClient(token.accessToken);
            const reply = await client.replyToComment(String(args.docId), String(args.id), {
              action: "resolve",
              content: args.text ? String(args.text) : "Resolved.",
            });

            if (args.json) {
              console.log(JSON.stringify({ reply }, null, 2));
              return;
            }

            console.log(`Resolved comment ${args.id}.`);
          }
        )
        .command(
          "reopen <docId>",
          "Reopen comment",
          (b) =>
            b
              .positional("docId", { type: "string", demandOption: true })
              .option("id", { type: "string", demandOption: true })
              .option("text", { type: "string" }),
          async (args) => {
            const token = await getToken();
            const client = new DriveClient(token.accessToken);
            const reply = await client.replyToComment(String(args.docId), String(args.id), {
              action: "reopen",
              content: args.text ? String(args.text) : "Reopened.",
            });

            if (args.json) {
              console.log(JSON.stringify({ reply }, null, 2));
              return;
            }

            console.log(`Reopened comment ${args.id}.`);
          }
        )
        .demandCommand(1),
    () => {}
  );
}
