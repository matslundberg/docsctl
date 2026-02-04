import type { Argv } from "yargs";
import { getTokenStatus, login, logout } from "../../auth/oauth";

export function registerAuthCommands(yargs: Argv) {
  return yargs.command(
    "auth",
    "Authentication commands",
    (y) =>
      y
        .command("login", "Login via OAuth", () => {}, async (args) => {
          const token = await login();
          if (args.json) {
            console.log(JSON.stringify({ accessToken: !!token.accessToken }, null, 2));
            return;
          }
          console.log("Login successful.");
        })
        .command("status", "Show auth status", () => {}, async (args) => {
          const status = await getTokenStatus();
          const expiresAt = status.token?.expiryDate
            ? new Date(status.token.expiryDate).toISOString()
            : null;
          if (args.json) {
            console.log(
              JSON.stringify(
                {
                  tokenPath: status.tokenPath,
                  loggedIn: !!status.token,
                  expired: status.expired,
                  expiresAt,
                },
                null,
                2
              )
            );
            return;
          }
          if (!status.token) {
            console.log(`Not logged in. Token path: ${status.tokenPath}`);
            return;
          }
          console.log(`Token path: ${status.tokenPath}`);
          console.log(`Expired: ${status.expired ? "yes" : "no"}`);
          if (expiresAt) {
            console.log(`Expires at: ${expiresAt}`);
          }
        })
        .command("logout", "Clear cached auth", () => {}, async (args) => {
          await logout();
          if (args.json) {
            console.log(JSON.stringify({ loggedOut: true }, null, 2));
            return;
          }
          console.log("Logged out.");
        })
        .demandCommand(1),
    () => {}
  );
}
