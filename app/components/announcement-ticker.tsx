import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import { query } from "~/lib/naru";
import type { Post } from "~/types/post";

const TICKER_LIMIT = 5;
// Scroll speed, in pixels a second.
const TICKER_SPEED = 40;

/** A post's first line as plain text, for a one-line summary. */
function headline(content: string) {
  const line =
    content
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  return line
    .replace(/^(#+|>|[-*+])\s*/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "");
}

/**
 * The latest announcements as a strip at the top of the timeline, scrolling
 * sideways when they do not fit, so members see them without going to the
 * announcements page (on phones above all).
 */
export function AnnouncementTicker() {
  const { currentProfile } = useAuth();
  const profileId = currentProfile?.id;
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements", profileId],
    queryFn: () =>
      query<Post[]>("posts:announcements", {
        ...(profileId && { profile_id: profileId }),
      }),
  });

  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(0);
  const items = announcements.slice(0, TICKER_LIMIT);

  // Scroll only when the headlines are wider than the strip.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the headlines change.
  useEffect(() => {
    const outer = viewport.current;
    const inner = track.current;
    if (!outer || !inner) return;
    const measure = () => {
      const first = inner.firstElementChild as HTMLElement | null;
      const width = first?.offsetWidth ?? 0;
      setOverflow(width > outer.clientWidth ? width : 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [items.map((post) => post.id).join()]);

  if (items.length === 0) return null;

  const list = (copy: boolean) => (
    <div
      className="flex shrink-0 items-center gap-6 pr-6"
      aria-hidden={copy || undefined}
    >
      {items.map((post) => (
        <Link
          key={post.id}
          to={`/@${post.author.username}/${post.id}`}
          tabIndex={copy ? -1 : undefined}
          className="whitespace-nowrap text-sm text-foreground hover:text-primary"
        >
          {headline(post.content) || "공지사항"}
        </Link>
      ))}
    </div>
  );

  return (
    <div className="mx-4 mb-3 flex items-center gap-3 border-[1.5px] border-[var(--frame)] bg-card px-3 h-10">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary">
        <Megaphone className="h-4 w-4" />
        공지
      </span>
      <div ref={viewport} className="ticker min-w-0 flex-1 overflow-hidden">
        <div
          ref={track}
          className={`flex w-max ${overflow ? "ticker-track" : ""}`}
          style={
            overflow
              ? {
                  animationDuration: `${Math.round(overflow / TICKER_SPEED)}s`,
                }
              : undefined
          }
        >
          {list(false)}
          {overflow > 0 && list(true)}
        </div>
      </div>
      <Link
        to="/announcements"
        className="shrink-0 text-xs text-muted-foreground hover:text-primary"
      >
        전체
      </Link>
    </div>
  );
}
