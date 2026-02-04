import type { Argv } from "yargs";
import { buildDiffOutput } from "../explainDiff";

export function registerDiffCommands(yargs: Argv) {
  return yargs.command(
    "diff <command..>",
    "Show diff for a mutating command",
    (b) => b.positional("command", { type: "string", array: true, demandOption: true }),
    async (args) => {
      const tokens = (args.command ?? []).map(String);
      const output = await buildDiffOutput(tokens);

      if (args.json) {
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      console.log(`Command: ${output.command}`);
      if (output.selector) {
        console.log(`Selector: ${output.selector}`);
      }
      if (output.guard) {
        console.log(`Guard: ${output.guard}`);
      }
      if (output.targetSummary) {
        console.log(`Target: ${output.targetSummary}`);
      }
      if (output.diff) {
        console.log("Before:");
        console.log(output.diff.before);
        console.log("After:");
        console.log(output.diff.after);
      }
      if (output.requestCount !== null) {
        console.log(`Requests: ${output.requestCount}`);
      }
      if (output.comment) {
        console.log("Comment payload prepared.");
      }
      if (output.message) {
        console.log(output.message);
      }
    }
  );
}
