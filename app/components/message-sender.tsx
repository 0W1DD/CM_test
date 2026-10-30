import { AlertTriangle } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { errorMessage, mutate } from "~/lib/naru";
import { MessageComposer } from "./MessageComposer";

interface MessageSenderProps {
  onPostSuccess?: () => void;
  replyToId?: string;
  placeholder?: string;
  initialValue?: string;
}

export function MessageSender({
  onPostSuccess,
  replyToId,
  placeholder = "무슨 일이 일어나고 있나요?",
  initialValue = "",
}: MessageSenderProps) {
  const { currentProfile } = useAuth();
  const { currentInstance, isOwner, isModerator } = useCurrentInstance();

  const now = new Date();
  const communityEnded = currentInstance?.ends_at
    ? now > new Date(currentInstance.ends_at)
    : false;
  const communityNotStarted = currentInstance?.starts_at
    ? now < new Date(currentInstance.starts_at)
    : false;
  const communityEndsAt = currentInstance?.ends_at
    ? new Date(currentInstance.ends_at)
    : undefined;

  const isOwnerOrModerator = isOwner || isModerator;

  // Announcements cannot be replies
  const canBeAnnouncement = isOwner && !replyToId;

  // Scheduling is only available to owners/moderators and cannot be used for replies
  const canSchedule = isOwnerOrModerator && !replyToId;

  const handleSubmit = useCallback(
    async (data: {
      content: string;
      image_ids: string[];
      content_warning?: string;
      announcement?: boolean;
      scheduled_at?: string;
    }) => {
      if (!currentProfile) {
        toast.error("프로필를 선택해주세요.");
        return;
      }

      const postData = {
        ...data,
        in_reply_to_id: replyToId,
        profile_id: currentProfile.id,
      };

      try {
        await mutate("posts:create", postData);
      } catch (error) {
        toast.error(
          errorMessage(error, "메시지 게시에 실패했습니다. 다시 시도해주세요."),
        );
        throw new Error("Failed to send message");
      }

      if (data.scheduled_at) {
        toast.success(
          `게시물이 ${new Date(data.scheduled_at).toLocaleString("ko-KR")}에 예약되었습니다!`,
        );
      } else {
        toast.success("메시지가 성공적으로 게시되었습니다!");
      }
      onPostSuccess?.();
    },
    [currentProfile, replyToId, onPostSuccess],
  );

  // If community has ended, show notice instead of message sender
  if (communityEnded) {
    return (
      <div className="bg-muted border-b border-border p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          커뮤가 종료되었습니다
        </h3>
        <p className="text-muted-foreground">
          이 커뮤는 종료되어 더 이상 게시할 수 없습니다.
        </p>
      </div>
    );
  }

  // If community hasn't started and user is not owner/moderator, show notice
  if (communityNotStarted && !isOwnerOrModerator) {
    return (
      <div className="bg-muted border-b border-border p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          커뮤가 아직 시작되지 않았습니다
        </h3>
        <p className="text-muted-foreground">
          커뮤가 시작되면 게시할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <MessageComposer
      mode="create"
      initialContent={initialValue}
      placeholder={placeholder}
      onSubmit={handleSubmit}
      showAnnouncement={true}
      showScheduling={true}
      canBeAnnouncement={canBeAnnouncement}
      canSchedule={canSchedule}
      schedulingConfig={{
        minDate: new Date(),
        maxDate: communityEndsAt,
      }}
    />
  );
}
