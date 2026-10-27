import { CheckCheck, Clock, MessageCircle, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { LoginButton } from "~/components/LoginButton";
import { ProfileAvatar } from "~/components/profile-avatar";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "~/components/ui/empty";
import { LoadingState } from "~/components/shared/LoadingState";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useLive } from "~/components/messages/useLive";
import { errorMessage, mutate, query } from "~/lib/naru";
import type { Conversation, GroupChat } from "~/types/message";
import type { Profile } from "~/types/profile";
import type { Route } from "./+types/messages";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "메시지" },
    { name: "description", content: "다른 사용자와 메시지 주고받기" },
  ];
}

export default function Messages() {
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // Create group state
  const [groupName, setGroupName] = useState("");
  const groupNameId = useId();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<
    {
      id: string;
      name: string;
      username: string;
      profile_picture_url: string | null;
    }[]
  >([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const { isAuthenticated, currentProfile, isLoading: authLoading } = useAuth();
  const { instanceSlug, isLoading: instanceLoading } = useCurrentInstance();
  // Live lists: more are asked for by raising the limit as the page scrolls.
  const [conversationLimit, setConversationLimit] = useState(ITEMS_PER_PAGE);
  const [groupChatLimit, setGroupChatLimit] = useState(ITEMS_PER_PAGE);
  const listsEnabled = isAuthenticated && !!instanceSlug && !!currentProfile;
  const conversationsLive = useLive<Conversation[]>(
    "messages:conversations",
    listsEnabled
      ? { profile_id: currentProfile.id, limit: conversationLimit }
      : null,
    { keepPrevious: true },
  );
  const groupChatsLive = useLive<GroupChat[]>(
    "groupChats:list",
    listsEnabled
      ? { profile_id: currentProfile.id, limit: groupChatLimit }
      : null,
    { keepPrevious: true },
  );

  const conversations = conversationsLive.data ?? [];
  const groupChats = groupChatsLive.data ?? [];
  const hasNextConversations =
    conversations.length >= conversationLimit && conversationLimit < 100;
  const hasNextGroupChats =
    groupChats.length >= groupChatLimit && groupChatLimit < 100;
  const isFetchingNextConversations =
    !!conversationsLive.data && conversationsLive.isLoading;
  const isFetchingNextGroupChats =
    !!groupChatsLive.data && groupChatsLive.isLoading;
  const isLoading =
    (conversationsLive.isLoading && !conversationsLive.data) ||
    (groupChatsLive.isLoading && !groupChatsLive.data) ||
    instanceLoading;

  const markAllAsRead = async () => {
    if (!currentProfile) return;

    try {
      setIsMarkingAllRead(true);
      // The live conversation list and unread counts update by themselves.
      await mutate("messages:markAllRead", { profile_id: currentProfile.id });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // Infinite scroll trigger
  const loadMore = useCallback(() => {
    if (hasNextConversations && !conversationsLive.isLoading) {
      setConversationLimit((limit) => Math.min(limit + ITEMS_PER_PAGE, 100));
    }
    if (hasNextGroupChats && !groupChatsLive.isLoading) {
      setGroupChatLimit((limit) => Math.min(limit + ITEMS_PER_PAGE, 100));
    }
  }, [
    hasNextConversations,
    conversationsLive.isLoading,
    hasNextGroupChats,
    groupChatsLive.isLoading,
  ]);

  // Scroll event listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight || document.body.scrollHeight;
      const clientHeight =
        document.documentElement.clientHeight || window.innerHeight;

      // Load more when within 200px of the bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR");
  };

  const handleOpenCreateModal = async () => {
    if (!currentProfile) return;

    setShowCreateModal(true);
    setGroupName("");
    setSelectedMembers([]);
    setCreateError("");

    // Fetch available profiles
    try {
      const result = await query<Profile[]>("profiles:list", {});
      const allProfiles = Array.isArray(result) ? result : [];

      // Filter out current profile
      const otherProfiles = allProfiles
        .filter((profile) => profile.id !== currentProfile.id)
        .map((profile) => ({
          id: profile.id,
          name: profile.name,
          username: profile.username,
          profile_picture_url: profile.profile_picture_url ?? null,
        }));
      setAvailableProfiles(otherProfiles);
    } catch (err) {
      console.error("Failed to fetch profiles:", err);
    }
  };

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setGroupName("");
    setSelectedMembers([]);
    setCreateError("");
    setIsCreating(false);
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCreateModal) {
        handleCloseCreateModal();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showCreateModal, handleCloseCreateModal]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !groupName.trim()) return;

    setIsCreating(true);
    setCreateError("");

    try {
      // The live group chat list shows the new one by itself.
      await mutate("groupChats:create", {
        name: groupName.trim(),
        member_profile_ids: selectedMembers,
        creator_profile_id: currentProfile.id,
      });
      handleCloseCreateModal();
    } catch (err) {
      setCreateError(errorMessage(err, "그룹 채팅 생성에 실패했습니다"));
    } finally {
      setIsCreating(false);
    }
  };

  const toggleMember = (profileId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId],
    );
  };

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <Empty className="bg-card rounded-2xl shadow-sm border border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle />
              </EmptyMedia>
              <EmptyTitle>로그인이 필요합니다</EmptyTitle>
              <EmptyDescription>
                메시지를 확인하려면 로그인해주세요.
              </EmptyDescription>
            </EmptyHeader>
            <LoginButton />
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-64">
              <LoadingState
                message="대화 목록을 불러오는 중..."
                asCard={false}
              />
            </div>
          ) : (
            <>
              {/* Mark All as Read Button */}
              {conversations.length > 0 &&
                conversations.some(
                  (conv) => parseInt(conv.unread_count || "0", 10) > 0,
                ) && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      disabled={isMarkingAllRead}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCheck className="h-3 w-3" />
                      {isMarkingAllRead
                        ? "처리 중..."
                        : "모든 메시지 읽음 처리"}
                    </button>
                  </div>
                )}

              {/* All Conversations */}
              {conversations.length === 0 && groupChats.length === 0 ? (
                <Empty className="bg-card rounded-2xl shadow-sm border border-border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageCircle />
                    </EmptyMedia>
                    <EmptyTitle>메시지가 없습니다</EmptyTitle>
                    <EmptyDescription>
                      다른 사용자와 개인 메시지를 시작하거나 그룹 채팅을
                      만들어보세요.
                    </EmptyDescription>
                  </EmptyHeader>
                  <div className="flex items-center justify-center gap-3">
                    <Link
                      to="/profiles"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="h-4 w-4" />새 1:1 메시지
                    </Link>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
                    >
                      <Plus className="h-4 w-4" />새 그룹 만들기
                    </button>
                  </div>
                </Empty>
              ) : (
                <div className="space-y-3">
                  {/* All Messages - sorted by last message date */}
                  {[
                    ...conversations
                      // One row per person, even if a list answer overlaps
                      // (the duplicated rooms members saw while scrolling).
                      .filter(
                        (conv, index, all) =>
                          conv.other_profile &&
                          all.findIndex(
                            (other) =>
                              other.other_profile?.id ===
                              conv.other_profile?.id,
                          ) === index,
                      )
                      .map((conv) => ({
                        type: "direct" as const,
                        data: conv,
                        lastMessageTime:
                          conv.last_message?.created_at ||
                          conv.other_profile?.username ||
                          "", // fallback for sorting
                      })),
                    ...groupChats
                      .filter(
                        (group, index, all) =>
                          all.findIndex((other) => other.id === group.id) ===
                          index,
                      )
                      .map((group) => ({
                      type: "group" as const,
                      data: group,
                      lastMessageTime:
                        group.last_message?.created_at || group.created_at,
                    })),
                  ]
                    .sort(
                      (a, b) =>
                        new Date(b.lastMessageTime).getTime() -
                        new Date(a.lastMessageTime).getTime(),
                    )
                    .map((item) =>
                      item.type === "direct" && item.data.other_profile ? (
                        /* Direct Messages */
                        <Link
                          key={`direct-${item.data.other_profile.id}`}
                          to={`/messages/${item.data.other_profile.username}`}
                          className="block bg-card rounded-xl shadow-sm border border-border p-6 transition-all hover:shadow-md hover:border-border"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              <ProfileAvatar
                                profilePictureUrl={
                                  item.data.other_profile.profile_picture_url ||
                                  undefined
                                }
                                name={item.data.other_profile.name}
                                username={item.data.other_profile.username}
                                profileId={item.data.other_profile.id}
                                size="lg"
                                className="border-2 border-border"
                                showOnlineStatus={true}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-foreground truncate">
                                    {item.data.other_profile.name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground truncate">
                                    @{item.data.other_profile.username}
                                  </p>

                                  {item.data.last_message && (
                                    <div className="mt-2">
                                      <p className="text-sm text-muted-foreground truncate">
                                        {item.data.last_message.is_sender &&
                                          "나: "}
                                        {item.data.last_message.content}
                                      </p>
                                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {formatTime(
                                            item.data.last_message.created_at,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                  {parseInt(item.data.unread_count || "0", 10) >
                                    0 && (
                                    <div className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                      {parseInt(
                                        item.data.unread_count || "0",
                                        10,
                                      ) > 99
                                        ? "99+"
                                        : item.data.unread_count}
                                    </div>
                                  )}
                                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ) : item.type === "group" ? (
                        /* Group Chats */
                        (() => {
                          const group = item.data;
                          return (
                            <Link
                              key={`group-${group.id}`}
                              to={`/group-chats/${group.id}`}
                              className="block bg-card rounded-xl shadow-sm border border-border p-6 transition-all hover:shadow-md hover:border-border"
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                                    <Users className="h-6 w-6 text-primary-foreground" />
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h3 className="font-medium text-foreground truncate">
                                          {group.name}
                                        </h3>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                                          그룹
                                        </span>
                                      </div>
                                      <p className="text-sm text-muted-foreground truncate">
                                        {group.member_count}명
                                      </p>

                                      {group.last_message && (
                                        <div className="mt-2">
                                          <p className="text-sm text-muted-foreground truncate">
                                            {group.last_message?.sender?.name}:{" "}
                                            {group.last_message?.content}
                                          </p>
                                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                              {formatTime(
                                                group.last_message
                                                  ?.created_at || "",
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                      {group.unread_count > 0 && (
                                        <div className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                                          {group.unread_count > 99
                                            ? "99+"
                                            : group.unread_count}
                                        </div>
                                      )}
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })()
                      ) : null,
                    )}
                </div>
              )}

              {/* Loading indicator for infinite scroll */}
              {(isFetchingNextConversations || isFetchingNextGroupChats) && (
                <div className="mt-6">
                  <LoadingState message="더 많은 대화를 불러오는 중..." />
                </div>
              )}

              {/* End of content indicator */}
              {!hasNextConversations &&
                !hasNextGroupChats &&
                (conversations.length > 0 || groupChats.length > 0) && (
                  <div className="bg-background rounded-2xl border border-border p-6 text-center mt-6">
                    <p className="text-muted-foreground text-sm">
                      모든 대화를 확인했습니다
                    </p>
                  </div>
                )}
            </>
          )}
        </div>
      </main>

      {/* Floating Action Buttons - shown when there are conversations */}
      {(conversations.length > 0 || groupChats.length > 0) && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3">
          <Link
            to="/profiles"
            className="inline-flex items-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
            title="새 1:1 메시지"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="hidden sm:inline">새 1:1 메시지</span>
          </Link>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-3 bg-secondary text-secondary-foreground rounded-full shadow-lg hover:bg-secondary/90 transition-colors"
            title="새 그룹"
          >
            <Users className="h-5 w-5" />
            <span className="hidden sm:inline">새 그룹</span>
          </button>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className="bg-card rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-bold mb-4">새 그룹 채팅 만들기</h2>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              {/* Group Name */}
              <div>
                <label
                  htmlFor={groupNameId}
                  className="block text-sm font-medium text-foreground mb-1"
                >
                  그룹 이름 *
                </label>
                <input
                  type="text"
                  id={groupNameId}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="그룹 이름을 입력하세요"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
                  required
                  disabled={isCreating}
                />
              </div>

              {/* Member Selection */}
              <div>
                <div className="block text-sm font-medium text-foreground mb-2">
                  멤버 선택 ({selectedMembers.length}명 선택됨)
                </div>
                <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                  {availableProfiles.length > 0 ? (
                    <div className="divide-y divide-border">
                      {availableProfiles.map((profile) => (
                        <label
                          key={profile.id}
                          className={`flex items-center p-3 cursor-pointer hover:bg-accent ${
                            selectedMembers.includes(profile.id)
                              ? "bg-accent"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(profile.id)}
                            onChange={() => toggleMember(profile.id)}
                            className="rounded border-border text-primary focus:ring-ring"
                            disabled={isCreating}
                          />
                          <div className="ml-3 flex items-center gap-3">
                            <ProfileAvatar
                              profilePictureUrl={profile.profile_picture_url}
                              name={profile.name}
                              username={profile.username}
                              profileId={profile.id}
                              size="sm"
                              showOnlineStatus={true}
                            />
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {profile.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                @{profile.username}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      사용 가능한 멤버가 없습니다
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {createError && (
                <div className="bg-destructive/15 border border-destructive/30 rounded-lg p-3">
                  <div className="text-destructive text-sm">{createError}</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseCreateModal}
                  className="flex-1 px-4 py-2 text-foreground border border-border rounded-lg hover:bg-background transition-colors"
                  disabled={isCreating}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!groupName.trim() || isCreating}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      생성 중...
                    </div>
                  ) : (
                    "그룹 만들기"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
