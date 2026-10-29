import { Edit, Flag, Megaphone, Pin, Shield, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { ProfileAvatar } from "~/components/profile-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { PostEditHistory } from "./PostEditHistory";

interface PostAuthor {
  id: string;
  username: string;
  name: string;
  profile_picture_url?: string | null;
}

interface PostCardHeaderProps {
  postId: string;
  author: PostAuthor;
  createdAt: string | null;
  updatedAt?: string | null;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  isReply?: boolean;
  currentProfileId?: string;
  isModerator?: boolean;
  isOwner?: boolean;
  onDelete: () => void;
  onEdit?: () => void;
  onReport?: () => void;
  size?: "sm" | "md";
}

/**
 * "방금 전", "5분 전", "3시간 전", then "8월 23일 오후 2:13" (with the year
 * only when it is not this year): no seconds, so a busy thread stays easy
 * to scan. The full time is the link's tooltip.
 */
export function shortTime(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString("ko-KR", {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PostCardHeader({
  postId,
  author,
  createdAt,
  updatedAt,
  isAnnouncement = false,
  isPinned = false,
  isReply = false,
  currentProfileId,
  isModerator = false,
  isOwner = false,
  onDelete,
  onEdit,
  onReport,
  size: _size = "md",
}: PostCardHeaderProps) {
  const canDelete =
    (currentProfileId && author.id === currentProfileId) || isModerator;
  const isOwnPost = currentProfileId && author.id === currentProfileId;
  // Allow editing own posts. For announcements, only owners can edit.
  const canEdit = isOwnPost && (!isAnnouncement || isOwner) && onEdit;
  const canReport = currentProfileId && !isOwnPost && onReport;
  const isEdited =
    updatedAt && createdAt && new Date(updatedAt) > new Date(createdAt);

  return (
    <div
      className={`flex items-center justify-between ${
        isReply ? "mb-1" : "mb-3"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Reply indicator */}
        <Link to={`/@${author.username}`} className="block">
          <ProfileAvatar
            profilePictureUrl={author.profile_picture_url}
            name={author.name}
            username={author.username}
            profileId={author.id}
            size={isReply ? "sm" : "md"}
            showOnlineStatus={true}
          />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Link to={`/@${author.username}`} className="hover:underline">
              <span
                className={`${isReply ? "text-[13px]" : "text-sm"} font-semibold text-foreground`}
              >
                {author.name}
              </span>
            </Link>
            <Link to={`/@${author.username}`} className="hover:underline">
              <span
                className={`${isReply ? "text-xs" : "text-xs"} text-muted-foreground`}
              >
                @{author.username}
              </span>
            </Link>
            {isAnnouncement && (
              <div className="announce-badge flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <Megaphone className="h-3 w-3" />
                <span>공지사항</span>
              </div>
            )}
            {isPinned && (
              <div className="flex items-center gap-1 bg-lilac/40 text-lilac-ink dark:bg-lilac/25 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                <Pin className="h-3 w-3" />
                <span>고정됨</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/@${author.username}/${postId}`}
              title={createdAt ? new Date(createdAt).toLocaleString("ko-KR") : ""}
              className="text-xs text-[#8a6500] hover:text-[#6b4e00] dark:text-[#f2c94c] dark:hover:text-[#ffe082] transition-colors"
            >
              {createdAt ? shortTime(createdAt) : ""}
            </Link>
            {isEdited && updatedAt && (
              <PostEditHistory postId={postId} updatedAt={updatedAt} />
            )}
          </div>
        </div>
      </div>
      <div
        className={`flex items-center gap-0.5 ${
          isReply
            ? "md:opacity-0 md:group-hover/post:opacity-100 focus-within:opacity-100 transition-opacity"
            : ""
        }`}
      >
        {canReport && (
          <button
            type="button"
            onClick={onReport}
            className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
            title="게시물 신고"
          >
            <Flag className="h-4 w-4" />
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-primary/10 transition-colors"
            title="게시물 수정"
          >
            <Edit className="h-4 w-4" />
          </button>
        )}
        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                title={isOwnPost ? "게시물 삭제" : "모더레이션 삭제"}
              >
                {isOwnPost ? (
                  <Trash2 className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>게시물 삭제</AlertDialogTitle>
                <AlertDialogDescription>
                  이 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
