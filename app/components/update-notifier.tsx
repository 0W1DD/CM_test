import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Tells people with the site open when a newer version has been deployed,
 * with a button to reload into it.
 *
 * Every build names its route manifest after a hash of the app
 * (`/assets/manifest-<hash>.js`), and `/index.html` is served as a plain
 * file, not through the app's routes. So the version this tab runs is the
 * hash in `window.__reactRouterManifest`, and the deployed one is the hash
 * that `/index.html` links to now: when they differ, the site was updated.
 */

const CHECK_EVERY_MS = 60_000;
const TOAST_ID = "site-update";

declare global {
  interface Window {
    __reactRouterManifest?: { version?: string };
  }
}

function runningVersion(): string | null {
  const fromManifest = window.__reactRouterManifest?.version;
  if (fromManifest) return fromManifest;
  const link = document.querySelector<HTMLLinkElement>(
    'link[href*="/assets/manifest-"], script[src*="/assets/manifest-"]',
  );
  const href = link?.getAttribute("href") ?? link?.getAttribute("src") ?? "";
  return href.match(/manifest-([0-9a-zA-Z]+)\.js/)?.[1] ?? null;
}

async function deployedVersion(): Promise<string | null> {
  const response = await fetch(`/index.html?v=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const html = await response.text();
  return html.match(/\/assets\/manifest-([0-9a-zA-Z]+)\.js/)?.[1] ?? null;
}

export function UpdateNotifier() {
  useEffect(() => {
    const current = runningVersion();
    if (!current) return;

    let shown = false;
    let checking = false;

    async function check() {
      if (shown || checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const latest = await deployedVersion();
        if (latest && latest !== current) {
          shown = true;
          toast("사이트가 업데이트되었어요", {
            id: TOAST_ID,
            description: "새로고침하면 새 버전을 쓸 수 있어요.",
            duration: Number.POSITIVE_INFINITY,
            action: {
              label: "새로고침",
              onClick: () => window.location.reload(),
            },
          });
        }
      } catch {
        // Offline or a hiccup: try again on the next tick.
      } finally {
        checking = false;
      }
    }

    const timer = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  return null;
}
