import { GameTileStatus } from "@/types/game";

export type BackendTeamName = "Team 1" | "Team 2";

export type TeamPerspective = "own" | "enemy";

export interface TeamScoreViewModel {
  label: BackendTeamName;
  perspective: TeamPerspective;
  totalPoints: number;
}

export function normalizeBackendTeamName(value: string | null): BackendTeamName | null {
  if (value === "Team 2" || value === "Team2") {
    return "Team 2";
  }

  if (value === "Team 1" || value === "Team1") {
    return "Team 1";
  }

  return null;
}

export function buildTeamScores(
  currentTeam: BackendTeamName,
  team1Score: number,
  team2Score: number,
): TeamScoreViewModel[] {
  return [
    createTeamScore("Team 1", currentTeam, team1Score),
    createTeamScore("Team 2", currentTeam, team2Score),
  ];
}

export function getTilePerspective(
  status: GameTileStatus,
  currentTeam: BackendTeamName,
): TeamPerspective | null {
  const owner = getStatusOwner(status);
  if (!owner) {
    return null;
  }

  return owner === currentTeam ? "own" : "enemy";
}

function createTeamScore(
  label: BackendTeamName,
  currentTeam: BackendTeamName,
  totalPoints: number,
): TeamScoreViewModel {
  return {
    label,
    perspective: label === currentTeam ? "own" : "enemy",
    totalPoints,
  };
}

function getStatusOwner(status: GameTileStatus): BackendTeamName | null {
  if (status === "CLAIMED_TEAM1" || status === "PROCESSING_TEAM1") {
    return "Team 1";
  }

  if (status === "CLAIMED_TEAM2" || status === "PROCESSING_TEAM2") {
    return "Team 2";
  }

  return null;
}
