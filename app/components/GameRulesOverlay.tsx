"use client";

import React, { useState, useRef, useEffect } from "react";
import { FittedTileText } from "@/components/FittedTileText";

export interface GameModeDTO {
  id: string;
  name: string;
  rules: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gameModes: GameModeDTO[];
}

export function GameRulesOverlay({ isOpen, onClose, gameModes }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !isOpen) return;

    const cards = Array.from(element.querySelectorAll(".rules-card"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = cards.indexOf(entry.target as Element);
            if (index !== -1) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: element,
        threshold: 0.6,
      }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [gameModes, isOpen]);

  const scrollToIndex = (i: number) => {
    const element = scrollRef.current;
    if (!element) return;

    const card = element.querySelectorAll(".rules-card")[i] as HTMLElement;
    if (!card) return;

    card.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="rules-content">
          <h2 className="overlay-title">Game Rules</h2>
          
          <div className="rules-section">
            <div className="rules-scroll-container" ref={scrollRef}>
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
            </div>
            {gameModes.length > 1 && (
              <div className="rules-dots">
                {gameModes.map((_, i) => (
                  <span
                    key={i}
                    className={`dot ${i === activeIndex ? "active" : ""}`}
                    onClick={() => scrollToIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rules-section">
            <h3 className="rules-subtitle">Tile Examples</h3>
            <div className="rules-tile-grid">
              <div className="rules-tile-item">
                <div className="bingo-field-button" style={{ pointerEvents: "none" }}>
                  <FittedTileText text="Tree" maxFontSize={10} />
                </div>
                <span>Unclaimed</span>
              </div>
              <div className="rules-tile-item">
                <div className="bingo-field-button is-processing-friendly is-analyzing" style={{ pointerEvents: "none" }}>
                  <div className="loader is-friendly"></div>
                </div>
                <span>In Validation</span>
              </div>
              <div className="rules-tile-item">
                <div className="bingo-field-button is-claimed is-claimed-friendly" style={{ pointerEvents: "none" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="claimed-icon-svg">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <span>Claimed Team 1</span>
              </div>
              <div className="rules-tile-item">
                <div className="bingo-field-button is-claimed is-claimed-enemy" style={{ pointerEvents: "none" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="claimed-icon-svg">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
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