import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LoginButton } from "~/components/LoginButton";
import { PostCard } from "~/components/post-card";
import { ReplyContext } from "~/components/reply-context";
import { EmptyState } from "~/components/shared/EmptyState";
import { LoadingState } from "~/components/shared/LoadingState";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { query } from "~/lib/naru";
import type { Page, Post } from "~/types/post";

export function meta() {
  return [{ title: "검색" }, { name: "description", content: "게시물 검색" }];
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isAuthenticated,
    belongsToCurrentInstance,
    currentProfile,
    isLoading: authLoading,
    consoleUrl,
  } = useAuth();
  const { currentInstance } = useCurrentInstance();
  const POSTS_PER_PAGE = 20;

  // Get query from URL or empty string
  const urlQuery = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
      // Update URL with search query
      if (inputValue.trim()) {
        setSearchParams({ q: inputValue.trim() });
      } else {
        setSearchParams({});
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  // Fetch search results with infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["search", debouncedQuery, currentProfile?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return {
          data: [] as Post[],
          pagination: { next_cursor: null, has_more: false, total_count: 0 },
        };
      }

      return query<Page<Post>>("posts:search", {
        q: debouncedQuery,
        limit: POSTS_PER_PAGE,
        ...(pageParam && { cursor: pageParam }),
        ...(currentProfile?.id && { profile_id: currentProfile.id }),
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.has_more
        ? (lastPage.pagination.next_cursor ?? undefined)
        : undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled:
      !!isAuthenticated &&
      !!belongsToCurrentInstance &&
      debouncedQuery.length >= 2,
  });

  const searchResults =
    data?.pages.flatMap((page: { data: Post[] }) => page.data) ?? [];

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

      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  if (!isAuthenticated && !authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-md mx-auto px-4">
          <EmptyState
            icon={Users}
            title="로그인이 필요합니다"
            description="게시물을 검색하려면 로그인해주세요."
            actions={<LoginButton />}
          />
        </div>
      </div>
    );
  }

  if (!belongsToCurrentInstance && !authLoading) {
    const applyUrl = consoleUrl;

    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="max-w-md mx-auto px-4">
          <EmptyState
            icon={Users}
            title="가입 신청이 필요합니다"
            description="이 커뮤의 게시물을 검색하려면 가입이 필요합니다."
            actions={
              <a
                href={applyUrl}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                가입 신청하기
              </a>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Search Input */}
          <div className="bg-card rounded-2xl shadow-marsh border border-border p-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="게시물·답글 검색..."
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {debouncedQuery && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>검색: "{debouncedQuery}"</span>
              </div>
            )}
          </div>

          {/* Search Results */}
          {!debouncedQuery || debouncedQuery.length < 2 ? (
            <EmptyState
              icon={Search}
              title="검색어를 입력해주세요"
              description="최소 2자 이상 입력하여 게시물을 검색할 수 있습니다."
            />
          ) : isLoading ? (
            <div className="text-center py-12">
              <Spinner className="h-8 w-8 mx-auto mb-4" />
              <p className="text-muted-foreground">검색 중...</p>
            </div>
          ) : isError ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">
                오류가 발생했습니다
              </h2>
              <p className="text-muted-foreground mb-4">
                검색 중 오류가 발생했습니다
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : searchResults.length === 0 ? (
            <EmptyState
              icon={Search}
              title="검색 결과가 없습니다"
              description={`"${debouncedQuery}"에 대한 검색 결과를 찾을 수 없습니다.`}
              actions={
                <Link
                  to="/"
                  className="text-primary hover:text-primary/90 font-medium"
                >
                  홈으로 이동
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl shadow-marsh border border-border p-4 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Search className="h-4 w-4" />
                  <span>검색 결과 {searchResults.length}개</span>
                </div>
              </div>

              {searchResults.map((post: Post) => (
                <div key={post.id}>
                  <ReplyContext parent={post.parent_summary} />
                  <PostCard
                    post={post}
                    currentProfileId={currentProfile?.id}
                    onDelete={() => refetch()}
                  />
                </div>
              ))}

              {/* Loading indicator for infinite scroll */}
              {isFetchingNextPage && (
                <div className="mt-6">
                  <LoadingState message="더 많은 결과를 불러오는 중..." />
                </div>
              )}

              {/* End of content indicator */}
              {!hasNextPage && searchResults.length > 0 && (
                <div className="bg-background rounded-2xl border border-border p-6 text-center mt-6">
                  <p className="text-muted-foreground text-sm">
                    모든 검색 결과를 확인했습니다
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
