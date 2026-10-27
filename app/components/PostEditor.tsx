import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "~/hooks/useAuth";
import { errorMessage, mutate } from "~/lib/naru";
import type { Post } from "~/types/post";
import { MessageComposer } from "./MessageComposer";

interface PostEditorProps {
  post: Post;
  onSaveSuccess?: () => void;
  onCancel: () => void;
  isOwner?: boolean;
}

export function PostEditor({
  post,
  onSaveSuccess,
  onCancel,
  isOwner = false,
}: PostEditorProps) {
  const { currentProfile } = useAuth();

  const handleSubmit = useCallback(
    async (data: {
      content: string;
      image_ids: string[];
      content_warning?: string;
      announcement?: boolean;
    }) => {
      if (!currentProfile) {
        toast.error("프로필을 선택해주세요.");
        return;
      }

      try {
        await mutate("posts:update", {
          post_id: post.id,
          profile_id: currentProfile.id,
          ...data,
        });
      } catch (error) {
        toast.error(
          errorMessage(error, "게시물 수정에 실패했습니다. 다시 시도해주세요."),
        );
        throw error;
      }

      toast.success("게시물이 성공적으로 수정되었습니다!");
      onSaveSuccess?.();
    },
    [currentProfile, post.id, onSaveSuccess],
  );

  // Announcements can only be set on root posts (not replies)
  const canBeAnnouncement = isOwner && post.depth === 0;

  return (
    <MessageComposer
      mode="edit"
      initialContent={post.content}
      initialImages={post.images}
      initialContentWarning={post.content_warning}
      initialAnnouncement={post.announcement}
      placeholder="게시물 내용을 입력하세요..."
      onSubmit={handleSubmit}
      onCancel={onCancel}
      showAnnouncement={canBeAnnouncement}
      canBeAnnouncement={canBeAnnouncement}
    />
  );
}
