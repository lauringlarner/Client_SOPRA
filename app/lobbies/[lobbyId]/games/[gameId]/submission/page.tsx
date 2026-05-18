"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createGameClient } from "@/api/gameService";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import { setStoredActiveLobbyId } from "@/utils/lobbySession";
import { setLastSubmissionWord } from "@/utils/submissionFeedback";
import { playCameraClick, successClick, errorClick } from "@/utils/sounds";
import { GameDetails, GameTileStatus } from "@/types/game";

const api = new ApiService();

function CameraContent() {
  const router = useRouter();
  const params = useParams<{ lobbyId: string; gameId: string }>();
  const searchParams = useSearchParams();
  const { loaded, isAuthenticated, token, userId } = useAuthSession();
  const lobbyId = params?.lobbyId as string;
  const gameId = params?.gameId as string;
  const tileWord = searchParams.get("tileWord");
  const gameClient = useMemo(() => createGameClient({ api, token }), [token]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  const [claimedOverlayMessage, setClaimedOverlayMessage] = useState<string | null>(null);
  const isRedirecting = useRef(false);

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Zoom Functionality ---
  const [zoomLevel, setZoomLevel] = useState(1);
  const touchStartDist = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleZoomChange = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(1, prev + delta), 4));
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY * -0.01;
    handleZoomChange(delta);
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      const dist = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      touchStartDist.current = dist;
      initialZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 2 && touchStartDist.current !== null) {
      if (event.cancelable) event.preventDefault();

      const currentDist = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );

      const zoomFactor = currentDist / touchStartDist.current;
      const nextZoom = Math.min(Math.max(1, initialZoomRef.current * zoomFactor), 4);
      setZoomLevel(nextZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  useEffect(() => {
    const element = videoRef.current;
    if (element) {
      element.addEventListener("wheel", handleWheel, { passive: false });
      element.addEventListener("touchstart", handleTouchStart, { passive: false });
      element.addEventListener("touchmove", handleTouchMove, { passive: false });
      element.addEventListener("touchend", handleTouchEnd);
      
      return () => {
        element.removeEventListener("wheel", handleWheel);
        element.removeEventListener("touchstart", handleTouchStart);
        element.removeEventListener("touchmove", handleTouchMove);
        element.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [videoRef.current, zoomLevel]);

  useEffect(() => {
    if (claimedOverlayMessage) {
      redirectTimerRef.current = setTimeout(() => {
        if (!isRedirecting.current) {
          isRedirecting.current = true;
          router.replace(`/lobbies/${lobbyId}/games/${gameId}`);
        }
      }, 2000);
    }
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [claimedOverlayMessage, lobbyId, gameId, router]);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }

    setStoredActiveLobbyId(userId, lobbyId);

    if (!capturedImage && !streamRef.current) {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        } catch (err) {
          console.error("Camera access error:", err);
          setSubmissionError("Failed to open camera. Please check permissions & then refresh page.");
        }
      })();
    }

    return () => stopCameraStream();
  }, [capturedImage, isAuthenticated, loaded, lobbyId, router, userId]);

  useEffect(() => {
    if (capturedImage) {
      setCountdown(15);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            void handleSubmit();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setCountdown(null);
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [capturedImage]);

  useEffect(() => {
    if (!loaded || !isAuthenticated || !gameId) return;

    const redirectToLeaderboard = () => {
      router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
    };

    const checkAndRedirect = async () => {
      try {
        const game = await gameClient.getGame(gameId) as GameDetails;
        if (game.status === "ENDED") {
          redirectToLeaderboard();
          return;
        }

        const isClaimed = game.tileGrid.some((row) =>
          row.some((tile) => tile.word === tileWord && isClaimedTileStatus(tile.status))
        );

        if (tileWord && isClaimed) {
          setClaimedOverlayMessage(`The tile "${tileWord}" has already been claimed.`);
        }
      } catch { /* network error */ }
    };

    void checkAndRedirect();
    const unsubscribe = gameClient.subscribeToGame(gameId, (details: GameDetails) => {
        if (details.status === "ENDED") redirectToLeaderboard();
      },
      () => {}, 
      (error) => {}
    );

    return () => unsubscribe();
  }, [gameClient, gameId, isAuthenticated, loaded, lobbyId, router, tileWord]);

  const handleCapture = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setIsImageLoaded(false);
      setCapturedImage(dataUrl);
    }
  };

  const handleSubmit = async () => {
    if (claimedOverlayMessage || isRedirecting.current) return;
    if (!capturedImage || !tileWord || !gameId) {
      setSubmissionError("Missing required submission data.");
      return;
    }

    playCameraClick();
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      stopCameraStream();
      const fetchRes = await fetch(capturedImage);
      const blob = await fetchRes.blob();

      const formData = new FormData();
      formData.append("image", blob, "submission.jpg");
      formData.append("object", tileWord);

      await api.post<void>(`/games/${gameId}/submission`, formData, token);

      successClick();
      setLastSubmissionWord(tileWord);
      router.replace(`/lobbies/${lobbyId}/games/${gameId}`);
    } catch (error) {
      if (isGameEndedError(error)) {
        router.replace(`/lobbies/${lobbyId}/games/${gameId}/leaderboard`);
        return;
      }
      errorClick();
      const errorMsg = getSubmissionErrorMessage(error);
      setSubmissionError(errorMsg);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    stopCameraStream();
    router.back();
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient camera-frame-layout">
        
        {claimedOverlayMessage && (
          <div className="custom-overlay-backdrop">
            <div className="custom-overlay-card">
              <h2 className="custom-overlay-title">Tile Unavailable</h2>
              <p className="custom-overlay-text">{claimedOverlayMessage}</p>
              <p className="custom-overlay-subtext">Redirecting to game screen...</p>
            </div>
          </div>
        )}

        <section className="camera-container">
          {tileWord && (
            <div className="camera-target-badge">
              <strong>Target: {tileWord}</strong>
            </div>
          )}

          {countdown !== null && (
            <div className="countdown-overlay">
              <span className="countdown-text">Sending in</span>
              <span className="countdown-number">{countdown}</span>
            </div>
          )}

          {submissionError && (
            <section className="lobby-card lobby-feedback-card is-error camera-feedback-card">
              <p className="lobby-feedback-text">{submissionError}</p>
            </section>
          )}

          {capturedImage ? (
            <>
              <img
                src={capturedImage}
                alt="Captured"
                className="camera-video-element"
                onLoad={() => setIsImageLoaded(true)}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: "transform 0.1s ease-out",
                }}
              />

              <div className="camera-actions-frame">
                <button
                  type="button"
                  className="camera-button-capture"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !capturedImage || !isImageLoaded}
                >
                  {isSubmitting ? "Uploading..." : "Submit"}
                </button>
                <button
                  type="button"
                  className="camera-button-cancel"
                  onClick={() => {
                    setCapturedImage(null);
                    setIsCameraReady(false);
                    setIsImageLoaded(false);
                  }}
                  disabled={isSubmitting}
                >
                  Discard
                </button>
              </div>
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-video-element"
                onLoadedMetadata={() => setIsCameraReady(true)}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: "transform 0.1s ease-out",
                  cursor: "pointer",
                  touchAction: "none" 
                }}
              />
              <div className="camera-actions-frame">
                <button
                  type="button"
                  className="camera-button-capture"
                  onClick={handleCapture}
                  disabled={!isCameraReady}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="button-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 5.5H3.814A2.31 2.31 0 0 0 2 7.814v8.372A2.31 2.31 0 0 0 3.814 18h16.372A2.31 2.31 0 0 0 22 16.186V7.814A2.31 2.31 0 0 0 20.186 5.5h-1.372a2.31 2.31 0 0 1-1.641-.675l-1.079-1.092A2.31 2.31 0 0 0 14.656 3.5H9.344a2.31 2.31 0 0 0-1.641.675l-1.076 1.092Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 11.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
                  </svg>
                  Capture
                </button>
                <button
                  type="button"
                  className="camera-button-cancel"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="app-shell" />}>
      <CameraContent />
    </Suspense>
  );
}

function getSubmissionErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "The submission could not be sent. Please try again.";
}

function isClaimedTileStatus(status: GameTileStatus): boolean {
  return status === "CLAIMED_TEAM1" || status === "CLAIMED_TEAM2";
}

function isGameEndedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === 409
  );
}
