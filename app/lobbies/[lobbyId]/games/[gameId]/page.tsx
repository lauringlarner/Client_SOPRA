"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { createGameClient } from "@/api/gameService";
import { createLobbyClient } from "@/api/lobbyService";
import { FittedTileText } from "@/components/FittedTileText";
import { GameRulesOverlay, GameModeDTO } from "@/components/GameRulesOverlay";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApplicationError } from "@/types/error";
import {
  ChatMessageGetDTO,
  GameDetails,
  GameTile,
  GameTileStatus,
} from "@/types/game";
import {
  BackendTeamName,
  buildTeamScores,
  getTilePerspective,
  normalizeBackendTeamName,
  TeamScoreViewModel,
} from "@/utils/gamePerspective";
import {
  clearLastSubmissionWord,
} from "@/utils/submissionFeedback";
import { playCountdown, getSoundEnabled, setSoundEnabled } from "@/utils/sounds";
import {
  getStoredLobbyTeam,
  getStoredSinglePlayerMode,
  setStoredActiveLobbyId,
  setStoredLobbyTeam,
} from "@/utils/lobbySession";

interface ChatPreviewMessage extends ChatMessageGetDTO {
  previewKey: string;
}

type ChatPreviewStyle = React.CSSProperties & Record<`--${string}`, string>;

const CHAT_PREVIEW_LIMIT = 3;
const CHAT_PREVIEW_TTL_MS = 5000;
const CHAT_FALLBACK_FETCH_INTERVAL_MS = 3000;
const CHAT_PREVIEW_MIN_HEIGHT = 50;
const CHAT_PREVIEW_SCORE_MARGIN = 15;
const CHAT_PREVIEW_MIN_META_SIZE = 9;
const CHAT_PREVIEW_MIN_TEXT_SIZE = 10;
const CHAT_PREVIEW_MAX_META_SIZE = 12;
const CHAT_PREVIEW_MAX_TEXT_SIZE = 16;

const QUICK_MESSAGES = [
  "Too slow on the shutter! 🐢📸",
  "Mine now! 🚩",
  "Focus, please! 📸🥴",
  "Bingo? Denied. 🙅‍♂️",
  "Nice blurry pic! 🏃💨",
  "Blocked! 🛑",
  "I saw that first! 👀",
  "Run faster! 🏃‍♀️🔥",
  "Touch grass! 🌿",
  "Calculated steal 🧮",
  "Was that a smudge? 🌫️",
  "Respect! 🤝"
];

