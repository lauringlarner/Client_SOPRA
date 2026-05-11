"use client";

import React, { useState } from "react";
import { FittedTileText } from "@/components/FittedTileText";
import { useApi } from "@/hooks/useApi";

interface GameModeDTO {
  id: string;
  name: string;
  rules: string[];
}

interface Props {
  token: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GameRulesOverlay({ token, isOpen, onClose }: Props) {
  const api = useApi();
  const [gameModes, setGameModes] = useState<GameModeDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch only when opened and if we don't have data yet
  React.useEffect(() => {
    if (isOpen && gameModes.length === 0 && token) {
      setLoading(true);
      api.get<GameModeDTO[]>("/gameModes", token)
        .then(setGameModes)
        .catch(() => setError("Failed to load game modes."))
        .finally(() => setLoading(false));
    }
  }, [isOpen, token, api, gameModes.length]);

  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-content">
          <h2 className="overlay-title">Game Rules</h2>
          
          <div className="rules-section">
            <div className="rules-scroll-container">
              {loading ? (
                <p className="overlay-error-bubble">Loading rules...</p>
              ) : error ? (
                <p className="overlay-error-bubble">{error}</p>
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
                <div className="bingo-field-button" style={{ pointerEvents: 'none' }}>
                    <FittedTileText text="Tree" maxFontSize={10} />
                </div>
                <span>Unclaimed</span>
              </div>
              <div className="rules-tile-item">
                <div className="bingo-field-button is-processing-friendly is-analyzing" style={{ pointerEvents: 'none' }}>
                    <div className="loader is-friendly"></div>
                </div>
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
            <button type="button" className="btn-rules-confirm" onClick={onClose}>Got it!</button>
          </div>
        </div>
      </div>
    </div>
  );
}