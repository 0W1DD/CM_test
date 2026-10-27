// Members and moderation (commung's console members page, member card,
// role and mute dialogs), plus the moderation log and post reports.
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  Crown,
  Flag,
  MoreVertical,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  User as UserIcon,
  UserMinus,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AdminGate,
  BackToAdmin,
  formatDateTime,
  PageHeader,
  type Role,
  ROLE_CONFIG,
  RoleBadge,
} from "~/components/admin/ui";
import { LoadingState } from "~/components/shared/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
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
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { SESSION_KEY } from "~/hooks/useSession";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "멤버 관리" },
    { name: "description", content: "커뮤 멤버를 관리할 수 있습니다" },
  ];
}

interface CommunityMember {
  id: string;
  role: Role;
  created_at: string;
  is_current_user: boolean;
  user_group?: string;
  profiles: Array<{
    id: string;
    name: string;
    username: string;
    primary: boolean;
    muted_at: string | null;
  }>;
  application: {
    profile_name: string;
    profile_username: string;
    status: string;
  } | null;
}

interface ProfileSummary {
  id: string;
  name: string;
  username: string;
}

interface LogEntry {
  id: string;
  action: "delete_post" | "mute_profile" | "unmute_profile";
  description: string;
  moderator: ProfileSummary | null;
  target_profile: ProfileSummary | null;
  created_at: string;
}

interface Report {
  id: string;
  reason: string;
  created_at: string;
  reporter: ProfileSummary | null;
  post: {
    id: string;
    content: string | null;
    deleted: boolean;
    author: ProfileSummary | null;
  };
}

const MEMBERS_PER_PAGE = 50;
const MEMBERS_KEY = "community-members";

const displayNameOf = (member: CommunityMember) => {
  const primary =
    member.profiles.find((profile) => profile.primary) ?? member.profiles[0];
  if (primary) return primary.name || primary.username;
  if (member.application)
    return (
      member.application.profile_name || member.application.profile_username
    );
  return "알 수 없는 멤버";
};

const groupColor = (group: string) => {
  const hash = group
    .split("")
    .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
};

const ROLE_DESCRIPTIONS = {
  owner: "커뮤의 모든 권한을 가집니다",
  moderator: "멤버 관리 및 게시물 삭제 권한을 가집니다",
  member: "기본 멤버 권한을 가집니다",
} as const;

