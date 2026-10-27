// One application (commung's console application page): the owner and
// moderators review it; its applicant reads, edits or withdraws it.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  ArrowLeft,
  CheckCircle,
  Edit2,
  FileText,
  Trash2,
  XCircle,
} from "lucide-react";
import { useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import {
  type ApplicationFormValues,
  ApplicationFormFields,
} from "~/components/admin/application-form";
import {
  Markdown,
  Notice,
  PageHeader,
  StatusBadge,
} from "~/components/admin/ui";
import {
  APPLICATIONS_KEY,
  type ReviewedApplication,
} from "~/components/admin/types";
import { LoadingState } from "~/components/shared/LoadingState";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { SESSION_KEY } from "~/hooks/useSession";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "가입 신청서 검토" },
    { name: "description", content: "커뮤 가입 신청서를 검토합니다" },
  ];
}

export default function ApplicationView() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading, login } = useAuth();
  const { isModerator } = useCurrentInstance();
  const rejectionReasonId = useId();
  const [rejectionReason, setRejectionReason] = useState("");
  const [editing, setEditing] = useState<ApplicationFormValues | null>(null);

  const applicationKey = ["application", applicationId];
  const {
    data: application,
    isLoading,
    error,
  } = useQuery({
    queryKey: applicationKey,
    queryFn: () =>
      query<ReviewedApplication>("applications:get", {
        application_id: applicationId,
      }),
    enabled: !!user && !!applicationId,
  });

  const afterChange = (message: string, to?: string) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: applicationKey });
    queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });
    queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    if (to) navigate(to);
  };

  const reviewMutation = useMutation({
    mutationFn: (variables: {
      status: "approved" | "rejected";
      reason?: string;
    }) =>
      mutate("applications:review", {
        application_id: applicationId,
        status: variables.status,
        rejection_reason: variables.reason,
      }),
    onSuccess: (_, variables) =>
      afterChange(
        variables.status === "approved"
          ? "지원을 승인했습니다"
          : "지원을 거절했습니다",
        "/admin/applications",
      ),
    onError: (error, variables) =>
      toast.error(
        errorMessage(
          error,
          variables.status === "approved"
            ? "승인에 실패했습니다"
            : "거절에 실패했습니다",
        ),
      ),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ApplicationFormValues) =>
      mutate("applications:update", {
        application_id: applicationId,
        profile_name: values.profileName.trim(),
        profile_username: values.profileUsername.trim(),
        message: values.message || null,
        attachment_ids: application?.attachments.map((a) => a.image_id),
      }),
    onSuccess: () => {
      setEditing(null);
      afterChange("지원서가 수정되었습니다");
    },
    onError: (error) => toast.error(errorMessage(error, "수정에 실패했습니다")),
  });

  const withdrawMutation = useMutation({
    mutationFn: () =>
      mutate("applications:withdraw", { application_id: applicationId }),
    onSuccess: () => afterChange("지원서를 철회했습니다", "/apply"),
    onError: (error) => toast.error(errorMessage(error, "철회에 실패했습니다")),
  });

  if (authLoading || (isLoading && !!user))
    return (
      <LoadingState
        message="신청서를 불러오는 중..."
        asCard={false}
        className="py-16"
      />
    );

  if (!user)
    return (
      <Notice
        title="로그인이 필요합니다"
        description="신청서를 보려면 로그인해주세요"
      >
        <Button onClick={() => login()}>로그인</Button>
      </Notice>
    );

  if (error || !application)
    return (
      <Notice
        icon={FileText}
        title="오류 발생"
        description={errorMessage(error, "신청서를 불러올 수 없습니다")}
      >
        <Link to="/apply">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" />
            지원하기
          </Button>
        </Link>
      </Notice>
    );

  const canEdit = !!application.is_own && application.status === "pending";
  const busy = reviewMutation.isPending;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link to={isModerator ? "/admin/applications" : "/apply"}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              {isModerator ? "신청 목록으로" : "지원 페이지로"}
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {canEdit && !editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditing({
                      profileName: application.profile_name,
                      profileUsername: application.profile_username,
                      message: application.message ?? "",
                    })
                  }
                >
                  <Edit2 className="h-4 w-4" />
                  수정
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  disabled={withdrawMutation.isPending}
                  onClick={() => {
                    if (window.confirm("지원서를 철회하시겠습니까?"))
                      withdrawMutation.mutate();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  철회
                </Button>
              </>
            )}
            <StatusBadge status={application.status} />
          </div>
        </div>

        <PageHeader
          eyebrow="지원서 상세"
          icon={FileText}
          title="지원서"
          description="지원서 내용을 확인해요"
          tone="butter"
        />

        <Card>
          <CardHeader>
            <CardTitle>가입 신청서</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    !editing.profileName.trim() ||
                    !editing.profileUsername.trim()
                  )
                    return;
                  updateMutation.mutate(editing);
                }}
                className="space-y-6"
              >
                <ApplicationFormFields
                  values={editing}
                  onChange={setEditing}
                  disabled={updateMutation.isPending}
                />
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={
                      updateMutation.isPending ||
                      !editing.profileName.trim() ||
                      !editing.profileUsername.trim()
                    }
                  >
                    {updateMutation.isPending && <Spinner />}
                    {updateMutation.isPending ? "저장 중..." : "저장"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(null)}
                    disabled={updateMutation.isPending}
                  >
                    취소
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>신청자 이름</Label>
                    <p className="text-lg font-semibold mt-1">
                      {application.profile_name}
                    </p>
                  </div>
                  <div>
                    <Label>사용자명</Label>
                    <p className="text-lg font-mono mt-1">
                      @{application.profile_username}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>신청일</Label>
                    <p className="mt-1">
                      {format(new Date(application.created_at), "PPP p", {
                        locale: ko,
                      })}
                    </p>
                  </div>
                  {application.reviewed_at && (
                    <div>
                      <Label>처리일</Label>
                      <p className="mt-1">
                        {format(new Date(application.reviewed_at), "PPP p", {
                          locale: ko,
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {application.rejection_reason && (
                  <div>
                    <Label>거절 사유</Label>
                    <p className="mt-1 text-destructive">
                      {application.rejection_reason}
                    </p>
                  </div>
                )}

                {application.message && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">
                      신청 메시지
                    </Label>
                    <Markdown source={application.message} />
                  </div>
                )}

                {application.attachments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">
                      첨부 이미지
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {application.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.image_url.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={attachment.image_url.url}
                            alt="첨부 이미지"
                            className="w-full h-auto rounded-lg border"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {application.status === "pending" && isModerator && (
                  <div className="pt-4 border-t space-y-4">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor={rejectionReasonId}>
                          거절 사유 (선택사항)
                        </FieldLabel>
                        <Textarea
                          id={rejectionReasonId}
                          placeholder="신청을 거절하는 경우 사유를 입력하세요..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          rows={3}
                        />
                      </Field>
                    </FieldGroup>
                    <div className="flex gap-3">
                      <Button
                        className="flex-1"
                        onClick={() =>
                          reviewMutation.mutate({ status: "approved" })
                        }
                        disabled={busy}
                      >
                        {busy ? (
                          <Spinner />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        승인
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() =>
                          reviewMutation.mutate({
                            status: "rejected",
                            reason: rejectionReason.trim() || undefined,
                          })
                        }
                        disabled={busy}
                      >
                        {busy ? <Spinner /> : <XCircle className="h-4 w-4" />}
                        거절
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
