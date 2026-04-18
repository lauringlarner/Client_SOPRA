import { ApiService } from "@/api/apiService";
import { ApplicationError } from "@/types/error";
import {
  JoinLobbyResult,
  LobbyDetails,
  LobbyPlayer,
  LobbySelectableTeam,
  StartLobbyResult,
} from "@/types/lobby";
import { getApiDomain } from "@/utils/domain";

/**
 * Präzise Definitionen der Backend-Antworten.
 */
interface BackendPlayer {
  id: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: string;
  teamType: string | null;
  user: {
    id: string;
    username: string;
  };
}

interface BackendLobby {
  id: string;
  joinCode?: string;
  code?: string;
  gameDuration: number;
  gameId?: string | null;
  bingoBoardSize?: number;
  lobbyPlayers?: BackendPlayer[];
}

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
      const p = await api.post<BackendLobby>("/lobbies", {}, token);
      return { 
        joinCode: p.joinCode || p.code || "", 
        lobbyId: p.id, 
        source: "remote" 
      };
    },
    async joinLobby(joinCode: string) {
      const p = await api.post<BackendLobby>("/lobbies/join", { joinCode }, token);
      return { 
        joinCode: p.joinCode || p.code || "", 
        lobbyId: p.id, 
        source: "remote" 
      };
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
      await api.post(`/lobbies/${lId}/start`, {}, token);
      // Backend gibt gameId oft erst via SSE zurück, daher hier undefined
      return { gameId: undefined, source: "remote" };
    },
    async deleteLobby(lId) { await api.delete(`/lobbies/${lId}`, token); },
    async leaveLobby(lId) { await api.delete(`/lobbies/${lId}/players/me`, token); },
    
    subscribeToLobby: (lobbyId, onUpdate, onError) => {
      const controller = new AbortController();
      
      // Benannte Funktion statt "void async" für bessere Lesbarkeit und Linting-Compliance
      const establishStream = async () => {
        try {
          const response = await fetch(`${getApiDomain()}/lobbies/${lobbyId}/stream`, {
            headers: { 
              Authorization: `Bearer ${token}`, 
              Accept: "text/event-stream" 
            },
            signal: controller.signal,
          });

          if (!response.ok) throw new Error(`Stream failed with status ${response.status}`);
          
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No reader available");
          
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            
            // Letzten (unvollständigen) Teil zurück in den Buffer
            buffer = parts.pop() || "";
            
            for (const part of parts) {
              const lobby = parseLobbySseEvent(part);
              if (lobby) onUpdate(lobby);
            }
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.name !== "AbortError") {
            onError(normalizeApplicationError(e));
          }
        }
      };

      establishStream();
      
      return () => {
        controller.abort();
      };
    },
  };
}

function parseLobbySseEvent(segment: string): LobbyDetails | null {
  if (!segment.trim()) return null;
  
  const lines = segment.split("\n");
  let data = "";
  for (const line of lines) {
    if (line.startsWith("data:")) {
      data += line.replace("data:", "").trim();
    }
  }
  
  if (!data) return null;
  
  try {
    const parsed = JSON.parse(data) as BackendLobby;
    return normalizeLobbyDetails(parsed);
  } catch (e) {
    console.error("SSE Parse Error", e);
    return null;
  }
}

function normalizeLobbyDetails(v: BackendLobby): LobbyDetails {
  return {
    id: v.id,
    joinCode: v.joinCode || v.code || "",
    gameDuration: v.gameDuration,
    gameId: v.gameId ?? undefined,
    bingoBoardSize: v.bingoBoardSize || 4,
    lobbyPlayers: (v.lobbyPlayers || []).map(normalizeLobbyPlayer),
  };
}

function normalizeLobbyPlayer(p: BackendPlayer): LobbyPlayer {
  return {
    id: p.id,
    isHost: p.isHost,
    isReady: p.isReady,
    joinedAt: p.joinedAt,
    // Sicherstellen, dass nur gültige Team-Typen gemappt werden
    team: (p.teamType === "Team1" || p.teamType === "Team2") ? p.teamType : null,
    user: {
      id: p.user.id,
      username: p.user.username,
      correctItemsFound: 0,
      creation_date: new Date().toISOString(),
      gamesPlayed: 0,
      gamesWon: 0,
      status: "ONLINE"
    },
  };
}

function normalizeApplicationError(error: unknown): ApplicationError {
  const message = error instanceof Error ? error.message : "Unknown error";
  const e = new Error(message) as ApplicationError;
  
  if (error && typeof error === 'object' && 'status' in error) {
    e.status = (error as { status: number }).status;
  } else {
    e.status = 500;
  }
  
  return e;
}