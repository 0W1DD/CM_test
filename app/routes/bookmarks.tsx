import { useInfiniteQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Link } from "react-router";
import { LoginButton } from "~/components/LoginButton";
import { PostCard } from "~/components/post-card";
import { LoadingState } from "~/components/shared/LoadingState";
import { Spinner } from "~/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { query } from "~/lib/naru";
import type { Page, Post } from "~/types/post";

export function meta() {
  return [
    { title: "북마크" },
    { name: "description", content: "저장한 게시물 모음" },
  ];
}

export default function Bookmarks() {
  const { user, currentProfile, isLoading: authLoading } = useAuth();
  const BOOKMARKS_PER_PAGE = 20;

  // Fetch bookmarks with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["bookmarks", currentProfile?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!currentProfile?.id) {
        return {
          data: [] as Post[],
          pagination: { next_cursor: null, has_more: false },
        };
      }

      return query<Page<Post>>("posts:bookmarks", {
        profile_id: currentProfile.id,
        limit: BOOKMARKS_PER_PAGE,
        ...(pageParam && { cursor: pageParam }),
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.has_more
        ? (lastPage.pagination.next_cursor ?? undefined)
        : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!user && !!currentProfile?.id,
  });

  const bookmarks = data?.pages.flatMap((page) => page.data) ?? [];

  // Infinite scroll trigger
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll event listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight =
        document.documentElement.clientHeight || window.innerHeight;

      // Load more when within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  if (authLoading) {
    return null;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bookmark />
            </EmptyMedia>
            <EmptyTitle>로그인이 필요합니다</EmptyTitle>
            <EmptyDescription>북마크를 보려면 로그인해주세요.</EmptyDescription>
          </EmptyHeader>
          <LoginButton />
        </Empty>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Spinner className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            로딩 중...
          </h1>
          <p className="text-muted-foreground mb-4">
            정보를 불러오고 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bookmark />
            </EmptyMedia>
            <EmptyTitle>프로필를 선택해주세요</EmptyTitle>
            <EmptyDescription>
              북마크를 보려면 프로필를 선택해주세요.
            </EmptyDescription>
          </EmptyHeader>
          <Link
            to="/profiles"
            className="text-primary hover:text-primary/90 font-medium"
          >
            프로필 관리
          </Link>
        </Empty>
      </div>
    );
  }

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <Spinner className="h-8 w-8 mx-auto mb-4" />
              <p className="text-muted-foreground">북마크를 불러오는 중...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bookmark className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                오류가 발생했습니다
              </h2>
              <p className="text-muted-foreground mb-4">
                북마크를 불러오는 데 실패했습니다
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : bookmarks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bookmark />
                </EmptyMedia>
                <EmptyTitle>저장된 북마크가 없습니다</EmptyTitle>
                <EmptyDescription>
                  마음에 드는 게시물에 북마크를 추가해보세요!
                </EmptyDescription>
              </EmptyHeader>
              <Link
                to="/"
                className="text-primary hover:text-primary/90 font-medium"
              >
                홈으로 이동
              </Link>
            </Empty>
          ) : (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl shadow-marsh border border-border p-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bookmark className="h-4 w-4" />
                  <span>총 {bookmarks.length}개의 저장된 게시물</span>
                </div>
              </div>

              {bookmarks.map((bookmark) => (
                <PostCard
                  key={bookmark.id as string}
                  post={
                    {
                      ...bookmark,
                      depth: (bookmark.depth as number | undefined) || 0,
                      replies: [],
                      content_warning:
                        (bookmark.content_warning as
                          | string
                          | null
                          | undefined) || null,
                      in_reply_to_id:
                        (bookmark.in_reply_to_id as string | undefined) ?? "",
                    } as unknown as import("~/types/post").Post
                  }
                  currentProfileId={currentProfile.id}
                  onDelete={() => refetch()} // Refresh bookmarks when a post is deleted/unbookmarked
                />
              ))}

              {/* Loading indicator for infinite scroll */}
              {isFetchingNextPage && (
                <div className="mt-6">
                  <LoadingState message="더 많은 북마크를 불러오는 중..." />
                </div>
              )}

              {/* End of content indicator */}
              {!hasNextPage && bookmarks.length > 0 && (
                <div className="bg-background rounded-2xl border border-border p-6 text-center mt-6">
                  <p className="text-muted-foreground text-sm">
                    모든 북마크를 확인했습니다
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
