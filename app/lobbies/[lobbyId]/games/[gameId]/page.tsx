"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { createGameClient } from "@/api/gameService";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApplicationError } from "@/types/error";
import { GameDetails, GameTileStatus, GameTile } from "@/types/game";
import {
  BackendTeamName,
  buildTeamScores,
  getTilePerspective,
  normalizeBackendTeamName,
  TeamPerspective,
  TeamScoreViewModel,
} from "@/utils/gamePerspective";
import {
  clearLastSubmissionWord,
} from "@/utils/submissionFeedback";
import {
  getStoredLobbyTeam,
  setStoredActiveLobbyId,
  setStoredLobbyTeam,
} from "@/utils/lobbySession";

// --- Interfaces ---

interface ChatMessageGetDTO {
  message: string;
  sender: string;     
  sentAt: string;     
  teamType: string;   // Matches JSON: "Team1" or "Team2"
}

type GameModeDTO = {
  id: string;
  name: string;
  rules: string[]; 
};

const QUICK_MESSAGES = [
  "Good luck!",
  "Nice find!",
  "Almost there!",
  "BINGO!",
  "GG!",
  "Check the rules!",
];

export default function GameBoardPage() {
  const api = useApi();
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams<{ lobbyId: string; gameId: string }>();
  const { lobbyId, gameId } = params;

  // --- States ---
  const [game, setGame] = useState<GameDetails | null>(null);
  const [myTeamName, setMyTeamName] = useState<BackendTeamName | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  
  const [showRules, setShowRules] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [shakingTile, setShakingTile] = useState<string | null>(null);
  const [showBingoBanner, setShowBingoBanner] = useState(false);
  const [activeBingoTiles, setActiveBingoTiles] = useState<Set<string>>(new Set());

  const [gameModes, setGameModes] = useState<GameModeDTO[]>([]);
  const [loadingGameModes, setLoadingGameModes] = useState(false);
  const [gameModesError, setGameModesError] = useState<string | null>(null);

  // --- Chat States ---
  const [chatHistory, setChatHistory] = useState<ChatMessageGetDTO[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const previousStatuses = useRef<Map<string, GameTileStatus>>(new Map());
  const celebratedBingos = useRef<string[]>([]); 
  const isFirstLoad = useRef(true); 
  const latestGameRef = useRef<GameDetails | null>(null);
  
  const gameClient = useMemo(() => createGameClient({ api, token }), [api, token]);
  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);

  // --- Chat Logic ---
  const fetchChat = async () => {
    if (!token || !gameId) return;
    try {
      const messages = await api.get<ChatMessageGetDTO[]>(`/games/${gameId}/chat`, token);
      setChatHistory(messages);
    } catch (err) {
      console.error("Chat fetch failed", err);
    }
  };

  useEffect(() => {
    if (!showChat || !isAuthenticated) return;
    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [showChat, isAuthenticated, gameId]);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [showChat, chatHistory]);

  const sendQuickMessage = async (msg: string) => {
    if (isSendingChat || !token) return;
    setIsSendingChat(true);
    try {
      await api.post(`/games/${gameId}/chat`, { message: msg }, token);
      await fetchChat();
    } catch (err) {
      console.error("Chat send failed", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // --- Game Timer ---
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenRules = async () => {
    if (gameModes.length > 0) {
      setShowRules(true);
      return;
    }
    setLoadingGameModes(true);
    setGameModesError(null);
    try {
      const response = await api.get<GameModeDTO[]>("/gameModes", token);
      setGameModes(response);
      setShowRules(true);
    } catch (_e) {
      setGameModesError("Failed to load game modes.");
      setShowRules(true);
    } finally {
      setLoadingGameModes(false);
    }
  };

  const remainingSeconds = useMemo(() => {
    if (!game || game.status === "ENDED") return 0;
    const totalSeconds = game.gameDuration * 60;
    const startedAtMs = Date.parse(game.startedAt);
    if (Number.isNaN(startedAtMs)) return totalSeconds;
    return Math.max(0, totalSeconds - Math.floor((nowMs - startedAtMs) / 1000));
  }, [game, nowMs]);

  const progressWidth = useMemo(() => {
    if (!game || remainingSeconds === null) return "100%";
    return `${Math.max(0, Math.min(100, (remainingSeconds / (game.gameDuration * 60)) * 100))}%`;
  }, [game, remainingSeconds]);

  // --- Auth & Team Sync ---
  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    setStoredActiveLobbyId(userId, lobbyId);
  }, [isAuthenticated, loaded, lobbyId, router, userId]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || userId.trim() === "") return;
    let cancelled = false;
    setMyTeamName(normalizeBackendTeamName(getStoredLobbyTeam(userId, lobbyId)));

    void (async () => {
      try {
        const currentLobby = await lobbyClient.getLobby(lobbyId);
        if (cancelled) return;
        const currentPlayer = currentLobby.lobbyPlayers.find(p => p.user.id === userId);
        const team = normalizeBackendTeamName(currentPlayer?.team ?? null);
        setMyTeamName(team);
        setStoredLobbyTeam(userId, lobbyId, currentPlayer?.team ?? null);
      } catch (error) {
        if (cancelled) return;
        setPageMessage("Unable to confirm your team.");
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loaded, lobbyClient, lobbyId, userId]);

  // --- Game Subscription ---
  useEffect(() => {
    if (!loaded || !isAuthenticated) return;
    let cancelled = false;
    
    const applyGameDetails = (details: GameDetails) => {
      if (cancelled) return;
      latestGameRef.current = details;
      setGame(details);
      setConnectionState("live");
      setPageMessage(null);
    };

    const handleGameError = (error: unknown, fallback: string) => {
      if (cancelled) return;
      const message = getGameErrorMessage(error, fallback);
      if (latestGameRef.current) {
        setPageMessage(message);
        return;
      }
      setConnectionState(isFatalApplicationError(error) ? "error" : "connecting");
      setPageMessage(message);
    };

    const unsubscribe = gameClient.subscribeToGame(gameId, applyGameDetails, (error) => {
      handleGameError(error, "Connection lost. Reconnecting...");
    });

    gameClient.getGame(gameId).then(applyGameDetails).catch((error) => {
      handleGameError(error, "Unable to load game state.");
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [loaded, isAuthenticated, gameClient, gameId]);

  // --- Bingo & Animation Logic ---
  useEffect(() => {
    if (!game || !myTeamName) return;

    const bingoDetails = getDetailedBingos(game.tileGrid, myTeamName);
    const currentBingoIds = bingoDetails.map(b => b.id);
    
    if (isFirstLoad.current) {
      celebratedBingos.current = currentBingoIds;
      isFirstLoad.current = false;
    } else {
      const newBingos = bingoDetails.filter(b => !celebratedBingos.current.includes(b.id));
      if (newBingos.length > 0) {
        const newTilesToAnimate = new Set<string>();
        newBingos.forEach(b => b.tiles.forEach(t => newTilesToAnimate.add(t)));
        celebratedBingos.current = [...celebratedBingos.current, ...newBingos.map(b => b.id)];
        
        setActiveBingoTiles(newTilesToAnimate);
        setShowBingoBanner(true);
        setTimeout(() => { setShowBingoBanner(false); setActiveBingoTiles(new Set()); }, 5000);
        
        const end = Date.now() + 2000;
        const frame = () => {
          confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#95D6A2'] });
          confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#95D6A2'] });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      }
    }

    const nextStatuses = new Map<string, GameTileStatus>();
    game.tileGrid.forEach((row, r) => {
      row.forEach((tile, c) => {
        const key = `${r}-${c}`;
        const prev = previousStatuses.current.get(key);
        if (prev && isFriendlyProcessing(prev, myTeamName) && isClaimedStatus(tile.status)) {
          if (!bingoDetails.some(b => !celebratedBingos.current.includes(b.id))) {
            setShakingTile(key);
            setTimeout(() => {
              setShakingTile(null);
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 }, colors: ["#95D6A2", "#FFFFFF"] });
            }, 600);
          }
        }
        nextStatuses.set(key, tile.status);
      });
    });
    previousStatuses.current = nextStatuses;
  }, [game, myTeamName]);

  useEffect(() => {
    if (game?.status !== "ENDED") return;
    clearLastSubmissionWord();
    router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
  }, [game?.status, gameId, lobbyId, router]);

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  const teamScores: TeamScoreViewModel[] = game && myTeamName
    ? buildTeamScores(myTeamName, game.score_1, game.score_2)
    : [];

  return (
    <div className="app-shell">
      {showBingoBanner && (
        <div className="bingo-overlay">
          BINGO!
          <span className="bingo-overlay-sub">Bonus Points earned!</span>
        </div>
      )}

      <main className="phone-frame screen-gradient bingo-frame-layout">
        {game && myTeamName && (
          <div className="top-actions-bar">
            <button 
              type="button" 
              className="menu-rules-trigger" 
              onClick={handleOpenRules}
              disabled={loadingGameModes}
            >
              {loadingGameModes ? "..." : "i"}
            </button>
            <button type="button" className="chat-trigger-btn" onClick={() => setShowChat(true)}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
        )}

        {game && myTeamName && (
          <>
            <section className="bingo-team-points-container bingo-top-spacing">
              {teamScores.map((score) => (
                <div key={score.label} className={`bingo-team-points-card ${getPerspectiveCardClass(score.perspective)}`}>
                  <span className="bingo-team-points-card-text">{score.label}<br />Points:</span>
                  <span className="bingo-team-points-card-points">{score.totalPoints}</span>
                </div>
              ))}
            </section>

            <div className="bingo-time-bar-container">
              <div className="bingo-time-bar-label">
                Time: {Math.floor(remainingSeconds/60)}:{(remainingSeconds%60).toString().padStart(2,"0")}
              </div>
              <div className="bingo-time-bar-track">
                <div 
                  className={`bingo-time-bar-fill ${remainingSeconds > 0 && remainingSeconds <= (game.gameDuration * 60) * 0.15 ? "is-warning-pulse" : ""}`}
                  style={{ width: progressWidth, transition: "width 1s linear" }} 
                />
              </div>
            </div>

            <section className="bingo-panel">
              <div className="bingo-card">
                {game.tileGrid.map((row, r) => (
                  <div key={`row-${r}`} className="bingo-row-frame">
                    {row.map((tile, c) => {
                      const key = `${r}-${c}`;
                      const isClaimed = isClaimedStatus(tile.status);
                      const isProcessing = isProcessingStatus(tile.status);
                      const isBingoGlow = activeBingoTiles.has(key);
                      const isSuccessShaking = shakingTile === key;

                      return (
                        <button
                          key={key}
                          type="button"
                          className={`bingo-field-button ${getTileStateClass(tile.status, myTeamName)} ${isSuccessShaking ? "is-success-shake" : ""} ${isBingoGlow ? "is-bingo-tile is-animating-bingo" : ""}`}
                          disabled={isClaimed || isProcessing}
                          onClick={() => router.push(`/lobbies/${lobbyId}/games/${gameId}/submission?tileWord=${encodeURIComponent(tile.word)}`)}
                        >
                          {isProcessing ? (
                            <div className={`loader ${getTileLoaderClass(tile.status, myTeamName)}`}></div>
                          ) : isClaimed ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            <span className="tile-text">{tile.word}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* --- RULES OVERLAY --- */}
      {showRules && (
        <div className="overlay-backdrop" onClick={() => setShowRules(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="rules-content">
              <h2 className="overlay-title">Game Rules</h2>
              <div className="rules-section">
                <div className="rules-scroll-container">
                  {gameModesError ? (
                    <p className="overlay-error-bubble">{gameModesError}</p>
                  ) : (
                    <div className="rules-horizontal-list">
                      {gameModes.map((mode) => (
                        <div key={mode.id} className="rules-card">
                          <h3 className="rules-subtitle">{mode.name}</h3>
                          <ul className="rules-bullet-list">
                            {mode.rules.map((rule, i) => (
                              <li key={i}>
                                <strong>{["Find", "Capture", "Submission", "Win"][i] || "Rule"}:</strong> {rule}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rules-section">
                <h3 className="rules-subtitle">Tile Examples</h3>
                <div className="rules-tile-grid">
                  <div className="rules-tile-item">
                    <div className="bingo-field-button" style={{ pointerEvents: 'none' }}><span className="tile-text">Tree</span></div>
                    <span>Unclaimed</span>
                  </div>
                  <div className="rules-tile-item">
                    <div className="bingo-field-button is-processing-friendly is-analyzing" style={{ pointerEvents: 'none' }}><div className="loader is-friendly"></div></div>
                    <span>In Validation</span>
                  </div>
                  <div className="rules-tile-item">
                    <div className="bingo-field-button is-claimed is-claimed-friendly" style={{ pointerEvents: 'none' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="claimed-icon-svg"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <span>Claimed Team 1</span>
                  </div>
                  <div className="rules-tile-item">
                    <div className="bingo-field-button is-claimed is-claimed-enemy" style={{ pointerEvents: 'none' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="claimed-icon-svg"><path d="M20 6L9 17l-5-5" /></svg>
                    </div>
                    <span>Claimed Team 2</span>
                  </div>
                </div>
              </div>

              <div className="overlay-actions overlay-actions-single">
                <button type="button" className="btn-rules-confirm" onClick={() => setShowRules(false)}>Got it!</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CHAT OVERLAY --- */}
      {showChat && (
        <div className="overlay-backdrop" onClick={() => setShowChat(false)}>
          <div className="overlay-card chat-overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="chat-header">
              <h2 className="overlay-title">Live Chat</h2>
              <button className="close-chat-btn" onClick={() => setShowChat(false)}>&times;</button>
            </div>

            <div className="chat-messages-log">
  {chatHistory.map((chat, i) => {
  // 1. Wir säubern beide Werte: Nur Zahlen extrahieren oder strikt Großbuchstaben
  const chatTeamClean = chat.teamType.replace(/\D/g, ""); // "Team1" -> "1"
  const myTeamClean = (myTeamName || "").replace(/\D/g, ""); // "TEAM1" -> "1"
  
  // 2. Vergleich (Wenn beide "1" sind, ist es mein Team)
  const isSameTeam = chatTeamClean === myTeamClean && chatTeamClean !== "";

  return (
    <div 
      key={i} 
      className={`chat-msg-wrapper ${isSameTeam ? 'is-friendly-side' : 'is-enemy-side'}`}
    >
<div className="chat-sender-label">
  <span className={`team-tag ${isSameTeam ? 'text-own' : 'text-enemy'}`}>
    {chat.teamType === "Team1" ? "Team 1" : "Team 2"}
  </span>
  
  <span className="label-divider">•</span>
  
  <span className="sender-name">{chat.sender}</span>
</div>
      <div className={`chat-msg-bubble ${isSameTeam ? 'chat-color-own' : 'chat-color-enemy'}`}>
        <p style={{ margin: 0 }}>{chat.message}</p>
      </div>
    </div>
  );
})}
  <div ref={chatEndRef} />
</div>

            <div className="chat-quick-replies-section">
              <div className="quick-replies-grid">
                {QUICK_MESSAGES.map((msg) => (
                  <button 
                    key={msg} 
                    className="btn-quick-chat" 
                    disabled={isSendingChat}
                    onClick={() => sendQuickMessage(msg)}
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---
function getTileStateClass(status: GameTileStatus, myTeamName: BackendTeamName): string {
  if (status === "UNCLAIMED") return "";
  const p = getTilePerspective(status, myTeamName);
  if (isClaimedStatus(status)) return p === "own" ? "is-claimed is-claimed-friendly" : "is-claimed is-claimed-enemy";
  if (isProcessingStatus(status)) return p === "own" ? "is-processing-friendly is-analyzing" : "is-processing-enemy is-analyzing";
  return "";
}

function getTileLoaderClass(status: GameTileStatus, myTeamName: BackendTeamName): string {
  if (!isProcessingStatus(status)) return "";
  return getTilePerspective(status, myTeamName) === "own" ? "is-friendly" : "is-enemy";
}

function getPerspectiveCardClass(perspective: TeamPerspective): string {
  return perspective === "own" ? "is-friendly" : "is-enemy";
}

function isClaimedStatus(status: GameTileStatus): boolean {
  return status === "CLAIMED_TEAM1" || status === "CLAIMED_TEAM2";
}

function isProcessingStatus(status: GameTileStatus): boolean {
  return status === "PROCESSING_TEAM1" || status === "PROCESSING_TEAM2";
}

function isFriendlyProcessing(status: GameTileStatus, myTeamName: BackendTeamName): boolean {
  return isProcessingStatus(status) && getTilePerspective(status, myTeamName) === "own";
}

function getGameErrorMessage(error: unknown, fallback: string): string {
  const applicationError = error as ApplicationError | undefined;
  if (applicationError?.status === 401) return "Session expired.";
  if (applicationError?.status === 403) return applicationError.message;
  return fallback;
}

function isFatalApplicationError(error: unknown): boolean {
  const applicationError = error as ApplicationError | undefined;
  return applicationError?.status === 401 || applicationError?.status === 403 || applicationError?.status === 404;
}

function getDetailedBingos(grid: GameTile[][], team: BackendTeamName) {
  const size = grid.length;
  const results: { id: string; tiles: string[] }[] = [];
  const isF = (t: GameTile) => isClaimedStatus(t.status) && getTilePerspective(t.status, team) === "own";
  grid.forEach((row, r) => { if (row.every(isF)) results.push({ id: `row-${r}`, tiles: row.map((_, c) => `${r}-${c}`) }); });
  for (let c = 0; c < size; c++) {
    let match = true;
    const tiles: string[] = []; 
    for (let r = 0; r < size; r++) { if (!isF(grid[r][c])) match = false; tiles.push(`${r}-${c}`); }
    if (match) results.push({ id: `col-${c}`, tiles });
  }
  let d1Match = true;
  const d1Tiles: string[] = [];
  for (let i = 0; i < size; i++) { if (!isF(grid[i][i])) d1Match = false; d1Tiles.push(`${i}-${i}`); }
  if (d1Match) results.push({ id: "diag-1", tiles: d1Tiles });
  let d2Match = true;
  const d2Tiles: string[] = [];
  for (let i = 0; i < size; i++) { if (!isF(grid[i][size - 1 - i])) d2Match = false; d2Tiles.push(`${i}-${size - 1 - i}`); }
  if (d2Match) results.push({ id: "diag-2", tiles: d2Tiles });
  return results;
}