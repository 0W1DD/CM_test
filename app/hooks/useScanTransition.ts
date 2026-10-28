import { type RefObject, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";

const DURATION = 480;
const EASING = "cubic-bezier(.4,0,.2,1)";

/**
 * On moving to another page, a line in the accent colour sweeps down the
 * visible part of `target` and reveals the new page behind it. A cover in
 * the page's own colour sits below the line and shrinks as it goes, so the
 * element's own clip-path (the cut corner) is left alone. Skipped for those
 * who ask for less motion.
 */
export function useScanTransition(target: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  const first = useRef(true);

  // Before paint, so the new page never shows uncovered for a frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per page change.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const element = target.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = element.getBoundingClientRect();
    const top = Math.max(rect.top, 0);
    const bottom = Math.min(rect.bottom, window.innerHeight);
    if (bottom <= top) return;

    const cover = document.createElement("div");
    cover.className = "scan-cover";
    Object.assign(cover.style, {
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      top: `${top}px`,
      height: `${bottom - top}px`,
      background: getComputedStyle(element).backgroundColor,
    });
    document.body.appendChild(cover);

    const height = bottom - top;
    const animation = cover.animate(
      [
        { transform: "translateY(0)", height: `${height}px` },
        { transform: `translateY(${height}px)`, height: "0px" },
      ],
      { duration: DURATION, easing: EASING, fill: "forwards" },
    );
    animation.finished.finally(() => cover.remove());
    return () => {
      animation.cancel();
      cover.remove();
    };
  }, [pathname]);
}
