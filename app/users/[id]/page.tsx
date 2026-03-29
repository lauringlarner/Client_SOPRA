"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function UserProfilePage() {
  const router = useRouter();
  // Destructure logout from your hook
  const { loaded, isAuthenticated, logout } = useAuthSession();
  const [activeOverlay, setActiveOverlay] = useState<"edit" | "stats" | null>(null);

  const [userData] = useState({
    username: "exampleusername",
    email: "example@email.com",
  });

  useEffect(() => {
    if (loaded && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, loaded, router]);

  const handleSaveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    // Basic logic check
    if (payload.newPassword && !payload.oldPassword) {
      alert("Please enter your current password to confirm changes.");
      return;
    }

    console.log("Sending Profile Package:", payload);

    try {
      // 1. In a real app, you'd await your API call here
      // await updateProfile(payload);

      // 2. Use the hook's logout method (clears token & userId)
      logout();

      // 3. Redirect to login
      router.replace("/login");
      
    } catch (error) {
      console.error("Update failed:", error);
      alert("Error saving profile. Please try again.");
    }
  };

  if (!loaded || !isAuthenticated) return <div className="app-shell" />;

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
            <label className="info-label">E-Mail</label>
            <div className="info-value">{userData.email}</div>
          </div>

          <div className="profile-actions-row">
            <button className="btn-profile-dark" onClick={() => setActiveOverlay("edit")}>
              Edit profile
            </button>
            <button className="btn-profile-dark" onClick={() => setActiveOverlay("stats")}>
              Show Stats
            </button>
          </div>
        </section>

        <section className="user-profile-nav-card">
          <button className="btn-profile-dark btn-profile-full" onClick={() => router.push("/menu")}>
            Back to Main Menue
          </button>
        </section>
      </main>

      {activeOverlay === "edit" && (
        <div className="overlay-backdrop" onClick={() => setActiveOverlay(null)}>
          <form 
            className="overlay-card" 
            onClick={(e) => e.stopPropagation()} 
            onSubmit={handleSaveProfile}
          >
            <h2 className="overlay-title">Edit Profile</h2>
            
            <div className="edit-form-stack">
              <div className="info-group">
                <label className="info-label" htmlFor="username">Change Username</label>
                <input 
                  id="username"
                  name="username" 
                  className="edit-input-field" 
                  defaultValue={userData.username}
                  required 
                />
              </div>

              <div className="info-group">
                <label className="info-label" htmlFor="oldPassword">Current Password</label>
                <input 
                  id="oldPassword"
                  name="oldPassword" 
                  type="password"
                  className="edit-input-field" 
                  placeholder="••••••••" 
                  required
                />
              </div>

              <div className="info-group">
                <label className="info-label" htmlFor="newPassword">New Password</label>
                <input 
                  id="newPassword"
                  name="newPassword" 
                  type="password"
                  className="edit-input-field" 
                  placeholder="••••••••" 
                />
              </div>
            </div>

            <div className="overlay-actions">
              <button type="button" className="vq-button" onClick={() => setActiveOverlay(null)}>
                Cancel
              </button>
              <button type="submit" className="vq-button" style={{ background: '#22313a' }}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {activeOverlay === "stats" && (
        <div className="overlay-backdrop" onClick={() => setActiveOverlay(null)}>
          <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="overlay-title">Your Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#22313a' }}>42</span>
                <span className="info-label" style={{ fontWeight: 600 }}>Games</span>
              </div>
              <div className="stat-card">
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#22313a' }}>12</span>
                <span className="info-label" style={{ fontWeight: 600 }}>Wins</span>
              </div>
            </div>
            <div className="overlay-actions overlay-actions-single">
              <button className="vq-button" onClick={() => setActiveOverlay(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}