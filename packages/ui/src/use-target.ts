"use client";

import { useEffect, useState } from "react";

/**
 * Resolves a CSS selector to a live DOM element and keeps it current as the
 * DOM changes. A `MutationObserver` handles targets that mount *later* — the
 * key to multi-page flows, where the next step's element may not exist until
 * the user navigates.
 */
export function useTargetElement(
  selector: string | null | undefined,
): HTMLElement | null {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!selector || typeof document === "undefined") {
      setElement(null);
      return;
    }

    const find = () => document.querySelector<HTMLElement>(selector);
    let current = find();
    setElement(current);

    const observer = new MutationObserver(() => {
      const next = find();
      if (next !== current) {
        current = next;
        setElement(next);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selector]);

  return element;
}

/**
 * Tracks an element's viewport rectangle, re-measuring on resize and scroll
 * (capture phase, so nested scroll containers count too). Returns `null` when
 * there's no element. Used to position the spotlight cut-out.
 */
export function useElementRect(element: HTMLElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!element) {
      setRect(null);
      return;
    }

    // Initial measure is synchronous (no first-paint flash); event-driven
    // updates are coalesced into a single rAF to avoid thrashing on scroll.
    const measure = () => setRect(element.getBoundingClientRect());
    measure();

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [element]);

  return rect;
}
