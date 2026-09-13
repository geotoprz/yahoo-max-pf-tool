import { playerBasePositions } from "./slots.js";
import type { OptimizedLineup, PlayerWeek, StarterSlot } from "./types.js";

type State = {
  score: number;
  assignments: Array<{ slotIndex: number; playerIndex: number }>;
};

function canFill(player: PlayerWeek, slot: StarterSlot): boolean {
  const positions = playerBasePositions(player.eligiblePositions, player.primaryPosition);
  return positions.some((position) => slot.accepts.includes(position));
}

/**
 * Maximum-weight bipartite assignment using DP over the 2^N starter-slot masks.
 * N=10 in this league, so this stays tiny even with 20+ rostered players.
 */
export function optimizeLineup(players: PlayerWeek[], slots: StarterSlot[]): OptimizedLineup {
  if (slots.length > 30) {
    throw new Error("This optimizer supports at most 30 starter slots.");
  }

  const fullMask = (1 << slots.length) - 1;
  let dp = new Map<number, State>();
  dp.set(0, { score: 0, assignments: [] });

  players.forEach((player, playerIndex) => {
    const next = new Map(dp);

    for (const [mask, state] of dp) {
      slots.forEach((slot, slotIndex) => {
        const bit = 1 << slotIndex;
        if ((mask & bit) !== 0 || !canFill(player, slot)) return;

        const newMask = mask | bit;
        const candidate: State = {
          score: state.score + player.points,
          assignments: [...state.assignments, { slotIndex, playerIndex }]
        };

        const previous = next.get(newMask);
        if (!previous || candidate.score > previous.score) {
          next.set(newMask, candidate);
        }
      });
    }

    dp = next;
  });

  const best = dp.get(fullMask);
  if (!best) {
    const mostFilled = [...dp.entries()].sort((a, b) => popcount(b[0]) - popcount(a[0]))[0];
    const filled = mostFilled ? popcount(mostFilled[0]) : 0;
    throw new Error(`Could not build a complete legal lineup: only ${filled}/${slots.length} slots could be filled.`);
  }

  const assignments = best.assignments
    .map(({ slotIndex, playerIndex }) => ({ slot: slots[slotIndex], player: players[playerIndex] }))
    .sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));

  return { points: round2(best.score), assignments };
}

function popcount(value: number): number {
  let count = 0;
  let x = value;
  while (x) {
    x &= x - 1;
    count++;
  }
  return count;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
