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
import Pusher, { Channel } from "pusher-js";

type SubscribeToLobby = (
  lobbyId: string,
  onUpdate: (details: LobbyDetails) => void,
  onError: (error: ApplicationError) => void,
) => () => void;

interface LobbyClient {
  createLobby: () => Promise<JoinLobbyResult>;
  joinLobby: (joinCode: string) => Promise<JoinLobbyResult>;
  getLobby: (lobbyId: string) => Promise<LobbyDetails>;
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
}

interface RemoteJoinCodePayload {
  joinCode?: string;
  code?: string;
  id?: string;
  lobbyId?: string;
}

export function createLobbyClient(
  options: CreateLobbyClientOptions,
): LobbyClient {
  return createRemoteLobbyClient(options);
}

function createRemoteLobbyClient(
  options: CreateLobbyClientOptions,
): LobbyClient {
  const { api, token } = options;

  return {
    async getLobby(lobbyId: string): Promise<LobbyDetails> {
      const payload = await api.get<LobbyDetails>(`/lobbies/${lobbyId}`,
        token,);
      return normalizeLobbyDetails(payload)
    },
    async createLobby(): Promise<JoinLobbyResult> {
      const payload = await api.post<RemoteJoinCodePayload>("/lobbies", undefined, token);
      return resolveJoinLobbyResult(payload);
    },
    async joinLobby(joinCode: string): Promise<JoinLobbyResult> {
      const payload = await api.post<RemoteJoinCodePayload>(
        "/lobbies/join",
        { joinCode },
        token,
      );
      return resolveJoinLobbyResult(payload);
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

let pusher: Pusher | null = null;
const channelCache = new Map<string, Channel>();

function getPusher() {
  if (!pusher) {
    pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY! , {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return pusher;
}

function createRemoteLobbySubscriber(token: string): SubscribeToLobby {
  return (lobbyId, onUpdate, onError) => {
    const pusher = getPusher();
    const channelName = `lobby-${lobbyId}`;

    // Prevent duplicate subscriptions (IMPORTANT for React Strict Mode)
    if (channelCache.has(channelName)) {
      const existingChannel = channelCache.get(channelName)!;

      const handler = (data: unknown) => {
        try {
          const lobby = normalizeLobbyDetails(data);
          onUpdate(lobby);
        } catch {
          onError(createApplicationError("Invalid lobby update", 500));
        }
      };

      existingChannel.bind("LobbyUpdate", handler);

      return () => {
        existingChannel.unbind("LobbyUpdate", handler);
      };
    }

    const channel = pusher.subscribe(channelName);
    channelCache.set(channelName, channel);

    const handler = (data: unknown) => {
      try {
        const lobby = normalizeLobbyDetails(data);
        onUpdate(lobby);
      } catch {
        onError(createApplicationError("Invalid lobby update", 500));
      }
    };

    channel.bind("LobbyUpdate", handler);

    const errorHandler = () => {
      onError(createApplicationError("Pusher connection error", 500));
    };

    pusher.connection.bind("error", errorHandler);

    return () => {
      channel.unbind("LobbyUpdate", handler);

      // IMPORTANT: only unsubscribe channel, DO NOT disconnect global client
      pusher.unsubscribe(channelName);

      channelCache.delete(channelName);

      pusher.connection.unbind("error", errorHandler);
    };
  };
}

function resolveJoinLobbyResult(payload: RemoteJoinCodePayload): JoinLobbyResult {
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

// export for quick dirty fix //
export function normalizeLobbyDetails(value: unknown): LobbyDetails {
  if (!isRecord(value)) {
    throw createApplicationError("The lobby payload is malformed.", 500);
  }

  const id = getRequiredString(value.id, "lobby id");
  const joinCode = getRequiredString(
    value.joinCode ?? value.code,
    "join code",
  );
  const gameDuration = getRequiredNumber(value.gameDuration, "game duration");
  const lobbyPlayers = Array.isArray(value.lobbyPlayers)
    ? value.lobbyPlayers.map(normalizeLobbyPlayer)
    : [];

  return {
    createdAt: getOptionalString(value.createdAt),
    gameDuration,
    gameId: getOptionalIdentifier(value.gameId),
    id,
    joinCode,
    lobbyPlayers,
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
    user: normalizeLobbyUser(value.user ?? value.userGetDTO),
  };
}

function normalizeLobbyUser(value: unknown): LobbyUser {
  if (!isRecord(value)) {
    throw createApplicationError("The lobby user payload is malformed.", 500);
  }

  return {
    correctItemsFound: getNumberOrDefault(value.correctItemsFound, 0),
    creation_date: getRequiredString(value.creation_date ?? value.createdAt, "user creation_date"),
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

function getOptionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  return undefined;
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
