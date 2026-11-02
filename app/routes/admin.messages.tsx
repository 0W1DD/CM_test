// The owner's reading of direct messages: every conversation between two
// profiles, opened one at a time (each opening is logged), and the log of
// who opened what. The community tells its members beforehand.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Eye, History, MessagesSquare, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminGate,
  BackToAdmin,
  formatDateTime,
  PageHeader,
} from "~/components/admin/ui";
import { ProfileAvatar } from "~/components/profile-avatar";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/hooks/useAuth";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "메시지 열람" },
    { name: "description", content: "멤버 간 1:1 메시지를 열람합니다" },
  ];
}

interface Brief {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
}

interface Pair {
  profile_a: Brief | null;
  profile_b: Brief | null;
  message_count: number;
  last_message_at: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  sender: Brief | undefined;
  images: { id: string; url: string; filename: string }[];
  reactions: { emoji: string; count: number }[];
}

interface MessagesPage {
  profile_a: Brief;
  profile_b: Brief;
  messages: Message[];
  pagination: { next_cursor: string | null; has_more: boolean };
}

interface View {
  id: string;
  viewer: Brief | null;
  profile_a: Brief | null;
  profile_b: Brief | null;
  created_at: string;
}

const name = (profile: Brief | null | undefined) =>
  profile ? `${profile.name} (@${profile.username})` : "알 수 없음";

/** One opened conversation, oldest first, with older pages on demand. */
function Conversation({ pair }: { pair: Pair }) {
  const { currentProfile } = useAuth();
  const a = pair.profile_a;
  const b = pair.profile_b;
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["admin-dm", a?.id, b?.id],
      queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
        try {
          return await mutate<MessagesPage>("moderation:readMessages", {
            profile_id: currentProfile?.id,
            profile_a: a?.id,
            profile_b: b?.id,
            ...(pageParam && { cursor: pageParam }),
          });
        } catch (error) {
          toast.error(errorMessage(error, "메시지를 불러오지 못했습니다"));
          throw error;
        }
      },
      getNextPageParam: (last) =>
        last.pagination.has_more
          ? (last.pagination.next_cursor ?? undefined)
          : undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentProfile && !!a && !!b,
      // Each opening is logged, so it is not fetched again on its own.
      staleTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
    });
  // Pages come newest first; each page is oldest first within.
  const messages = [...(data?.pages ?? [])]
    .reverse()
    .flatMap((page) => page.messages);

  if (isLoading)
    return <LoadingState message="메시지를 불러오는 중..." asCard={false} />;

  return (
    <div className="space-y-3">
      {hasNextPage && (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? "불러오는 중..." : "이전 메시지 더 보기"}
          </Button>
        </div>
      )}
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          남아 있는 메시지가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {messages.map((message) => {
            const fromA = message.sender?.id === a?.id;
            return (
              <li
                key={message.id}
                className={`flex ${fromA ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    fromA
                      ? "bg-muted text-foreground"
                      : "bg-primary/15 text-foreground"
                  }`}
                >
                  <p className="text-xs font-semibold text-muted-foreground mb-0.5">
                    {message.sender?.name ?? "알 수 없음"}
                  </p>
                  {message.content && (
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  )}
                  {message.images.map((image) => (
                    <a
                      key={image.id}
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block mt-1"
                    >
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="max-h-48 rounded"
                      />
                    </a>
                  ))}
                  {message.reactions.length > 0 && (
                    <p className="mt-1 text-xs">
                      {message.reactions
                        .map((r) => `${r.emoji} ${r.count}`)
                        .join("  ")}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDateTime(message.created_at)}
                    {message.read_at ? " · 읽음" : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Pairs() {
  const [search, setSearch] = useState("");
  const [username, setUsername] = useState("");
  const [open, setOpen] = useState<Pair | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dm-pairs", username],
    queryFn: () =>
      query<{ data: Pair[]; has_more: boolean }>("moderation:messagePairs", {
        limit: 100,
        ...(username && { username }),
      }),
  });
  const pairs = data?.data ?? [];

  if (open)
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-foreground">
            {name(open.profile_a)} ↔ {name(open.profile_b)}
          </p>
          <Button variant="outline" size="sm" onClick={() => setOpen(null)}>
            목록으로
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          이 대화를 연 기록이 열람 기록에 남았습니다.
        </p>
        <Conversation pair={open} />
      </div>
    );

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setUsername(search.trim());
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="@아이디로 찾기 (비우면 전체)"
          className="min-w-0 flex-1 border border-border bg-background px-2 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" variant="outline" size="sm">
          <Search className="h-4 w-4" />
          찾기
        </Button>
      </form>
      {isLoading ? (
        <LoadingState message="대화 목록을 불러오는 중..." asCard={false} />
      ) : pairs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          1:1 대화가 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md">
          {pairs.map((pair) => (
            <li key={`${pair.profile_a?.id}-${pair.profile_b?.id}`}>
              <button
                type="button"
                onClick={() => setOpen(pair)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/60 transition-colors"
              >
                <div className="flex -space-x-2 shrink-0">
                  {[pair.profile_a, pair.profile_b].map(
                    (profile) =>
                      profile && (
                        <ProfileAvatar
                          key={profile.id}
                          profilePictureUrl={
                            profile.profile_picture_url || undefined
                          }
                          name={profile.name}
                          username={profile.username}
                          size="sm"
                        />
                      ),
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {name(pair.profile_a)} ↔ {name(pair.profile_b)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    메시지 {pair.message_count}개 · 마지막{" "}
                    {formatDateTime(pair.last_message_at)}
                  </p>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {data?.has_more && (
        <p className="text-xs text-muted-foreground text-center">
          최근 100개 대화까지 보여요. 아이디로 찾아 보세요.
        </p>
      )}
    </div>
  );
}

function Views() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-dm-views"],
    queryFn: () => query<View[]>("moderation:messageViews", { limit: 100 }),
  });
  if (isLoading)
    return <LoadingState message="열람 기록을 불러오는 중..." asCard={false} />;
  if (data.length === 0)
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        아직 열람한 대화가 없습니다.
      </p>
    );
  return (
    <ul className="divide-y divide-border border border-border rounded-md">
      {data.map((view) => (
        <li key={view.id} className="px-3 py-2 text-sm">
          <span className="font-medium">{name(view.viewer)}</span>
          <span className="text-muted-foreground">님이 </span>
          {name(view.profile_a)} ↔ {name(view.profile_b)}
          <span className="text-muted-foreground"> 대화를 열람</span>
          <span className="block text-xs text-muted-foreground">
            {formatDateTime(view.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminMessages() {
  const [tab, setTab] = useState<"pairs" | "views">("pairs");
  return (
    <AdminGate need="owner">
      <div className="container mx-auto py-8 px-4 max-w-3xl space-y-4">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={MessagesSquare}
          title="메시지 열람"
          description="멤버끼리 주고받은 1:1 메시지를 열람합니다. 대화를 열 때마다 열람 기록이 남습니다."
          tone="lilac"
        />
        <div role="tablist" aria-label="메시지 열람" className="flex gap-1">
          {(
            [
              ["pairs", "대화 목록", MessagesSquare],
              ["views", "열람 기록", History],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-sm rounded-md border transition-colors ${
                tab === value
                  ? "border-primary text-primary bg-primary/10 font-semibold"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        {tab === "pairs" ? <Pairs /> : <Views />}
      </div>
    </AdminGate>
  );
}
