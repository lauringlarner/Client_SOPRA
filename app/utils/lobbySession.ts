import { LobbyTeam } from "@/types/lobby";

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

function canUseLocalStorage(): boolean {
  return typeof globalThis !== "undefined" && "localStorage" in globalThis;
}
