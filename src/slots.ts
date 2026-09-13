import type { BasePosition, StarterSlot } from "./types.js";

// League 30035 roster settings from the screenshot supplied by the commissioner:
// QB x1, WR x2, RB x2, TE x1, W/T x1, W/R/T x2, Q/W/R/T x1.
export const LEAGUE_30035_STARTER_SLOTS: StarterSlot[] = [
  { id: "QB1", label: "QB", accepts: ["QB"] },
  { id: "RB1", label: "RB", accepts: ["RB"] },
  { id: "RB2", label: "RB", accepts: ["RB"] },
  { id: "WR1", label: "WR", accepts: ["WR"] },
  { id: "WR2", label: "WR", accepts: ["WR"] },
  { id: "TE1", label: "TE", accepts: ["TE"] },
  { id: "WT1", label: "W/T", accepts: ["WR", "TE"] },
  { id: "WRT1", label: "W/R/T", accepts: ["WR", "RB", "TE"] },
  { id: "WRT2", label: "W/R/T", accepts: ["WR", "RB", "TE"] },
  { id: "QWRT1", label: "Q/W/R/T", accepts: ["QB", "WR", "RB", "TE"] }
];

export function playerBasePositions(eligible: string[], primary?: string): BasePosition[] {
  const bases = new Set<BasePosition>();
  const source = [...eligible, primary].filter(Boolean) as string[];

  for (const position of source) {
    if (position === "QB" || position === "RB" || position === "WR" || position === "TE") {
      bases.add(position);
    }
  }

  return [...bases];
}
