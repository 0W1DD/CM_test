// Reviewing applications (commung's console applications page): the owner
// and moderators approve and reject; the owner takes reviews back.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckIcon,
  FileText,
  ImageIcon,
  RotateCcw,
  XIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  AdminGate,
  BackToAdmin,
  formatDateTime,
  PageHeader,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/admin/ui";
import {
  APPLICATIONS_KEY,
  type ReviewedApplication,
} from "~/components/admin/types";
import { LoadingState } from "~/components/shared/LoadingState";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "지원서 관리" },
    { name: "description", content: "내 커뮤에 지원한 사용자들을 관리하세요" },
  ];
}

type SortKey = "profile_name" | "status" | "created_at" | "reviewed_at";

function ApplicationsTable() {
  const queryClient = useQueryClient();
  const { isOwner } = useCurrentInstance();
  const rejectionReasonId = useId();
  const [sortBy, setSortBy] = useState<SortKey | "">("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingApplicationId, setProcessingApplicationId] = useState("");

  const {
    data: allApplications = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: APPLICATIONS_KEY,
    queryFn: () => query<ReviewedApplication[]>("applications:list"),
  });

  const done = () => {
    queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });
    setRejectDialogOpen(false);
    setSelectedApplicationId("");
    setRejectionReason("");
    setProcessingApplicationId("");
  };

  const reviewMutation = useMutation({
    mutationFn: (variables: {
      applicationId: string;
      status: "approved" | "rejected";
      rejection_reason?: string;
    }) =>
      mutate("applications:review", {
        application_id: variables.applicationId,
        status: variables.status,
        rejection_reason: variables.rejection_reason,
      }),
    onSuccess: (_, variables) => {
      toast.success(
        variables.status === "approved"
          ? "지원서를 승인했습니다!"
          : "지원서를 거절했습니다.",
      );
      done();
    },
    onError: (error) => {
      toast.error(errorMessage(error, "처리에 실패했습니다"));
      setProcessingApplicationId("");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (applicationId: string) =>
      mutate("applications:revoke", { application_id: applicationId }),
    onSuccess: () => {
      toast.success("지원서 처리를 취소했습니다!");
      done();
    },
    onError: (error) => {
      toast.error(errorMessage(error, "취소에 실패했습니다"));
      setProcessingApplicationId("");
    },
  });

  const handleReview = (
    applicationId: string,
    status: "approved" | "rejected",
  ) => {
    if (status === "rejected") {
      setSelectedApplicationId(applicationId);
      setRejectDialogOpen(true);
    } else {
      setProcessingApplicationId(applicationId);
      reviewMutation.mutate({ applicationId, status });
    }
  };

  const handleRejectConfirm = () => {
    if (!selectedApplicationId) return;
    setProcessingApplicationId(selectedApplicationId);
    reviewMutation.mutate({
      applicationId: selectedApplicationId,
      status: "rejected",
      rejection_reason: rejectionReason.trim() || undefined,
    });
  };

  const sortedApplications = [...allApplications].sort((a, b) => {
    if (!sortBy) return 0;
    const aValue = a[sortBy] ?? "";
    const bValue = b[sortBy] ?? "";
    if (sortBy === "profile_name")
      return sortOrder === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: SortKey) => {
    if (sortBy === column) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };
  const arrow = (column: SortKey) =>
    sortBy === column ? (sortOrder === "asc" ? "↑" : "↓") : "";

  if (isLoading)
    return <LoadingState message="지원서를 불러오는 중..." asCard={false} />;

  if (error)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle />
          </EmptyMedia>
          <EmptyTitle>오류 발생</EmptyTitle>
          <EmptyDescription>
            {errorMessage(error, "지원서를 불러올 수 없습니다")}
          </EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => refetch()}>다시 시도</Button>
      </Empty>
    );

  if (sortedApplications.length === 0)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>지원서가 없습니다</EmptyTitle>
          <EmptyDescription>아직 지원한 사용자가 없습니다</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>지원서 목록</CardTitle>
          <CardDescription>
            총 {sortedApplications.length}개의 지원서가 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("profile_name")}
                >
                  지원자 {arrow("profile_name")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("status")}
                >
                  상태 {arrow("status")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("created_at")}
                >
                  지원일 {arrow("created_at")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort("reviewed_at")}
                >
                  처리일 {arrow("reviewed_at")}
                </TableHead>
                <TableHead className="w-40">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedApplications.map((application) => {
                const busy = processingApplicationId === application.id;
                return (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Link
                        to={`/admin/applications/${application.id}`}
                        className="text-left hover:underline block"
                      >
                        <div className="font-medium">
                          {application.profile_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          @{application.profile_username}
                        </div>
                        {application.attachments.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <ImageIcon className="w-3 h-3" />
                            <span>{application.attachments.length}개 첨부</span>
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={application.status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDateTime(application.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDateTime(application.reviewed_at)}
                      </div>
                    </TableCell>
                    <TableCell className="w-40">
                      <div className="flex gap-2 min-w-max">
                        {application.status === "pending" ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleReview(application.id, "approved")
                              }
                              disabled={busy}
                              className="text-mint-ink border-mint/60 hover:bg-mint/40 flex-1"
                            >
                              {busy ? (
                                <Spinner />
                              ) : (
                                <CheckIcon className="w-4 h-4" />
                              )}
                              승인
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleReview(application.id, "rejected")
                              }
                              disabled={busy}
                              className="text-destructive border-destructive/30 hover:bg-destructive/10 flex-1"
                            >
                              {busy ? (
                                <Spinner />
                              ) : (
                                <XIcon className="w-4 h-4" />
                              )}
                              거절
                            </Button>
                          </>
                        ) : isOwner ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setProcessingApplicationId(application.id);
                              revokeMutation.mutate(application.id);
                            }}
                            disabled={busy}
                            className="w-full"
                          >
                            {busy ? (
                              <Spinner />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            {application.status === "approved"
                              ? "승인 취소"
                              : "거절 취소"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>지원 거절</DialogTitle>
            <DialogDescription>
              이 지원을 거절하시겠습니까? 거절 사유를 입력할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={rejectionReasonId}>
                  거절 사유 (선택사항)
                </FieldLabel>
                <Textarea
                  id={rejectionReasonId}
                  placeholder="신청을 거절하는 사유를 입력하세요..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </Field>
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedApplicationId("");
                setRejectionReason("");
              }}
              disabled={reviewMutation.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Spinner />}
              {reviewMutation.isPending ? "거절 중..." : "거절"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ApplicationsPage() {
  return (
    <AdminGate need="staff">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <BackToAdmin />
        <PageHeader
          eyebrow="운영"
          icon={FileText}
          title="지원서 검토"
          description="새 가입 지원서를 검토해요"
          tone="butter"
        />
        <ApplicationsTable />
      </div>
    </AdminGate>
  );
}
