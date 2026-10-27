// The admin home: the site owner opens the community and connects their
// member account as its owner; the owner and moderators reach the admin
// sections (commung's console community page for its staff).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  CheckCircle,
  Clock,
  FileText,
  LayoutList,
  Link as LinkIcon,
  LogIn,
  type LucideIcon,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ApplicationFormFields } from "~/components/admin/application-form";
import { SettingsForm } from "~/components/admin/settings-form";
import { PageHeader } from "~/components/admin/ui";
import { LoadingState } from "~/components/shared/LoadingState";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Spinner } from "~/components/ui/spinner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { SESSION_KEY } from "~/hooks/useSession";
import { errorMessage, ownerSession, ownerSignIn, query } from "~/lib/naru";

export function meta() {
  return [{ title: "커뮤 관리" }];
}

interface OwnerStatus {
  is_set_up: boolean;
  owner_member: string | null;
}

interface Stats {
  applications: { pending: number; approved: number; rejected: number };
  members: { total: number };
}

const SECTIONS: {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  ownerOnly?: boolean;
}[] = [
  {
    to: "/admin/applications",
    icon: FileText,
    title: "지원서",
    description: "가입 신청을 검토하고 승인하거나 거절합니다",
  },
  {
    to: "/admin/members",
    icon: Users,
    title: "멤버",
    description: "멤버의 역할을 바꾸고 프로필을 음소거합니다",
  },
  {
    to: "/admin/analytics",
    icon: BarChart3,
    title: "활동 분석",
    description: "게시글과 메시지 활동을 살펴봅니다",
  },
  {
    to: "/admin/settings",
    icon: Settings,
    title: "커뮤 설정",
    description: "이름, 일정, 모집, 운영 옵션을 조정합니다",
    ownerOnly: true,
  },
  {
    to: "/admin/links",
    icon: LinkIcon,
    title: "링크",
    description: "커뮤에 표시할 외부 링크를 관리합니다",
    ownerOnly: true,
  },
  {
    to: "/admin/boards",
    icon: LayoutList,
    title: "게시판",
    description: "게시판을 만들고 관리합니다",
  },
  {
    to: "/admin/shop",
    icon: ShoppingBag,
    title: "상점",
    description: "화폐와 상품을 관리합니다",
  },
  {
    to: "/admin/bots",
    icon: Bot,
    title: "봇",
    description: "커뮤의 봇을 관리합니다",
  },
];

