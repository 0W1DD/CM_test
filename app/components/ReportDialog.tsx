import { useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { errorMessage, mutate } from "~/lib/naru";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  profileId: string;
}

export function ReportDialog({
  open,
  onOpenChange,
  postId,
  profileId,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("신고 사유를 입력해주세요");
      return;
    }

    setIsSubmitting(true);
    try {
      await mutate("posts:report", {
        post_id: postId,
        reason: reason.trim(),
        profile_id: profileId,
      });

      toast.success("신고가 접수되었습니다");
      setReason("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "신고 접수에 실패했습니다"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>게시물 신고</DialogTitle>
          <DialogDescription>
            이 게시물을 신고하는 이유를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="신고 사유를 자세히 작성해주세요..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={2000}
          />
          <div className="text-xs text-muted-foreground mt-1 text-right">
            {reason.length}/2000
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            {isSubmitting ? "제출 중..." : "신고하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
