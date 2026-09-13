import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { authorizationUrl, exchangeAuthorizationCode } from "./oauth.js";

console.log("\n1) Open this Yahoo authorization URL:\n");
console.log(authorizationUrl());
console.log("\n2) Approve access. Paste the authorization code below.");
console.log("   If Yahoo redirects to a URL, you can paste the whole redirected URL instead.\n");

const rl = readline.createInterface({ input, output });
const answer = (await rl.question("Code or redirected URL: ")).trim();
rl.close();

let code = answer;
try {
  const url = new URL(answer);
  code = url.searchParams.get("code") || answer;
} catch {
  // User pasted only the code.
}

if (!code) throw new Error("No authorization code supplied.");
await exchangeAuthorizationCode(code);
console.log("\nAuthorized. Token stored locally in .yahoo-token.json (gitignored).\n");
