"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { createGameClient } from "@/api/gameService";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { GameDetails, GameTileStatus, GameTile } from "@/types/game";
import {
  BackendTeamName,
  buildTeamScores,
  getTilePerspective,
  normalizeBackendTeamName,
} from "@/utils/gamePerspective";
import {
  setStoredActiveLobbyId,
  setStoredLobbyTeam,
} from "@/utils/lobbySession";

export default function GameBoardPage() {
  const api = useApi();
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const params = useParams<{ lobbyId: string; gameId: string }>();
  const { lobbyId, gameId } = params;

  const [game, setGame] = useState<GameDetails | null>(null);
  const [myTeamName, setMyTeamName] = useState<BackendTeamName | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  
  const [activeOverlay, setActiveOverlay] = useState<"rules" | null>(null);
  const [shakingTile, setShakingTile] = useState<string | null>(null);
  const [showBingoBanner, setShowBingoBanner] = useState(false);
  
  // Neu: Tracking der Kacheln, die AKTUELL leuchten sollen
  const [activeBingoTiles, setActiveBingoTiles] = useState<Set<string>>(new Set());

  const previousStatuses = useRef<Map<string, GameTileStatus>>(new Map());
  const celebratedBingos = useRef<string[]>([]); 
  const isFirstLoad = useRef(true); 
  const latestGameRef = useRef<GameDetails | null>(null);
  
  const gameClient = useMemo(() => createGameClient({ api, token }), [api, token]);
  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);

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

  // Redirect bei Zeitablauf
  useEffect(() => {
    if (game && remainingSeconds <= 0) {
      router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
    }
  }, [remainingSeconds, game, router, lobbyId, gameId]);

  useEffect(() => {
    if (!loaded || !isAuthenticated) { if (loaded) router.replace("/"); return; }
    setStoredActiveLobbyId(userId, lobbyId);
  }, [isAuthenticated, loaded, lobbyId, router, userId]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || !userId) return;
    lobbyClient.getLobby(lobbyId).then(l => {
      const p = l.lobbyPlayers.find(x => x.user.id === userId);
      const team = normalizeBackendTeamName(p?.team ?? null);
      setMyTeamName(team);
      setStoredLobbyTeam(userId, lobbyId, p?.team ?? null);
    });
  }, [isAuthenticated, loaded, lobbyClient, lobbyId, userId]);

  useEffect(() => {
    if (!loaded || !isAuthenticated) return;
    let cancelled = false;
    const applyGameDetails = (details: GameDetails) => {
      if (cancelled) return;
      latestGameRef.current = details;
      setGame(details);
      setConnectionState("live");
      
      if (details.status === "ENDED") {
        router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
      }
    };
    const unsubscribe = gameClient.subscribeToGame(gameId, applyGameDetails, (err) => {
      if (!latestGameRef.current) setConnectionState("error");
    });
    gameClient.getGame(gameId).then(applyGameDetails).catch(() => setConnectionState("error"));
    return () => { cancelled = true; unsubscribe(); };
  }, [loaded, isAuthenticated, gameClient, gameId, lobbyId, router]);

  // --- BINGO LOGIK: NUR NEUE BINGOS LEUCHTEN ---
  useEffect(() => {
    if (!game || !myTeamName) return;

    const bingoDetails = getDetailedBingos(game.tileGrid, myTeamName);
    const currentBingoIds = bingoDetails.map(b => b.id);

    if (isFirstLoad.current) {
      celebratedBingos.current = currentBingoIds;
      isFirstLoad.current = false;
      return;
    }

    const newBingos = bingoDetails.filter(b => !celebratedBingos.current.includes(b.id));

    if (newBingos.length > 0) {
      const newTilesToAnimate = new Set<string>();
      newBingos.forEach(b => b.tiles.forEach(t => newTilesToAnimate.add(t)));

      celebratedBingos.current = [...celebratedBingos.current, ...newBingos.map(b => b.id)];
      
      setActiveBingoTiles(newTilesToAnimate);
      setShowBingoBanner(true);

      // Animation & Glow nach 5 Sekunden entfernen
      setTimeout(() => {
        setShowBingoBanner(false);
        setActiveBingoTiles(new Set()); 
      }, 5000);

      const end = Date.now() + 2000;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#95D6A2'] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#95D6A2'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [game, myTeamName]);

  // --- TILE STATUS MONITORING ---
  useEffect(() => {
    if (!game || !myTeamName) return;
    const nextStatuses = new Map<string, GameTileStatus>();

    game.tileGrid.forEach((row, r) => {
      row.forEach((tile, c) => {
        const key = `${r}-${c}`;
        const prev = previousStatuses.current.get(key);

        if (prev && isProcessingStatus(prev) && isClaimedStatus(tile.status) && getTilePerspective(tile.status, myTeamName) === "own") {
          const bingoDetails = getDetailedBingos(game.tileGrid, myTeamName);
          const isPartOfNewBingo = bingoDetails.some(b => !celebratedBingos.current.includes(b.id));
          
          if (!isPartOfNewBingo) {
            setShakingTile(key);
            setTimeout(() => {
              setShakingTile(null);
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 }, colors: ["#95D6A2", "#FFFFFF", "#76c486"] });
            }, 600);
          }
        }
        nextStatuses.set(key, tile.status);
      });
    });
    previousStatuses.current = nextStatuses;
  }, [game, myTeamName]);

  const closeOverlay = () => setActiveOverlay(null);

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  const teamScores = game && myTeamName ? buildTeamScores(myTeamName, game.score_1, game.score_2) : [];

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
          <button type="button" className="menu-rules-trigger" onClick={() => setActiveOverlay("rules")}>i</button>
        )}

        {game && myTeamName && (
          <>
            <section className="bingo-team-points-container">
              {teamScores.map((score) => (
                <div key={score.label} className={`bingo-team-points-card ${score.perspective === "own" ? "is-friendly" : "is-enemy"}`}>
                  <span className="bingo-team-points-card-text">{score.label}<br />Points:</span>
                  <span className="bingo-team-points-card-points">{score.totalPoints}</span>
                </div>
              ))}
            </section>

            <div className="bingo-time-bar-container">
              <div className="bingo-time-bar-label">Time: {Math.floor(remainingSeconds/60)}:{(remainingSeconds%60).toString().padStart(2,"0")}</div>
              <div className="bingo-time-bar-track">
                <div className="bingo-time-bar-fill" style={{ width: progressWidth, transition: "width 1s linear" }} />
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
                            <div className={`loader ${getTilePerspective(tile.status, myTeamName) === "own" ? "is-friendly" : "is-enemy"}`}></div>
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

                {/* RULES OVERLAY */}
        {activeOverlay === "rules" && (
          <div className="overlay-backdrop" onClick={closeOverlay}>
            <div className="overlay-card is-rules-large" onClick={(e) => e.stopPropagation()}>
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
                      <div className="bingo-field-button">
                        <span className="tile-text">Tree</span>
                      </div>
                      <span>Unclaimed</span>
                    </div>
                    <div className="rules-tile-item">
                      <div className="bingo-field-button is-processing-friendly is-analyzing">
                        <div className="loader is-friendly"></div>
                      </div>
                      <span>In Validation</span>
                    </div>
                    <div className="rules-tile-item">
                      <div className="bingo-field-button is-claimed is-claimed-friendly">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <span>Claimed Team 1</span>
                    </div>
                    <div className="rules-tile-item">
                      <div className="bingo-field-button is-claimed is-claimed-enemy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <span>Claimed Team 2</span>
                    </div>
                  </div>
                </div>
                
                <div className="overlay-actions-single">
                  <button type="button" className="btn-rules-confirm" onClick={closeOverlay}>Got it!</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- HELPER ---
function getDetailedBingos(grid: GameTile[][], team: BackendTeamName) {
  const size = grid.length;
  const results: { id: string; tiles: string[] }[] = [];
  const isF = (t: GameTile) => isClaimedStatus(t.status) && getTilePerspective(t.status, team) === "own";

  grid.forEach((row, r) => {
    if (row.every(isF)) results.push({ id: `row-${r}`, tiles: row.map((_, c) => `${r}-${c}`) });
  });

  for (let c = 0; c < size; c++) {
    let match = true;
    let tiles: string[] = [];
    for (let r = 0; r < size; r++) {
      if (!isF(grid[r][c])) match = false;
      tiles.push(`${r}-${c}`);
    }
    if (match) results.push({ id: `col-${c}`, tiles });
  }

  let d1Match = true, d1Tiles: string[] = [];
  for (let i = 0; i < size; i++) {
    if (!isF(grid[i][i])) d1Match = false;
    d1Tiles.push(`${i}-${i}`);
  }
  if (d1Match) results.push({ id: "diag-1", tiles: d1Tiles });

  let d2Match = true, d2Tiles: string[] = [];
  for (let i = 0; i < size; i++) {
    if (!isF(grid[i][size - 1 - i])) d2Match = false;
    d2Tiles.push(`${i}-${size - 1 - i}`);
  }
  if (d2Match) results.push({ id: "diag-2", tiles: d2Tiles });

  return results;
}

function getTileStateClass(s: GameTileStatus, t: BackendTeamName) {
  if (s === "UNCLAIMED") return "";
  const p = getTilePerspective(s, t);
  if (isClaimedStatus(s)) return p === "own" ? "is-claimed is-claimed-friendly" : "is-claimed is-claimed-enemy";
  if (isProcessingStatus(s)) return p === "own" ? "is-processing-friendly is-analyzing" : "is-processing-enemy is-analyzing";
  return "";
}

function isClaimedStatus(s: GameTileStatus) { return s === "CLAIMED_TEAM1" || s === "CLAIMED_TEAM2"; }
function isProcessingStatus(s: GameTileStatus) { return s === "PROCESSING_TEAM1" || s === "PROCESSING_TEAM2"; }