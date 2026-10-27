import { Smile } from "lucide-react";
import { useEffect, useState } from "react";

interface Reaction {
  emoji: string;
  count: number;
  profiles: Array<{
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
  }>;
}

interface DirectMessageReactionsProps {
  reactions: Reaction[];
  currentProfileId?: string;
  onAddReaction: (emoji: string) => Promise<void>;
  onRemoveReaction: (emoji: string) => Promise<void>;
  isFromMe?: boolean;
}

const AVAILABLE_REACTIONS = [
  { emoji: "❤️", label: "좋아요" },
  { emoji: "🎉", label: "축하" },
  { emoji: "😂", label: "웃김" },
  { emoji: "😲", label: "놀람" },
  { emoji: "🤔", label: "생각" },
  { emoji: "😢", label: "슬픔" },
  { emoji: "👀", label: "주목" },
];

export function DirectMessageReactions({
  reactions,
  currentProfileId,
  onAddReaction,
  onRemoveReaction,
  isFromMe = false,
}: DirectMessageReactionsProps) {
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

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openReactionSelector]);

  const handleReactionClick = async (emoji: string) => {
    await onAddReaction(emoji);
    setOpenReactionSelector(false);
  };

  return (
    <>
      {/* Existing reactions display */}
      {reactions.map((reaction) => {
        const hasCurrentUserReaction =
          currentProfileId &&
          reaction.profiles.some((profile) => profile.id === currentProfileId);
        const userNames = reaction.profiles
          .map((p) => `${p.name} (@${p.username})`)
          .join(", ");

        return (
          <button
            type="button"
            key={reaction.emoji}
            onClick={() => {
              if (hasCurrentUserReaction) {
                onRemoveReaction(reaction.emoji);
              } else {
                handleReactionClick(reaction.emoji);
              }
            }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
              hasCurrentUserReaction
                ? "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
                : "bg-card border-border text-foreground hover:bg-accent"
            }`}
            title={userNames}
          >
            <span>{reaction.emoji}</span>
            <span className="font-medium">{reaction.count}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      {currentProfileId && (
        <div className="relative reaction-selector inline-flex">
          <button
            type="button"
            onClick={() => setOpenReactionSelector(!openReactionSelector)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-border rounded-full transition-colors"
          >
            <Smile className="h-3 w-3" />
          </button>

          {openReactionSelector && (
            <div
              className={`absolute bottom-full mb-2 bg-popover border border-border rounded-lg shadow-lg p-2 flex gap-1 z-10 ${
                isFromMe ? "right-0" : "left-0"
              }`}
            >
              {AVAILABLE_REACTIONS.map(({ emoji, label }) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className="hover:bg-accent p-1 rounded text-lg transition-colors"
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
