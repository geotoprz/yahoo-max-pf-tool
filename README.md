# Yahoo Dynasty Max PF — League 30035

A small TypeScript CLI that calculates **weekly historical Max PF (potential points)** for your Yahoo dynasty league while correctly accounting for trades, waivers, drops, and other roster changes.

It does this the fair way: for every team and every regular-season week, it asks Yahoo for **that week's roster**, gets each rostered player's **Yahoo fantasy points for that week**, and finds the highest-scoring legal lineup for your league's starting slots.

## Your lineup encoded in the calculator

From the league settings screenshot:

- QB × 1
- RB × 2
- WR × 2
- TE × 1
- W/T × 1
- W/R/T × 2
- Q/W/R/T (Superflex) × 1
- Bench × 12
- IR × 1

That means Max PF optimizes exactly **10 offensive starters** each week.

## Why roster changes are handled correctly

The Yahoo Fantasy Sports API supports a roster query for a specific NFL week. The calculator calls the historical roster endpoint separately for each team/week, rather than applying today's roster retroactively.

So if Team A owns a player in Weeks 1–4 and trades him to Team B before Week 5:

- his Weeks 1–4 points are eligible for Team A's Max PF;
- his Week 5+ points are eligible for Team B's Max PF.

## Requirements

- Node.js 20+
- Yahoo Fantasy API access
- A Yahoo Developer **Public Client** app authorized for Fantasy Sports **Read** access
- The Yahoo account you authorize must be able to view league 30035

Yahoo currently requires Fantasy API applications to be submitted/approved. Once Yahoo enables the app and gives you the Client ID, the calculator is ready to run. This project uses a Yahoo **Public Client**, so there is no Client Secret.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
YAHOO_CLIENT_ID=your_client_id
YAHOO_REDIRECT_URI=https://localhost:3000/callback
YAHOO_LEAGUE_ID=30035
INCLUDE_IR=true
```

`YAHOO_REDIRECT_URI` must exactly match the redirect URI registered in Yahoo Developer. For the app created for this project, use `https://localhost:3000/callback`.

## Authorize once

```bash
npm run auth
```

The script generates a fresh **PKCE** verifier/challenge and prints a Yahoo authorization URL. Open it and approve access. Yahoo will redirect to `https://localhost:3000/callback?...`. Because this is a CLI and no local HTTPS server is running, the browser may show a connection/certificate error after the redirect; that is expected. Copy the full URL from the address bar and paste it into the terminal.

The script verifies the returned OAuth `state`, exchanges the authorization code using the PKCE `code_verifier`, and stores the resulting tokens in `.yahoo-token.json`, which is gitignored. It automatically refreshes expired access tokens using the refresh token. Public clients omit `client_secret` on both token exchange and refresh.

## Calculate Max PF

```bash
npm run maxpf
```

By default it calculates from your league's start week through the **last completed week**, capped at the week before Yahoo's configured playoff start.

Useful options:

```bash
# Explicitly calculate through Week 14
npm run maxpf -- --through 14

# Recalculate only Weeks 8-14
npm run maxpf -- --from 8 --through 14

# Include the currently-running Yahoo fantasy week (normally avoid this)
npm run maxpf -- --include-current
```

## Output

The tool writes three audit-friendly files:

- `results/max-pf.csv` — total Actual PF, Max PF, efficiency, and lowest-Max-PF-first ranking.
- `results/max-pf-by-week.csv` — each team's Actual PF, Max PF, and exact optimal lineup for every week.
- `results/max-pf-audit.json` — full data for auditing/debugging.

The ranking in `max-pf.csv` is **not automatically the complete rookie draft order**. Use lowest Max PF only for the non-playoff teams; order playoff teams according to your league's playoff-finish rule.

## IR policy

Default: `INCLUDE_IR=true`.

That means a player rostered in Yahoo's IR slot is still part of the team's talent pool for Max PF and can count if he actually scores enough points to make the optimal lineup. This is the harder-to-game anti-tanking rule.

If your league votes to exclude Yahoo IR slots entirely:

```env
INCLUDE_IR=false
```

## Verification

The script also calculates **Actual PF from Yahoo's historical selected positions**. This is useful as a sanity check against Yahoo's weekly score. Small discrepancies could occur if Yahoo exposes corrected historical data differently from the old matchup display; the weekly audit file makes any issue traceable.

## League rule I would pair with this

> Rookie picks for non-playoff teams are ordered by regular-season Max PF (lowest first). Max PF is the sum of each team's highest-scoring legal lineup from the roster Yahoo records for each fantasy week. Roster rebuilding is allowed; intentionally submitting a weaker lineup does not improve draft position.
