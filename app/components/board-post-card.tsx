import { MessageSquare, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { errorMessage, mutate } from "~/lib/naru";
import { ProfileAvatar } from "./profile-avatar";
import { Button } from "./ui/button";

interface ProfilePicture {
  id: string;
  url: string;
  width: number;
  height: number;
}

interface Author {
  id: string;
  name: string;
  username: string;
  profile_picture: ProfilePicture | null;
}

interface BoardPost {
  id: string;
  title: string;
  content: string;
  image: {
    id: string;
    url: string;
    width: number;
    height: number;
    filename: string;
  } | null;
  author: Author;
  created_at: string;
  updated_at: string;
}

interface BoardPostCardProps {
  post: BoardPost;
  boardSlug: string;
  currentProfileId?: string;
  onDelete?: () => void;
}

/**
 * Strip markdown image syntax from content, replacing with alt text if present
 * ![alt text](url) -> alt text
 * ![](url) -> (removed)
 */
function stripImageMarkdown(content: string): string {
  return content.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, altText) => {
    return altText ? altText : "";
  });
}

export function BoardPostCard({
  post,
  boardSlug,
  currentProfileId,
  onDelete,
}: BoardPostCardProps) {
  const isAuthor = post.author.id === currentProfileId;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentProfileId) return;

    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return;

    try {
      await mutate("boards:deletePost", {
        slug: boardSlug,
        post_id: post.id,
        profile_id: currentProfileId,
      });
      toast.success("게시글이 삭제되었습니다");
      onDelete?.();
    } catch (err) {
      console.error("Failed to delete post:", err);
      toast.error(errorMessage(err, "게시글 삭제에 실패했습니다"));
    }
  };

  // Strip image markdown and truncate content for preview
  const strippedContent = stripImageMarkdown(post.content).trim();
  const truncatedContent =
    strippedContent.length > 200
      ? `${strippedContent.slice(0, 200)}...`
      : strippedContent;

  return (
    <Link
      to={`/boards/${boardSlug}/${post.id}`}
      className="block bg-card rounded-xl shadow-sm border border-border p-5 hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar
          profilePictureUrl={post.author.profile_picture?.url}
          name={post.author.name}
          username={post.author.username}
          profileId={post.author.id}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground">
              {post.author.name}
            </span>
            <span className="text-muted-foreground text-sm">
              @{post.author.username}
            </span>
            <span className="text-muted-foreground text-sm">
              {new Date(post.created_at).toLocaleString()}
            </span>
          </div>

          <h3 className="font-semibold text-foreground mb-1">{post.title}</h3>

          <p className="text-muted-foreground text-sm line-clamp-2">
            {truncatedContent}
          </p>

          {post.image && (
            <div className="mt-3">
              <img
                src={post.image.url}
                alt={post.image.filename}
                className="rounded-lg max-h-48 object-cover"
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground text-sm flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
              </span>
            </div>

            {isAuthor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
