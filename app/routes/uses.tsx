import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, Clock, Lock, ScrollText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ProfileAvatar } from "~/components/profile-avatar";
import { shortTime } from "~/components/post/PostCardHeader";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "사용 로그" },
    { name: "description", content: "아이템 사용 기록" },
  ];
}

interface ItemUse {
  id: string;
  profile: {
    id: string;
    name: string;
    username: string;
    profile_picture_url: string | null;
  } | null;
  item_name: string | null;
  note: string | null;
  secret: boolean;
  hidden: boolean;
  consumed: boolean;
  status: "pending" | "approved";
  approved_at: string | null;
  created_at: string;
}

interface UsesPage {
  data: ItemUse[];
  pagination: { next_cursor: string | null; has_more: boolean };
  staff: boolean;
  pending_count: number | null;
}

type Filter = "all" | "pending";

/**
 * The use log: items members used from their inventory, newest first, kept
 * off the timeline. The staff confirm each use; a secret use shows to
 * others only as a secret.
 */
export default function UsesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["item-uses", filter],
      queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
        query<UsesPage>("uses:list", {
          limit: 20,
          ...(filter === "pending" && { pending: true }),
          ...(pageParam && { cursor: pageParam }),
        }),
      getNextPageParam: (last) =>
        last.pagination.has_more
          ? (last.pagination.next_cursor ?? undefined)
          : undefined,
      initialPageParam: undefined as string | undefined,
    });

  const uses = data?.pages.flatMap((page) => page.data) ?? [];
  const staff = data?.pages[0]?.staff ?? false;
  const pendingCount = data?.pages[0]?.pending_count ?? 0;

  const approve = useMutation({
    mutationFn: async (useId: string) => {
      try {
        await mutate("uses:approve", { use_id: useId });
      } catch (error) {
        throw new Error(errorMessage(error, "승인하지 못했습니다"));
      }
    },
    onSuccess: () => {
      toast.success("승인했습니다");
      queryClient.invalidateQueries({ queryKey: ["item-uses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            사용 로그
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            상점에서 사용한 아이템이 여기에 기록되고, 운영진이 확인하면
            승인됩니다.
          </p>
        </div>
        <Link
          to="/shop"
          className="text-sm text-primary hover:underline whitespace-nowrap"
        >
          보유 상품 →
        </Link>
      </div>

      {staff && (
        <div role="tablist" aria-label="사용 로그 범위" className="flex gap-1">
          {(
            [
              ["all", "전체"],
              ["pending", "승인 대기"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`px-3 h-8 text-sm rounded-md border transition-colors ${
                filter === value
                  ? "border-primary text-primary bg-primary/10 font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {label}
              {value === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingState message="사용 로그를 불러오는 중..." />
      ) : uses.length === 0 ? (
        <div className="framed p-8 text-center text-muted-foreground">
          {filter === "pending"
            ? "승인을 기다리는 사용이 없습니다."
            : "아직 사용 기록이 없습니다."}
        </div>
      ) : (
        <ul className="framed divide-y divide-border">
          {uses.map((use) => (
            <li key={use.id} className="flex gap-3 px-4 py-3">
              {use.profile && (
                <Link to={`/@${use.profile.username}`} className="shrink-0">
                  <ProfileAvatar
                    profilePictureUrl={
                      use.profile.profile_picture_url || undefined
                    }
                    name={use.profile.name}
                    username={use.profile.username}
                    size="md"
                  />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-semibold text-foreground">
                    {use.profile?.name ?? "알 수 없음"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {shortTime(use.created_at)}
                  </span>
                  {use.secret && !use.hidden && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      비밀
                    </span>
                  )}
                </div>
                {use.hidden ? (
                  <p className="mt-1 text-sm text-muted-foreground inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    비밀 사용입니다.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-foreground">
                      <strong>{use.item_name}</strong>을(를){" "}
                      {use.consumed ? "사용했습니다" : "꺼내 보였습니다"}.
                    </p>
                    {use.note && (
                      <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words border-l-2 border-border pl-2">
                        {use.note}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                {use.status === "approved" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    <Check className="h-3.5 w-3.5" />
                    승인됨
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    승인 대기
                  </span>
                )}
                {staff && use.status === "pending" && (
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(use.id)}
                  >
                    확인
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
          </Button>
        </div>
      )}
    </div>
  );
}
