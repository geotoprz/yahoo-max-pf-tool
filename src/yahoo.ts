import { XMLParser } from "fast-xml-parser";
import { getAccessToken } from "./oauth.js";
import type { PlayerWeek, TeamInfo } from "./types.js";

const API = "https://fantasysports.yahooapis.com/fantasy/v2";
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (_name, jpath) =>
    jpath.endsWith(".teams.team") ||
    jpath.endsWith(".players.player") ||
    jpath.endsWith(".eligible_positions.position")
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

async function yahooGet(path: string, attempt = 1): Promise<any> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if ((response.status === 429 || response.status >= 500) && attempt < 4) {
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    return yahooGet(path, attempt + 1);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Yahoo API ${response.status} for ${path}: ${body.slice(0, 1000)}`);
  }
  return parser.parse(body);
}

export type LeagueMeta = {
  leagueKey: string;
  name: string;
  currentWeek: number;
  startWeek: number;
  endWeek: number;
};

export type LeagueSettings = {
  playoffStartWeek: number | null;
};

export async function getLeagueMeta(leagueId: string): Promise<LeagueMeta> {
  const data = await yahooGet(`/league/nfl.l.${leagueId}`);
  const league = data?.fantasy_content?.league;
  if (!league) throw new Error("Could not parse Yahoo league metadata.");

  return {
    leagueKey: text(league.league_key) || `nfl.l.${leagueId}`,
    name: text(league.name) || `League ${leagueId}`,
    currentWeek: Number(league.current_week || 1),
    startWeek: Number(league.start_week || 1),
    endWeek: Number(league.end_week || 18)
  };
}

export async function getLeagueSettings(leagueKey: string): Promise<LeagueSettings> {
  const data = await yahooGet(`/league/${leagueKey}/settings`);
  const settings = data?.fantasy_content?.league?.settings;
  const raw = settings?.playoff_start_week;
  return { playoffStartWeek: raw ? Number(raw) : null };
}

export async function getTeams(leagueKey: string): Promise<TeamInfo[]> {
  const data = await yahooGet(`/league/${leagueKey}/teams`);
  const rawTeams = asArray(data?.fantasy_content?.league?.teams?.team);

  const teams = rawTeams.map((team: any) => ({
    key: text(team.team_key),
    id: text(team.team_id),
    name: text(team.name)
  })).filter((team) => team.key && team.name);

  if (!teams.length) {
    throw new Error("Yahoo returned no teams. Check that the authorized account belongs to this league.");
  }
  return teams;
}

export async function getTeamRosterWithStats(teamKey: string, week: number): Promise<PlayerWeek[]> {
  const data = await yahooGet(`/team/${teamKey}/roster;week=${week}/players/stats`);
  const players = asArray(data?.fantasy_content?.team?.roster?.players?.player);

  return players.map((player: any) => ({
    key: text(player.player_key),
    name: text(player.name?.full) || `${text(player.name?.first)} ${text(player.name?.last)}`.trim(),
    eligiblePositions: asArray(player.eligible_positions?.position).map(text),
    primaryPosition: text(player.primary_position) || undefined,
    selectedPosition: text(player.selected_position?.position) || undefined,
    points: Number(player.player_points?.total || 0)
  }));
}
