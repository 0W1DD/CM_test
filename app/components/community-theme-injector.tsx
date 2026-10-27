import { useEffect, useRef } from "react";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { buildThemeCss } from "~/lib/theme";

const STYLE_ID = "community-theme";
// The site owner's own look (naru/modules/look.ts writes the same ids into
// each page's head): their /_owner/ stylesheet, then 사용자 CSS, last.
const OWNER_FILE_ID = "owner-file";
const OWNER_CSS_ID = "community-owner-css";
const OWNER_SCRIPT_ID = "owner-script";
const TRANSITION_CLASS = "theme-transitioning";
const TRANSITION_MS = 450;

export function CommunityThemeInjector() {
  const { themeKeyColor, lookLoaded } = useCurrentInstance();
  // What the page's head already has (naru/modules/look.ts).
  const lastAppliedRef = useRef<string | null>(
    typeof document === "undefined"
      ? null
      : (document.getElementById(STYLE_ID)?.textContent ?? null),
  );

  useEffect(() => {
    // Until the community is known, the head's theme stands.
    if (typeof document === "undefined" || !lookLoaded) return;

    const css = buildThemeCss(themeKeyColor);
    const existing = document.getElementById(
      STYLE_ID,
    ) as HTMLStyleElement | null;
    const previous = lastAppliedRef.current;
    const next = css || null;

    if (previous === next) return;

    if (!css) {
      if (existing) existing.remove();
    } else {
      if (existing) {
        existing.textContent = css;
      } else {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = css;
        // Before the site owner's own CSS, which keeps the last word.
        document.head.insertBefore(
          style,
          document.getElementById(OWNER_FILE_ID) ??
            document.getElementById(OWNER_CSS_ID),
        );
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
  }, [themeKeyColor, lookLoaded]);

  return null;
}

/**
 * The site owner's own look: their /_owner/style.css and 사용자 CSS after
 * the app's and the theme's, and their /_owner/script.js once the app is up.
 * The page's head already has the styles (naru/routes.ts); this keeps them
 * as the community's settings change, and touches nothing until they load.
 */
export function CommunityOwnerLook() {
  const { customCss, ownerFiles, lookLoaded } = useCurrentInstance();

  useEffect(() => {
    if (!lookLoaded || typeof document === "undefined") return;
    const file = document.getElementById(OWNER_FILE_ID);
    if (ownerFiles && !file) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.id = OWNER_FILE_ID;
      link.href = "/_owner/style.css";
      document.head.appendChild(link);
    } else if (!ownerFiles) file?.remove();
    let own = document.getElementById(OWNER_CSS_ID);
    if (customCss) {
      if (!own) {
        own = document.createElement("style");
        own.id = OWNER_CSS_ID;
      }
      own.textContent = customCss;
      // Last in <head>, so it has the last word.
      document.head.appendChild(own);
    } else own?.remove();
    if (ownerFiles && !document.getElementById(OWNER_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.type = "module";
      script.id = OWNER_SCRIPT_ID;
      script.src = "/_owner/script.js";
      document.body.appendChild(script);
    }
  }, [lookLoaded, customCss, ownerFiles]);

  return null;
}
