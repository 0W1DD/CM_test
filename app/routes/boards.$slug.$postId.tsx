import {
  ArrowLeft,
  LayoutList,
  MessageSquare,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { getReadOnlyMarkdownInstance } from "~/lib/markdown-utils";
import { errorMessage, mutate, query, reasonOf } from "~/lib/naru";

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

interface BoardInfo {
  id: string;
  name: string;
  slug: string;
  allow_comments: boolean;
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
  board: BoardInfo;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  content: string;
  depth: number;
  author: Author;
  created_at: string;
  updated_at: string;
  replies: Reply[];
}

export default function BoardPostDetail() {
  const { slug, postId } = useParams();
  const navigate = useNavigate();
  const {
    currentProfile,
    isLoading: authLoading,
    belongsToCurrentInstance,
  } = useAuth();
  const [post, setPost] = useState<BoardPost | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const md = useMemo(() => getReadOnlyMarkdownInstance(), []);

  const fetchPost = useCallback(async () => {
    if (!slug || !postId) return;

    try {
      setIsLoading(true);
      setPost(await query<BoardPost>("boards:post", { slug, post_id: postId }));
    } catch (err) {
      console.error("Failed to fetch post:", err);
      setError(
        reasonOf(err) === "post_not_found"
          ? "게시글을 찾을 수 없습니다"
          : "게시글을 불러오는 데 실패했습니다",
      );
    } finally {
      setIsLoading(false);
    }
  }, [slug, postId]);

  const fetchReplies = useCallback(async () => {
    if (!slug || !postId || !currentProfile) return;

    try {
      const result = await query<{ data: Reply[] }>("boards:replies", {
        slug,
        post_id: postId,
        profile_id: currentProfile.id,
      });
      setReplies(result.data);
    } catch (err) {
      console.error("Failed to fetch replies:", err);
    }
  }, [slug, postId, currentProfile]);

  useEffect(() => {
    if (belongsToCurrentInstance) {
      fetchPost();
    }
  }, [belongsToCurrentInstance, fetchPost]);

  useEffect(() => {
    if (
      belongsToCurrentInstance &&
      post?.board.allow_comments &&
      currentProfile
    ) {
      fetchReplies();
    }
  }, [belongsToCurrentInstance, post, currentProfile, fetchReplies]);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !currentProfile || !slug || !postId) return;

    try {
      setIsSubmitting(true);
      await mutate("boards:createReply", {
        slug,
        post_id: postId,
        profile_id: currentProfile.id,
        content: replyContent.trim(),
        in_reply_to_id: replyToId || undefined,
      });
      setReplyContent("");
      setReplyToId(null);
      fetchReplies();
      toast.success("댓글이 등록되었습니다");
    } catch (err) {
      console.error("Failed to submit reply:", err);
      toast.error(errorMessage(err, "댓글 등록에 실패했습니다"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!currentProfile || !slug || !postId) return;

    if (!confirm("정말 이 게시글을 삭제하시겠습니까?")) return;

    try {
      await mutate("boards:deletePost", {
        slug,
        post_id: postId,
        profile_id: currentProfile.id,
      });
      toast.success("게시글이 삭제되었습니다");
      navigate(`/boards/${slug}`);
    } catch (err) {
      console.error("Failed to delete post:", err);
      toast.error(errorMessage(err, "게시글 삭제에 실패했습니다"));
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!currentProfile || !slug || !postId) return;

    if (!confirm("정말 이 댓글을 삭제하시겠습니까?")) return;

    try {
      await mutate("boards:deleteReply", {
        slug,
        post_id: postId,
        reply_id: replyId,
        profile_id: currentProfile.id,
      });
      toast.success("댓글이 삭제되었습니다");
      fetchReplies();
    } catch (err) {
      console.error("Failed to delete reply:", err);
      toast.error(errorMessage(err, "댓글 삭제에 실패했습니다"));
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">게시글을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!belongsToCurrentInstance && !authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            커뮤 멤버만 접근할 수 있습니다
          </h1>
          <Link
            to="/"
            className="text-primary hover:text-primary/90 font-medium"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {error || "게시글을 찾을 수 없습니다"}
          </h1>
          <Link
            to={`/boards/${slug}`}
            className="text-primary hover:text-primary/90 font-medium"
          >
            게시판으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const isAuthor = post.author.id === currentProfile?.id;

  const renderReply = (reply: Reply, depth = 0) => {
    const isReplyAuthor = reply.author.id === currentProfile?.id;
    const maxDepth = 3;

    return (
      <div
        key={reply.id}
        className={depth > 0 ? "ml-8 border-l-2 border-border pl-4" : "px-4"}
      >
        <div className="py-4">
          <div className="flex items-start gap-3">
            <ProfileAvatar
              profilePictureUrl={reply.author.profile_picture?.url}
              name={reply.author.name}
              username={reply.author.username}
              profileId={reply.author.id}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {reply.author.name}
                </span>
                <span className="text-muted-foreground text-sm">
                  @{reply.author.username}
                </span>
                <span className="text-muted-foreground text-sm">
                  {new Date(reply.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-foreground mt-1 whitespace-pre-wrap">
                {reply.content}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {depth < maxDepth && post.board.allow_comments && (
                  <button
                    type="button"
                    onClick={() => setReplyToId(reply.id)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    답글
                  </button>
                )}
                {isReplyAuthor && (
                  <button
                    type="button"
                    onClick={() => handleDeleteReply(reply.id)}
                    className="text-sm text-destructive hover:text-destructive/90"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {reply.replies && reply.replies.length > 0 && (
          <div>
            {reply.replies.map((childReply) =>
              renderReply(childReply, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to={`/boards/${slug}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {post.board.name}
          </Link>
        </div>

        {/* Post Content */}
        <article className="bg-card rounded-2xl shadow-marsh border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                profilePictureUrl={post.author.profile_picture?.url}
                name={post.author.name}
                username={post.author.username}
                profileId={post.author.id}
                size="md"
              />
              <div>
                <div className="font-medium text-foreground">
                  {post.author.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  @{post.author.username} ·{" "}
                  {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            {isAuthor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeletePost}
                className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <h1 className="text-xl font-bold text-foreground mb-4">
            {post.title}
          </h1>

          <div
            className="prose dark:prose-invert prose-sm max-w-none text-foreground"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized by markdown-it
            dangerouslySetInnerHTML={{ __html: md.render(post.content) }}
          />
        </article>

        {/* Replies Section */}
        {post.board.allow_comments && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5" />
              댓글
            </h2>

            {/* Reply Form */}
            <div className="bg-card rounded-xl shadow-sm border border-border p-4 mb-4">
              {replyToId && (
                <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                  <span>답글 작성 중...</span>
                  <button
                    type="button"
                    onClick={() => setReplyToId(null)}
                    className="hover:text-foreground"
                  >
                    취소
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <ProfileAvatar
                  profilePictureUrl={currentProfile?.profile_picture_url}
                  name={currentProfile?.name ?? ""}
                  username={currentProfile?.username}
                  profileId={currentProfile?.id}
                  size="sm"
                />
                <div className="flex-1">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    rows={2}
                    className="resize-none"
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleSubmitReply}
                      disabled={!replyContent.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Spinner className="h-4 w-4 mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      등록
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Replies List */}
            {replies.length === 0 ? (
              <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl shadow-sm border border-border divide-y divide-border">
                {replies.map((reply) => renderReply(reply))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
