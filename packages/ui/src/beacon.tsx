"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useFlow } from "cairn-react";
import { useElementRect, usePrefersReducedMotion, useTargetElement } from "./use-target.js";
import type { CSSProperties } from "react";

export interface CairnBeaconProps {
  /** What clicking the beacon does. Defaults to advancing the flow (`next`). */
  onActivate?: () => void;
  /** Beacon diameter in px. Default 14. */
  size?: number;
  /** Beacon color. Default indigo. */
  color?: string;
  className?: string;
  style?: CSSProperties;
}

const KEYFRAMES_ID = "cairn-beacon-keyframes";
const KEYFRAMES = `@keyframes cairn-beacon-pulse {
  0% { box-shadow: 0 0 0 0 var(--cairn-beacon-ring, rgba(79,70,229,0.5)); }
  70% { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}`;

/** Inject the pulse keyframes once (self-contained; no CSS import required). */
function usePulseKeyframes(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    if (document.getElementById(KEYFRAMES_ID)) return;
    const el = document.createElement("style");
    el.id = KEYFRAMES_ID;
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
  }, [enabled]);
}

/**
 * A pulsing "hotspot" anchored to the current step's target — the click-to-start
 * affordance from Appcues/Intro.js. It's a real `<button>` with an accessible
 * name; clicking it advances the flow (or runs `onActivate`). Pulse is disabled
 * under `prefers-reduced-motion`.
 */
export function CairnBeacon({
  onActivate,
  size = 14,
  color = "#4f46e5",
  className,
  style,
}: CairnBeaconProps) {
  const { state, next } = useFlow();
  const step = state.currentStep;
  const target = useTargetElement(step?.meta?.["target"] as string | undefined);
  const rect = useElementRect(target);
  const reducedMotion = usePrefersReducedMotion();
  usePulseKeyframes(!reducedMotion);

  if (!rect || typeof document === "undefined") return null;

  const title = step?.meta?.["title"];
  return createPortal(
    <button
      type="button"
      data-cairn-beacon=""
      aria-label={typeof title === "string" ? `Continue: ${title}` : "Continue the tour"}
      onClick={() => (onActivate ? onActivate() : next())}
      className={className}
      style={{
        position: "fixed",
        top: rect.top - size / 2,
        left: rect.right - size / 2,
        width: size,
        height: size,
        padding: 0,
        borderRadius: "50%",
        border: "none",
        background: color,
        cursor: "pointer",
        zIndex: 9999,
        animation: reducedMotion ? "none" : "cairn-beacon-pulse 1.5s infinite",
        ...style,
      }}
    />,
    document.body,
  );
}