/** The site owner's part: opening the community and claiming it. */
function SiteOwnerPanel() {
  const queryClient = useQueryClient();
  const { user, login, availableProfiles } = useAuth();
  const [profile, setProfile] = useState({
    profileName: "",
    profileUsername: "",
    message: "",
  });

  const adminSession = useQuery({
    queryKey: ["admin-session"],
    queryFn: ownerSession,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const admin = adminSession.data ?? null;
  const status = useQuery({
    queryKey: ["owner-status"],
    queryFn: () => {
      if (!admin) throw new Error("사이트 소유자로 로그인해주세요");
      return admin.query<OwnerStatus>("community:ownerStatus");
    },
    enabled: !!admin,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["owner-status"] });
    queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    queryClient.invalidateQueries({ queryKey: ["instance"] });
  };

  const claim = useMutation({
    mutationFn: () => {
      if (!admin || !user) throw new Error("로그인이 필요합니다");
      return admin.mutate("owner:claim", {
        member: user.id,
        ...(availableProfiles.length === 0
          ? {
              profile_name: profile.profileName.trim(),
              profile_username: profile.profileUsername.trim(),
            }
          : {}),
      });
    },
    onSuccess: () => {
      toast.success("운영자로 연결되었습니다");
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, "연결에 실패했습니다")),
  });

  if (adminSession.isLoading || (admin && status.isLoading))
    return <LoadingState message="사이트 소유자 확인 중..." asCard={false} />;

  if (!admin)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            사이트 소유자
          </CardTitle>
          <CardDescription>
            이 나루 사이트의 소유자라면 소유자로 로그인해 커뮤를 개설하거나
            운영자 계정을 연결할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void ownerSignIn()}>
            <LogIn className="h-4 w-4" />
            사이트 소유자로 로그인
          </Button>
        </CardContent>
      </Card>
    );

  if (status.error || !status.data)
    return (
      <div className="text-destructive">
        {errorMessage(status.error, "상태를 불러올 수 없습니다")}
      </div>
    );

  if (!status.data.is_set_up)
    return (
      <Card>
        <CardHeader>
          <CardTitle>커뮤 개설</CardTitle>
          <CardDescription>
            커뮤의 이름과 일정을 정해 커뮤를 엽니다. 다른 설정은 나중에 바꿀 수
            있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm
            initial={null}
            submitLabel="커뮤 개설"
            onSubmit={async (body) => {
              await admin.mutate("owner:setup", body as never);
              toast.success("커뮤가 개설되었습니다");
              refresh();
            }}
          />
        </CardContent>
      </Card>
    );

  if (user && status.data.owner_member === user.id) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-5 w-5" />
          운영자로 연결
        </CardTitle>
        <CardDescription>
          {status.data.owner_member
            ? "다른 회원 계정이 커뮤 소유자입니다. 지금 로그인한 회원 계정을 소유자로 연결하면 기존 소유자는 멤버가 됩니다."
            : "커뮤를 운영할 회원 계정을 연결합니다. 커뮤에서는 이 회원 계정으로 활동합니다."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!user ? (
          <Button onClick={() => login()}>
            <LogIn className="h-4 w-4" />
            회원으로 로그인
          </Button>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              claim.mutate();
            }}
          >
            {availableProfiles.length === 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  커뮤에서 쓸 첫 프로필을 만듭니다.
                </p>
                <ApplicationFormFields
                  values={profile}
                  onChange={setProfile}
                  disabled={claim.isPending}
                  withoutMessage
                />
              </>
            )}
            <Button
              type="submit"
              disabled={
                claim.isPending ||
                (availableProfiles.length === 0 &&
                  (!profile.profileName.trim() ||
                    !profile.profileUsername.trim()))
              }
            >
              {claim.isPending && <Spinner />}
              운영자로 연결
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function StaffSections() {
  const { isOwner } = useCurrentInstance();
  const { data: stats } = useQuery({
    queryKey: ["community-stats"],
    queryFn: () => query<Stats>("analytics:stats"),
  });
  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile
            icon={Clock}
            label="대기 중"
            value={stats.applications.pending}
            badge="bg-butter/40 text-butter-ink"
          />
          <StatTile
            icon={CheckCircle}
            label="승인됨"
            value={stats.applications.approved}
            badge="bg-mint/40 text-mint-ink"
          />
          <StatTile
            icon={XCircle}
            label="거절됨"
            value={stats.applications.rejected}
            badge="bg-destructive/15 text-destructive"
          />
          <StatTile
            icon={Users}
            label="멤버"
            value={stats.members.total}
            badge="bg-primary/15 text-primary"
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.filter((section) => isOwner || !section.ownerOnly).map(
          (section) => (
            <Link key={section.to} to={section.to} className="block group">
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 transition-all hover:shadow-md hover:border-primary/30 h-full">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                    <section.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">
                    {section.title}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  badge: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge className={badge}>{value}</Badge>
    </div>
  );
}

export default function AdminHome() {
  const { isLoading } = useAuth();
  const {
    isModerator,
    isLoading: instanceLoading,
    instanceName,
  } = useCurrentInstance();

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl space-y-6">
      <PageHeader
        eyebrow="운영"
        icon={ShieldCheck}
        title="커뮤 관리"
        description={instanceName || "커뮤를 열고 운영해요"}
        tone="lilac"
      />
      <SiteOwnerPanel />
      {isLoading || instanceLoading ? (
        <LoadingState message="인증 확인 중..." asCard={false} />
      ) : isModerator ? (
        <StaffSections />
      ) : null}
    </div>
  );
}
