"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { ApiService } from "@/api/apiService";
import StatsOverlay from "@/components/StatsOverlay"; // Adjust import path as needed

const api = new ApiService();

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
 const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Visibility states for the password inputs
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const closeOverlay = () => {
    if (isSubmitting || isLoggingOut) return;
    setActiveOverlay(null);
    setError("");
    setShowOldPassword(false);
    setShowNewPassword(false);
  };

  const handleSavePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    
    const formData = new FormData(event.currentTarget);
    const oldPassword = formData.get("oldPassword") as string;
    const newPassword = formData.get("newPassword") as string;

    if (oldPassword === newPassword) {
      setError("New password cannot be the same as the current one.");
      setIsSubmitting(false);
      return;
    }

    try {
      await api.put(`/users/${userId}/password`, { oldPassword, newPassword }, token);
            // Close the password modal layout but keep backdrop active for visual transition
      setActiveOverlay(null);
      // Trigger the specialized loading backdrop view
      setIsLoggingOut(true);
      setTimeout(() => {
        logout();
        router.replace("/");
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error updating password.");
      setIsSubmitting(false);
    }
  };

  if (!loaded || !isAuthenticated || !userData) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <main className="phone-frame screen-gradient ">
        <h1 className="user-profile-title">Your Profile</h1>

        <section className="user-profile-card">
          <div className="info-group">
            <label className="info-label">Username:</label>
            <div className="info-value">{userData.username}</div>
          </div>
          <div className="info-group">
            <label className="info-label">Status:</label>
            <div className="info-value status-text">
              {userData.status.toLowerCase()}
            </div>
          </div>
          
          <div className="profile-actions-row">
            <button type="button" className="vq-button btn-confirm" onClick={() => setActiveOverlay("edit")}>
              Password
            </button>
            <button type="button" className="vq-button btn-confirm" onClick={() => setActiveOverlay("stats")}>
              Stats
            </button>
          </div>
        </section>

        <section className="user-profile-nav-card">
          <button type="button" className="vq-button btn-confirm" onClick={() => router.push("/menu")}>
            Back to Menu
          </button>
          <button
            type="button"
            className="vq-button menu-secondary-btn logout"
            onClick={() => { logout(); router.replace("/"); }}
          >
            Logout
          </button>
        </section>
      </main>

      {/* PASSWORD OVERLAY */}
      {activeOverlay === "edit" && (
        <div className="overlay-backdrop" onClick={closeOverlay}>
          <form className="overlay-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSavePassword} noValidate>
            <h2 className="overlay-title">Update Password</h2>
            {error && <div className="error-template">{error}</div>}
            
            
            <div className="edit-form-stack">
              {/* Current Password */}
              <div className="info-group">
                <label className="info-label" htmlFor="oldPassword">Current Password</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input 
                    id="oldPassword" 
                    name="oldPassword" 
                    type={showOldPassword ? "text" : "password"} 
                    className="edit-input-field" 
                    placeholder="Enter current password" 
                    required 
                    disabled={isSubmitting} 
                    style={{ paddingRight: "3.5rem", width: "100%" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    disabled={isSubmitting}
                    aria-label={showOldPassword ? "Hide current password" : "Show current password"}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      background: "transparent",
                      border: "none",
                       cursor: isSubmitting ? "not-allowed" : "pointer",
                      color: "#000000",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {showOldPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="info-group">
                <label className="info-label" htmlFor="newPassword">New Password</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input 
                    id="newPassword" 
                    name="newPassword" 
                    type={showNewPassword ? "text" : "password"} 
                    className="edit-input-field" 
                    placeholder="Enter new password" 
                    required 
                    disabled={isSubmitting} 
                    style={{ paddingRight: "3.5rem", width: "100%" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={isSubmitting} 
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      background: "transparent",
                      border: "none",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      color: "#000000",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {showNewPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="overlay-actions">
              <button type="button" className="vq-button btn-cancel" onClick={closeOverlay} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="vq-button btn-confirm" disabled={isSubmitting}>
                {isSubmitting ? "..." : "Update"}
              </button>
            </div>
          </form>
        </div>
      )}

            {/* DISCONNECT / REDIRECT LOADING OVERLAY */}
      {isLoggingOut && (
          <div className="guard-backdrop">
            <div className="guard-panel">
              <h2 className="guard-title" style={{color: "#2ecc71"}}>Password Updated!</h2>
              <p className="guard-description">
              You will now be logged out.
              </p>
              <div className="guard-loader-container">
                <div className="guard-loader"></div>
              </div>
            </div>
          </div>
      )}


      {/* REUSABLE STATS OVERLAY COMPONENT */}
      <StatsOverlay 
        isOpen={activeOverlay === "stats"}
        onClose={closeOverlay}
        gamesPlayed={userData.gamesPlayed}
        gamesWon={userData.gamesWon}
      />
    </div>
  );
}