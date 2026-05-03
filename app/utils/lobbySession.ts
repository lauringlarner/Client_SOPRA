import { LobbyTeam } from "@/types/lobby";

export function getStoredActiveLobbyId(userId: string): string {
  if (!canUseLocalStorage() || userId.trim() === "") {
    return "";
  }

  return globalThis.localStorage.getItem(getActiveLobbyKey(userId)) ?? "";
}

export function setStoredActiveLobbyId(userId: string, lobbyId: string): void {
  if (!canUseLocalStorage() || userId.trim() === "" || lobbyId.trim() === "") {
    return;
  }

  globalThis.localStorage.setItem(getActiveLobbyKey(userId), lobbyId);
}

export function clearStoredActiveLobbyId(userId: string, lobbyId?: string): void {
  if (!canUseLocalStorage() || userId.trim() === "") {
    return;
  }

  const key = getActiveLobbyKey(userId);
  if (lobbyId && globalThis.localStorage.getItem(key) !== lobbyId) {
    return;
  }

  globalThis.localStorage.removeItem(key);
}

export function getStoredLobbyTeam(userId: string, lobbyId: string): LobbyTeam {
  if (!canUseLocalStorage() || userId.trim() === "" || lobbyId.trim() === "") {
    return null;
  }

  const rawValue = globalThis.localStorage.getItem(getLobbyTeamKey(userId, lobbyId));
  if (rawValue === "Team1" || rawValue === "Team2") {
    return rawValue;
  }

  return null;
}

export function clearStoredLobbyTeam(userId: string, lobbyId: string): void {
  if (!canUseLocalStorage() || userId.trim() === "" || lobbyId.trim() === "") {
    return;
  }

  const key = getLobbyTeamKey(userId, lobbyId);
  globalThis.localStorage.removeItem(key);
}

export function setStoredLobbyTeam(
  userId: string,
  lobbyId: string,
  team: LobbyTeam,
): void {
  if (!canUseLocalStorage() || userId.trim() === "" || lobbyId.trim() === "") {
    return;
  }

  const key = getLobbyTeamKey(userId, lobbyId);
  if (team === "Team1" || team === "Team2") {
    globalThis.localStorage.setItem(key, team);
    return;
  }

  globalThis.localStorage.removeItem(key);
}

function getLobbyTeamKey(userId: string, lobbyId: string): string {
  return `vq.lobbyTeam.${userId}.${lobbyId}`;
}

function getActiveLobbyKey(userId: string): string {
  return `vq.activeLobbyId.${userId}`;
}

function canUseLocalStorage(): boolean {
  return typeof globalThis !== "undefined" && "localStorage" in globalThis;
}
