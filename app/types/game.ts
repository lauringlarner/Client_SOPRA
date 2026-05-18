export type GameStatus = "IN_PROGRESS" | "ENDED";

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
  isSinglePlayer?: boolean;
  lobbyId: string;
  score_1: number;
  score_2: number;
  startedAt: string;
  status: GameStatus;
  tileGrid: GameTile[][];
  wordList: string[];
  wordListScore: string[];
}

export interface ChatMessageGetDTO {
  id?: string;
  message: string;
  sender: string;
  sentAt: string;
  teamType: string;
}
