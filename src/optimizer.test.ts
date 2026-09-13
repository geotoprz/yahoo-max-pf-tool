import assert from "node:assert/strict";
import test from "node:test";
import { optimizeLineup } from "./optimizer.js";
import { LEAGUE_30035_STARTER_SLOTS } from "./slots.js";
import type { PlayerWeek } from "./types.js";

function p(name: string, pos: "QB" | "RB" | "WR" | "TE", points: number): PlayerWeek {
  return { key: name, name, eligiblePositions: [pos], primaryPosition: pos, points };
}

test("optimizes the league's 10 offensive starter slots", () => {
  const players: PlayerWeek[] = [
    p("QB1", "QB", 20), p("QB2", "QB", 18), p("QB3", "QB", 5),
    p("RB1", "RB", 25), p("RB2", "RB", 15), p("RB3", "RB", 14), p("RB4", "RB", 2),
    p("WR1", "WR", 24), p("WR2", "WR", 16), p("WR3", "WR", 13), p("WR4", "WR", 12),
    p("TE1", "TE", 17), p("TE2", "TE", 11), p("TE3", "TE", 1)
  ];

  const result = optimizeLineup(players, LEAGUE_30035_STARTER_SLOTS);
  assert.equal(result.assignments.length, 10);
  assert.equal(result.points, 174);
  assert.equal(result.assignments.filter((a) => a.player.name === "QB1").length, 1);
  assert.equal(result.assignments.filter((a) => a.player.name === "QB2").length, 1);
});

test("a player is never used twice", () => {
  const players: PlayerWeek[] = [
    p("QB1", "QB", 50), p("QB2", "QB", 1),
    p("RB1", "RB", 10), p("RB2", "RB", 9), p("RB3", "RB", 8), p("RB4", "RB", 7),
    p("WR1", "WR", 10), p("WR2", "WR", 9), p("WR3", "WR", 8), p("WR4", "WR", 7),
    p("TE1", "TE", 10), p("TE2", "TE", 9)
  ];

  const result = optimizeLineup(players, LEAGUE_30035_STARTER_SLOTS);
  const names = result.assignments.map((a) => a.player.name);
  assert.equal(new Set(names).size, names.length);
});
