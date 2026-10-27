import { useEffect, useRef } from "react";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { buildThemeCss } from "~/lib/theme";

const STYLE_ID = "community-theme";
const TRANSITION_CLASS = "theme-transitioning";
const TRANSITION_MS = 450;
const CACHE_KEY_PREFIX = "community-theme-css:";

function cacheKey(): string | null {
  if (typeof window === "undefined") return null;
  return `${CACHE_KEY_PREFIX}${window.location.hostname}`;
}

export function CommunityThemeInjector() {
  const { themeKeyColor } = useCurrentInstance();
  const lastAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const css = buildThemeCss(themeKeyColor);
    const existing = document.getElementById(
      STYLE_ID,
    ) as HTMLStyleElement | null;
    const previous = lastAppliedRef.current;
    const next = css || null;

    if (previous === next) return;

    const key = cacheKey();

    if (!css) {
      if (existing) existing.remove();
      if (key) {
        try {
          window.localStorage.removeItem(key);
        } catch {}
      }
    } else {
      if (existing) {
        existing.textContent = css;
      } else {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = css;
        document.head.appendChild(style);
      }
      if (key) {
        try {
          window.localStorage.setItem(key, css);
        } catch {}
      }
    }

    const root = document.documentElement;
    root.classList.add(TRANSITION_CLASS);
    const timer = window.setTimeout(() => {
      root.classList.remove(TRANSITION_CLASS);
    }, TRANSITION_MS);

    lastAppliedRef.current = next;

    return () => {
      window.clearTimeout(timer);
    };
  }, [themeKeyColor]);

  return null;
}
