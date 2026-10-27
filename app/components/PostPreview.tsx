import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import { query } from "~/lib/naru";
import { Skeleton } from "./ui/skeleton";

interface Post {
  id: string;
  content: string;
  created_at: string | null;
  author: {
    id: string;
    username: string;
    name: string;
    profile_picture_url: string | null;
  };
}

interface PostPreviewProps {
  postUrl: string;
  currentProfileId?: string;
}

export function PostPreview({ postUrl, currentProfileId }: PostPreviewProps) {
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Extract username and post_id from URL
        // Expected format: https://[domain]/[username]/[post_id] or /[username]/[post_id]
        const urlPattern = /\/([^/]+)\/([^/]+)\/?$/;
        const match = postUrl.match(urlPattern);

        if (!match) {
          setError("잘못된 게시물 링크입니다");
          return;
        }

        const postId = match[2];

        if (!postId) {
          setError("잘못된 게시물 링크입니다");
          return;
        }

        try {
          setPost(
            await query<Post>("posts:get", {
              post_id: postId,
              ...(currentProfileId && { profile_id: currentProfileId }),
            }),
          );
        } catch {
          setError("게시물을 불러올 수 없습니다");
        }
      } catch (err) {
        console.error("Error fetching post:", err);
        setError("게시물을 불러오는 중 오류가 발생했습니다");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [postUrl, currentProfileId]);

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-3 bg-card my-2">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="border border-border rounded-lg p-3 bg-muted my-2">
        <p className="text-sm text-muted-foreground">
          {error || "게시물을 불러올 수 없습니다"}
        </p>
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
        >
          링크에서 보기
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  // Truncate content if too long
  const truncateContent = (content: string, maxLength: number) => {
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Link
      to={`/${post.author.username}/${post.id}`}
      className="block border border-border rounded-lg p-3 bg-card hover:bg-accent transition-colors my-2"
    >
      <div className="flex items-start gap-3">
        <ProfileAvatar
          profilePictureUrl={post.author.profile_picture_url || undefined}
          name={post.author.name}
          username={post.author.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-semibold text-foreground text-sm">
              {post.author.name}
            </p>
            <p className="text-xs text-muted-foreground">
              @{post.author.username}
            </p>
            <p className="text-xs text-muted-foreground">·</p>
            <p className="text-xs text-muted-foreground">
              {post.created_at ? formatDate(post.created_at) : ""}
            </p>
          </div>
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
            {truncateContent(post.content, 150)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
            <span>게시물 보기</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}
