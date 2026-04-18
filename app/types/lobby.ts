export type LobbySelectableTeam = "Team1" | "Team2";

export type LobbyTeam = LobbySelectableTeam | null;

export const LOBBY_TEAMS: LobbySelectableTeam[] = ["Team1", "Team2"];

export interface LobbyUser {
  correctItemsFound: number;
  creation_date: string;
  email?: string;
  gamesPlayed: number;
  gamesWon: number;
  id: string;
  status: string;
  username: string;
}

export interface LobbyPlayer {
  id: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: string;
  team: LobbyTeam;
  user: LobbyUser;
}

export interface LobbyDetails {
  createdAt?: string;
  gameDuration: number;
  gameId?: string;
  id: string;
  joinCode: string;
  lobbyPlayers: LobbyPlayer[];
}

export interface JoinLobbyResult {
  joinCode: string;
  lobbyId: string;
}

export interface StartLobbyResult {
  gameId?: string;
}

export function getLobbyTeamLabel(team: LobbyTeam): string {
  if (team === "Team1") {
    return "Team 1";
  }
  if (team === "Team2") {
    return "Team 2";
  }
  return "Unassigned";
}
