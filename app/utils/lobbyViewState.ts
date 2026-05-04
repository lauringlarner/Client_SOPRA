import {
  LOBBY_TEAMS,
  LobbyPlayer,
  LobbySelectableTeam,
  SinglPlayereMode,
} from "@/types/lobby";

interface LobbyViewStateOptions {
  currentPlayer: LobbyPlayer | null;
  isSinglePlayer: SinglPlayereMode;
  pendingAction: string | null;
  players: LobbyPlayer[];
}

interface LobbyViewState {
  actionNote: string | null;
  canAutoStart: boolean;
}

export function deriveLobbyViewState(
  options: LobbyViewStateOptions,
): LobbyViewState {
  const { currentPlayer, isSinglePlayer, pendingAction, players } = options;
  const playerCount = players.length;
  const isHost = currentPlayer?.isHost ?? false;
  const allPlayersReady =
    playerCount > 0 && players.every((player) => player.isReady);
  const bothTeamsHavePlayers = isSinglePlayer === 1
    ? LOBBY_TEAMS.some((team: LobbySelectableTeam) =>
        players.some((player) => player.team === team)
      )
    : LOBBY_TEAMS.every((team: LobbySelectableTeam) =>
        players.some((player) => player.team === team)
      );

  return {
    actionNote: getActionNote({
      allPlayersReady,
      bothTeamsHavePlayers,
      currentPlayer,
      isHost,
      pendingAction,
      playerCount,
    }),
    canAutoStart: allPlayersReady && bothTeamsHavePlayers,
  };
}

interface ActionNoteOptions {
  allPlayersReady: boolean;
  bothTeamsHavePlayers: boolean;
  currentPlayer: LobbyPlayer | null;
  isHost: boolean;
  pendingAction: string | null;
  playerCount: number;
}

function getActionNote(options: ActionNoteOptions): string | null {
  const {
    allPlayersReady,
    bothTeamsHavePlayers,
    currentPlayer,
    isHost,
    pendingAction,
    playerCount,
  } = options;

  if (pendingAction === "start") {
    return "Everyone is ready. Starting the game.";
  }

  if (!currentPlayer) {
    return "Your player entry is missing from this lobby.";
  }

  if (!isHost && !allPlayersReady) {
    return "The game starts automatically once everyone is ready.";
  }

  if (!isHost) {
    return "Everyone is ready. Waiting for the game to start.";
  }

  if (playerCount < 2) {
    return "At least 2 players are required before the game can start.";
  }

  if (!bothTeamsHavePlayers) {
    return "Each team needs at least one player before the game can start.";
  }

  if (!allPlayersReady) {
    return "The game starts automatically once everyone is ready.";
  }

  return null;
}
