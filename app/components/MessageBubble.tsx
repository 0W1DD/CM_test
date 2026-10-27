import { Clock, Copy, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PostPreview } from "./PostPreview";
import { ImageModal } from "./post/ImageModal";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isFromMe: boolean;
  senderName?: string;
  senderAvatar?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  currentProfileId?: string;
  onDelete?: () => void;
  images?: Array<{
    id: string;
    url: string;
    width: number;
    height: number;
  }>;
}

export function MessageBubble({
  content,
  timestamp,
  isFromMe,
  senderName,
  senderAvatar,
  children,
  onClick,
  currentProfileId,
  onDelete,
  images,
}: MessageBubbleProps) {
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Element &&
        !menuRef.current.contains(event.target)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const handleBubbleTap = () => {
    setShowMenu((prev) => !prev);
    if (onClick) {
      onClick();
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(content);
    setShowMenu(false);
  };

  // Detect post URLs in the content
  // Pattern matches: /username/post_id or https://domain/username/post_id
  const postUrlPattern = /(https?:\/\/[^\s]+)?\/([^/\s]+)\/([a-f0-9-]{36})/gi;
  const postUrls = content.match(postUrlPattern) || [];

  // Extract content without URLs for display
  const contentWithoutUrls = content.replace(postUrlPattern, "").trim();

  return (
    <div
      className={`flex flex-col ${isFromMe ? "items-end" : "items-start"} max-w-xs lg:max-w-md`}
    >
      {/* Sender info for messages from others */}
      {!isFromMe && senderAvatar && (
        <div className="flex items-center gap-2 mb-1">
          {senderAvatar}
          {senderName && (
            <span className="text-sm font-medium text-foreground">
              {senderName}
            </span>
          )}
        </div>
      )}

      {/* Post Previews - shown above message */}
      {postUrls.length > 0 && (
        <div className="w-full mb-2">
          {postUrls.map((url) => (
            <PostPreview
              key={url}
              postUrl={url}
              currentProfileId={currentProfileId}
            />
          ))}
        </div>
      )}

      {/* Message bubble with action menu */}
      <div className="relative" ref={menuRef}>
        {(contentWithoutUrls || (images && images.length > 0)) && (
          <button
            type="button"
            onClick={handleBubbleTap}
            className={`rounded-2xl px-4 py-2 text-left shadow-marsh transition-shadow hover:shadow-marsh-lg ${
              isFromMe
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border/70 text-foreground rounded-bl-md"
            } cursor-pointer`}
          >
            {/* Images */}
            {images && images.length > 0 && (
              <div className={`flex flex-col gap-2 ${content ? "mb-2" : ""}`}>
                {images.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage({
                        url: image.url,
                        filename: `image-${image.id}`,
                      });
                    }}
                    className="cursor-pointer"
                  >
                    <img
                      src={image.url}
                      alt="Attached"
                      width={image.width}
                      height={image.height}
                      className="rounded-md w-full h-auto object-cover"
                      style={{ maxHeight: "300px", minWidth: "200px" }}
                    />
                  </button>
                ))}
              </div>
            )}
            {/* Content */}
            {contentWithoutUrls && (
              <p className="text-sm whitespace-pre-wrap">
                {contentWithoutUrls}
              </p>
            )}
          </button>
        )}

        {/* Action menu popover */}
        {showMenu && (
          <div
            className={`absolute z-20 ${isFromMe ? "right-0" : "left-0"} bottom-full mb-1 bg-popover border border-border/80 rounded-2xl shadow-marsh-lg overflow-hidden`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText();
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors whitespace-nowrap w-full"
            >
              <Copy className="h-3.5 w-3.5" />
              복사
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onDelete();
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap w-full"
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      {/* Timestamp, reactions, and actions */}
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {!isFromMe && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <Clock className="h-3 w-3" />
            {timestamp}
          </span>
        )}
        {children}
        {isFromMe && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-1">
            <Clock className="h-3 w-3" />
            {timestamp}
          </span>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
