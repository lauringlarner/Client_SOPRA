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
import Pusher, { Channel } from "pusher-js";
import process from "node:process";

/**
 * HINWEIS: Kein "import process from 'node:process'" nötig. 
 * Next.js injiziert process.env automatisch im Browser für NEXT_PUBLIC_ Variablen.
 */

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
      const payload = await api.get<LobbyDetails>(`/lobbies/${lobbyId}`, token);
      return normalizeLobbyDetails(payload);
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
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      throw createApplicationError(
        "Pusher configuration missing. Check NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER in .env.local",
        500
      );
    }

    pusher = new Pusher(key, {
      cluster: cluster,
      forceTLS: true,
    });
  }
  return pusher;
}

function createRemoteLobbySubscriber(_token: string): SubscribeToLobby {
  return (lobbyId, onUpdate, onError) => {
    let pusherInstance: Pusher;
    try {
      pusherInstance = getPusher();
    } catch (err) {
      onError(err as ApplicationError);
      return () => {};
    }

    const channelName = `lobby-${lobbyId}`;

    const handler = (data: unknown) => {
      try {
        const lobby = normalizeLobbyDetails(data);
        onUpdate(lobby);
      } catch (_err) {
        onError(createApplicationError("Invalid lobby update", 500));
      }
    };

    const errorHandler = () => {
      onError(createApplicationError("Pusher connection error", 500));
    };

    let channel: Channel;
    if (channelCache.has(channelName)) {
      channel = channelCache.get(channelName)!;
    } else {
      channel = pusherInstance.subscribe(channelName);
      channelCache.set(channelName, channel);
    }

    channel.bind("LobbyUpdate", handler);
    pusherInstance.connection.bind("error", errorHandler);

    return () => {
      channel.unbind("LobbyUpdate", handler);
      // Nur unsubscribe und Cache löschen, wenn keine anderen Listener mehr aktiv sind (optional)
      // Hier halten wir es einfach: Wir räumen auf, wenn die Component unmountet.
      pusherInstance.unsubscribe(channelName);
      channelCache.delete(channelName);
      pusherInstance.connection.unbind("error", errorHandler);
    };
  };
}

function resolveJoinLobbyResult(payload: RemoteJoinCodePayload): JoinLobbyResult {
  const joinCode = payload.joinCode ?? payload.code;
  const lobbyId = payload.lobbyId ?? payload.id;

  if (!joinCode || !lobbyId) {
    throw createApplicationError(
      "The backend response is missing lobby information.",
      500,
    );
  }

  return { joinCode, lobbyId };
}

function extractGameId(payload: Response | Record<string, unknown>): string | undefined {
  if (payload instanceof Response) {
    const location = payload.headers.get("Location");
    if (!location) return undefined;
    const segments = location.split("/").filter(Boolean);
    return segments.at(-1);
  }

  const gameId = payload.gameId;
  if (typeof gameId === "string" && gameId.trim() !== "") return gameId;
  if (typeof gameId === "number" && Number.isFinite(gameId)) return String(gameId);
  return undefined;
}

export function normalizeLobbyDetails(value: unknown): LobbyDetails {
  if (!isRecord(value)) {
    throw createApplicationError("The lobby payload is malformed.", 500);
  }

  const id = getRequiredString(value.id, "lobby id");
  const joinCode = getRequiredString(value.joinCode ?? value.code, "join code");
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
  if (team === null || team === undefined || team === "" || team === "Undecided") return null;
  if (team === "Team1") return "Team1";
  if (team === "Team2") return "Team2";
  return null;
}

function createApplicationError(message: string, status: number): ApplicationError {
  const error = new Error(message) as ApplicationError;
  error.status = status;
  error.info = JSON.stringify({ status }, null, 2);
  return error;
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
  return (typeof value === "string" && value.trim() !== "") ? value : undefined;
}

function getNumberOrDefault(value: unknown, fallback: number): number {
  return (typeof value === "number" && !Number.isNaN(value)) ? value : fallback;
}

function getOptionalIdentifier(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}