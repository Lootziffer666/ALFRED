"use client";

import { useCallback, useRef } from "react";

/**
 * Imperative DOM particle burst (matches the prototype's `burstDust`) — kept
 * outside React state on purpose since it's fire-and-forget visual flair
 * with no bearing on any evidence/report logic.
 */
export function useDustBurst() {
  const containerRef = useRef<HTMLDivElement>(null);

  const burst = useCallback((originEl: HTMLElement) => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const originRect = originEl.getBoundingClientRect();
    const cx = originRect.left - containerRect.left + originRect.width / 2;
    const cy = originRect.top - containerRect.top + originRect.height / 2;

    for (let i = 0; i < 7; i++) {
      const speck = document.createElement("i");
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 26;
      speck.style.left = `${cx}px`;
      speck.style.top = `${cy}px`;
      speck.style.transition = "transform .7s ease-out, opacity .7s";
      container.appendChild(speck);
      requestAnimationFrame(() => {
        speck.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist - 12}px)`;
        speck.style.opacity = "0.7";
      });
      setTimeout(() => {
        speck.style.opacity = "0";
        setTimeout(() => speck.remove(), 400);
      }, 30);
    }
  }, []);

  return { containerRef, burst };
}
