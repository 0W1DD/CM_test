import { CornerDownRight } from "lucide-react";
import { Link } from "react-router";
import type { Post } from "~/types/post";

/** "Reply to …" above a reply shown on its own, linking to its parent. */
export function ReplyContext({
  parent,
}: {
  parent: Post["parent_summary"];
}) {
  if (!parent) return null;
  return (
    <Link
      to={`/@${parent.author.username}/${parent.id}`}
      className="flex items-start gap-2 px-4 py-2 mb-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
    >
      <CornerDownRight className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{parent.author.name}</span>
        <span className="text-muted-foreground/70">
          {" "}
          @{parent.author.username}
        </span>
        님의 게시물에 답글:{" "}
        <span className="italic">{parent.content_excerpt}</span>
      </span>
    </Link>
  );
}
