"use client";

import { useRef } from "react";
import {
  FloatingArrow,
  FloatingFocusManager,
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";
import { useFlow, type StepDefinition } from "@cairn/react";
import { useTargetElement } from "./use-target.js";
import type { CSSProperties, ReactNode } from "react";

export interface CairnPopoverProps {
  /**
   * Popover content. Either a node, or a render function that receives the
   * current step so you can read `step.meta` (title, body, …).
   */
  children: ReactNode | ((step: StepDefinition) => ReactNode);
  /** Fallback placement; overridden per-step by `step.meta.placement`. */
  placement?: Placement;
  /** Trap focus inside the popover while it's open. Default true. */
  trapFocus?: boolean;
  /** Dismiss the flow when the user clicks outside / presses Escape. Default true. */
  dismissOnInteractOutside?: boolean;
  /** Show a pointer arrow toward the target. Default true. */
  showArrow?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * An accessible popover anchored to the current step's target element. Handles
 * the hard parts so you don't have to:
 *
 * - **Positioning** via Floating UI — `flip`/`shift` keep it on screen,
 *   `autoUpdate` follows the target through scroll/resize.
 * - **Accessibility** — `role="dialog"`, focus moves in on open and returns on
 *   close, Escape dismisses.
 *
 * You own the content and styling; Cairn owns the behaviour.
 */
export function CairnPopover({
  children,
  placement = "bottom",
  trapFocus = true,
  dismissOnInteractOutside = true,
  showArrow = true,
  className,
  style,
}: CairnPopoverProps) {
  const { state, dismiss } = useFlow();
  const step = state.currentStep;
  const open = state.status === "active" && step != null;

  const selector = step?.meta?.["target"] as string | undefined;
  const target = useTargetElement(selector);
  const arrowRef = useRef<SVGSVGElement>(null);

  const stepPlacement = (step?.meta?.["placement"] as Placement | undefined) ?? placement;

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next && dismissOnInteractOutside) dismiss();
    },
    placement: stepPlacement,
    middleware: [offset(10), flip(), shift({ padding: 8 }), arrow({ element: arrowRef })],
    whileElementsMounted: autoUpdate,
    elements: { reference: target },
  });

  const dismissInteraction = useDismiss(context, { enabled: dismissOnInteractOutside });
  const role = useRole(context, { role: "dialog" });
  const { getFloatingProps } = useInteractions([dismissInteraction, role]);

  if (!open || !target) return null;

  const title = step?.meta?.["title"];
  const content = typeof children === "function" ? children(step!) : children;

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} modal={false} disabled={!trapFocus}>
        <div
          ref={refs.setFloating}
          style={{ zIndex: 9999, ...floatingStyles, ...style }}
          className={className}
          data-cairn-popover=""
          data-step={step!.id}
          aria-label={typeof title === "string" ? title : undefined}
          {...getFloatingProps()}
        >
          {content}
          {showArrow && (
            <FloatingArrow ref={arrowRef} context={context} data-cairn-arrow="" />
          )}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
