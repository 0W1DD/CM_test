import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Clock, Hash, Search, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LoginButton } from "~/components/LoginButton";
import { PostCard } from "~/components/post-card";
import { ProfileAvatar } from "~/components/profile-avatar";
import { ReplyContext } from "~/components/reply-context";
import { EmptyState } from "~/components/shared/EmptyState";
import { LoadingState } from "~/components/shared/LoadingState";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCommunityProfilesQuery } from "~/hooks/useCommunityProfiles";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { query } from "~/lib/naru";
import type { Page, Post } from "~/types/post";

type SearchKind = "all" | "posts" | "replies";

const KINDS: { value: SearchKind; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "posts", label: "글" },
  { value: "replies", label: "답글" },
];

// The last searches in this browser, newest first, offered while the box is
// empty. Kept per browser; without storage there are none.
const RECENT_KEY = "recent-searches";
const RECENT_MAX = 8;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // No storage: nothing is remembered.
  }
}

/** The words to mark in the results: the query without its `@username`. */
function matchTerms(q: string) {
  const text = q.replace(/^@[A-Za-z0-9_]+\s*/, "").trim();
  return text ? [text] : [];
}

/**
 * Marks every place `terms` appear in the text under `root` with the
 * search-match highlight, without changing the page (the CSS Custom
 * Highlight API); browsers without it simply show no marks.
 */
function highlight(root: HTMLElement | null, terms: string[]) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  CSS.highlights.delete("search-match");
  if (!root || terms.length === 0) return;
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.toLowerCase() ?? "";
    for (const term of terms) {
      const needle = term.toLowerCase();
      for (
        let at = text.indexOf(needle);
        at >= 0;
        at = text.indexOf(needle, at + needle.length)
      ) {
        const range = new Range();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        ranges.push(range);
      }
    }
  }
  CSS.highlights.set("search-match", new Highlight(...ranges));
}

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
  const [kind, setKind] = useState<SearchKind>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => setRecent(readRecent()), []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
      // Update URL with search query
      if (inputValue.trim()) {
        setSearchParams({ q: inputValue.trim() }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  // Remember a search once it has been made.
  useEffect(() => {
    if (debouncedQuery.length < 2) return;
    setRecent((list) => {
      const next = [
        debouncedQuery,
        ...list.filter((q) => q !== debouncedQuery),
      ].slice(0, RECENT_MAX);
      writeRecent(next);
      return next;
    });
  }, [debouncedQuery]);

  const forgetRecent = (q?: string) => {
    setRecent((list) => {
      const next = q ? list.filter((item) => item !== q) : [];
      writeRecent(next);
      return next;
    });
  };

  // The most used tags, offered while the box is empty.
  const { data: popularTags = [] } = useQuery({
    queryKey: ["popular-hashtags"],
    queryFn: () =>
      query<{ tag: string; count: number }[]>("search:popularHashtags", {
        limit: 12,
      }),
    staleTime: 60000,
    enabled: !!isAuthenticated && !!belongsToCurrentInstance,
  });

  // Members whose name or username holds the words, searched in the
  // profile list the app already keeps (nothing new is asked of the site).
  const { data: profiles = [] } = useCommunityProfilesQuery(
    !!isAuthenticated && !!belongsToCurrentInstance,
  );
  const people = useMemo(() => {
    const words = debouncedQuery.replace(/^[@#]/, "").toLowerCase();
    if (words.length < 1 || debouncedQuery.startsWith("#")) return [];
    return profiles
      .filter(
        (p) =>
          p.name.toLowerCase().includes(words) ||
          p.username.toLowerCase().includes(words),
      )
      .slice(0, 8);
  }, [profiles, debouncedQuery]);

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
    queryKey: ["search", debouncedQuery, kind, currentProfile?.id],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return {
          data: [] as Post[],
          pagination: { next_cursor: null, has_more: false, total_count: 0 },
        };
      }

      return query<Page<Post>>("posts:search", {
        q: debouncedQuery,
        ...(kind !== "all" && { kind }),
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
  const totalCount = data?.pages[0]?.pagination.total_count;

  // Mark the words in what came back, and clear the marks on leaving.
  // biome-ignore lint/correctness/useExhaustiveDependencies: again whenever more results arrive.
  useEffect(() => {
    highlight(resultsRef.current, matchTerms(debouncedQuery));
  }, [data, kind, debouncedQuery]);
  useEffect(() => () => highlight(null, []), []);

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
                placeholder="글·답글·사람 검색"
                className="w-full pl-10 pr-10 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue("")}
                  aria-label="검색어 지우기"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <code>@아이디</code> 를 앞에 쓰면 그 사람 글만, <code>#태그</code>{" "}
              는 해시태그로 찾습니다.
            </p>
            <div
              role="tablist"
              aria-label="검색 범위"
              className="mt-3 flex items-center gap-1"
            >
              {KINDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={kind === item.value}
                  onClick={() => setKind(item.value)}
                  className={`px-3 h-8 text-sm rounded-md border transition-colors ${
                    kind === item.value
                      ? "border-primary text-primary bg-primary/10 font-semibold"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* People whose name or username matches */}
          {people.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                사람
              </h2>
              <div className="flex flex-wrap gap-2">
                {people.map((person) => (
                  <Link
                    key={person.id}
                    to={`/@${person.username}`}
                    className="inline-flex items-center gap-2 pl-1 pr-3 py-1 bg-card border border-border rounded-full hover:border-primary text-sm"
                  >
                    <ProfileAvatar
                      profilePictureUrl={
                        person.profile_picture_url || undefined
                      }
                      name={person.name}
                      username={person.username}
                      size="sm"
                    />
                    <span className="font-medium text-foreground">
                      {person.name}
                    </span>
                    <span className="text-muted-foreground">
                      @{person.username}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {!debouncedQuery || debouncedQuery.length < 2 ? (
            recent.length > 0 || popularTags.length > 0 ? (
              <div className="space-y-4">
                {popularTags.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground mb-3">
                      <Hash className="h-4 w-4" />
                      많이 쓴 태그
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {popularTags.map((item) => (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => setInputValue(`#${item.tag}`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 border border-border rounded-full text-sm hover:border-primary"
                        >
                          <span className="font-semibold text-primary">
                            #{item.tag}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {recent.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        최근 검색어
                      </h2>
                      <button
                        type="button"
                        onClick={() => forgetRecent()}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        모두 지우기
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recent.map((q) => (
                        <span
                          key={q}
                          className="inline-flex items-center gap-1 border border-border rounded-full text-sm"
                        >
                          <button
                            type="button"
                            onClick={() => setInputValue(q)}
                            className="pl-3 py-1 text-foreground hover:text-primary"
                          >
                            {q}
                          </button>
                          <button
                            type="button"
                            onClick={() => forgetRecent(q)}
                            aria-label={`${q} 지우기`}
                            className="pr-2 py-1 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title="검색어를 입력해주세요"
                description="최소 2자 이상 입력하여 게시물을 검색할 수 있습니다."
              />
            )
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
            <div className="space-y-4" ref={resultsRef}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span>검색 결과 {totalCount ?? searchResults.length}개</span>
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
