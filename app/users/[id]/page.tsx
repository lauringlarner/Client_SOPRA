"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";

const api = new ApiService();

// Simplified: Only include what we actually use in the UI
interface User {
  id: string;
  username: string;
  status: string;
  gamesPlayed: number;
  gamesWon: number;
}

export default function UserProfilePage() {
  const router = useRouter();
  const { loaded, isAuthenticated, logout, userId, token } = useAuthSession();
  
  const [activeOverlay, setActiveOverlay] = useState<"edit" | "stats" | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const data = await api.get<User>(`/users/${userId}`, token);
      setUserData(data);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    }
  }, [userId, token]);

  useEffect(() => {
    if (loaded && !isAuthenticated) {
      router.replace("/");
    } else if (isAuthenticated) {
      fetchUserData();
    }
  }, [isAuthenticated, loaded, router, fetchUserData]);

  const handleSavePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    
    const formData = new FormData(event.currentTarget);
    const oldPassword = formData.get("oldPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    // 1. Instant check: Are they the same?
    if (oldPassword === newPassword) {
      setError("New password cannot be the same as the current one.");
      setIsSubmitting(false);
      return;
    }

    try {
      // 2. Call PUT /users/{id}/password
      await api.put(`/users/${userId}/password`, {
        oldPassword,
        newPassword
      }, token);

      setSuccess("Password updated successfully! Logging out...");

      setTimeout(() => {
        logout();
        router.replace("/");
      }, 2000);
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error updating password. Please try again.");
      }
      setIsSubmitting(false);
    }
  };

  const winRate = userData && userData.gamesPlayed > 0 
    ? Math.round((userData.gamesWon / userData.gamesPlayed) * 100) 
    : 0;

  if (!loaded || !isAuthenticated || !userData) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient user-profile-container">
        <h1 className="user-profile-title">Your Profile</h1>

        <section className="user-profile-card">
          <div className="info-group">
            <label className="info-label">Username</label>
            <div className="info-value">{userData.username}</div>
          </div>
          <div className="info-group">
            <label className="info-label">Status</label>
            <div className="info-value" style={{ textTransform: 'capitalize' }}>
              {userData.status.toLowerCase()}
            </div>
          </div>
          <div className="profile-actions-row">
            <button type="button" className="btn-profile-dark" onClick={() => { setError(""); setSuccess(""); setActiveOverlay("edit"); }}>
              Change Password
            </button>
            <button type="button" className="btn-profile-dark" onClick={() => setActiveOverlay("stats")}>
              Show Stats
            </button>
          </div>
        </section>

        <section className="user-profile-nav-card">
          <button type="button" className="btn-profile-dark btn-profile-full" onClick={() => router.push("/menu")}>
            Back to Main Menu
          </button>
          <button
            type="button"
            className="btn-profile-dark btn-profile-full"
            style={{ marginTop: '10px', color: '#ff6b6b' }}
            onClick={() => {
              logout();
              router.replace("/");
            }}
          >
            Logout
          </button>
        </section>
      </main>

      {activeOverlay === "edit" && (
        <div className="overlay-backdrop" onClick={() => !isSubmitting && setActiveOverlay(null)}>
          <form className="overlay-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSavePassword}>
            <h2 className="overlay-title">Update Password</h2>
            
            {error && <div className="error-template">{error}</div>}
            {success && <div className="success-template">{success}</div>}

            <div className="edit-form-stack">
              <div className="info-group">
                <label className="info-label" htmlFor="oldPassword">Current Password</label>
                <input id="oldPassword" name="oldPassword" type="password" className="edit-input-field" placeholder="••••••••" required disabled={isSubmitting || !!success} />
              </div>
              <div className="info-group">
                <label className="info-label" htmlFor="newPassword">New Password</label>
                <input id="newPassword" name="newPassword" type="password" className="edit-input-field" placeholder="••••••••" required disabled={isSubmitting || !!success} />
              </div>
            </div>

            <div className="overlay-actions">
              <button type="button" className="vq-button" onClick={() => setActiveOverlay(null)} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="vq-button" style={{ background: '#22313a' }} disabled={isSubmitting || !!success}>
                {isSubmitting ? "Updating..." : "Update"}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeOverlay === "stats" && (
        <div className="overlay-backdrop" onClick={() => setActiveOverlay(null)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="overlay-title">Your Statistics</h2>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div className="stat-card">
                <span className="stat-value">{userData.gamesPlayed}</span>
                <span className="info-label">Games</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{userData.gamesWon}</span>
                <span className="info-label">Wins</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{winRate}%</span>
                <span className="info-label">Rate</span>
              </div>
            </div>
            <div className="overlay-actions overlay-actions-single">
              <button type="button" className="vq-button" onClick={() => setActiveOverlay(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
