import { type RefObject, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

const EASING = "cubic-bezier(.7,0,.2,1)";

interface Style {
  // The strips' colours, top to bottom.
  colours: string[];
  stagger: number;
  sweep: number;
  hold: number;
  // Whether the top strip carries the page's name and the date.
  titled: boolean;
}

// Moving to another part of the community: eight strips, a pause, a name.
const FULL: Style = {
  colours: [
    "var(--accent-color)",
    "var(--theme)",
    "var(--ground-raised)",
    "var(--accent-color)",
    "var(--ground-sunk)",
    "var(--theme)",
    "var(--accent-color)",
    "var(--ground-raised)",
  ],
  stagger: 35,
  sweep: 300,
  hold: 220,
  titled: true,
};

// Going back, or within a part (a settings tab, a post): three quick strips.
const QUICK: Style = {
  colours: ["var(--accent-color)", "var(--theme)", "var(--ground-raised)"],
  stagger: 25,
  sweep: 140,
  hold: 0,
  titled: false,
};

const inTime = (style: Style) =>
  style.sweep + style.colours.length * style.stagger;

// The menu's names for its parts, so the first strip can say where you are.
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

/** The menu part a page belongs to, or "" for one outside the menu (a post, a profile). */
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
 * of `target` one after another, then leave the other way and show the new
 * page. Moving to another part of the menu gets the full eight strips with
 * the part's name and the date on the top one; moving within a part or to a
 * post or profile, three quick ones; going back or forward, the quick ones
 * the other way round. A blank in
 * the page's colour hides the new page until the strips cover it. Skipped
 * for those who ask for less motion.
 */
export function usePageTransition(target: RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef<string | null>(null);

  // Before paint, so the new page never shows uncovered for a frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per page change.
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === null) return;
    const element = target.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const name = pageName(pathname);
    // Back and forward run the quick strips the other way: in from the right,
    // bottom first, out to the left, as if winding back.
    const back = navigationType === "POP";
    const style = !back && name && name !== pageName(from) ? FULL : QUICK;
    const enter = back ? "102%" : "-102%";
    const leave = back ? "-102%" : "102%";

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
    // The page's colour, or the ground where the page is clear (the home
    // timeline on phones, which lets the photo through).
    const colour = getComputedStyle(element).backgroundColor;
    blank.style.background =
      colour === "rgba(0, 0, 0, 0)" || colour === "transparent"
        ? "var(--ground)"
        : colour;
    layer.appendChild(blank);

    const count = style.colours.length;
    const strips = style.colours.map((colour, index) => {
      const strip = document.createElement("div");
      strip.className = "page-blinds-strip";
      Object.assign(strip.style, {
        top: `${(index * 100) / count}%`,
        height: `calc(${100 / count}% + 1px)`,
        background: colour,
      });
      layer.appendChild(strip);
      return strip;
    });
    if (style.titled) {
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

    const covered = inTime(style);
    const animations = strips.flatMap((strip, index) => {
      const order = back ? count - 1 - index : index;
      return [
        strip.animate(
          [
            { transform: `translateX(${enter})` },
            { transform: "translateX(0)" },
          ],
          {
            duration: style.sweep,
            delay: order * style.stagger,
            easing: EASING,
            fill: "backwards",
          },
        ),
        strip.animate(
          [
            { transform: "translateX(0)" },
            { transform: `translateX(${leave})` },
          ],
          {
            duration: style.sweep,
            delay: covered + style.hold + (count - 1 - order) * style.stagger,
            easing: EASING,
            fill: "forwards",
          },
        ),
      ];
    });
    // The blank goes once every strip is in, so only the strips are left
    // to uncover the new page.
    const reveal = window.setTimeout(() => blank.remove(), covered);
    // Never leave the page covered, even where animations are held back (a
    // tab that does not paint).
    const done = window.setTimeout(
      () => layer.remove(),
      covered * 2 + style.hold + 100,
    );
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(done);
      for (const animation of animations) animation.cancel();
      layer.remove();
    };
  }, [pathname]);
}
