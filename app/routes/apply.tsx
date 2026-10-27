// Joining the community (commung's console apply page): the landing for
// visitors and signed-in members who are not yet in, with their
// applications and the form.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  ExternalLink,
  LogIn,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  type ApplicationFormValues,
  ApplicationFormFields,
} from "~/components/admin/application-form";
import { Markdown, PageHeader, StatusBadge } from "~/components/admin/ui";
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
import { SESSION_KEY, type SessionInstance } from "~/hooks/useSession";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "커뮤 가입 신청" },
    { name: "description", content: "커뮤에 가입 신청하세요" },
  ];
}

interface MyApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  profile_name: string;
  profile_username: string;
  message: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface CommunityLink {
  id: string;
  title: string;
  url: string;
}

const EMPTY: ApplicationFormValues = {
  profileName: "",
  profileUsername: "",
  message: "",
};

/** Whether the community takes applications now (as the site's code decides). */
function recruitingNow(instance: SessionInstance | null) {
  if (!instance?.is_recruiting) return false;
  const now = Date.now();
  const at = (value: string | null) => (value ? Date.parse(value) : null);
  const starts = at(instance.recruiting_starts_at);
  const ends = at(instance.recruiting_ends_at);
  const communityEnds = at(instance.ends_at);
  return (
    (starts === null || starts <= now) &&
    (ends === null || ends > now) &&
    (communityEnds === null || communityEnds > now)
  );
}

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("ko-KR") : "";

export default function Apply() {
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, login } = useAuth();
  const {
    currentInstance,
    instanceName,
    isLoading: instanceLoading,
  } = useCurrentInstance();
  const [values, setValues] = useState<ApplicationFormValues>(EMPTY);

  const { data: myApplications = [], isLoading: applicationsLoading } =
    useQuery({
      queryKey: ["my-applications"],
      queryFn: () => query<MyApplication[]>("applications:mine"),
      enabled: !!user && !user.is_member,
    });

  const { data: links = [] } = useQuery({
    queryKey: ["community-links"],
    queryFn: () => query<CommunityLink[]>("community:links"),
  });

  const applyMutation = useMutation({
    mutationFn: () =>
      mutate<{ status: string }>("applications:apply", {
        message: values.message || null,
        profile_name: values.profileName.trim(),
        profile_username: values.profileUsername.trim(),
      }),
    onSuccess: (result) => {
      toast.success(
        result.status === "approved"
          ? "가입이 승인되었습니다!"
          : "지원이 완료되었습니다!",
      );
      setValues(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, "지원에 실패했습니다")),
  });

  if (authLoading || instanceLoading)
    return (
      <LoadingState
        message="커뮤 정보를 불러오는 중..."
        asCard={false}
        className="py-16"
      />
    );

  const instance = currentInstance;
  const recruiting = recruitingNow(instance);
  const hasPending = myApplications.some((app) => app.status === "pending");

  const renderForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>가입 신청서</CardTitle>
        <CardDescription>
          {instanceName}에 가입을 신청합니다. 운영자가 검토한 후 승인 여부를
          알려드립니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!values.profileName.trim() || !values.profileUsername.trim())
              return;
            applyMutation.mutate();
          }}
          className="space-y-6"
        >
          <ApplicationFormFields
            values={values}
            onChange={setValues}
            disabled={applyMutation.isPending}
          />
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={
              applyMutation.isPending ||
              !values.profileName.trim() ||
              !values.profileUsername.trim()
            }
          >
            {applyMutation.isPending && <Spinner />}
            {applyMutation.isPending ? "신청 중..." : "가입 신청하기"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    if (!user)
      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>로그인이 필요합니다</CardTitle>
            <CardDescription>
              {instanceName}에 지원하려면 먼저 나루 계정으로 로그인해주세요
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button className="w-full" onClick={() => login()}>
              <LogIn className="h-4 w-4" />
              로그인
            </Button>
          </CardContent>
        </Card>
      );

    if (user.is_member)
      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-mint/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-mint-ink" />
            </div>
            <CardTitle className="text-mint-ink">
              이미 가입된 커뮤입니다
            </CardTitle>
            <CardDescription>
              {instanceName}의 {user.role === "owner" ? "운영자" : "멤버"}
              입니다
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/">
              <Button variant="outline" className="w-full">
                커뮤로 가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      );

    if (applicationsLoading)
      return (
        <LoadingState message="지원 내역을 불러오는 중..." asCard={false} />
      );

    const closed = (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>지금은 모집 중이 아닙니다</CardTitle>
          <CardDescription>
            모집 기간에 다시 찾아와 주세요
            {instance?.recruiting_starts_at &&
              ` (모집 기간: ${formatDate(instance.recruiting_starts_at)} ~ ${formatDate(instance.recruiting_ends_at)})`}
          </CardDescription>
        </CardHeader>
      </Card>
    );

    return (
      <div className="space-y-6">
        {myApplications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>내 지원 내역</CardTitle>
              <CardDescription>
                이 커뮤에 제출한 지원서 목록입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myApplications.map((app) => (
                  <Link
                    key={app.id}
                    to={`/admin/applications/${app.id}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={app.status} />
                        <span className="text-sm text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1">
                        {app.profile_name} (@{app.profile_username})
                      </p>
                      {app.rejection_reason && (
                        <p className="text-xs text-destructive mt-1">
                          거절 사유: {app.rejection_reason}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {!hasPending && (recruiting ? renderForm() : closed)}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="space-y-8">
        <PageHeader
          eyebrow="지원하기"
          icon={Sparkles}
          title="커뮤에 참여해요"
          description={instanceName}
          tone="mint"
        />

        {instance?.banner_image_url && (
          <div className="relative w-full rounded-xl overflow-hidden bg-muted">
            <img
              src={instance.banner_image_url}
              alt={`${instanceName} 배너`}
              className="w-full h-auto object-contain"
            />
          </div>
        )}

        {(instance?.is_recruiting || instance?.minimum_birth_year) && (
          <div className="flex flex-wrap justify-center gap-2">
            {recruiting && (
              <Badge className="bg-mint/40 text-mint-ink">
                <Sparkles className="h-3 w-3 mr-1" />
                모집 중
              </Badge>
            )}
            {instance?.minimum_birth_year && (
              <Badge variant="outline" className="text-muted-foreground">
                {instance.minimum_birth_year}년생+
              </Badge>
            )}
          </div>
        )}

        {instance?.description && <Markdown source={instance.description} />}

        {links.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
              >
                {link.title}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}

        {renderContent()}

        <div className="text-center">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            사이트 운영자이신가요? 관리 페이지로
          </Link>
        </div>
      </div>
    </div>
  );
}
