import { ApplicationError } from "@/types/error";
import { GameDetails, GameStatus, GameTile, GameTileStatus } from "@/types/game";
import { getApiDomain } from "@/utils/domain";

type SubscribeToGame = (
  gameId: string,
  onUpdate: (details: GameDetails) => void,
  onError: (error: ApplicationError) => void,
) => () => void;

interface GameClient {
  subscribeToGame: SubscribeToGame;
}

interface CreateGameClientOptions {
  token: string;
}

export function createGameClient(options: CreateGameClientOptions): GameClient {
  return {
    subscribeToGame: createRemoteGameSubscriber(options.token),
  };
}

function createRemoteGameSubscriber(token: string): SubscribeToGame {
  return (gameId, onUpdate, onError) => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(`${getApiDomain()}/games/${gameId}/stream`, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          onError(await createResponseError(
            response,
            "Unable to subscribe to the game.",
          ));
          return;
        }

        if (!response.body) {
          onError(createApplicationError(
            "The game stream is not available yet.",
            500,
          ));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
          
          let boundary;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            const nextGame = parseGameSseEvent(rawEvent);
            if (nextGame) {
              onUpdate(nextGame);
            }
          }
        }

        if (!controller.signal.aborted) {
          onError(createApplicationError("The game connection was closed.", 500));
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        onError(normalizeApplicationError(error));
      }
    })();

    return () => controller.abort();
  };
}

function parseGameSseEvent(segment: string): GameDetails | null {
  let eventName: string | null = null;

  const lines = segment.split("\n");
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (eventName !== "gameUpdate") {
    return null;
  }

  const data = dataLines.join("\n").trim();
  if (!data) return null;

  return normalizeGameDetails(JSON.parse(data));
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
