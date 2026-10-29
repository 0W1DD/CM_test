import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { DirectMessageModal } from "~/components/DirectMessageModal";
import { ReportDialog } from "~/components/ReportDialog";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useMarkdownWithMentions } from "~/hooks/useMarkdownWithMentions";
import { errorMessage, mutate } from "~/lib/naru";
import type { Post, PostCardProps } from "~/types/post";
import { MessageSender } from "./message-sender";
import { PostEditor } from "./PostEditor";
import { ImageModal } from "./post/ImageModal";
import { PostCardActions } from "./post/PostCardActions";
import { PostCardContent } from "./post/PostCardContent";
import { PostCardHeader } from "./post/PostCardHeader";
import { PostCardImages } from "./post/PostCardImages";
import { PostCardReactions } from "./post/PostCardReactions";

// Helper function to count total replies recursively
function countTotalReplies(replies: Post[]): number {
  let count = replies.length;
  for (const reply of replies) {
    count += countTotalReplies(reply.replies || []);
  }
  return count;
}

/** How many steps replies indent before they stop moving in. */
const MAX_INDENT = 4;

/** A thread line per depth, so neighbouring levels are told apart. */
const THREAD_LINE = [
  "border-l-primary/60",
  "border-l-mint-ink/60",
  "border-l-butter-ink/60",
  "border-l-lilac-ink/60",
];

