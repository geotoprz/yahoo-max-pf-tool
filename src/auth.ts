import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createAuthorizationRequest, exchangeAuthorizationCode } from "./oauth.js";

const request = createAuthorizationRequest();

console.log("\nYahoo authorization (Public Client + PKCE)\n");
console.log("1) Open this URL in your browser:\n");
console.log(request.url);
console.log("\n2) Approve access.");
console.log("3) Yahoo will redirect to your registered HTTPS localhost callback.");
console.log("   It is OK if the browser then shows a connection/certificate error because no local web server is running.");
console.log("   Copy the FULL URL from the address bar and paste it below.");
console.log("   You can also paste only the `code` value.\n");

const rl = readline.createInterface({ input, output });
const answer = (await rl.question("Redirected URL or authorization code: ")).trim();
rl.close();

let code = answer;
let returnedState: string | null = null;
try {
  const url = new URL(answer);
  code = url.searchParams.get("code") || "";
  returnedState = url.searchParams.get("state");

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const description = url.searchParams.get("error_description");
    throw new Error(`Yahoo authorization failed: ${oauthError}${description ? ` — ${description}` : ""}`);
  }
} catch (error) {
  if (error instanceof Error && error.message.startsWith("Yahoo authorization failed:")) throw error;
  // User pasted only the code rather than a full URL.
}

if (!code) throw new Error("No authorization code supplied.");
if (returnedState && returnedState !== request.state) {
  throw new Error("OAuth state mismatch. Do not continue; run `npm run auth` again and use the URL from that same run.");
}

await exchangeAuthorizationCode(code, request.codeVerifier);
console.log("\nAuthorized successfully. Token stored locally in .yahoo-token.json (gitignored).\n");
