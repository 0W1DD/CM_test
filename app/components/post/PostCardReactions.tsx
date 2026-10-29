import { Smile } from "lucide-react";
import { useEffect, useState } from "react";

interface Reaction {
  emoji: string;
  user: {
    id: string;
    username: string;
    name: string;
  };
}

interface PostCardReactionsProps {
  reactions: Reaction[];
  currentProfileId?: string;
  canInteract: boolean;
  onAddReaction: (emoji: string) => Promise<void>;
  onRemoveReaction: (emoji: string) => Promise<void>;
  isReply?: boolean;
}

const AVAILABLE_REACTIONS = [
  { emoji: "❤️", label: "좋아요" },
  { emoji: "🎉", label: "축하" },
  { emoji: "😂", label: "웃김" },
  { emoji: "😲", label: "놀람" },
  { emoji: "🤔", label: "생각" },
  { emoji: "😢", label: "슬픔" },
  { emoji: "👀", label: "주목" },
  { emoji: "👍", label: "좋아" },
  { emoji: "🙏", label: "감사" },
  { emoji: "😭", label: "오열" },
  { emoji: "😡", label: "화남" },
  { emoji: "🥺", label: "애원" },
  { emoji: "💀", label: "해골" },
  { emoji: "🔥", label: "불" },
  { emoji: "✨", label: "반짝" },
  { emoji: "👏", label: "박수" },
  { emoji: "⚔️", label: "전투" },
  { emoji: "🩸", label: "피" },
  { emoji: "🕯️", label: "촛불" },
  { emoji: "🎲", label: "주사위" },
  { emoji: "💤", label: "잠" },
];

// The reactions this browser used last, newest first, so the picker puts
// them at the front. Kept per browser; without storage the order is fixed.
const RECENT_KEY = "recent-reactions";
const RECENT_MAX = 6;

function recentReactions(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function rememberReaction(emoji: string) {
  try {
    const recent = [emoji, ...recentReactions().filter((e) => e !== emoji)];
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(recent.slice(0, RECENT_MAX)),
    );
  } catch {
    // No storage: the picker keeps its fixed order.
  }
}

function reactionsByRecent() {
  const recent = recentReactions();
  const rank = (emoji: string) => {
    const at = recent.indexOf(emoji);
    return at < 0 ? recent.length : at;
  };
  return [...AVAILABLE_REACTIONS].sort((a, b) => rank(a.emoji) - rank(b.emoji));
}

export function PostCardReactions({
  reactions,
  currentProfileId,
  canInteract,
  onAddReaction,
  onRemoveReaction,
  isReply = false,
}: PostCardReactionsProps) {
  const [openReactionSelector, setOpenReactionSelector] = useState(false);

  // Close reaction selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openReactionSelector &&
        event.target instanceof Element &&
        !event.target.closest(".reaction-selector")
      ) {
        setOpenReactionSelector(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenReactionSelector(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openReactionSelector]);

  const handleReactionClick = async (emoji: string) => {
    if (!currentProfileId || !canInteract) return;
    rememberReaction(emoji);
    await onAddReaction(emoji);
    setOpenReactionSelector(false);
  };

  // Group reactions by emoji type
  const reactionGroups = reactions.reduce<
    Record<string, Array<{ id: string; username: string; name: string }>>
  >((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    if (reaction.user) {
      const group = acc[reaction.emoji];
      if (group) {
        group.push(reaction.user);
      }
    }
    return acc;
  }, {});

  return (
    <>
      {/* Reaction button */}
      {currentProfileId && canInteract && (
        <>
          <button
            type="button"
            onClick={() => setOpenReactionSelector(!openReactionSelector)}
            className={`reaction-selector inline-flex items-center gap-1 ${
              isReply ? "text-[13px]" : "text-sm"
            } text-muted-foreground hover:text-primary transition-colors`}
          >
            <Smile className={isReply ? "h-3.5 w-3.5" : "h-4 w-4"} />
            <span>반응</span>
          </button>

          {openReactionSelector && (
            <div className="reaction-selector basis-full mt-1 bg-popover border-[1.5px] border-[var(--frame)] p-2 flex flex-wrap gap-1">
              {reactionsByRecent().map(({ emoji, label }) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className="hover:bg-accent p-1.5 rounded text-xl leading-none transition-colors"
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reactions display - placed in separate row */}
      {Object.keys(reactionGroups).length > 0 && (
        <div
          className={`basis-full flex flex-wrap gap-1 ${isReply ? "mt-1" : "mt-2"}`}
        >
          {Object.entries(reactionGroups).map(([emoji, users]) => {
            const hasCurrentUserReaction =
              currentProfileId &&
              users.some((user) => user.id === currentProfileId);

            return (
              <button
                type="button"
                key={emoji}
                disabled={!currentProfileId || !canInteract}
                onClick={() => {
                  if (!currentProfileId || !canInteract) return;
                  if (hasCurrentUserReaction) {
                    onRemoveReaction(emoji);
                  } else {
                    handleReactionClick(emoji);
                  }
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                  hasCurrentUserReaction
                    ? "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
                    : "bg-card/70 border-border text-foreground hover:bg-accent/70"
                }`}
                title={`${users.map((u) => `${u.name} (@${u.username})`).join(", ")}`}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
