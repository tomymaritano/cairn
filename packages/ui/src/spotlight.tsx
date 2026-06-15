"use client";

import { createPortal } from "react-dom";
import { useFlow } from "cairn-react";
import { useElementRect, usePrefersReducedMotion, useTargetElement } from "./use-target.js";
import type { CSSProperties } from "react";

export interface CairnSpotlightProps {
  /** Space (px) between the target and the highlight edge. Default 8. */
  padding?: number;
  /** Corner radius (px) of the highlight. Default 8. */
  radius?: number;
  /** Color of the dimmed area outside the highlight. */
  overlayColor?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Dims the page and cuts a hole around the current step's target element
 * (read from `step.meta.target`). Renders nothing when no step is active or
 * the target isn't on screen. Purely presentational and `aria-hidden` — the
 * accessible content lives in the popover.
 *
 * The "hole" is the classic huge-spread `box-shadow` trick: one element, no
 * SVG masks, GPU-friendly.
 */
export function CairnSpotlight({
  padding = 8,
  radius = 8,
  overlayColor = "rgba(0, 0, 0, 0.5)",
  className,
  style,
}: CairnSpotlightProps) {
  const { state } = useFlow();
  const selector = state.currentStep?.meta?.["target"] as string | undefined;
  const target = useTargetElement(selector);
  const rect = useElementRect(target);
  const reducedMotion = usePrefersReducedMotion();

  if (!rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden="true"
      data-cairn-spotlight=""
      className={className}
      style={{
        position: "fixed",
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: radius,
        boxShadow: `0 0 0 9999px ${overlayColor}`,
        pointerEvents: "none",
        transition: reducedMotion ? "none" : "all 0.2s ease",
        zIndex: 9998,
        ...style,
      }}
    />,
    document.body,
  );
}
