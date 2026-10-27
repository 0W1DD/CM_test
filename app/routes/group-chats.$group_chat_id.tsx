import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useImageUpload } from "~/hooks/useImageUpload";
import { pastedImages } from "~/lib/upload-image";
import { useLive } from "~/components/messages/useLive";
import { errorMessage, mutate } from "~/lib/naru";
import type { GroupChatInfo, GroupChatMessagePage } from "~/types/message";
import type { Route } from "./+types/group-chats.$group_chat_id";

import {
  ArrowLeft,
  Check,
  Image,
  MessageCircle,
  Pencil,
  Send,
  Settings,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { GroupChatMessageReactions } from "~/components/GroupChatMessageReactions";
import { LoginButton } from "~/components/LoginButton";
import { MessageBubble } from "~/components/MessageBubble";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Spinner } from "~/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "그룹 채팅" },
    { name: "description", content: "그룹 채팅" },
  ];
}

export default function GroupChatDetail() {
  const { group_chat_id } = useParams();
  const [newMessage, setNewMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<
    string | null
  >(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const { isAuthenticated, currentProfile, isLoading: authLoading } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const _navigate = useNavigate();
  const imageUploadId = useId();
  const {
    images,
    uploadedImageIds,
    isUploadingImages,
    handleImageSelect: handleImageSelectFromHook,
    removeImage,
    clearImages,
  } = useImageUpload();

  const { instanceSlug } = useCurrentInstance();

  // The chat and its messages, kept current: anyone's message, reaction,
  // deletion or rename runs them again.
  const liveArgs =
    isAuthenticated && instanceSlug && currentProfile && group_chat_id
      ? { group_chat_id, profile_id: currentProfile.id }
      : null;
  const chatLive = useLive<GroupChatInfo>("groupChats:get", liveArgs);
  const messagesLive = useLive<GroupChatMessagePage>(
    "groupChats:messages",
    liveArgs,
  );
  const groupChat = chatLive.data ?? null;
  const messages = (messagesLive.data?.messages ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  const isLoading = chatLive.isLoading || messagesLive.isLoading;
  const error =
    sendError ||
    (chatLive.error
      ? "그룹 채팅을 찾을 수 없습니다"
      : messagesLive.error
        ? "메시지를 불러올 수 없습니다"
        : "");

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const hasNewMessages = messages.length > prevMessageCountRef.current;
    const isInitial = isInitialLoadRef.current && messages.length > 0;

    if (isInitial) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 50);
      isInitialLoadRef.current = false;
    } else if (hasNewMessages && isNearBottom()) {
      scrollToBottom();
    }

    prevMessageCountRef.current = messages.length;
  }, [messages, isLoading, scrollToBottom, isNearBottom]);

  // Mark the chat read: once per batch of new messages from others, a
  // moment after they arrive, not once per message.
  const currentProfileId = currentProfile?.id;
  const latestFromOthersId = messagesLive.data?.messages
    .filter((message) => !message.is_sender)
    .at(-1)?.id;
  const markedUpToRef = useRef<string | null>(null);
  useEffect(() => {
    if (!latestFromOthersId || !currentProfileId || !group_chat_id) return;
    if (markedUpToRef.current === latestFromOthersId) return;
    const timer = setTimeout(() => {
      markedUpToRef.current = latestFromOthersId;
      mutate("groupChats:markRead", {
        group_chat_id,
        profile_id: currentProfileId,
      }).catch((err) => {
        markedUpToRef.current = null;
        console.error("Error marking messages as read:", err);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [latestFromOthersId, currentProfileId, group_chat_id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!newMessage.trim() && uploadedImageIds.length === 0) ||
      !currentProfile ||
      !group_chat_id ||
      isSending
    )
      return;

    try {
      setIsSending(true);

      // The live messages show the new one by itself.
      await mutate("groupChats:send", {
        group_chat_id,
        content: newMessage.trim(),
        profile_id: currentProfile.id,
        image_ids: uploadedImageIds.length > 0 ? uploadedImageIds : undefined,
      });
      setNewMessage("");
      clearImages();
    } catch (err) {
      setSendError(errorMessage(err, "메시지 전송 중 오류가 발생했습니다"));
    } finally {
      setIsSending(false);
    }
  };

  // Reactions: the live messages show them once the call returns.
  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile || !group_chat_id) return;

    try {
      await mutate("groupChats:addReaction", {
        group_chat_id,
        message_id: messageId,
        profile_id: currentProfile.id,
        emoji,
      });
    } catch (err) {
      console.error("Error adding reaction:", err);
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile || !group_chat_id) return;

    try {
      await mutate("groupChats:removeReaction", {
        group_chat_id,
        message_id: messageId,
        profile_id: currentProfile.id,
        emoji,
      });
    } catch (err) {
      console.error("Error removing reaction:", err);
    }
  };

  const deleteMessage = async (
    messageId: string,
    mode: "for_me" | "for_all",
  ) => {
    if (!currentProfile || !group_chat_id) return;

    try {
      setDeletingMessageId(messageId);

      await mutate("groupChats:remove", {
        group_chat_id,
        message_id: messageId,
        profile_id: currentProfile.id,
        mode,
      });
      toast.success("메시지가 삭제되었습니다");
    } catch (err) {
      toast.error(errorMessage(err, "메시지를 삭제할 수 없습니다"));
    } finally {
      setDeletingMessageId(null);
      setConfirmDeleteMessageId(null);
    }
  };

  const handleDeleteClick = (messageId: string) => {
    setConfirmDeleteMessageId(messageId);
  };

  const cancelDelete = () => {
    setConfirmDeleteMessageId(null);
  };

  const handleStartEditName = () => {
    if (groupChat) {
      setEditName(groupChat.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = async () => {
    if (!currentProfile || !group_chat_id || !editName.trim()) return;

    try {
      setIsSavingName(true);
      await mutate("groupChats:update", {
        group_chat_id,
        profile_id: currentProfile.id,
        name: editName.trim(),
      });
      setIsEditingName(false);
      toast.success("그룹 이름이 변경되었습니다");
    } catch (err) {
      toast.error(errorMessage(err, "그룹 이름 변경에 실패했습니다"));
    } finally {
      setIsSavingName(false);
    }
  };

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

  if (authLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-marsh border border-border p-8 text-center">
            <div className="w-16 h-16 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인이 필요합니다
            </h1>
            <p className="text-muted-foreground mb-6">
              그룹 채팅을 확인하려면 로그인해주세요.
            </p>
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-64">
            <div className="flex items-center gap-3">
              <Spinner className="h-6 w-6" />
              <span className="text-muted-foreground">
                그룹 채팅을 불러오는 중...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !groupChat) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-marsh border border-border p-8 text-center">
            <div className="w-16 h-16 bg-destructive/15 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              오류가 발생했습니다
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link
              to="/group-chats"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              그룹 채팅 목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                to="/messages"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                메시지 목록
              </Link>
              {groupChat && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h1 className="font-bold text-foreground">
                      {groupChat.name}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {groupChat.members.length}명
                    </p>
                  </div>
                </div>
              )}
            </div>
            <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>그룹 설정</DialogTitle>
                </DialogHeader>

                {/* Group name edit */}
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    그룹 이름
                  </div>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveName();
                          if (e.key === "Escape") setIsEditingName(false);
                        }}
                        disabled={isSavingName}
                        className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveName}
                        disabled={isSavingName || !editName.trim()}
                        className="p-1.5 text-primary hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isSavingName ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(false)}
                        disabled={isSavingName}
                        className="p-1.5 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                      <span className="font-medium text-foreground">
                        {groupChat?.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleStartEditName}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Members */}
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  멤버 ({groupChat?.members.length}명)
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {groupChat?.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <ProfileAvatar
                          profilePictureUrl={member.profile_picture_url}
                          name={member.name}
                          username={member.username}
                          size="sm"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {member.name}
                            </span>
                            {member.id === groupChat.created_by_id && (
                              <Shield className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            @{member.username}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 overflow-hidden">
        <div className="bg-card rounded-lg shadow-marsh border border-border h-full flex flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.map((message) => {
              const hasReactions =
                message.reactions && message.reactions.length > 0;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.is_sender ? "justify-end" : "justify-start"
                  }`}
                >
                  <MessageBubble
                    content={message.content}
                    timestamp={formatTime(message.created_at)}
                    isFromMe={message.is_sender}
                    senderName={message.sender.name}
                    senderAvatar={
                      !message.is_sender ? (
                        <ProfileAvatar
                          profilePictureUrl={message.sender.profile_picture_url}
                          name={message.sender.name}
                          username={message.sender.username}
                          size="sm"
                        />
                      ) : undefined
                    }
                    onClick={
                      hasReactions
                        ? () => setSelectedMessageId(message.id)
                        : undefined
                    }
                    images={message.images}
                    currentProfileId={currentProfile?.id}
                    onDelete={() => handleDeleteClick(message.id)}
                  >
                    {hasReactions ? (
                      <GroupChatMessageReactions
                        reactions={message.reactions || []}
                        currentProfileId={currentProfile?.id}
                        onAddReaction={(emoji) =>
                          handleAddReaction(message.id, emoji)
                        }
                        onRemoveReaction={(emoji) =>
                          handleRemoveReaction(message.id, emoji)
                        }
                        messageContent={message.content}
                        senderName={message.sender.name}
                        isModalOpen={selectedMessageId === message.id}
                        onModalClose={() => setSelectedMessageId(null)}
                        isFromMe={message.is_sender}
                      />
                    ) : (
                      currentProfile && (
                        <GroupChatMessageReactions
                          reactions={[]}
                          currentProfileId={currentProfile.id}
                          onAddReaction={(emoji) =>
                            handleAddReaction(message.id, emoji)
                          }
                          onRemoveReaction={(emoji) =>
                            handleRemoveReaction(message.id, emoji)
                          }
                          messageContent={message.content}
                          senderName={message.sender.name}
                          isModalOpen={false}
                          onModalClose={() => {}}
                          isFromMe={message.is_sender}
                        />
                      )
                    )}
                  </MessageBubble>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t border-border p-4">
            {/* Image Previews */}
            {images.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {images.map((image, index) => (
                  <div key={image.id} className="relative">
                    <img
                      src={image.preview}
                      alt="Preview"
                      className="h-20 w-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    handleImageSelectFromHook(e.target.files);
                  }
                }}
                className="hidden"
                id={imageUploadId}
                disabled={isSending || isUploadingImages}
              />
              <label
                htmlFor={imageUploadId}
                className="px-4 py-2 border border-border rounded-lg hover:bg-accent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Image className="h-5 w-5" />
              </label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onPaste={(e) => {
                  const files = pastedImages(e);
                  if (files.length === 0) return;
                  e.preventDefault();
                  handleImageSelectFromHook(files);
                }}
                placeholder="메시지를 입력하세요..."
                className="flex-1 min-w-0 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={
                  (!newMessage.trim() && uploadedImageIds.length === 0) ||
                  isSending
                }
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? (
                  <Spinner className="h-5 w-5 text-white" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {confirmDeleteMessageId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-destructive/15 rounded-full flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  메시지 삭제
                </h3>
                <p className="text-sm text-muted-foreground">
                  삭제 방식을 선택해주세요
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => deleteMessage(confirmDeleteMessageId, "for_me")}
                disabled={deletingMessageId !== null}
                className="w-full px-4 py-3 text-left text-foreground bg-accent hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingMessageId === confirmDeleteMessageId ? (
                  <Spinner className="h-4 w-4" />
                ) : null}
                <div>
                  <div className="font-medium">나에게만 삭제</div>
                  <div className="text-sm text-muted-foreground">
                    다른 멤버에게는 계속 보입니다
                  </div>
                </div>
              </button>
              {(() => {
                const msg = messages.find(
                  (m) => m.id === confirmDeleteMessageId,
                );
                const withinTimeWindow =
                  msg &&
                  Date.now() - new Date(msg.created_at).getTime() <=
                    2 * 60 * 1000;
                return msg?.is_sender && withinTimeWindow;
              })() && (
                <button
                  type="button"
                  onClick={() =>
                    deleteMessage(confirmDeleteMessageId, "for_all")
                  }
                  disabled={deletingMessageId !== null}
                  className="w-full px-4 py-3 text-left text-destructive bg-destructive/15 hover:bg-destructive/25 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deletingMessageId === confirmDeleteMessageId ? (
                    <Spinner className="h-4 w-4" />
                  ) : null}
                  <div>
                    <div className="font-medium">모두에게 삭제</div>
                    <div className="text-sm text-muted-foreground">
                      이 메시지는 모든 참여자에게서 삭제됩니다
                    </div>
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deletingMessageId !== null}
                className="w-full px-4 py-2 text-foreground bg-accent hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
