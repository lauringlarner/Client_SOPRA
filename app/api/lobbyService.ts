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

export interface LobbyClient {
  mode: "remote";
  createLobby: () => Promise<JoinLobbyResult>;
  joinLobby: (joinCode: string) => Promise<JoinLobbyResult>;
  updatePlayerTeam: (lId: string, pId: string, t: LobbySelectableTeam) => Promise<void>;
  updatePlayerReady: (lId: string, pId: string, r: boolean) => Promise<void>;
  updateSettings: (lId: string, d: number) => Promise<void>;
  startLobby: (lId: string) => Promise<StartLobbyResult>;
  deleteLobby: (lId: string) => Promise<void>;
  leaveLobby: (lId: string) => Promise<void>;
  subscribeToLobby: (lId: string, onUpdate: (d: LobbyDetails) => void, onError: (e: ApplicationError) => void) => () => void;
}

export function createLobbyClient({ api, token }: { api: ApiService; token: string }): LobbyClient {
  return {
    mode: "remote",
    async createLobby() {
      const p = await api.post<any>("/lobbies", undefined, token);
      return { joinCode: p.joinCode || p.code, lobbyId: p.id || p.lobbyId, source: "remote" };
    },
    async joinLobby(joinCode: string) {
      const p = await api.post<any>("/lobbies/join", { joinCode }, token);
      return { joinCode: p.joinCode || p.code, lobbyId: p.id || p.lobbyId, source: "remote" };
    },
    async updatePlayerTeam(lId, pId, team) {
      await api.put(`/lobbies/${lId}/players/${pId}/team`, { teamType: team }, token);
    },
    async updatePlayerReady(lId, pId, isReady) {
      await api.put(`/lobbies/${lId}/players/${pId}/ready`, { isReady }, token);
    },
    async updateSettings(lId, gameDuration) {
      await api.put(`/lobbies/${lId}/settings`, { gameDuration }, token);
    },
    async startLobby(lId) {
      await api.post(`/lobbies/${lId}/start`, undefined, token);
      return { gameId: undefined, source: "remote" };
    },
    async deleteLobby(lId) { await api.delete(`/lobbies/${lId}`, token); },
    async leaveLobby(lId) { await api.delete(`/lobbies/${lId}/players/me`, token); },
    subscribeToLobby: (lobbyId, onUpdate, onError) => {
      const controller = new AbortController();
      void (async () => {
        try {
          const response = await fetch(`${getApiDomain()}/lobbies/${lobbyId}/stream`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Stream failed");
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";
            for (const part of parts) {
              const lobby = parseLobbySseEvent(part);
              if (lobby) onUpdate(lobby);
            }
          }
        } catch (e: any) {
          if (e.name !== "AbortError") onError(normalizeApplicationError(e));
        }
      })();
      return () => controller.abort();
    },
  };
}

function parseLobbySseEvent(segment: string): LobbyDetails | null {
  const lines = segment.split("\n");
  let data = "";
  for (const line of lines) {
    if (line.startsWith("data:")) data += line.replace("data:", "").trim();
  }
  if (!data) return null;
  try {
    return normalizeLobbyDetails(JSON.parse(data));
  } catch { return null; }
}

function normalizeLobbyDetails(v: any): LobbyDetails {
  return {
    id: v.id,
    joinCode: v.joinCode,
    gameDuration: v.gameDuration,
    gameId: v.gameId || null,
    bingoBoardSize: v.bingoBoardSize || 4,
    lobbyPlayers: (v.lobbyPlayers || []).map(normalizeLobbyPlayer),
  };
}

function normalizeLobbyPlayer(p: any): LobbyPlayer {
  return {
    id: p.id,
    isHost: p.isHost,
    isReady: p.isReady,
    joinedAt: p.joinedAt,
    // Map backend "Undecided" to null
    team: (p.teamType === "Team1" || p.teamType === "Team2") ? p.teamType : null,
    user: p.user,
  };
}

function normalizeApplicationError(error: any): ApplicationError {
  const e = new Error(error.message || "Unknown error") as ApplicationError;
  e.status = error.status || 500;
  return e;
}