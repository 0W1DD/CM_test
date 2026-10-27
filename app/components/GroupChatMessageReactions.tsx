import { Smile } from "lucide-react";
import { useEffect, useState } from "react";
import { ProfileAvatar } from "~/components/profile-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

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

interface GroupChatMessageReactionsProps {
  reactions: Reaction[];
  currentProfileId?: string;
  onAddReaction: (emoji: string) => Promise<void>;
  onRemoveReaction: (emoji: string) => Promise<void>;
  messageContent: string;
  senderName: string;
  isModalOpen: boolean;
  onModalClose: () => void;
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

export function GroupChatMessageReactions({
  reactions,
  currentProfileId,
  onAddReaction,
  onRemoveReaction,
  messageContent,
  senderName,
  isModalOpen,
  onModalClose,
  isFromMe = false,
}: GroupChatMessageReactionsProps) {
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
            title={reaction.profiles
              .map((p) => `${p.name} (@${p.username})`)
              .join(", ")}
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
              className={`absolute bottom-full mb-2 bg-popover border border-border rounded-lg shadow-marsh-lg p-2 flex gap-1 z-10 ${
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

      {/* Reaction details modal */}
      <Dialog open={isModalOpen} onOpenChange={onModalClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>메시지 반응</DialogTitle>
          </DialogHeader>

          {/* Message preview */}
          <div className="bg-background rounded-lg p-3 mb-4">
            <div className="text-xs text-muted-foreground mb-1">
              {senderName}
            </div>
            <div className="text-sm text-foreground line-clamp-2">
              {messageContent}
            </div>
          </div>

          {/* Reactions grouped by emoji */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {reactions.map((reaction) => (
              <div key={reaction.emoji}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{reaction.emoji}</span>
                  <span className="text-sm font-medium text-foreground">
                    {reaction.count}명
                  </span>
                </div>
                <div className="space-y-2 pl-10">
                  {reaction.profiles.map((profile) => {
                    const hasReacted = profile.id === currentProfileId;

                    return (
                      <div
                        key={profile.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-background transition-colors"
                      >
                        <ProfileAvatar
                          profilePictureUrl={profile.profile_picture_url}
                          name={profile.name}
                          username={profile.username}
                          size="sm"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {profile.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{profile.username}
                          </div>
                        </div>
                        {hasReacted && (
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveReaction(reaction.emoji);
                              onModalClose();
                            }}
                            className="text-xs text-destructive hover:text-destructive/80 font-medium"
                          >
                            제거
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
