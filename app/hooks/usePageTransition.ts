import { type RefObject, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";

const STRIPS = 8;
const STAGGER = 35;
const SWEEP = 300;
const HOLD = 220;
const EASING = "cubic-bezier(.7,0,.2,1)";
const TOTAL = SWEEP + STRIPS * STAGGER + HOLD + SWEEP + STRIPS * STAGGER;

// The strips' colours, top to bottom; the first carries the page's name.
const COLOURS = [
  "var(--accent-color)",
  "var(--theme)",
  "var(--ground-raised)",
  "var(--accent-color)",
  "var(--ground-sunk)",
  "var(--theme)",
  "var(--accent-color)",
  "var(--ground-raised)",
];

// The menu's names for its pages, so the first strip can say where you are.
const PAGE_NAMES: [string, string][] = [
  ["/notifications", "알림"],
  ["/messages", "메시지"],
  ["/group-chats", "메시지"],
  ["/announcements", "공지사항"],
  ["/boards", "게시판"],
  ["/shop", "상점"],
  ["/bookmarks", "북마크"],
  ["/search", "검색"],
  ["/profiles", "멤버"],
  ["/settings", "설정"],
  ["/admin", "커뮤 관리"],
];

function pageName(pathname: string) {
  if (pathname === "/") return "홈";
  return (
    PAGE_NAMES.find(
      ([path]) => pathname === path || pathname.startsWith(`${path}/`),
    )?.[1] ?? ""
  );
}

function today() {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())}`;
}

/**
 * On moving to another page, coloured strips pour in over the visible part
 * of `target` one after another, the top one carrying the page's name and
 * the date, then leave the other way and show the new page. A blank in the
 * page's colour hides the new page until the strips cover it. Skipped for
 * those who ask for less motion.
 */
export function usePageTransition(target: RefObject<HTMLElement | null>) {
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

    const layer = document.createElement("div");
    layer.className = "page-blinds";
    Object.assign(layer.style, {
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      top: `${top}px`,
      height: `${bottom - top}px`,
    });
    const blank = document.createElement("div");
    blank.className = "page-blinds-blank";
    blank.style.background = getComputedStyle(element).backgroundColor;
    layer.appendChild(blank);

    const strips = COLOURS.map((colour, index) => {
      const strip = document.createElement("div");
      strip.className = "page-blinds-strip";
      Object.assign(strip.style, {
        top: `${(index * 100) / STRIPS}%`,
        height: `calc(${100 / STRIPS}% + 1px)`,
        background: colour,
      });
      layer.appendChild(strip);
      return strip;
    });
    const name = pageName(pathname);
    if (name) {
      const title = document.createElement("span");
      title.className = "page-blinds-title";
      title.textContent = name;
      const date = document.createElement("span");
      date.className = "page-blinds-date";
      date.textContent = today();
      strips[0]?.append(title, date);
      title.animate(
        [
          { transform: "translateX(-60px)", opacity: 0 },
          { transform: "translateX(0)", opacity: 1 },
        ],
        {
          duration: 420,
          delay: 120,
          easing: "cubic-bezier(.2,.9,.3,1.2)",
          fill: "backwards",
        },
      );
    }
    document.body.appendChild(layer);

    const animations = strips.flatMap((strip, index) => [
      strip.animate(
        [{ transform: "translateX(-102%)" }, { transform: "translateX(0)" }],
        {
          duration: SWEEP,
          delay: index * STAGGER,
          easing: EASING,
          fill: "backwards",
        },
      ),
      strip.animate(
        [{ transform: "translateX(0)" }, { transform: "translateX(102%)" }],
        {
          duration: SWEEP,
          delay:
            SWEEP + STRIPS * STAGGER + HOLD + (STRIPS - 1 - index) * STAGGER,
          easing: EASING,
          fill: "forwards",
        },
      ),
    ]);
    // The blank goes once every strip is in, so only the strips are left
    // to uncover the new page.
    const reveal = window.setTimeout(
      () => blank.remove(),
      SWEEP + STRIPS * STAGGER,
    );
    // Never leave the page covered, even where animations are held back (a
    // tab that does not paint).
    const done = window.setTimeout(() => layer.remove(), TOTAL + 100);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(done);
      for (const animation of animations) animation.cancel();
      layer.remove();
    };
  }, [pathname]);
}
