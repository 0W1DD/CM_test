import { ArrowLeft, LayoutList, MessageSquare, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BoardPostCard } from "~/components/board-post-card";
import { BoardPostForm } from "~/components/board-post-form";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { query, reasonOf } from "~/lib/naru";

interface CommunityBoard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  allow_comments: boolean;
  created_at: string;
  updated_at: string;
}

interface BoardPostAuthor {
  id: string;
  name: string;
  username: string;
  profile_picture: {
    id: string;
    url: string;
    width: number;
    height: number;
  } | null;
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
  author: BoardPostAuthor;
  created_at: string;
  updated_at: string;
}

export default function BoardPosts() {
  const { slug = "" } = useParams();
  const {
    currentProfile,
    isLoading: authLoading,
    belongsToCurrentInstance,
  } = useAuth();
  const [board, setBoard] = useState<CommunityBoard | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchBoard = useCallback(async () => {
    if (!slug) return;

    try {
      setBoard(await query<CommunityBoard>("boards:board", { slug }));
    } catch (err) {
      console.error("Failed to fetch board:", err);
      setError(
        reasonOf(err) === "board_not_found"
          ? "게시판을 찾을 수 없습니다"
          : "게시판을 불러오는 데 실패했습니다",
      );
    }
  }, [slug]);

  const fetchPosts = useCallback(
    async (loadMore = false) => {
      if (!slug || !currentProfile) return;

      try {
        if (loadMore) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const result = await query<{
          data: BoardPost[];
          pagination: { next_cursor: string | null; has_more: boolean };
        }>("boards:posts", {
          slug,
          profile_id: currentProfile.id,
          limit: 20,
          ...(loadMore && cursor ? { cursor } : {}),
        });
        if (loadMore) {
          setPosts((prev) => [...prev, ...result.data]);
        } else {
          setPosts(result.data);
        }
        setHasMore(result.pagination.has_more);
        setCursor(result.pagination.next_cursor);
      } catch (err) {
        console.error("Failed to fetch posts:", err);
        setError("게시글을 불러오는 데 실패했습니다");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [slug, currentProfile, cursor],
  );

  useEffect(() => {
    if (belongsToCurrentInstance) {
      fetchBoard();
    }
  }, [belongsToCurrentInstance, fetchBoard]);

  useEffect(() => {
    if (belongsToCurrentInstance && board && currentProfile) {
      fetchPosts();
    }
  }, [belongsToCurrentInstance, board, currentProfile, fetchPosts]);

  const handlePostCreated = () => {
    setIsCreating(false);
    fetchPosts();
  };

  const handlePostDeleted = () => {
    fetchPosts();
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">게시판을 불러오는 중...</p>
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

  if (error || !board) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <LayoutList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {error || "게시판을 찾을 수 없습니다"}
          </h1>
          <Link
            to="/boards"
            className="text-primary hover:text-primary/90 font-medium"
          >
            게시판 목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            to="/boards"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            게시판 목록
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <LayoutList className="h-6 w-6" />
              {board.name}
            </h1>
            {board.description && (
              <p className="text-muted-foreground mt-1">{board.description}</p>
            )}
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            글쓰기
          </Button>
        </div>

        {isCreating && (
          <div className="mb-6">
            <BoardPostForm
              boardSlug={slug}
              onSuccess={handlePostCreated}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        )}

        {posts.length === 0 && !isCreating ? (
          <div className="bg-card rounded-2xl shadow-sm border border-border p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              아직 게시글이 없습니다
            </h3>
            <p className="text-muted-foreground mb-4">
              첫 번째 게시글을 작성해보세요.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              글쓰기
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <BoardPostCard
                key={post.id}
                post={post}
                boardSlug={slug}
                currentProfileId={currentProfile?.id}
                onDelete={handlePostDeleted}
              />
            ))}

            {hasMore && (
              <div className="text-center py-4">
                <Button
                  variant="outline"
                  onClick={() => fetchPosts(true)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" />
                      불러오는 중...
                    </>
                  ) : (
                    "더 보기"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
