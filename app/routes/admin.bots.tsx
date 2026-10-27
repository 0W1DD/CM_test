// The community's bots and their tokens (commung's console
// communities.$slug.bots), for the owner.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Copy, Eye, EyeOff, Key, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  AdminGate,
  BackToAdmin,
  PageHeader,
} from "~/components/community-admin-kit";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "sonner";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "봇 관리" },
    {
      name: "description",
      content: "커뮤니티 봇을 관리할 수 있습니다",
    },
  ];
}

interface BotData {
  id: string;
  name: string;
  description: string | null;
  profileId: string;
  profileName: string;
  profileUsername: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface BotToken {
  id: string;
  name: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

interface NewBotToken {
  id: string;
  token: string;
  name: string | null;
  created_at: string;
  expires_at: string | null;
}

/** A call's refusal as an Error with its message (or `fallback`). */
async function orFail<T>(call: Promise<T>, fallback: string): Promise<T> {
  try {
    return await call;
  } catch (error) {
    throw new Error(errorMessage(error, fallback));
  }
}

async function fetchBots(): Promise<BotData[]> {
  return orFail(
    query<BotData[]>("bots:adminList"),
    "봇 목록을 가져오는데 실패했습니다",
  );
}

async function fetchBotTokens(botId: string): Promise<BotToken[]> {
  return orFail(
    query<BotToken[]>("bots:adminTokens", { bot_id: botId }),
    "토큰 목록을 가져오는데 실패했습니다",
  );
}

function TokenDisplay({ token }: { token: string }) {
  const [visible, setVisible] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(token);
    toast.success("토큰이 클립보드에 복사되었습니다");
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
      <span className="flex-1 truncate">
        {visible ? token : "••••••••••••••••••••••••••••••••••••"}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="sm" onClick={copyToClipboard}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CreateBotDialog({
  slug,
  onSuccess,
}: {
  slug: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const nameId = useId();
  const descriptionId = useId();
  const profileNameId = useId();
  const profileUsernameId = useId();

  const createBotMutation = useMutation({
    mutationFn: async () => {
      return orFail(
        mutate("bots:adminCreate", {
          name,
          description: description || null,
          profile_name: profileName,
          profile_username: profileUsername,
        }),
        "봇 생성에 실패했습니다",
      );
    },
    onSuccess: () => {
      toast.success("봇이 성공적으로 생성되었습니다");
      setOpen(false);
      setName("");
      setDescription("");
      setProfileName("");
      setProfileUsername("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />봇 추가
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 봇 생성</DialogTitle>
          <DialogDescription>
            커뮤니티에 새 봇을 추가합니다. 봇은 API를 통해 포스트를 읽고 작성할
            수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor={nameId}>봇 이름</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 공지사항 봇"
            />
          </div>
          <div>
            <Label htmlFor={descriptionId}>설명 (선택)</Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="봇이 하는 일에 대한 설명"
            />
          </div>
          <div>
            <Label htmlFor={profileNameId}>프로필 이름</Label>
            <Input
              id={profileNameId}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="예: 공지사항 봇"
            />
          </div>
          <div>
            <Label htmlFor={profileUsernameId}>프로필 사용자명</Label>
            <Input
              id={profileUsernameId}
              value={profileUsername}
              onChange={(e) => setProfileUsername(e.target.value)}
              placeholder="예: announcement_bot"
            />
            <p className="text-xs text-muted-foreground mt-1">
              영문, 숫자, 밑줄(_)만 사용 가능합니다
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            onClick={() => createBotMutation.mutate()}
            disabled={
              createBotMutation.isPending ||
              !name ||
              !profileName ||
              !profileUsername
            }
          >
            {createBotMutation.isPending ? "생성 중..." : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTokenDialog({
  slug,
  botId,
  onSuccess,
}: {
  slug: string;
  botId: string;
  onSuccess: (token: NewBotToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const tokenNameId = useId();

  const createTokenMutation = useMutation({
    mutationFn: async () => {
      return orFail(
        mutate<NewBotToken>("bots:adminCreateToken", {
          bot_id: botId,
          name: name || null,
        }),
        "토큰 생성에 실패했습니다",
      );
    },
    onSuccess: (result) => {
      toast.success(
        "토큰이 성공적으로 생성되었습니다. 이 토큰은 다시 볼 수 없으니 안전하게 저장하세요.",
      );
      setOpen(false);
      setName("");
      onSuccess(result);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Key className="w-4 h-4 mr-2" />
          토큰 생성
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 API 토큰 생성</DialogTitle>
          <DialogDescription>
            봇 API 접근을 위한 새 토큰을 생성합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor={tokenNameId}>토큰 이름 (선택)</Label>
            <Input
              id={tokenNameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: production, development"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            onClick={() => createTokenMutation.mutate()}
            disabled={createTokenMutation.isPending}
          >
            {createTokenMutation.isPending ? "생성 중..." : "생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BotCard({ bot, slug }: { bot: BotData; slug: string }) {
  const [newToken, setNewToken] = useState<NewBotToken | null>(null);
  const queryClient = useQueryClient();

  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["bot-tokens", slug, bot.id],
    queryFn: () => fetchBotTokens(bot.id),
  });

  const deleteBotMutation = useMutation({
    mutationFn: async () => {
      await orFail(
        mutate("bots:adminDelete", { bot_id: bot.id }),
        "봇 삭제에 실패했습니다",
      );
    },
    onSuccess: () => {
      toast.success("봇이 성공적으로 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["bots", slug] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      await orFail(
        mutate("bots:adminRevokeToken", { bot_id: bot.id, token_id: tokenId }),
        "토큰 폐기에 실패했습니다",
      );
    },
    onSuccess: () => {
      toast.success("토큰이 성공적으로 폐기되었습니다");
      queryClient.invalidateQueries({ queryKey: ["bot-tokens", slug, bot.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const activeTokens = tokens?.filter((t) => !t.revokedAt) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              {bot.name}
            </CardTitle>
            <CardDescription>
              @{bot.profileUsername} &middot; {bot.profileName}
            </CardDescription>
            {bot.description && (
              <p className="text-sm text-muted-foreground mt-2">
                {bot.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (
                confirm(
                  "정말로 이 봇을 삭제하시겠습니까? 모든 토큰도 폐기됩니다.",
                )
              ) {
                deleteBotMutation.mutate();
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {newToken && (
          <div className="p-4 bg-mint/40 border border-mint/60 rounded-lg space-y-2">
            <p className="text-sm font-medium text-mint-ink">
              새 토큰이 생성되었습니다. 이 토큰은 다시 볼 수 없으니 안전하게
              저장하세요.
            </p>
            <TokenDisplay token={newToken.token} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewToken(null)}
            >
              확인
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">API 토큰</h4>
            <CreateTokenDialog
              slug={slug}
              botId={bot.id}
              onSuccess={(token) => {
                setNewToken(token);
                queryClient.invalidateQueries({
                  queryKey: ["bot-tokens", slug, bot.id],
                });
              }}
            />
          </div>

          {tokensLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : activeTokens.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              토큰이 없습니다. 토큰을 생성하여 API에 접근하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {activeTokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {token.name || "이름 없음"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      생성: {new Date(token.createdAt).toLocaleDateString()}
                      {token.lastUsedAt &&
                        ` · 마지막 사용: ${new Date(token.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("정말로 이 토큰을 폐기하시겠습니까?")) {
                        revokeTokenMutation.mutate(token.id);
                      }
                    }}
                  >
                    폐기
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminBots() {
  return (
    <AdminGate
      allow="owner"
      icon={Bot}
      title="봇 관리"
      denied="봇 관리 권한이 없습니다"
    >
      <CommunityBots />
    </AdminGate>
  );
}

/** How a bot program calls: the site's bot queries and mutations with its token. */
const BOT_CALLS = [
  'query("bot:posts", { token, limit?, cursor? })',
  'query("bot:post", { token, post_id })',
  'subscribe("bot:mentions", { token, since?, limit? }, onResult)',
  'mutate("bot:createPost", { token, content, in_reply_to_id?, content_warning? })',
  'mutate("bot:updatePost", { token, post_id, content, content_warning? })',
  'mutate("bot:deletePost", { token, post_id })',
  'mutate("bot:addReaction", { token, post_id, emoji })',
  'mutate("bot:removeReaction", { token, post_id, emoji })',
];

function CommunityBots() {
  const { instanceSlug: slug } = useCurrentInstance();
  const queryClient = useQueryClient();

  const { data: bots, isLoading: botsLoading } = useQuery({
    queryKey: ["bots", slug],
    queryFn: fetchBots,
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <BackToAdmin />
          <CreateBotDialog
            slug={slug}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["bots", slug] });
            }}
          />
        </div>

        <PageHeader
          eyebrow="운영"
          icon={Bot}
          title="봇 토큰"
          description="API로 자동화할 수 있는 봇 토큰을 관리해요"
          tone="lilac"
        />

        <Card>
          <CardContent className="pt-6">
            <div>
              <h4 className="text-sm font-medium mb-2">봇 API</h4>
              <p className="text-sm text-muted-foreground mb-2">
                봇 프로그램은 Naru SDK로 이 사이트의 봇 쿼리와 뮤테이션을 토큰과
                함께 부릅니다:{" "}
                <code className="font-mono">
                  createNaru({"{"} site: "{slug}" {"}"})
                </code>{" "}
                (https://sdk.naru.pub/sdk/1.1.0/naru.js)
              </p>
              <div className="space-y-1 text-sm text-muted-foreground font-mono">
                {BOT_CALLS.map((call) => (
                  <p key={call}>naru.{call}</p>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                방문자 호출이라 주소마다 1분에 20번까지 부를 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        {botsLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        ) : bots?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                아직 생성된 봇이 없습니다. 봇을 추가하여 API를 통해 커뮤니티와
                상호작용하세요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bots?.map((bot) => (
              <BotCard key={bot.id} bot={bot} slug={slug} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
