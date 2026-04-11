"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createLobbyClient } from "@/api/lobbyService";
import { useApi } from "@/hooks/useApi";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApplicationError } from "@/types/error";

export default function MenuPage() {
  const router = useRouter();
  const api = useApi();
  const { loaded, isAuthenticated, logout, token, userId, username } = useAuthSession();
  const [activeOverlay, setActiveOverlay] = useState<"join" | "rules" | null>(null);
  const [activeLobbyId, setActiveLobbyId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(
    null,
  );

  const lobbyClient = useMemo(() => createLobbyClient({
    api,
    token,
    userId,
  }), [api, token, userId]);

  useEffect(() => {
    if (!loaded) return;
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, loaded, router]);

  useEffect(() => {
    if (!loaded || !isAuthenticated) {
      return;
    }

    setActiveLobbyId(getStoredLobbyId(userId));
  }, [isAuthenticated, loaded, userId]);

  if (!loaded || !isAuthenticated) {
    return <div className="app-shell" />;
  }

  const avatarInitial = username.trim().charAt(0).toUpperCase() || "U";

  const handleCreateLobby = async (): Promise<void> => {
    setMenuMessage(null);
    setPendingAction("create");

    try {
      const createdLobby = await lobbyClient.createLobby();
      setStoredLobbyId(userId, createdLobby.lobbyId);
      setActiveLobbyId(createdLobby.lobbyId);
      router.push(`/lobbies/${createdLobby.lobbyId}`);
    } catch (error) {
      setMenuMessage(
        getLobbyErrorMessage(
          error,
          "Unable to create a lobby.",
          activeLobbyId !== "",
        ),
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleJoinLobby = async (): Promise<void> => {
    setMenuMessage(null);
    setPendingAction("join");

    try {
      const joinedLobby = await lobbyClient.joinLobby(joinCode);
      setStoredLobbyId(userId, joinedLobby.lobbyId);
      setActiveLobbyId(joinedLobby.lobbyId);
      setActiveOverlay(null);
      setJoinCode("");
      router.push(`/lobbies/${joinedLobby.lobbyId}`);
    } catch (error) {
      setMenuMessage(
        getLobbyErrorMessage(
          error,
          "Unable to join that lobby.",
          activeLobbyId !== "",
        ),
      );
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient menu-layout">
        <section className="menu-panel">
          <button
            type="button"
            className="menu-profile"
            onClick={() => router.push(`/users/${userId || "1"}`)}
          >
            <span className="menu-avatar">{avatarInitial}</span>
            <span className="menu-username">{username || "Username"}</span>
          </button>

          <div className="menu-main-actions">
            <button
              type="button"
              className="vq-button menu-main-btn"
              onClick={() => void handleCreateLobby()}
              disabled={pendingAction !== null}
            >
              {pendingAction === "create" ? "Creating Lobby..." : "Create Lobby"}
            </button>
            <button
              type="button"
              className="vq-button menu-main-btn"
              onClick={() => setActiveOverlay("join")}
            >
              Join Lobby
            </button>
            <button
              type="button"
              className="vq-button menu-main-btn"
              onClick={() => setActiveOverlay("rules")}
            >
              Game Rules
            </button>
          </div>
        </section>

        {menuMessage && (
          <section className="menu-status-card">
            <p className="menu-status-message is-error">{menuMessage}</p>
          </section>
        )}

        <section className={`menu-secondary-actions ${activeLobbyId ? "" : "is-single-item"}`}>
          {activeLobbyId && (
            <button
              type="button"
              className="vq-button menu-secondary-btn"
              onClick={() => router.push(`/lobbies/${activeLobbyId}`)}
            >
              Return to Lobby
            </button>
          )}
          <button
            type="button"
            className="vq-button menu-secondary-btn"
            onClick={() => {
              logout();
              router.replace("/");
            }}
          >
            Logout
          </button>
        </section>
      </main>

      {activeOverlay && (
        <div className="overlay-backdrop" role="dialog" aria-modal="true">
          <div className="overlay-card">
            {activeOverlay === "join" && (
              <>
                <h2 className="overlay-title">Join by Code</h2>
                <input
                  className="overlay-input"
                  placeholder="Enter join code"
                  value={joinCode}
                  maxLength={6}
                  onChange={(event) =>
                    setJoinCode(event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
                  }
                />
                <p className="overlay-text overlay-text-compact">
                  Ask the host for the 6-character join code.
                </p>
                <div className="overlay-actions">
                  <button
                    type="button"
                    className="vq-button"
                    onClick={() => {
                      setActiveOverlay(null);
                      setJoinCode("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="vq-button"
                    disabled={joinCode.trim().length < 6 || pendingAction !== null}
                    onClick={() => void handleJoinLobby()}
                  >
                    {pendingAction === "join" ? "Joining..." : "Join"}
                  </button>
                </div>
              </>
            )}

            {activeOverlay === "rules" && (
              <>
                <h2 className="overlay-title">Game Rules</h2>
                <p className="overlay-text">
                  Create or join a lobby, pick a team, mark yourself ready, and
                  the round starts automatically once everyone is ready.
                </p>
                <div className="overlay-actions overlay-actions-single">
                  <button
                    type="button"
                    className="vq-button"
                    onClick={() => setActiveOverlay(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getLobbyErrorMessage(
  error: unknown,
  fallback: string,
  hasStoredLobby: boolean,
): string {
  const applicationError = error as ApplicationError | undefined;

  if (applicationError?.status === 404) {
    return "That lobby could not be found. Double-check the join code.";
  }

  if (applicationError?.status === 409) {
    if (hasStoredLobby) {
      return "You already have an active lobby. Use Return to Lobby to continue.";
    }

    return applicationError.message;
  }

  if (applicationError instanceof Error && applicationError.message.trim() !== "") {
    return applicationError.message;
  }

  return fallback;
}

function getStoredLobbyId(userId: string): string {
  if (typeof window === "undefined" || userId.trim() === "") {
    return "";
  }

  return window.localStorage.getItem(`vq.activeLobbyId.${userId}`) ?? "";
}

function setStoredLobbyId(userId: string, lobbyId: string): void {
  if (
    typeof window === "undefined" ||
    userId.trim() === "" ||
    lobbyId.trim() === ""
  ) {
    return;
  }

  window.localStorage.setItem(`vq.activeLobbyId.${userId}`, lobbyId);
}
