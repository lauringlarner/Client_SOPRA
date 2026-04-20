export type GameStatus = "IN_PROGRESS" | "FINISHED";

export type GameTileStatus =
  | "UNCLAIMED"
  | "PROCESSING_TEAM1"
  | "PROCESSING_TEAM2"
  | "CLAIMED_TEAM1"
  | "CLAIMED_TEAM2";

export interface GameTile {
  status: GameTileStatus;
  value: number;
  word: string;
}

export interface GameDetails {
  gameDuration: number;
  id: string;
  lobbyId: string;
  score_1: number;
  score_2: number;
  status: GameStatus;
  tileGrid: GameTile[][];
  wordList: string[];
  wordListScore: string[];
}
