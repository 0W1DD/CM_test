import { Clock, History } from "lucide-react";
import MarkdownIt from "markdown-it";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { query } from "~/lib/naru";
import type { PostHistoryEntry } from "~/types/post";
import { ImageModal } from "./ImageModal";
import { PostCardContent } from "./PostCardContent";
import { PostCardImages } from "./PostCardImages";

const md = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
});

interface PostEditHistoryProps {
  postId: string;
  updatedAt: string;
}

export function PostEditHistory({ postId }: PostEditHistoryProps) {
  const [history, setHistory] = useState<PostHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        setHistory(
          await query<PostHistoryEntry[]>("posts:history", { post_id: postId }),
        );
      } catch (error) {
        console.error("Failed to fetch post history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [postId, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          title="수정 내역 보기"
        >
          <History className="h-3 w-3" />
          <span>수정됨</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>수정 내역</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              로딩 중...
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              수정 내역이 없습니다.
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="border border-border rounded-lg p-4 bg-card"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Link to={`/@${entry.edited_by.username}`}>
                    <ProfileAvatar
                      profilePictureUrl={entry.edited_by.profile_picture_url}
                      name={entry.edited_by.name}
                      username={entry.edited_by.username}
                      profileId={entry.edited_by.id}
                      size="sm"
                      showOnlineStatus={false}
                    />
                  </Link>
                  <div>
                    <Link
                      to={`/@${entry.edited_by.username}`}
                      className="hover:underline"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {entry.edited_by.name}
                      </span>
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(entry.edited_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <PostCardContent
                  content={entry.content}
                  contentWarning={entry.content_warning}
                  md={md}
                />

                {entry.images.length > 0 && (
                  <div className="mt-2">
                    <PostCardImages
                      images={entry.images}
                      onImageClick={setSelectedImage}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </Dialog>
  );
}
