import { ApiService } from "@/api/apiService";
import { ApplicationError } from "@/types/error";
import {
  JoinLobbyResult,
  LobbyDetails,
  LobbyPlayer,
  LobbySelectableTeam,
  LobbyTeam,
  LobbyUser,
  StartLobbyResult,
} from "@/types/lobby";
import { getApiDomain } from "@/utils/domain";
import { generateUUID } from "@/utils/uuid";

const MOCK_AUTH_TOKEN = "mock-token";
const MOCK_LOBBIES_STORAGE_KEY = "vq.mock.lobbies.v1";
const MOCK_LOBBY_EVENT = "vq:mock-lobby-change";
const DEFAULT_BINGO_BOARD_SIZE = 4;
const DEFAULT_GAME_DURATION = 10;
const MIN_GAME_DURATION = 5;
const MAX_GAME_DURATION = 20;

type SubscribeToLobby = (
  lobbyId: string,
  onUpdate: (details: LobbyDetails) => void,
  onError: (error: ApplicationError) => void,
) => () => void;

interface LobbyClient {
  mode: "mock" | "remote";
  createLobby: () => Promise<JoinLobbyResult>;
  joinLobby: (joinCode: string) => Promise<JoinLobbyResult>;
  updatePlayerTeam: (
    lobbyId: string,
    playerId: string,
    team: LobbySelectableTeam,
  ) => Promise<void>;
  updatePlayerReady: (
    lobbyId: string,
    playerId: string,
    isReady: boolean,
  ) => Promise<void>;
  updateSettings: (lobbyId: string, gameDuration: number) => Promise<void>;
  startLobby: (lobbyId: string) => Promise<StartLobbyResult>;
  deleteLobby: (lobbyId: string) => Promise<void>;
  leaveLobby: (lobbyId: string) => Promise<void>;
  subscribeToLobby: SubscribeToLobby;
}

interface CreateLobbyClientOptions {
  api: ApiService;
  token: string;
  userId: string;
}

interface RemoteJoinCodePayload {
  joinCode?: string;
  code?: string;
  id?: string;
  lobbyId?: string;
}

interface StoredLobby extends LobbyDetails {
  gameId?: string;
  startedAt?: string;
}

type StoredLobbyState = Record<string, StoredLobby>;

export function createLobbyClient(
  options: CreateLobbyClientOptions,
): LobbyClient {
  if (options.token === MOCK_AUTH_TOKEN || options.token.trim() === "") {
    return createMockLobbyClient(options.userId);
  }

  return createRemoteLobbyClient(options);
}

function createRemoteLobbyClient(
  options: CreateLobbyClientOptions,
): LobbyClient {
  const { api, token } = options;

  return {
    mode: "remote",
    async createLobby(): Promise<JoinLobbyResult> {
      const payload = await api.post<RemoteJoinCodePayload>("/lobbies", undefined, token);
      return resolveJoinLobbyResult(payload, "remote");
    },
    async joinLobby(joinCode: string): Promise<JoinLobbyResult> {
      const payload = await api.post<RemoteJoinCodePayload>(
        "/lobbies/join",
        { joinCode },
        token,
      );
      return resolveJoinLobbyResult(payload, "remote");
    },
    async updatePlayerTeam(
      lobbyId: string,
      playerId: string,
      team: LobbySelectableTeam,
    ): Promise<void> {
      await api.put<void>(
        `/lobbies/${lobbyId}/players/${playerId}/team`,
        { teamType: team },
        token,
      );
    },
    async updatePlayerReady(
      lobbyId: string,
      playerId: string,
      isReady: boolean,
    ): Promise<void> {
      await api.put<void>(
        `/lobbies/${lobbyId}/players/${playerId}/ready`,
        { isReady },
        token,
      );
    },
    async updateSettings(lobbyId: string, gameDuration: number): Promise<void> {
      await api.put<void>(
        `/lobbies/${lobbyId}/settings`,
        { gameDuration },
        token,
      );
    },
    async startLobby(lobbyId: string): Promise<StartLobbyResult> {
      const payload = await api.post<Response | Record<string, unknown>>(
        `/lobbies/${lobbyId}/start`,
        undefined,
        token,
      );

      return {
        gameId: extractGameId(payload),
        source: "remote",
      };
    },
    async deleteLobby(lobbyId: string): Promise<void> {
      await api.delete<void>(`/lobbies/${lobbyId}`, token);
    },
    async leaveLobby(lobbyId: string): Promise<void> {
      await api.delete<void>(`/lobbies/${lobbyId}/players/me`, token);
    },
    subscribeToLobby: createRemoteLobbySubscriber(token),
  };
}

