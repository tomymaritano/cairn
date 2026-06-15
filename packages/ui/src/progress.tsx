"use client";

import { useFlow } from "cairn-react";
import type { CSSProperties } from "react";

export interface CairnProgressProps {
  /** Show the "N / total" count. Default true. */
  showCount?: boolean;
  /** Show the dot indicators. Default true. */
  showDots?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A tiny progress indicator for the active flow — "step N / total" plus a row
 * of dots (the current one highlighted). Reads `stepIndex` / `totalSteps` from
 * the flow; renders nothing when no step is active. Style via the
 * `data-cairn-progress*` attributes / `className`, or the `--cairn-dot*` vars.
 */
export function CairnProgress({
  showCount = true,
  showDots = true,
  className,
  style,
}: CairnProgressProps) {
  const { state } = useFlow();
  if (state.status !== "active" || state.currentStepId == null) return null;

  const { stepIndex, totalSteps } = state;
  return (
    <div
      data-cairn-progress=""
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}
    >
      {showCount && (
        <span data-cairn-progress-count="" style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
          {stepIndex + 1} / {totalSteps}
        </span>
      )}
      {showDots && (
        <span style={{ display: "inline-flex", gap: 4 }} aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              data-cairn-dot={i === stepIndex ? "active" : ""}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background:
                  i === stepIndex
                    ? "var(--cairn-dot-active, #4f46e5)"
                    : "var(--cairn-dot, #d1d5db)",
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}
