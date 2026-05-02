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
  getLastSubmissionWord,
} from "@/utils/submissionFeedback";
import {
  getStoredLobbyTeam,
  setStoredActiveLobbyId,
  setStoredLobbyTeam,
} from "@/utils/lobbySession";

export default function GameBoardPage() {
  const api = useApi();
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams<{ lobbyId: string; gameId: string }>();
  const lobbyId = params.lobbyId;
  const gameId = params.gameId;

  // --- States ---
  const [game, setGame] = useState<GameDetails | null>(null);
  const [myTeamName, setMyTeamName] = useState<BackendTeamName | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  
  const [showRules, setShowRules] = useState(false);
  const [shakingTile, setShakingTile] = useState<string | null>(null);
  const [showBingoBanner, setShowBingoBanner] = useState(false);
  const [activeBingoTiles, setActiveBingoTiles] = useState<Set<string>>(new Set());

  const previousStatuses = useRef<Map<string, GameTileStatus>>(new Map());
  const celebratedBingos = useRef<string[]>([]); 
  const isFirstLoad = useRef(true); 
  const latestGameRef = useRef<GameDetails | null>(null);
  
  const gameClient = useMemo(() => createGameClient({ api, token }), [api, token]);
  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);

  // Timer für den Fortschrittsbalken
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Auth Session & Lobby Tracking
  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
    setStoredActiveLobbyId(userId, lobbyId);
  }, [isAuthenticated, loaded, lobbyId, router, userId]);

  // Team Zuordnung
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
        setPageMessage(getGameErrorMessage(error, "Unable to confirm your team."));
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loaded, lobbyClient, lobbyId, userId]);

  // Live Updates via Pusher
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

  // Bingo Detektion & Animationen
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
    const lastWord = getLastSubmissionWord();
    let failedSubmission = false;

    game.tileGrid.forEach((row, r) => {
      row.forEach((tile, c) => {
        const key = `${r}-${c}`;
        const prev = previousStatuses.current.get(key);
        
        if (lastWord === tile.word && prev && isFriendlyProcessing(prev, myTeamName)) {
          if (tile.status === "UNCLAIMED") {
            failedSubmission = true;
            clearLastSubmissionWord();
          } else if (isClaimedStatus(tile.status)) {
            clearLastSubmissionWord();
          }
        }

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
    if (failedSubmission) setSubmissionNotice("Your last submission was not recognized. Try again!");
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
          <button type="button" className="menu-rules-trigger" onClick={() => setShowRules(true)}>i</button>
        )}

        {(!game || !myTeamName) && (
          <section className="lobby-card lobby-loading-card">
            <h2 className="lobby-section-title">{connectionState === "error" ? "Unavailable" : "Connecting..."}</h2>
            <p className="lobby-muted-note">{pageMessage ?? "Waiting for game state..."}</p>
          </section>
        )}

        {game && myTeamName && (
          <>
            <section className="bingo-team-points-container">
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
                  className={`bingo-time-bar-fill ${
                    remainingSeconds > 0 && remainingSeconds <= (game.gameDuration * 60) * 0.15
                      ? "is-warning-pulse"
                      : ""
                  }`}
                  style={{ 
                    width: progressWidth, 
                    transition: "width 1s linear"
                  }} 
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
                          className={`bingo-field-button 
                            ${getTileStateClass(tile.status, myTeamName)} 
                            ${isSuccessShaking ? "is-success-shake" : ""} 
                            ${isBingoGlow ? "is-bingo-tile is-animating-bingo" : ""}`}
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
            {submissionNotice && <p className="bingo-submission-note">{submissionNotice}</p>}
          </>
        )}
      </main>

      {/* RULES OVERLAY */}
      {showRules && (
        <div className="overlay-backdrop" onClick={() => setShowRules(false)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="rules-content">
              <h2 className="overlay-title">Game Rules</h2>
              <div className="rules-section">
                <ul className="rules-bullet-list">
                  <li><strong>Find:</strong> Locate an item listed on the bingo board in the real world.</li>
                  <li><strong>Capture:</strong> Tap the tile to open the camera and snap a photo of that item.</li>
                  <li><strong>Submission:</strong> Once submitted, our AI will validate the image to ensure it matches the item on the tile.</li>
                  <li><strong>Win:</strong> Earn points for every captured tile, plus bonus points for completing rows, columns, or diagonals.</li>
                </ul>
              </div>

              <div className="rules-section">
                <h3 className="rules-subtitle">Tile Examples</h3>
                <div className="rules-tile-grid">
                  <div className="rules-tile-item">
                    <button type="button" className="bingo-field-button">
                      <span className="tile-text">Tree</span>
                    </button>
                    <span>Unclaimed</span>
                  </div>

                  <div className="rules-tile-item">
                    <button type="button" className="bingo-field-button is-processing-friendly is-analyzing" disabled>
                      <div className="loader is-friendly"></div>
                    </button>
                    <span>In Validation</span>
                  </div>

                  <div className="rules-tile-item">
                    <button type="button" className="bingo-field-button is-claimed is-claimed-friendly" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </button>
                    <span>Claimed Team 1</span>
                  </div>

                  <div className="rules-tile-item">
                    <button type="button" className="bingo-field-button is-claimed is-claimed-enemy" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </button>
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
  if (applicationError?.status === 404) return "Game not found.";
  if (shouldExposeLocalErrorDetails() && applicationError?.message) return `${fallback} (${applicationError.message})`;
  return fallback;
}

function isFatalApplicationError(error: unknown): boolean {
  const applicationError = error as ApplicationError | undefined;
  return applicationError?.status === 401 || applicationError?.status === 403 || applicationError?.status === 404;
}

function shouldExposeLocalErrorDetails(): boolean {
  if (typeof globalThis === "undefined" || !globalThis.location) return false;
  return globalThis.location.hostname === "localhost" || globalThis.location.hostname === "127.0.0.1";
}

function getDetailedBingos(grid: GameTile[][], team: BackendTeamName) {
  const size = grid.length;
  const results: { id: string; tiles: string[] }[] = [];
  const isF = (t: GameTile) => isClaimedStatus(t.status) && getTilePerspective(t.status, team) === "own";

  grid.forEach((row, r) => {
    if (row.every(isF)) results.push({ id: `row-${r}`, tiles: row.map((_, c) => `${r}-${c}`) });
  });
  
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