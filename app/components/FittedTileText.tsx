"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type FittedTileTextProps = {
  text: string;
  maxFontSize?: number;
  minFontSize?: number;
};

const DEFAULT_MAX_FONT_SIZE = 11;
const DEFAULT_MIN_FONT_SIZE = 5;
const WIDTH_TOLERANCE_PX = 0.5;

export function FittedTileText({
  text,
  maxFontSize = DEFAULT_MAX_FONT_SIZE,
  minFontSize = DEFAULT_MIN_FONT_SIZE,
}: FittedTileTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const segments = getBreakableSegments(text);
    let isDisposed = false;
    let frame = 0;

    const getAvailableWidth = () => {
      const styles = window.getComputedStyle(container);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      return container.clientWidth - paddingLeft - paddingRight;
    };

    const getWidestSegmentWidth = (candidateFontSize: number) => {
      measure.style.fontSize = `${candidateFontSize}px`;

      return segments.reduce((widestWidth, segment) => {
        measure.textContent = segment;
        return Math.max(widestWidth, measure.scrollWidth);
      }, 0);
    };

    const fitFontSize = () => {
      const availableWidth = getAvailableWidth();
      if (availableWidth <= 0) return;

      let nextFontSize = maxFontSize;

      if (getWidestSegmentWidth(maxFontSize) > availableWidth + WIDTH_TOLERANCE_PX) {
        let low = minFontSize;
        let high = maxFontSize;

        for (let i = 0; i < 10; i += 1) {
          const middle = (low + high) / 2;

          if (getWidestSegmentWidth(middle) <= availableWidth + WIDTH_TOLERANCE_PX) {
            low = middle;
          } else {
            high = middle;
          }
        }

        nextFontSize = Math.max(minFontSize, Math.min(maxFontSize, low));
      }

      setFontSize((currentFontSize) =>
        Math.abs(currentFontSize - nextFontSize) < 0.05 ? currentFontSize : nextFontSize
      );
    };

    const scheduleFitFontSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitFontSize);
    };

    scheduleFitFontSize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", scheduleFitFontSize);
    } else {
      resizeObserver = new ResizeObserver(scheduleFitFontSize);
      resizeObserver.observe(container);
    }

    if (document.fonts) {
      void document.fonts.ready.then(() => {
        if (!isDisposed) scheduleFitFontSize();
      });
    }

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleFitFontSize);
      measure.textContent = "";
    };
  }, [maxFontSize, minFontSize, text]);

  const style = {
    "--tile-text-font-size": `${fontSize}px`,
  } as CSSProperties;

  return (
    <span ref={containerRef} className="tile-text" style={style}>
      <span className="tile-text-content">{renderHyphenBreaks(text)}</span>
      <span ref={measureRef} className="tile-text-measure" aria-hidden="true" />
    </span>
  );
}

function getBreakableSegments(text: string): string[] {
  const segments = text.trim().split(/[\s-]+/u).filter(Boolean);
  return segments.length > 0 ? segments : [text];
}

function renderHyphenBreaks(text: string) {
  return text.split(/(-)/u).map((part, index) =>
    part === "-" ? (
      <Fragment key={`${part}-${index}`}>
        -
        <wbr />
      </Fragment>
    ) : (
      part
    )
  );
}
