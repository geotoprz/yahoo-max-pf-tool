import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { toCsv } from "./csv.js";
import { optimizeLineup, round2 } from "./optimizer.js";
import { LEAGUE_30035_STARTER_SLOTS } from "./slots.js";
import type { PlayerWeek, TeamWeekResult } from "./types.js";
import { getLeagueMeta, getLeagueSettings, getTeamRosterWithStats, getTeams } from "./yahoo.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    throughWeek: value("--through") ? Number(value("--through")) : undefined,
    includeCurrent: args.includes("--include-current"),
    fromWeek: value("--from") ? Number(value("--from")) : undefined
  };
}

function isActiveStarter(player: PlayerWeek): boolean {
  const pos = player.selectedPosition;
  return Boolean(pos && pos !== "BN" && pos !== "IR" && pos !== "IL" && pos !== "NA");
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const leagueId = process.env.YAHOO_LEAGUE_ID || "30035";
const includeIr = (process.env.INCLUDE_IR || "true").toLowerCase() !== "false";
const { throughWeek, includeCurrent, fromWeek } = parseArgs();

const meta = await getLeagueMeta(leagueId);
const settings = await getLeagueSettings(meta.leagueKey);
const teams = await getTeams(meta.leagueKey);

const regularSeasonEnd = settings.playoffStartWeek ? settings.playoffStartWeek - 1 : meta.endWeek;
const completedThrough = includeCurrent ? meta.currentWeek : Math.max(meta.startWeek, meta.currentWeek - 1);
const defaultThrough = Math.min(regularSeasonEnd, completedThrough);
const finalThrough = throughWeek ?? defaultThrough;
const finalFrom = fromWeek ?? meta.startWeek;

if (!Number.isInteger(finalThrough) || !Number.isInteger(finalFrom) || finalThrough < finalFrom) {
  throw new Error(`Invalid week range ${finalFrom}-${finalThrough}.`);
}
if (finalThrough > regularSeasonEnd) {
  console.warn(`Warning: --through ${finalThrough} is after the detected regular-season end (Week ${regularSeasonEnd}).`);
}

console.log(`\n${meta.name}`);
console.log(`League key: ${meta.leagueKey}`);
console.log(`Teams: ${teams.length}`);
console.log(`Calculating weekly Max PF for Weeks ${finalFrom}-${finalThrough}${includeIr ? " (IR included)" : " (IR excluded)"}...\n`);

const weekResults: TeamWeekResult[] = [];

for (let week = finalFrom; week <= finalThrough; week++) {
  process.stdout.write(`Week ${week}: `);

  const results = await mapWithConcurrency(teams, 3, async (team): Promise<TeamWeekResult> => {
    let players = await getTeamRosterWithStats(team.key, week);
    if (!includeIr) players = players.filter((p) => p.selectedPosition !== "IR");

    const optimal = optimizeLineup(players, LEAGUE_30035_STARTER_SLOTS);
    const actualPf = round2(players.filter(isActiveStarter).reduce((sum, player) => sum + player.points, 0));

    return {
      week,
      teamKey: team.key,
      teamName: team.name,
      actualPf,
      maxPf: optimal.points,
      efficiency: optimal.points === 0 ? null : round2((actualPf / optimal.points) * 100),
      optimalLineup: optimal.assignments
    };
  });

  weekResults.push(...results);
  console.log("done");
}

const totals = teams.map((team) => {
  const rows = weekResults.filter((row) => row.teamKey === team.key);
  const actualPf = round2(rows.reduce((sum, row) => sum + row.actualPf, 0));
  const maxPf = round2(rows.reduce((sum, row) => sum + row.maxPf, 0));
  return {
    team: team.name,
    team_key: team.key,
    actual_pf: actualPf,
    max_pf: maxPf,
    lineup_efficiency_pct: maxPf === 0 ? "" : round2((actualPf / maxPf) * 100)
  };
}).sort((a, b) => a.max_pf - b.max_pf);

const ranked = totals.map((row, index) => ({ rookie_pick_order: index + 1, ...row }));

const detailRows = weekResults
  .sort((a, b) => a.week - b.week || a.teamName.localeCompare(b.teamName))
  .map((row) => ({
    week: row.week,
    team: row.teamName,
    actual_pf: row.actualPf,
    max_pf: row.maxPf,
    efficiency_pct: row.efficiency ?? "",
    optimal_lineup: row.optimalLineup.map(({ slot, player }) => `${slot.label}: ${player.name} (${player.points})`).join(" | ")
  }));

await fs.mkdir(path.resolve("results"), { recursive: true });
await fs.writeFile(path.resolve("results/max-pf.csv"), toCsv(ranked));
await fs.writeFile(path.resolve("results/max-pf-by-week.csv"), toCsv(detailRows));
await fs.writeFile(path.resolve("results/max-pf-audit.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  leagueId,
  leagueKey: meta.leagueKey,
  leagueName: meta.name,
  weeks: { from: finalFrom, through: finalThrough, regularSeasonEnd },
  includeIr,
  slots: LEAGUE_30035_STARTER_SLOTS,
  totals: ranked,
  byWeek: weekResults
}, null, 2));

console.table(ranked.map(({ rookie_pick_order, team, actual_pf, max_pf, lineup_efficiency_pct }) => ({
  Pick: rookie_pick_order,
  Team: team,
  "Actual PF": actual_pf,
  "Max PF": max_pf,
  "Efficiency %": lineup_efficiency_pct
})));

console.log("\nWrote:");
console.log("  results/max-pf.csv             (season totals / draft-order ranking)");
console.log("  results/max-pf-by-week.csv     (weekly audit + optimal lineup)");
console.log("  results/max-pf-audit.json      (full machine-readable audit)\n");
console.log("Important: apply the Max-PF order only to your NON-PLAYOFF teams. Playoff-team picks should follow your league's playoff-finish rule.");