function createRemoteLobbySubscriber(token: string): SubscribeToLobby {
  return (lobbyId, onUpdate, onError) => {
    const controller = new AbortController();
    const headers = createRemoteHeaders(token);

    void (async () => {
      try {
        const response = await fetch(`${getApiDomain()}/lobbies/${lobbyId}/stream`, {
          method: "GET",
          headers,
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw await createResponseError(
            response,
            "Unable to subscribe to the lobby.",
          );
        }

        if (!response.body) {
          throw createApplicationError(
            "The lobby stream is not available yet.",
            500,
          );
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
          const segments = buffer.split("\n\n");
          buffer = segments.pop() ?? "";

          for (const segment of segments) {
            const nextLobby = parseLobbySseEvent(segment);
            if (nextLobby) {
              onUpdate(nextLobby);
            }
          }
        }

        if (!controller.signal.aborted) {
          throw createApplicationError("The lobby connection was closed.", 500);
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

function createMockLobbyClient(userId: string): LobbyClient {
  return {
    mode: "mock",
    createLobby(): Promise<JoinLobbyResult> {
      assertBrowserStorage();

      const state = readMockLobbies();
      if (findLobbyByUserId(state, userId)) {
        throw createApplicationError(
          "You already have an active lobby. Leave it before creating a new one.",
          409,
        );
      }

      const lobbyId = generateUUID();
      const joinCode = generateJoinCode();
      const hostPlayer = createStoredPlayer(userId, true);

      state[lobbyId] = {
        bingoBoardSize: DEFAULT_BINGO_BOARD_SIZE,
        gameDuration: DEFAULT_GAME_DURATION,
        id: lobbyId,
        joinCode,
        lobbyPlayers: [hostPlayer],
      };

      writeMockLobbies(state);

      return Promise.resolve({
        joinCode,
        lobbyId,
        source: "mock",
      });
    },
    joinLobby(joinCode: string): Promise<JoinLobbyResult> {
      assertBrowserStorage();

      const normalizedCode = joinCode.trim().toUpperCase();
      const state = readMockLobbies();

      if (findLobbyByUserId(state, userId)) {
        throw createApplicationError(
          "You are already in an active lobby.",
          409,
        );
      }

      const lobby = Object.values(state).find((entry) => entry.joinCode === normalizedCode);
      if (!lobby) {
        throw createApplicationError("No lobby matches that join code.", 404);
      }

      if (lobby.gameId) {
        throw createApplicationError("That lobby is already closed.", 409);
      }

      lobby.lobbyPlayers.push(createStoredPlayer(userId, false));
      writeMockLobbies(state);

      return Promise.resolve({
        joinCode: lobby.joinCode,
        lobbyId: lobby.id,
        source: "mock",
      });
    },
    updatePlayerTeam(
      lobbyId: string,
      playerId: string,
      team: LobbySelectableTeam,
    ): Promise<void> {
      if (team !== "Team1" && team !== "Team2") {
        throw createApplicationError("The selected team is invalid.", 400);
      }

      const state = readMockLobbies();
      const lobby = requireStoredLobby(state, lobbyId);
      const player = requirePlayer(lobby, playerId);
      player.team = team;
      writeMockLobbies(state);
      return Promise.resolve();
    },
    updatePlayerReady(
      lobbyId: string,
      playerId: string,
      isReady: boolean,
    ): Promise<void> {
      if (typeof isReady !== "boolean") {
        throw createApplicationError("The ready state must be a boolean.", 400);
      }

      const state = readMockLobbies();
      const lobby = requireStoredLobby(state, lobbyId);
      const player = requirePlayer(lobby, playerId);
      player.isReady = isReady;
      writeMockLobbies(state);
      return Promise.resolve();
    },
    updateSettings(lobbyId: string, gameDuration: number): Promise<void> {
      if (
        !Number.isInteger(gameDuration) ||
        gameDuration < MIN_GAME_DURATION ||
        gameDuration > MAX_GAME_DURATION
      ) {
        throw createApplicationError(
          `Game duration must be an integer between ${MIN_GAME_DURATION} and ${MAX_GAME_DURATION} minutes.`,
          400,
        );
      }

      const state = readMockLobbies();
      const lobby = requireStoredLobby(state, lobbyId);
      const hostPlayer = lobby.lobbyPlayers.find((player) => player.isHost);
      if (!hostPlayer || hostPlayer.user.id !== userId) {
        throw createApplicationError("Only the host can update lobby settings.", 403);
      }

      lobby.gameDuration = gameDuration;
      writeMockLobbies(state);
      return Promise.resolve();
    },
    startLobby(lobbyId: string): Promise<StartLobbyResult> {
      const state = readMockLobbies();
      const lobby = requireStoredLobby(state, lobbyId);
      const hostPlayer = lobby.lobbyPlayers.find((player) => player.isHost);

      if (!hostPlayer || hostPlayer.user.id !== userId) {
        throw createApplicationError("Only the host can start the game.", 403);
      }

      if (lobby.gameId) {
        throw createApplicationError("This game has already started.", 409);
      }

      if (lobby.lobbyPlayers.some((player) => !player.isReady)) {
        throw createApplicationError("All players need to be ready first.", 409);
      }

      lobby.gameId = generateUUID();
      lobby.startedAt = new Date().toISOString();
      writeMockLobbies(state);

      return Promise.resolve({
        gameId: lobby.gameId,
        source: "mock",
      });
    },
    deleteLobby(lobbyId: string): Promise<void> {
      const state = readMockLobbies();
      const lobby = requireStoredLobby(state, lobbyId);
      const hostPlayer = lobby.lobbyPlayers.find((player) => player.isHost);

      if (!hostPlayer || hostPlayer.user.id !== userId) {
        throw createApplicationError("Only the host can delete this lobby.", 403);
      }

      delete state[lobbyId];
      writeMockLobbies(state);
      return Promise.resolve();
    },
    leaveLobby(lobbyId: string): Promise<void> {
      const state = readMockLobbies();
      const lobby = requireStoredLobby(state, lobbyId);
      const playerIndex = lobby.lobbyPlayers.findIndex((player) => player.user.id === userId);

      if (playerIndex === -1) {
        throw createApplicationError("You are not part of this lobby.", 403);
      }

      if (lobby.lobbyPlayers[playerIndex]?.isHost) {
        throw createApplicationError(
          "The host needs to delete the lobby instead of leaving it.",
          403,
        );
      }

      lobby.lobbyPlayers.splice(playerIndex, 1);
      writeMockLobbies(state);
      return Promise.resolve();
    },
    subscribeToLobby(lobbyId, onUpdate, onError) {
      const emitLobby = () => {
        try {
          const state = readMockLobbies();
          onUpdate(requireStoredLobby(state, lobbyId));
        } catch (error) {
          onError(normalizeApplicationError(error));
        }
      };

      emitLobby();

      if (typeof globalThis === "undefined" || !("addEventListener" in globalThis)) {
        return () => undefined;
      }

      const handleStorage = (event: StorageEvent) => {
        if (event.key && event.key !== MOCK_LOBBIES_STORAGE_KEY) {
          return;
        }
        emitLobby();
      };

      const handleCustomChange = () => emitLobby();

      globalThis.addEventListener("storage", handleStorage);
      globalThis.addEventListener(MOCK_LOBBY_EVENT, handleCustomChange);

      return () => {
        globalThis.removeEventListener("storage", handleStorage);
        globalThis.removeEventListener(MOCK_LOBBY_EVENT, handleCustomChange);
      };
    },
  };
}

function resolveJoinLobbyResult(
  payload: RemoteJoinCodePayload,
  source: "mock" | "remote",
): JoinLobbyResult {
  const joinCode = payload.joinCode ?? payload.code;
  const lobbyId = payload.lobbyId ?? payload.id;

  if (!joinCode || !lobbyId) {
    throw createApplicationError(
      "The backend response is missing lobby information. Create and join should return both joinCode and lobbyId.",
      500,
    );
  }

  return {
    joinCode,
    lobbyId,
    source,
  };
}

function extractGameId(payload: Response | Record<string, unknown>): string | undefined {
  if (payload instanceof Response) {
    const location = payload.headers.get("Location");
    if (!location) {
      return undefined;
    }

    const segments = location.split("/").filter(Boolean);
    return segments.at(-1);
  }

  const gameId = payload.gameId;
  if (typeof gameId === "string" && gameId.trim() !== "") {
    return gameId;
  }
  if (typeof gameId === "number" && Number.isFinite(gameId)) {
    return String(gameId);
  }

  return undefined;
}

function parseLobbySseEvent(segment: string): LobbyDetails | null {
  const data = segment
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
    .trim();

  if (!data) {
    return null;
  }

  return normalizeLobbyDetails(JSON.parse(data));
}

function normalizeLobbyDetails(value: unknown): LobbyDetails {
  if (!isRecord(value)) {
    throw createApplicationError("The lobby payload is malformed.", 500);
  }

  const id = getRequiredString(value.id, "lobby id");
  const joinCode = getRequiredString(
    value.joinCode ?? value.code,
    "join code",
  );
  const bingoBoardSize = getRequiredNumber(value.bingoBoardSize, "bingo board size");
  const gameDuration = getRequiredNumber(value.gameDuration, "game duration");
  const lobbyPlayers = Array.isArray(value.lobbyPlayers)
    ? value.lobbyPlayers.map(normalizeLobbyPlayer)
    : [];

  return {
    bingoBoardSize,
    gameDuration,
    gameId: getOptionalIdentifier(value.gameId),
    id,
    joinCode,
    lobbyPlayers,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : undefined,
  };
}

function normalizeLobbyPlayer(value: unknown): LobbyPlayer {
  if (!isRecord(value)) {
    throw createApplicationError("The lobby player payload is malformed.", 500);
  }

  return {
    id: getRequiredString(value.id, "player id"),
    isHost: Boolean(value.isHost),
    isReady: Boolean(value.isReady),
    joinedAt: getRequiredString(value.joinedAt, "player joinedAt"),
    team: normalizeLobbyTeam(value.teamType ?? value.team),
    user: normalizeLobbyUser(value.user),
  };
}

function normalizeLobbyUser(value: unknown): LobbyUser {
  if (!isRecord(value)) {
    throw createApplicationError("The lobby user payload is malformed.", 500);
  }

  return {
    correctItemsFound: getNumberOrDefault(value.correctItemsFound, 0),
    creation_date: getRequiredString(value.creation_date, "user creation_date"),
    email: typeof value.email === "string" ? value.email : undefined,
    gamesPlayed: getNumberOrDefault(value.gamesPlayed, 0),
    gamesWon: getNumberOrDefault(value.gamesWon, 0),
    id: getRequiredString(value.id, "user id"),
    status: getRequiredString(value.status, "user status"),
    username: getRequiredString(value.username, "user username"),
  };
}

function normalizeLobbyTeam(team: unknown): LobbyTeam {
  if (team === null || team === undefined || team === "") {
    return null;
  }
  if (team === "Undecided") {
    return null;
  }
  if (team === "Team1") {
    return "Team1";
  }
  if (team === "Team2") {
    return "Team2";
  }

  return null;
}

function requireStoredLobby(
  state: StoredLobbyState,
  lobbyId: string,
): StoredLobby {
  const lobby = state[lobbyId];
  if (!lobby) {
    throw createApplicationError("That lobby could not be found.", 404);
  }
  return lobby;
}

function requirePlayer(lobby: StoredLobby, playerId: string): LobbyPlayer {
  const player = lobby.lobbyPlayers.find((entry) => entry.id === playerId);
  if (!player) {
    throw createApplicationError("That lobby player could not be found.", 404);
  }
  return player;
}

function findLobbyByUserId(
  state: StoredLobbyState,
  userId: string,
): StoredLobby | undefined {
  return Object.values(state).find((lobby) =>
    !lobby.gameId && lobby.lobbyPlayers.some((player) => player.user.id === userId)
  );
}

function createStoredPlayer(userId: string, isHost: boolean): LobbyPlayer {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    isHost,
    isReady: false,
    joinedAt: now,
    team: null,
    user: createMockLobbyUser(userId, now),
  };
}

function createMockLobbyUser(userId: string, creationDate: string): LobbyUser {
  return {
    correctItemsFound: 0,
    creation_date: creationDate,
    email: `player-${userId}@visionquest.local`,
    gamesPlayed: 0,
    gamesWon: 0,
    id: userId,
    status: "ONLINE",
    username: `Player ${userId}`,
  };
}

function readMockLobbies(): StoredLobbyState {
  if (!hasBrowserStorage()) {
    return {};
  }

  const rawState = globalThis.localStorage.getItem(MOCK_LOBBIES_STORAGE_KEY);
  if (!rawState) {
    return {};
  }

  try {
    return JSON.parse(rawState) as StoredLobbyState;
  } catch {
    return {};
  }
}

function writeMockLobbies(state: StoredLobbyState): void {
  if (!hasBrowserStorage()) {
    return;
  }

  globalThis.localStorage.setItem(MOCK_LOBBIES_STORAGE_KEY, JSON.stringify(state));
  globalThis.dispatchEvent(new Event(MOCK_LOBBY_EVENT));
}

function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)]
  ).join("");
}

function createRemoteHeaders(token: string): HeadersInit {
  return {
    Accept: "text/event-stream, application/json",
    Authorization: `Bearer ${token}`,
  };
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

function createApplicationError(
  message: string,
  status: number,
): ApplicationError {
  const error = new Error(message) as ApplicationError;
  error.status = status;
  error.info = JSON.stringify({ status }, null, 2);
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function assertBrowserStorage(): void {
  if (!hasBrowserStorage()) {
    throw createApplicationError(
      "Lobby actions need a browser environment.",
      500,
    );
  }
}

function hasBrowserStorage(): boolean {
  return typeof globalThis !== "undefined" && "localStorage" in globalThis;
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

function getNumberOrDefault(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return value;
}

function getOptionalIdentifier(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
