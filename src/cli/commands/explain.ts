import type { Argv } from "yargs";
import { buildExplainOutput } from "../explainDiff";

export function registerExplainCommands(yargs: Argv) {
  return yargs.command(
    "explain <command..>",
    "Explain a mutating command",
    (b) => b.positional("command", { type: "string", array: true, demandOption: true }),
    async (args) => {
      const tokens = (args.command ?? []).map(String);
      const output = await buildExplainOutput(tokens);

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