export const PostCard = memo(function PostCard({
  post,
  currentProfileId: suppliedProfileId,
  onDelete,
  onRefresh,
  isCommunityOwner = false,
  isModerator = false,
  hideBorder = false,
  isProfileView = false,
  displayDepth,
  isContinuation = false,
  branchIndex = 0,
  foldable = false,
  noFold = false,
}: PostCardProps) {
  // A folded branch shows its first reply and how many follow it.
  const [branchOpen, setBranchOpen] = useState(false);
  const { currentProfile, isAuthenticated, belongsToCurrentInstance } =
    useAuth();
  const canParticipate = isAuthenticated && belongsToCurrentInstance;
  const currentProfileId = canParticipate ? suppliedProfileId : undefined;
  const { currentInstance, showAllReplies } = useCurrentInstance();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showContentWarningContent, setShowContentWarningContent] =
    useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const [showDMModal, setShowDMModal] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Check if current user is part of the conversation thread
  const currentUsername = currentProfile?.username;
  const isUserPartOfThread = useCallback(() => {
    if (!currentProfileId || !currentUsername) return false;

    // User is part of thread if they authored the root post
    if (post.author.id === currentProfileId) return true;

    // Check if user is mentioned in root post
    if (post.content.includes(`@${currentUsername}`)) return true;

    // User is part of thread if they authored any reply or are mentioned in any reply
    if (post.replies && post.replies.length > 0) {
      return post.replies.some(
        (reply) =>
          reply.author.id === currentProfileId ||
          reply.content.includes(`@${currentUsername}`),
      );
    }

    return false;
  }, [
    currentProfileId,
    currentUsername,
    post.author.id,
    post.content,
    post.replies,
  ]);

  // Collapse thread by default if user is not part of it (unless community shows all replies)
  // (only a post's own list folds; replies inside it always show theirs)
  const [isThreadCollapsed, setIsThreadCollapsed] = useState(
    noFold || showAllReplies || (displayDepth ?? post.depth ?? 0) > 0
      ? false
      : !isUserPartOfThread(),
  );

  // Filter replies to show only relevant ones (for collapsed view)
  const filterRelevantReplies = useCallback(() => {
    if (!currentProfileId || !currentUsername || !post.replies) {
      return [];
    }

    const replies = post.replies;
    const relevantIds = new Set<string>();

    // Mark directly relevant replies
    for (const reply of replies) {
      if (
        reply.author.id === currentProfileId ||
        reply.content.includes(`@${currentUsername}`)
      ) {
        relevantIds.add(reply.id);
      }
    }

    // Add immediate context (parent and children)
    const withContext = new Set(relevantIds);
    for (const replyId of relevantIds) {
      const reply = replies.find((r) => r.id === replyId);
      if (reply?.in_reply_to_id) {
        withContext.add(reply.in_reply_to_id);
      }
      // Add direct children
      for (const r of replies) {
        if (r.in_reply_to_id === replyId) {
          withContext.add(r.id);
        }
      }
    }

    return replies.filter((r) => withContext.has(r.id));
  }, [currentProfileId, currentUsername, post.replies]);

  // Use the markdown hook for mention validation and rendering
  // For read-only posts, disable username validation to avoid API calls
  const { md } = useMarkdownWithMentions({
    content: post.content,
    useUsernameValidation: false,
  });

  // currentInstance fetched above to be available before useState

  const now = new Date();
  const communityEnded = currentInstance?.ends_at
    ? now > new Date(currentInstance.ends_at)
    : false;
  const communityNotStarted = currentInstance?.starts_at
    ? now < new Date(currentInstance.starts_at)
    : false;
  const canInteract =
    canParticipate &&
    !!currentProfileId &&
    !communityEnded &&
    !communityNotStarted;

  const deletePost = useCallback(async () => {
    const profileIdToUse = currentProfileId;

    if (!profileIdToUse) {
      toast.error("프로필를 선택해주세요.");
      return;
    }

    try {
      await mutate("posts:remove", {
        post_id: post.id,
        profile_id: profileIdToUse,
      });
      toast.success("게시물이 성공적으로 삭제되었습니다");
      onDelete?.();
    } catch (error) {
      toast.error(errorMessage(error, "게시물 삭제에 실패했습니다"));
    }
  }, [currentProfileId, post.id, onDelete]);

  const handleEditSuccess = useCallback(() => {
    setShowEditForm(false);
    (onRefresh || onDelete)?.();
  }, [onRefresh, onDelete]);

  const addReaction = useCallback(
    async (emoji: string) => {
      if (!currentProfileId) return;

      try {
        await mutate("posts:react", {
          post_id: post.id,
          profile_id: currentProfileId,
          emoji,
        });
        // Trigger a refresh of the post data
        (onRefresh || onDelete)?.();
      } catch (error) {
        toast.error(errorMessage(error, "반응을 추가할 수 없습니다"));
      }
    },
    [currentProfileId, post.id, onRefresh, onDelete],
  );

  const removeReaction = useCallback(
    async (emoji: string) => {
      if (!currentProfileId) return;

      try {
        await mutate("posts:unreact", {
          post_id: post.id,
          profile_id: currentProfileId,
          emoji,
        });
        // Trigger a refresh of the post data
        (onRefresh || onDelete)?.();
      } catch (error) {
        toast.error(errorMessage(error, "반응을 제거할 수 없습니다"));
      }
    },
    [currentProfileId, post.id, onRefresh, onDelete],
  );

  // Calculate styling based on depth - memoize to avoid recalculation
  const { depth, isReply, cardSize, padding } = useMemo(() => {
    const depth = displayDepth ?? (post.depth || 0);
    const isReply = depth > 0;
    const cardSize = isReply ? "text-[13px]" : "text-sm";
    const hasReplies = post.replies && post.replies.length > 0;
    // Only add bottom padding to deepest replies (those without children)
    const padding = isReply
      ? `${hasReplies ? "pt-2.5" : "py-2.5"} ${isContinuation ? "" : "pl-4"}`
      : "px-5 py-4";
    return { depth, isReply, cardSize, padding };
  }, [displayDepth, post.depth, post.replies, isContinuation]);

  return (
    <div
      className={`${
        post.announcement
          ? "bg-announce border-l-4 border-l-butter"
          : isReply
            ? ""
            : `bg-card ${!hideBorder ? "border-b border-border" : ""}`
      } group/post overflow-hidden ${
        isReply && !isContinuation
          ? `border-l-[3px] ${THREAD_LINE[(depth - 1 + branchIndex) % THREAD_LINE.length]}`
          : ""
      } ${cardSize}`}
    >
      <div className={padding}>
        {/* Header */}
        <PostCardHeader
          postId={post.id}
          author={post.author}
          createdAt={post.created_at}
          updatedAt={post.updated_at}
          isAnnouncement={post.announcement}
          isPinned={!!post.pinned_at}
          isReply={isReply}
          currentProfileId={currentProfileId}
          isModerator={canParticipate && isModerator}
          isOwner={canParticipate && isCommunityOwner}
          onDelete={deletePost}
          onEdit={() => setShowEditForm(true)}
          onReport={() => setShowReportDialog(true)}
        />

        {/* Edit Form */}
        {showEditForm ? (
          <div className="mt-4">
            <PostEditor
              post={post}
              onSaveSuccess={handleEditSuccess}
              onCancel={() => setShowEditForm(false)}
              isOwner={isCommunityOwner}
            />
          </div>
        ) : (
          <>
            {/* Content */}
            <PostCardContent
              content={post.content}
              contentWarning={post.content_warning}
              md={md}
              isReply={isReply}
              showContentWarningContent={showContentWarningContent}
              onToggleContentWarning={setShowContentWarningContent}
            />

            {/* Images */}
            {post.images && post.images.length > 0 && (
              <PostCardImages
                images={post.images}
                isReply={isReply}
                onImageClick={setSelectedImage}
                hidden={!!post.content_warning && !showContentWarningContent}
              />
            )}
          </>
        )}

        {/* Reply actions and reactions */}
        {!showEditForm && (
          <div className={isReply ? "mt-1" : "mt-3"}>
            {/* Action buttons row */}
            <div
              className={`flex items-center flex-wrap ${
                isReply ? "gap-2" : "gap-4"
              }`}
            >
              {currentProfileId ? (
                <PostCardActions
                  postId={post.id}
                  replyCount={
                    post.reply_count ?? countTotalReplies(post.replies || [])
                  }
                  isBookmarked={post.is_bookmarked || false}
                  isPinned={!!post.pinned_at}
                  isOwnPost={post.author.id === currentProfileId}
                  isProfileView={isProfileView}
                  currentProfileId={currentProfileId}
                  isReply={isReply}
                  onToggleReply={() => setShowReplyForm(!showReplyForm)}
                  showReplyForm={showReplyForm}
                  onBookmarkChange={() => {}} // Handled internally by PostCardActions
                  onPinChange={() => {
                    // Trigger refresh to update the pinned status
                    (onRefresh || onDelete)?.();
                  }}
                  onOpenDMModal={() => setShowDMModal(true)}
                />
              ) : (
                <Link
                  to={`/@${post.author.username}/${post.id}`}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  답글{" "}
                  {post.reply_count ?? countTotalReplies(post.replies || [])}개
                  보기
                </Link>
              )}

              {/* Reaction button and reactions display */}
              <PostCardReactions
                reactions={post.reactions || []}
                currentProfileId={currentProfileId}
                canInteract={canInteract}
                onAddReaction={addReaction}
                onRemoveReaction={removeReaction}
                isReply={isReply}
              />
            </div>
          </div>
        )}

        {/* Inline reply form */}
        {currentProfileId && showReplyForm && !showEditForm && (
          <div
            className={`${
              isReply ? "mt-2 pl-2" : "mt-4 pl-4"
            } border-l-2 border-primary/40`}
          >
            <MessageSender
              key={currentProfile?.id || "no-profile"}
              replyToId={post.id}
              placeholder={`@${post.author.username}님에게 답글을 작성하세요...`}
              initialValue={`@${post.author.username} `}
              onPostSuccess={() => {
                toast.success("답글이 작성되었습니다");
                setShowReplyForm(false);
                (onRefresh || onDelete)?.();
              }}
            />
          </div>
        )}

        {/* Nested replies */}
        {!showEditForm &&
          post.replies &&
          post.replies.length > 0 &&
          (() => {
            const filteredReplies = filterRelevantReplies();
            const repliesToShow = isThreadCollapsed
              ? filteredReplies
              : post.replies;
            const hasHiddenReplies =
              filteredReplies.length < post.replies.length;
            // An answer to the reply right above continues its line; when
            // a reply has several answers, each starts a step further in.
            const branches = isReply && post.replies.length > 1;

            const totalReplyCount = post.reply_count ?? post.replies.length;
            // Folded: the rest of a long branch waits behind one button.
            if (foldable && !noFold && !branchOpen) {
              const hidden = countTotalReplies(post.replies);
              return (
                <button
                  type="button"
                  onClick={() => setBranchOpen(true)}
                  className="mt-1 mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  이어진 답글 {hidden}개 더보기
                </button>
              );
            }

            return (
              <div className="mt-2">
                {/* Show toggle button only if there are hidden replies */}
                {hasHiddenReplies && !showAllReplies && !isReply && (
                  <button
                    type="button"
                    onClick={() => setIsThreadCollapsed(!isThreadCollapsed)}
                    className="flex items-center gap-2 mb-2 hover:opacity-70 transition-opacity"
                  >
                    <span className="text-xs text-muted-foreground font-medium">
                      {isThreadCollapsed
                        ? `답글 ${filteredReplies.length}/${totalReplyCount}개`
                        : `답글 ${totalReplyCount}개`}
                    </span>
                    {isThreadCollapsed ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <ChevronUp className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                )}
                {/* Always show replies (filtered when collapsed, all when expanded) */}
                <div>
                  {repliesToShow.map((reply, index) => {
                    const childDisplayDepth =
                      isReply && !branches
                        ? depth
                        : Math.min(depth + 1, MAX_INDENT);
                    return (
                      <div
                        key={reply.id}
                        // Separate sibling branches so each keeps its own line
                        className={branches && index > 0 ? "mt-3" : ""}
                      >
                        <PostCard
                          post={reply}
                          displayDepth={childDisplayDepth}
                          isContinuation={childDisplayDepth === depth}
                          // Sibling branches take turns through the line
                          // colours; continuations keep their branch's.
                          branchIndex={
                            branches || !isReply
                              ? branchIndex + index
                              : branchIndex
                          }
                          // Every branch but the newest folds when it runs
                          // long, so the newer one is not pushed far down.
                          foldable={
                            (branches || !isReply) &&
                            index < repliesToShow.length - 1 &&
                            countTotalReplies(reply.replies || []) >= 2
                          }
                          currentProfileId={currentProfileId}
                          onDelete={onDelete}
                          onRefresh={onRefresh}
                          isCommunityOwner={isCommunityOwner}
                          isModerator={isModerator}
                          isProfileView={isProfileView}
                          noFold={noFold}
                        />
                      </div>
                    );
                  })}
                </div>
                {post.has_more_replies && (
                  <Link
                    to={`/@${post.author.username}/${post.root_post_id ?? post.id}`}
                    className="block mt-2 text-xs text-primary hover:underline font-medium"
                  >
                    답글 {totalReplyCount}개 모두 보기
                  </Link>
                )}
              </div>
            );
          })()}
      </div>

      {/* Image Modal */}
      <ImageModal
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
      />

      {/* Direct Message Modal */}
      {currentProfileId && (
        <DirectMessageModal
          postId={post.id}
          postAuthor={{
            username: post.author.username,
            name: post.author.name,
          }}
          isOpen={showDMModal}
          onClose={() => setShowDMModal(false)}
          currentProfileId={currentProfileId}
          receiverId={post.author.id}
        />
      )}

      {/* Report Dialog */}
      {currentProfileId && (
        <ReportDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          postId={post.id}
          profileId={currentProfileId}
        />
      )}
    </div>
  );
});
