"use client";

import React from "react";

interface StatsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  gamesPlayed: number;
  gamesWon: number;
}

export default function StatsOverlay({
  isOpen,
  onClose,
  gamesPlayed,
  gamesWon,
}: StatsOverlayProps) {
  if (!isOpen) return null;

  // Calculate win rate safely
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="overlay-title">Statistics</h2>
        
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{gamesPlayed}</span>
            <span className="info-label">Games</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{gamesWon}</span>
            <span className="info-label">Wins</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{winRate}%</span>
            <span className="info-label">Winrate</span>
          </div>
        </div>

        <div className="overlay-actions-single">
          <button type="button" className="btn-rules-confirm" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}