export default function GameBoardPage() {
  const api = useApi();
  const router = useRouter();
  const { loaded, isAuthenticated, token, userId, username } = useAuthSession();
  const params = useParams<{ lobbyId: string; gameId: string }>();
  const { lobbyId, gameId } = params;

  // --- States ---
  const [game, setGame] = useState<GameDetails | null>(null);
  const [myTeamName, setMyTeamName] = useState<BackendTeamName | null>(null);
  const [storedSinglePlayerMode, setStoredSinglePlayerMode] = useState(false);
  const [, setConnectionState] = useState<"connecting" | "live" | "error">("connecting");
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  
  const [soundEnabled, setSoundEnabledState] = useState(true);

  // Rules pre-fetch management states
  const [showRules, setShowRules] = useState(false);
  const [gameModes, setGameModes] = useState<GameModeDTO[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  
  const [showChat, setShowChat] = useState(false);
  const [shakingTile, setShakingTile] = useState<string | null>(null);
  const [showBingoBanner, setShowBingoBanner] = useState(false);
  const [activeBingoTiles, setActiveBingoTiles] = useState<Set<string>>(new Set());

  // --- Chat States ---
  const [chatHistory, setChatHistory] = useState<ChatMessageGetDTO[]>([]);
  const [chatPreviewMessages, setChatPreviewMessages] = useState<ChatPreviewMessage[]>([]);
  const [chatPreviewHeight, setChatPreviewHeight] = useState(CHAT_PREVIEW_MIN_HEIGHT);
  const [chatPreviewContentWidth, setChatPreviewContentWidth] = useState(0);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  
  // --- Refs ---
  const topActionsRef = useRef<HTMLDivElement>(null);
  const scoreContainerRef = useRef<HTMLElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollChatRef = useRef(true);
  const hasAutoScrolledOnOpen = useRef(false);
  const chatFetchRequestRef = useRef(0);
  const hasHydratedChatHistory = useRef(false);
  const seenPreviewMessageKeys = useRef<Set<string>>(new Set());
  const previewRemovalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const previousStatuses = useRef<Map<string, GameTileStatus>>(new Map());
  const celebratedBingos = useRef<string[]>([]);
  const isFirstLoad = useRef(true);
  const latestGameRef = useRef<GameDetails | null>(null);
  const countdownPlayedRef = useRef(false);
  
  const gameClient = useMemo(() => createGameClient({ api, token }), [api, token]);
  const lobbyClient = useMemo(() => createLobbyClient({ api, token }), [api, token]);
  const chatPreviewStyle = useMemo<ChatPreviewStyle>(() => {
    const gap = chatPreviewHeight <= CHAT_PREVIEW_MIN_HEIGHT
      ? 1
      : clampNumber(Math.round(chatPreviewHeight * 0.03), 2, 6);
    const desiredMetaSize = clampNumber(
      Math.round(chatPreviewHeight * 0.13),
      CHAT_PREVIEW_MIN_META_SIZE,
      CHAT_PREVIEW_MAX_META_SIZE,
    );
    const desiredTextSize = clampNumber(
      Math.round(chatPreviewHeight * 0.16),
      CHAT_PREVIEW_MIN_TEXT_SIZE,
      CHAT_PREVIEW_MAX_TEXT_SIZE,
    );
    const fittedSizes = getPreviewFontSizes({
      availableWidth: chatPreviewContentWidth,
      desiredMetaSize,
      desiredTextSize,
      messages: chatPreviewMessages,
    });
    const rowHeight = Math.max(15, Math.ceil(fittedSizes.textSize * 1.25));

    return {
      "--bingo-chat-preview-height": `${chatPreviewHeight}px`,
      "--bingo-chat-preview-gap": `${gap}px`,
      "--bingo-chat-preview-row-height": `${rowHeight}px`,
      "--bingo-chat-preview-meta-size": `${fittedSizes.metaSize}px`,
      "--bingo-chat-preview-text-size": `${fittedSizes.textSize}px`,
    };
  }, [chatPreviewContentWidth, chatPreviewHeight, chatPreviewMessages]);
  const tileSound = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { tileSound.current = new Audio('/sounds/ui_click_beep.wav'); }, []);
  useEffect(() => { setSoundEnabledState(getSoundEnabled()); }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
  };

  // --- 1. Background Scroll Lock ---
  useEffect(() => {
    const shouldLock = showRules || showChat || showBingoBanner;
    if (shouldLock) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [showRules, showChat, showBingoBanner]);

  // --- 2. Redirect Logic ---
  useEffect(() => {
    if (game?.status === "ENDED" && lobbyId && gameId) {
      clearLastSubmissionWord();
      const timer = setTimeout(() => {
        router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [game?.status, gameId, lobbyId, router]);

  // --- 3. Chat Logic & Smart Scrolling ---
  const appendChatMessage = useCallback((message: ChatMessageGetDTO) => {
    setChatHistory((current) => mergeChatMessages(current, [message]));
  }, []);

  const fetchChat = useCallback(async () => {
    if (!token || !gameId) return;
    const requestId = chatFetchRequestRef.current + 1;
    chatFetchRequestRef.current = requestId;

    try {
      const messages = await api.get<ChatMessageGetDTO[]>(`/games/${gameId}/chat`, token);
      if (requestId !== chatFetchRequestRef.current) return;

      if (!hasHydratedChatHistory.current) {
        messages.forEach((chat) =>
          seenPreviewMessageKeys.current.add(getChatMessageKey(chat)),
        );
        hasHydratedChatHistory.current = true;
      }

      setChatHistory((current) => mergeChatMessages(current, messages));
    } catch (err) {
      if (requestId === chatFetchRequestRef.current) {
        console.error("Chat fetch failed", err);
      }
    }
  }, [api, gameId, token]);

  useEffect(() => {
    const updatePageVisibility = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    updatePageVisibility();
    document.addEventListener("visibilitychange", updatePageVisibility);
    return () => document.removeEventListener("visibilitychange", updatePageVisibility);
  }, []);

  useEffect(() => {
    if (
      !loaded ||
      !isAuthenticated ||
      !token ||
      !gameId ||
      !isPageVisible ||
      game?.status === "ENDED"
    ) {
      return;
    }

    const unsubscribe = gameClient.subscribeToChat(
      gameId,
      appendChatMessage,
      (error) => {
        console.error("Chat subscription failed", error);
      },
    );

    void fetchChat();
    const fallbackFetchInterval = setInterval(
      () => void fetchChat(),
      CHAT_FALLBACK_FETCH_INTERVAL_MS,
    );

    return () => {
      clearInterval(fallbackFetchInterval);
      unsubscribe();
      chatFetchRequestRef.current += 1;
    };
  }, [
    appendChatMessage,
    fetchChat,
    game?.status,
    gameClient,
    gameId,
    isAuthenticated,
    isPageVisible,
    loaded,
    token,
  ]);

  useEffect(() => {
    if (!hasHydratedChatHistory.current) return;

    const unseenMessages = chatHistory
      .map((chat) => ({
        ...chat,
        previewKey: getChatMessageKey(chat),
      }))
      .filter((chat) => !seenPreviewMessageKeys.current.has(chat.previewKey))
      .sort(compareChatPreviewMessages);

    if (unseenMessages.length === 0) return;

    unseenMessages.forEach((chat) =>
      seenPreviewMessageKeys.current.add(chat.previewKey),
    );

    const nextPreviewMessages = unseenMessages.slice(-CHAT_PREVIEW_LIMIT);

    nextPreviewMessages.forEach((chat) => {
      const timer = setTimeout(() => {
        setChatPreviewMessages((current) =>
          current.filter((previewMessage) => previewMessage.previewKey !== chat.previewKey),
        );
        previewRemovalTimers.current.delete(chat.previewKey);
      }, CHAT_PREVIEW_TTL_MS);

      previewRemovalTimers.current.set(chat.previewKey, timer);
    });

    setChatPreviewMessages((current) => {
      const nextMessages = [...current, ...nextPreviewMessages]
        .sort(compareChatPreviewMessages)
        .slice(-CHAT_PREVIEW_LIMIT);

      const activeKeys = new Set(nextMessages.map((message) => message.previewKey));

      previewRemovalTimers.current.forEach((timer, key) => {
        if (!activeKeys.has(key)) {
          clearTimeout(timer);
          previewRemovalTimers.current.delete(key);
        }
      });

      return nextMessages;
    });
  }, [chatHistory]);

  useEffect(() => {
    const timers = previewRemovalTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      chatFetchRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!showChat) {
      hasAutoScrolledOnOpen.current = false;
    }
  }, [showChat]);

  useEffect(() => {
    if (!game || !myTeamName) return;

    let frameId = 0;
    const updatePreviewHeight = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const topActions = topActionsRef.current;
        const scoreContainer = scoreContainerRef.current;
        if (!topActions || !scoreContainer) return;

        const topActionsRect = topActions.getBoundingClientRect();
        const scoreRect = scoreContainer.getBoundingClientRect();
        const availableHeight = Math.floor(scoreRect.top - topActionsRect.top - CHAT_PREVIEW_SCORE_MARGIN);
        const nextHeight = Math.max(CHAT_PREVIEW_MIN_HEIGHT, availableHeight);
        const nextContentWidth = Math.max(0, Math.floor(topActionsRect.width - 132 - 12));

        setChatPreviewHeight((current) => current === nextHeight ? current : nextHeight);
        setChatPreviewContentWidth((current) => current === nextContentWidth ? current : nextContentWidth);
      });
    };

    updatePreviewHeight();
    globalThis.addEventListener("resize", updatePreviewHeight);
    globalThis.addEventListener("orientationchange", updatePreviewHeight);

    const resizeObserver = new ResizeObserver(updatePreviewHeight);
    if (topActionsRef.current) resizeObserver.observe(topActionsRef.current);
    if (scoreContainerRef.current) resizeObserver.observe(scoreContainerRef.current);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      globalThis.removeEventListener("resize", updatePreviewHeight);
      globalThis.removeEventListener("orientationchange", updatePreviewHeight);
    };
  }, [game, myTeamName]);

  useEffect(() => {
    if (showChat && !hasAutoScrolledOnOpen.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "instant" });
      hasAutoScrolledOnOpen.current = true;
    }
  }, [showChat, chatHistory]);

  const sendQuickMessage = async (msg: string) => {
    if (isSendingChat || !token) return;

    setIsSendingChat(true);

    try {
      await api.post<ChatMessageGetDTO>(
        `/games/${gameId}/chat`,
        { message: msg },
        token,
      );
      await fetchChat();
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      console.error("Chat send failed", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      shouldAutoScrollChatRef.current = isUserNearBottom(el);
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!showChat) return;

    const el = chatContainerRef.current;
    if (!el) return;

    if (shouldAutoScrollChatRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, showChat]);

  // --- Game Timer ---
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

  useEffect(() => {
    if (remainingSeconds <= 20 && remainingSeconds > 0 && game?.status !== "ENDED" && !countdownPlayedRef.current) {
      countdownPlayedRef.current = true;
      playCountdown();
    }
  }, [remainingSeconds, game?.status]);

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
    setStoredSinglePlayerMode(getStoredSinglePlayerMode(userId, lobbyId) === 1);

    void (async () => {
      try {
        const currentLobby = await lobbyClient.getLobby(lobbyId);
        if (cancelled) return;
        const currentPlayer = currentLobby.lobbyPlayers.find(p => p.user.id === userId);
        const team = normalizeBackendTeamName(currentPlayer?.team ?? null);
        setMyTeamName(team);
        setStoredLobbyTeam(userId, lobbyId, currentPlayer?.team ?? null);
      } catch {
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
        for (let idx = 0; idx < 1; idx++) {
          frame();
        }
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

  // --- Pre-fetch rules execution ---
  const handleOpenRules = async () => {
    if (rulesLoading) return;

    if (gameModes.length > 0) {
      setShowRules(true);
      return;
    }

    if (!token) return;

    setRulesLoading(true);
    setPageMessage(null);
    try {
      const data = await api.get<GameModeDTO[]>("/gameModes", token);
      setGameModes(data);
      setShowRules(true);
    } catch {
      setPageMessage("Failed to load game rules.");
    } finally {
      setRulesLoading(false);
    }
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  const isSinglePlayerGame = game?.isSinglePlayer ?? storedSinglePlayerMode;
  const teamScores: TeamScoreViewModel[] = game && myTeamName
    ? buildTeamScores(myTeamName, game.score_1, game.score_2, isSinglePlayerGame)
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
          <div className="top-actions-bar" ref={topActionsRef}>
            <div className="rules-trigger-container">
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="chat-trigger-btn" onClick={toggleSound} aria-label="Toggle sound">
                  {soundEnabled ? (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </svg>
                  )}
                </button>
                  {!isSinglePlayerGame && (

                    <button type="button" className="chat-trigger-btn" onClick={() => setShowChat(true)}>
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                  )}
              </div>

              <button
                type="button"
                className={`menu-rules-trigger ${rulesLoading ? "is-loading" : ""}`}
                onClick={() => void handleOpenRules()}
                disabled={rulesLoading}
              >
                {rulesLoading ? "..." : "i"}
              </button>
            </div>

            {chatPreviewMessages.length > 0 && (
              <button
                type="button"
                className="bingo-chat-preview-stack"
                onClick={() => setShowChat(true)}
                aria-label="Open live chat"
                style={chatPreviewStyle}
              >
                {chatPreviewMessages.map((chat) => {
                  const isSameTeam = isChatFromSameTeam(chat.teamType, myTeamName);
                  return (
                    <span
                      key={chat.previewKey}
                      className={`bingo-chat-preview-message ${isSameTeam ? "is-friendly" : "is-enemy"}`}
                    >
                      <span className="bingo-chat-preview-meta">
                        <span>{getChatTeamLabel(chat.teamType)}</span>
                        <span className="label-divider">•</span>
                        <span className="sender-name">{chat.sender}</span>
                      </span>
                      <span className="bingo-chat-preview-text">{chat.message}</span>
                    </span>
                  );
                })}
              </button>
            )}
          </div>
        )}

        {pageMessage && (
          <div className="menu-status-card is-error" style={{ margin: "10px" }}>{pageMessage}</div>
        )}

        {game && myTeamName && (
          <>
            <section
              className={`bingo-team-points-container bingo-top-spacing ${isSinglePlayerGame ? "is-solo" : ""}`}
              ref={scoreContainerRef}
            >
              {teamScores.map((score) => (
                <div key={score.label} className={`bingo-team-points-card ${score.label === "Team 1" ? "is-team1" : "is-team2"}`}>
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
                          onClick={() => { if (soundEnabled) tileSound.current?.play().catch(() => {}); router.push(`/lobbies/${lobbyId}/games/${gameId}/submission?tileWord=${encodeURIComponent(tile.word)}`); }}
                        >
                          {isProcessing ? (
                            <div className={`loader ${getTileLoaderClass(tile.status, myTeamName)}`}></div>
                          ) : isClaimed ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="claimed-icon-svg">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            <FittedTileText text={tile.word} />
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

      <GameRulesOverlay 
        isOpen={showRules}
        onClose={() => setShowRules(false)} 
        gameModes={gameModes}          
      />

      {/* --- CHAT OVERLAY --- */}
      {showChat && (
        <div className="overlay-backdrop" onClick={() => setShowChat(false)}>
          <div className="overlay-card chat-overlay-card" onClick={(e) => e.stopPropagation()}>
            <div className="chat-header">
              <h2 className="overlay-title">Live Chat</h2>
              <button type="button" className="close-chat-btn" onClick={() => setShowChat(false)}>&times;</button>
            </div>

            <div className="chat-messages-log" ref={chatContainerRef}>
                {chatHistory.map((chat) => {
                    const chatTeamClean = chat.teamType.replace(/\D/g, "");
                    const myTeamClean = (myTeamName || "").replace(/\D/g, "");
                    const isSameTeam = chatTeamClean === myTeamClean && chatTeamClean !== "";
                    const isMine = chat.sender === username;

                    return (
                        <div
                          key={getChatMessageKey(chat)}
                          className={`chat-msg-wrapper ${isSameTeam ? 'is-friendly-side' : 'is-enemy-side'}`}
                        >
                            <div className="chat-sender-label">
                                <span className={`team-tag ${isSameTeam ? 'text-own' : 'text-enemy'}`}>
                                    {chat.teamType === "Team1" ? "Team 1" : "Team 2"}
                                </span>
                                <span className="label-divider">•</span>
                                

                                <span className="sender-name">
                                  {chat.sender}
                                  {isMine ? " (You)" : ""}
                                </span>
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
                    type="button"
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPreviewFontSizes({
  availableWidth,
  desiredMetaSize,
  desiredTextSize,
  messages,
}: {
  availableWidth: number;
  desiredMetaSize: number;
  desiredTextSize: number;
  messages: ChatPreviewMessage[];
}): { metaSize: number; textSize: number } {
  if (availableWidth <= 0 || messages.length === 0) {
    return { metaSize: CHAT_PREVIEW_MIN_META_SIZE, textSize: CHAT_PREVIEW_MIN_TEXT_SIZE };
  }

  const rows = buildPreviewFitRows(messages);
  const desiredWidth = getWidestPreviewRowWidth(rows, desiredMetaSize, desiredTextSize);
  if (desiredWidth <= availableWidth) {
    return { metaSize: desiredMetaSize, textSize: desiredTextSize };
  }

  let low = CHAT_PREVIEW_MIN_TEXT_SIZE;
  let high = desiredTextSize;
  for (let i = 0; i < 8; i++) {
    const nextTextSize = (low + high) / 2;
    const nextMetaSize = getMetaSizeForTextSize(nextTextSize);
    const nextWidth = getWidestPreviewRowWidth(rows, nextMetaSize, nextTextSize);

    if (nextWidth <= availableWidth) low = nextTextSize;
    else high = nextTextSize;
  }

  const textSize = Math.max(CHAT_PREVIEW_MIN_TEXT_SIZE, Math.floor(low * 10) / 10);
  return {
    metaSize: getMetaSizeForTextSize(textSize),
    textSize,
  };
}

function buildPreviewFitRows(messages: ChatPreviewMessage[]): { meta: string; text: string }[] {
  return messages.flatMap((message) => {
    const meta = `${getChatTeamLabel(message.teamType)} • ${message.sender}`;
    return [
      { meta, text: message.message },
      ...QUICK_MESSAGES.map((quickMessage) => ({ meta, text: quickMessage })),
    ];
  });
}

function getMetaSizeForTextSize(textSize: number): number {
  const ratio = CHAT_PREVIEW_MIN_META_SIZE / CHAT_PREVIEW_MIN_TEXT_SIZE;
  return clampNumber(
    Math.round(textSize * ratio * 10) / 10,
    CHAT_PREVIEW_MIN_META_SIZE,
    CHAT_PREVIEW_MAX_META_SIZE,
  );
}

function getWidestPreviewRowWidth(
  rows: { meta: string; text: string }[],
  metaSize: number,
  textSize: number,
): number {
  return rows.reduce((widest, row) => {
    const rowWidth =
      measurePreviewText(row.meta, metaSize, 800) +
      5 +
      measurePreviewText(row.text, textSize, 700);
    return Math.max(widest, rowWidth);
  }, 0);
}

function measurePreviewText(text: string, fontSize: number, fontWeight: number): number {
  if (typeof document === "undefined") return text.length * fontSize * 0.6;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * fontSize * 0.6;

  context.font = `${fontWeight} ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  return context.measureText(text).width;
}

function isChatFromSameTeam(teamType: string, myTeamName: BackendTeamName): boolean {
  const chatTeamClean = teamType.replace(/\D/g, "");
  const myTeamClean = myTeamName.replace(/\D/g, "");
  return chatTeamClean === myTeamClean && chatTeamClean !== "";
}

function getChatTeamLabel(teamType: string): string {
  if (teamType === "Team1" || teamType === "Team 1") return "Team 1";
  if (teamType === "Team2" || teamType === "Team 2") return "Team 2";
  return teamType;
}

function getChatMessageKey(chat: ChatMessageGetDTO): string {
  return chat.id ?? `${chat.teamType}-${chat.sender}-${chat.sentAt}-${chat.message}`;
}

function mergeChatMessages(
  currentMessages: ChatMessageGetDTO[],
  incomingMessages: ChatMessageGetDTO[],
): ChatMessageGetDTO[] {
  const messageIds = new Set<string>();
  const fallbackKeys = new Set<string>();
  const nextMessages: ChatMessageGetDTO[] = [];

  [...currentMessages, ...incomingMessages]
    .sort(compareChatMessages)
    .forEach((message) => {
      const messageId = message.id;
      if (messageId) {
        if (messageIds.has(messageId)) return;
        messageIds.add(messageId);
        nextMessages.push(message);
        return;
      }

      const fallbackKey = getChatMessageKey(message);
      if (fallbackKeys.has(fallbackKey)) return;
      fallbackKeys.add(fallbackKey);
      nextMessages.push(message);
    });

  return nextMessages;
}

function compareChatMessages(a: ChatMessageGetDTO, b: ChatMessageGetDTO): number {
  return getChatMessageTime(a) - getChatMessageTime(b);
}

function compareChatPreviewMessages(a: ChatPreviewMessage, b: ChatPreviewMessage): number {
  return compareChatMessages(a, b);
}

function getChatMessageTime(chat: ChatMessageGetDTO): number {
  const time = new Date(chat.sentAt).getTime();
  return Number.isNaN(time) ? 0 : time;
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

function isUserNearBottom(element: HTMLElement, threshold = 80): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}
