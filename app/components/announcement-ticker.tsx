import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import {
  markAnnouncementsSeen,
  unseenAnnouncements,
} from "~/lib/announcements-seen";
import { query } from "~/lib/naru";
import type { Post } from "~/types/post";

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
 * The latest announcement as a strip at the top of the timeline, so members
 * see it without going to the announcements page (on phones above all).
 * It counts them all, and a red dot marks any this browser has not seen.
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

  const latest = announcements[0];
  if (!latest) return null;
  const unseen = unseenAnnouncements(announcements);

  return (
    <div className="mx-4 mb-3 flex items-center gap-3 border-[1.5px] border-[var(--frame)] bg-card px-3 h-10">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary">
        <span className="relative">
          <Megaphone className="h-4 w-4" />
          {unseen > 0 && (
            <span
              className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#e5322d] ring-2 ring-[var(--card)]"
              title={`새 공지 ${unseen}개`}
            />
          )}
        </span>
        공지
      </span>
      <Link
        to={`/@${latest.author.username}/${latest.id}`}
        onClick={() => {
          if (unseen <= 1) markAnnouncementsSeen(announcements);
        }}
        className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-primary"
      >
        {headline(latest.content) || "공지사항"}
      </Link>
      <Link
        to="/announcements"
        className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        {unseen > 0 && (
          <span className="rounded-full bg-[#e5322d] px-1.5 text-[10px] font-semibold leading-4 text-white">
            새 {unseen}
          </span>
        )}
        전체 {announcements.length}
      </Link>
    </div>
  );
}