function RoleDialog({
  member,
  open,
  onClose,
  onDone,
}: {
  member: CommunityMember;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [role, setRole] = useState<Role>(member.role);
  const [saving, setSaving] = useState(false);
  const name = displayNameOf(member);

  const submit = async () => {
    if (role === member.role) return onClose();
    setSaving(true);
    try {
      await mutate("members:setRole", { membership_id: member.id, role });
      toast.success("역할이 변경되었습니다");
      onDone();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "역할 변경에 실패했습니다"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>멤버 역할 변경</DialogTitle>
          <DialogDescription>{name}님의 역할을 변경합니다</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">현재 역할:</span>
            <RoleBadge role={member.role} />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">새 역할:</div>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as Role)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["owner", "moderator", "member"] as const).map((r) => (
                  <SelectItem key={r} value={r}>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={ROLE_CONFIG[r].className}
                        variant="outline"
                      >
                        {ROLE_CONFIG[r].label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_DESCRIPTIONS[r]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role !== member.role && (
            <div className="p-3 bg-butter/40 border border-butter/60 rounded-md">
              <p className="text-sm text-butter-ink">
                <strong>{name}</strong>님의 역할이{" "}
                <strong>{ROLE_CONFIG[member.role].label}</strong>에서{" "}
                <strong>{ROLE_CONFIG[role].label}</strong>로 변경됩니다.
              </p>
              {role === "owner" && (
                <p className="text-xs text-butter-ink mt-1">
                  ⚠️ 소유자 권한을 양도하면 나는 모더레이터가 됩니다. 사이트
                  소유자는 관리 페이지에서 언제든 운영자로 다시 연결할 수
                  있습니다.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          {role !== member.role && (
            <Button
              onClick={submit}
              disabled={saving}
              variant={role === "owner" ? "destructive" : "default"}
            >
              {saving && <Spinner />}
              {saving ? "변경 중..." : "역할 변경"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MuteDialog({
  profile,
  muting,
  onClose,
  onDone,
}: {
  profile: { id: string; name: string } | null;
  muting: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const result = await mutate<{ message: string }>(
        muting ? "moderation:mute" : "moderation:unmute",
        muting
          ? { profile_id: profile.id, reason: reason.trim() || undefined }
          : { profile_id: profile.id },
      );
      toast.success(result.message);
      setReason("");
      onDone();
      onClose();
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          muting ? "음소거에 실패했습니다" : "음소거 해제에 실패했습니다",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={!!profile}
      onOpenChange={(next) => !next && !busy && onClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{muting ? "프로필 음소거" : "음소거 해제"}</DialogTitle>
          <DialogDescription>
            {muting
              ? `${profile?.name}님의 프로필을 음소거합니다. 음소거된 프로필은 글을 작성할 수 없습니다.`
              : `${profile?.name}님의 프로필 음소거를 해제합니다.`}
          </DialogDescription>
        </DialogHeader>
        {muting && (
          <div className="space-y-2">
            <Label htmlFor={reasonId}>사유 (선택사항)</Label>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="음소거 사유를 입력하세요..."
              rows={3}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            variant={muting ? "destructive" : "default"}
          >
            {busy && <Spinner />}
            {muting ? "음소거" : "음소거 해제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberCard({
  member,
  isOwner,
  onUpdate,
}: {
  member: CommunityMember;
  isOwner: boolean;
  onUpdate: () => void;
}) {
  const queryClient = useQueryClient();
  const [showRole, setShowRole] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [mute, setMute] = useState<{
    profile: { id: string; name: string };
    muting: boolean;
  } | null>(null);
  const [removing, setRemoving] = useState(false);
  const self = member.is_current_user;
  const displayName = displayNameOf(member);
  const canChangeRole = isOwner && member.role !== "owner";
  const canRemove = isOwner && member.role !== "owner" && !self;
  const canLeave = self && member.role !== "owner";

  const remove = async () => {
    setRemoving(true);
    try {
      if (self) await mutate("members:leave");
      else await mutate("members:remove", { membership_id: member.id });
      setShowRemove(false);
      if (self) {
        toast.success("커뮤에서 나갔습니다");
        queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      }
      onUpdate();
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          self ? "커뮤 나가기에 실패했습니다" : "멤버 제거에 실패했습니다",
        ),
      );
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Card
        style={
          member.user_group
            ? {
                borderLeft: `4px solid ${groupColor(member.user_group)}`,
                borderRadius: "0.5rem",
              }
            : {}
        }
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-lilac rounded-full flex items-center justify-center text-primary-foreground font-medium flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{displayName}</h3>
                  {self && (
                    <Badge variant="outline" className="text-xs">
                      나
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={member.role} />
                  <span className="text-xs text-muted-foreground">
                    가입일:{" "}
                    {new Date(member.created_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {member.profiles.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      활성 프로필:
                      {member.user_group && (
                        <span className="ml-1">(다중 프로필 사용자)</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {member.profiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center gap-1"
                        >
                          <Badge
                            variant="outline"
                            className={`text-xs ${profile.primary ? "border-primary" : "border-muted"} ${profile.muted_at ? "bg-mute/15 border-mute/40" : ""}`}
                          >
                            {profile.muted_at && (
                              <VolumeX className="w-3 h-3 mr-1 text-mute" />
                            )}
                            {profile.name} (@{profile.username})
                            {profile.primary && " ★"}
                          </Badge>
                          {!self && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {profile.muted_at ? (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setMute({ profile, muting: false })
                                    }
                                  >
                                    <Volume2 className="w-4 h-4 mr-2" />
                                    음소거 해제
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setMute({ profile, muting: true })
                                    }
                                    className="text-mute"
                                  >
                                    <VolumeX className="w-4 h-4 mr-2" />
                                    음소거
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(canChangeRole || canRemove || canLeave) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canChangeRole && (
                    <DropdownMenuItem onClick={() => setShowRole(true)}>
                      <Shield className="w-4 h-4 mr-2" />
                      역할 변경
                    </DropdownMenuItem>
                  )}
                  {(canRemove || canLeave) && (
                    <DropdownMenuItem
                      onClick={() => setShowRemove(true)}
                      className="text-destructive"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      {self ? "커뮤 나가기" : "멤버 제거"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {showRole && (
        <RoleDialog
          member={member}
          open={showRole}
          onClose={() => setShowRole(false)}
          onDone={() => {
            onUpdate();
            queryClient.invalidateQueries({ queryKey: SESSION_KEY });
          }}
        />
      )}
      <MuteDialog
        profile={mute?.profile ?? null}
        muting={mute?.muting ?? true}
        onClose={() => setMute(null)}
        onDone={onUpdate}
      />
      <AlertDialog open={showRemove} onOpenChange={setShowRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {self ? "커뮤 나가기" : "멤버 제거"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {self ? (
                <>
                  정말로 이 커뮤에서 나가시겠습니까? 다시 가입하려면 재신청이
                  필요합니다.
                </>
              ) : (
                <>
                  정말로 <strong>{displayName}</strong>님을 커뮤에서
                  제거하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={removing}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {removing
                ? self
                  ? "나가는 중..."
                  : "제거 중..."
                : self
                  ? "나가기"
                  : "제거"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MemberManagement() {
  const queryClient = useQueryClient();
  const { isOwner } = useCurrentInstance();
  const [searchQuery, setSearchQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: [MEMBERS_KEY, debounced, roleFilter],
    queryFn: ({ pageParam }) =>
      query<CommunityMember[]>("members:list", {
        limit: MEMBERS_PER_PAGE,
        offset: pageParam,
        ...(debounced ? { q: debounced } : {}),
        ...(roleFilter !== "all" ? { role: roleFilter } : {}),
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < MEMBERS_PER_PAGE
        ? undefined
        : allPages.reduce((total, page) => total + page.length, 0),
    initialPageParam: 0,
  });
  const members = useMemo(() => data?.pages.flat() ?? [], [data?.pages]);

  const { data: roleStats = { owner: 0, moderator: 0, member: 0 } } = useQuery({
    queryKey: ["community-member-stats"],
    queryFn: () =>
      query<{ owner: number; moderator: number; member: number }>(
        "members:stats",
      ),
  });

  const update = () => {
    queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY] });
    queryClient.invalidateQueries({ queryKey: ["community-member-stats"] });
    queryClient.invalidateQueries({ queryKey: ["moderation-log"] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              멤버 관리
            </CardTitle>
            <CardDescription>
              커뮤 멤버들을 관리하고 역할을 변경할 수 있습니다
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">
              {roleStats.owner + roleStats.moderator + roleStats.member}
            </div>
            <div className="text-sm text-muted-foreground">총 멤버</div>
          </div>
          {(
            [
              ["owner", Crown, "text-destructive"],
              ["moderator", Shield, "text-primary"],
              ["member", UserIcon, "text-muted-foreground"],
            ] as const
          ).map(([role, Icon, color]) => (
            <div key={role} className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-2xl font-bold">{roleStats[role]}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {ROLE_CONFIG[role].label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="멤버 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as "all" | Role)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 역할</SelectItem>
              <SelectItem value="owner">소유자</SelectItem>
              <SelectItem value="moderator">모더레이터</SelectItem>
              <SelectItem value="member">멤버</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isError && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircle />
              </EmptyMedia>
              <EmptyTitle>오류 발생</EmptyTitle>
              <EmptyDescription>
                멤버 목록을 가져오는데 실패했습니다
              </EmptyDescription>
            </EmptyHeader>
            <Button variant="outline" onClick={() => refetch()}>
              다시 시도
            </Button>
          </Empty>
        )}
        {isLoading && (
          <LoadingState message="멤버 목록을 불러오는 중..." asCard={false} />
        )}
        {!isLoading && !isError && (
          <div className="space-y-3">
            {members.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>
                    {searchQuery || roleFilter !== "all"
                      ? "검색 조건에 맞는 멤버가 없습니다"
                      : "멤버가 없습니다"}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                {members.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    isOwner={isOwner}
                    onUpdate={update}
                  />
                ))}
                {hasNextPage && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="outline"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage && <Spinner />}더 보기 (
                      {members.length}명 표시 중)
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModerationLog() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["moderation-log"],
    queryFn: () => query<LogEntry[]>("moderation:log", { limit: 100 }),
  });
  if (isLoading)
    return <LoadingState message="기록을 불러오는 중..." asCard={false} />;
  if (!data.length)
    return (
      <p className="text-center text-muted-foreground py-8">기록이 없습니다</p>
    );
  return (
    <div className="space-y-2">
      {data.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 p-3 border rounded-lg"
        >
          {entry.action === "unmute_profile" ? (
            <Volume2 className="h-4 w-4 mt-0.5 text-mint-ink" />
          ) : (
            <VolumeX className="h-4 w-4 mt-0.5 text-mute" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm">{entry.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {entry.moderator ? `@${entry.moderator.username}` : "알 수 없음"}
              {entry.target_profile && ` → @${entry.target_profile.username}`} ·{" "}
              {formatDateTime(entry.created_at)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Reports() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["post-reports"],
    queryFn: () => query<Report[]>("moderation:reports", { limit: 100 }),
  });
  if (isLoading)
    return <LoadingState message="신고를 불러오는 중..." asCard={false} />;
  if (!data.length)
    return (
      <p className="text-center text-muted-foreground py-8">신고가 없습니다</p>
    );
  return (
    <div className="space-y-2">
      {data.map((report) => (
        <div key={report.id} className="p-3 border rounded-lg space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{report.reason}</p>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDateTime(report.created_at)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            신고자:{" "}
            {report.reporter ? `@${report.reporter.username}` : "알 수 없음"}
          </p>
          {report.post.deleted ? (
            <p className="text-xs text-muted-foreground">삭제된 게시물</p>
          ) : report.post.author ? (
            <Link
              to={`/@${report.post.author.username}/${report.post.id}`}
              className="block text-sm text-primary hover:underline truncate"
            >
              @{report.post.author.username}:{" "}
              {report.post.content || "(내용 없음)"}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function CommunityMembers() {
  return (
    <AdminGate need="staff">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={Users}
          title="멤버 관리"
          description="커뮤 멤버를 살펴보고 역할을 조정해요"
          tone="lilac"
        />
        <Tabs defaultValue="members">
          <TabsList className="mb-4">
            <TabsTrigger value="members">
              <Users className="h-4 w-4" />
              멤버
            </TabsTrigger>
            <TabsTrigger value="reports">
              <Flag className="h-4 w-4" />
              신고
            </TabsTrigger>
            <TabsTrigger value="log">
              <ScrollText className="h-4 w-4" />
              모더레이션 기록
            </TabsTrigger>
          </TabsList>
          <TabsContent value="members">
            <MemberManagement />
          </TabsContent>
          <TabsContent value="reports">
            <Card>
              <CardContent className="pt-6">
                <Reports />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="log">
            <Card>
              <CardContent className="pt-6">
                <ModerationLog />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminGate>
  );
}
