export type BasePosition = "QB" | "RB" | "WR" | "TE";

export type StarterSlot = {
  id: string;
  label: string;
  accepts: BasePosition[];
};

export type PlayerWeek = {
  key: string;
  name: string;
  eligiblePositions: string[];
  primaryPosition?: string;
  selectedPosition?: string;
  points: number;
};

export type TeamInfo = {
  key: string;
  id: string;
  name: string;
};

export type OptimizedAssignment = {
  slot: StarterSlot;
  player: PlayerWeek;
};

export type OptimizedLineup = {
  points: number;
  assignments: OptimizedAssignment[];
};

export type TeamWeekResult = {
  week: number;
  teamKey: string;
  teamName: string;
  actualPf: number;
  maxPf: number;
  efficiency: number | null;
  optimalLineup: OptimizedAssignment[];
};
