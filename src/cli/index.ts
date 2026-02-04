import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { registerAuthCommands } from "./commands/auth";
import { registerDocCommands } from "./commands/doc";
import { registerEditCommands } from "./commands/edit";
import { registerStyleCommands } from "./commands/style";
import { registerObjectCommands } from "./commands/objects";
import { registerCommentCommands } from "./commands/comments";
import { registerExplainCommands } from "./commands/explain";
import { registerDiffCommands } from "./commands/diff";

export function buildCli(argv = process.argv) {
  let cli = yargs(hideBin(argv))
    .scriptName("gdocs")
    .option("json", { type: "boolean", default: false })
    .option("verbose", { type: "boolean", default: false })
    .option("dry-run", { type: "boolean", default: false })
    .option("select", { type: "string" })
    .option("guard", { type: "string" })
    .option("if-revision", { type: "string" })
    .option("expect", { type: "string" })
    .option("mode", { type: "string", default: "preserve-nontext" })
    .strict()
    .help();

  cli = registerAuthCommands(cli);
  cli = registerDocCommands(cli);
  cli = registerEditCommands(cli);
  cli = registerStyleCommands(cli);
  cli = registerObjectCommands(cli);
  cli = registerCommentCommands(cli);
  cli = registerExplainCommands(cli);
  cli = registerDiffCommands(cli);

  return cli.demandCommand(1);
}

buildCli().parse();
