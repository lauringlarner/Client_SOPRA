import { ApiService } from "@/api/apiService";
import { ApplicationError } from "@/types/error";
import { GameDetails, GameStatus, GameTile, GameTileStatus } from "@/types/game";
import { getApiDomain } from "@/utils/domain";
import Pusher, { Channel } from "pusher-js";

type SubscribeToGame = (
  gameId: string,
  onUpdate: (details: GameDetails) => void,
  onError: (error: ApplicationError) => void,
) => () => void;

interface GameClient {
  subscribeToGame: SubscribeToGame;
  getGame: (gameId: string) => Promise<GameDetails>;
}

interface CreateGameClientOptions {
  api: ApiService;
  token: string;
}

export function createGameClient(options: CreateGameClientOptions): GameClient {
  const { api, token } = options;

  return {
    subscribeToGame: createRemoteGameSubscriber(options.token),
    async getGame(gameId: string): Promise<GameDetails> {
          const payload = await api.get<GameDetails>(`/games/${gameId}`,
            token,);
          return normalizeGameDetails(payload)
        },
  };
}

let pusher: Pusher | null = null;
const channelCache = new Map<string, Channel>();

function getPusher() {
  if (!pusher) {
    pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return pusher;
}



function createRemoteGameSubscriber(token: string): SubscribeToGame {
  return (gameId, onUpdate, onError) => {
    const pusher = getPusher();
    const channelName = `game-${gameId}`;
    const eventName = "GameUpdate";

    // Prevent duplicate subscriptions (React Strict Mode safe)
    if (channelCache.has(channelName)) {
      const existingChannel = channelCache.get(channelName)!;

      const handler = (data: unknown) => {
        try {
          const game = normalizeGameDetails(data);
          onUpdate(game);
        } catch {
          onError(createApplicationError("Invalid game update", 500));
        }
      };

      existingChannel.bind(eventName, handler);

      return () => {
        existingChannel.unbind(eventName, handler);
      };
    }

    const channel = pusher.subscribe(channelName);
    channelCache.set(channelName, channel);

    const handler = (data: unknown) => {
      try {
        const game = normalizeGameDetails(data);
        onUpdate(game);
      } catch {
        onError(createApplicationError("Invalid game update", 500));
      }
    };

    channel.bind(eventName, handler);

    const errorHandler = () => {
      onError(createApplicationError("Pusher connection error", 500));
    };

    pusher.connection.bind("error", errorHandler);

    return () => {
      channel.unbind(eventName, handler);
      pusher.unsubscribe(channelName);
      channelCache.delete(channelName);
      pusher.connection.unbind("error", errorHandler);
    };
  };
}


function normalizeGameDetails(value: unknown): GameDetails {
  if (!isRecord(value)) {
    throw createApplicationError("The game payload is malformed.", 500);
  }

  const tileGrid = normalizeTileGrid(value.tileGrid);

  return {
    gameDuration: getRequiredNumber(value.gameDuration, "game duration"),
    id: getRequiredString(value.id, "game id"),
    lobbyId: getRequiredString(value.lobbyId, "lobby id"),
    score_1: getRequiredNumber(value.score_1, "team 1 score"),
    score_2: getRequiredNumber(value.score_2, "team 2 score"),
    status: normalizeGameStatus(value.status),
    tileGrid,
    wordList: normalizeStringList(value.wordList, "word list", tileGrid.flat().map((tile) => tile.word)),
    wordListScore: normalizeStringList(value.wordListScore, "word list score", []),
  };
}

function normalizeTileGrid(value: unknown): GameTile[][] {
  if (!Array.isArray(value)) {
    throw createApplicationError("The tile grid is missing from the response.", 500);
  }

  return value.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      throw createApplicationError(`The tile row ${rowIndex + 1} is malformed.`, 500);
    }

    return row.map(normalizeGameTile);
  });
}

function normalizeGameTile(value: unknown): GameTile {
  if (!isRecord(value)) {
    throw createApplicationError("The tile payload is malformed.", 500);
  }

  return {
    status: normalizeTileStatus(value.status),
    value: getRequiredNumber(value.value, "tile value"),
    word: getRequiredString(value.word, "tile word"),
  };
}

function normalizeGameStatus(value: unknown): GameStatus {
  if (value === "IN_PROGRESS" || value === "FINISHED") {
    return value;
  }

  throw createApplicationError("The game status is missing from the response.", 500);
}

function normalizeTileStatus(value: unknown): GameTileStatus {
  if (
    value === "UNCLAIMED" ||
    value === "PROCESSING_TEAM1" ||
    value === "PROCESSING_TEAM2" ||
    value === "CLAIMED_TEAM1" ||
    value === "CLAIMED_TEAM2"
  ) {
    return value;
  }

  throw createApplicationError("The tile status is missing from the response.", 500);
}

function normalizeStringList(
  value: unknown,
  label: string,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.map((entry) => getRequiredString(entry, label));
}

async function createResponseError(
  response: Response,
  fallbackMessage: string,
): Promise<ApplicationError> {
  let detail = response.statusText || "Unknown error";

  try {
    const payload = await response.json();
    if (isRecord(payload)) {
      const reason = payload.reason;
      const message = payload.message;
      if (typeof reason === "string" && reason.trim() !== "") {
        detail = reason;
      } else if (typeof message === "string" && message.trim() !== "") {
        detail = message;
      }
    }
  } catch {
    // Keep the original response status text when the error body is not JSON.
  }

  return createApplicationError(
    `${fallbackMessage} (${response.status}: ${detail})`,
    response.status,
  );
}

function normalizeApplicationError(error: unknown): ApplicationError {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "message" in error
  ) {
    return error as ApplicationError;
  }

  if (error instanceof Error) {
    return createApplicationError(error.message, 500);
  }

  return createApplicationError("An unexpected error occurred.", 500);
}

function createApplicationError(message: string, status: number): ApplicationError {
  const error = new Error(message) as ApplicationError;
  error.status = status;
  error.info = JSON.stringify({ status }, null, 2);
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw createApplicationError(`The ${label} is missing from the response.`, 500);
  }

  return value;
}

function getRequiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw createApplicationError(`The ${label} is missing from the response.`, 500);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
