import {
  ArrowLeft,
  MessageCircle,
  Paperclip,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { DirectMessageReactions } from "~/components/DirectMessageReactions";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_FILE_SIZE,
  uploadImage,
  pastedImages,
} from "~/lib/upload-image";
import { LoginButton } from "~/components/LoginButton";
import { MessageBubble } from "~/components/MessageBubble";
import { ProfileAvatar } from "~/components/profile-avatar";
import { Spinner } from "~/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "~/components/ui/empty";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { useLive } from "~/components/messages/useLive";
import { errorMessage, mutate, reasonOf } from "~/lib/naru";
import type { ConversationThread } from "~/types/message";
import type { Route } from "./+types/messages.$username";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `${params.username}님과의 대화` },
    { name: "description", content: "메시지 대화" },
  ];
}

export default function MessageConversation() {
  const { username } = useParams();
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );
  const [confirmDeleteMessageId, setConfirmDeleteMessageId] = useState<
    string | null
  >(null);
  const { isAuthenticated, currentProfile, isLoading: authLoading } = useAuth();
  const { instanceSlug } = useCurrentInstance();

  // The conversation, kept current: a message sent, read, reacted to or
  // deleted on either side runs it again.
  const thread = useLive<ConversationThread>(
    "messages:conversation",
    isAuthenticated && instanceSlug && username && currentProfile
      ? { profile_id: currentProfile.id, username }
      : null,
  );
  const otherProfile = thread.data?.other_profile ?? null;
  const messages = thread.data?.messages.slice().reverse() ?? [];
  const isLoading = authLoading || thread.isLoading;
  const error = sendError
    ? sendError
    : thread.error
      ? reasonOf(thread.error) === "not_found"
        ? "사용자를 찾을 수 없습니다"
        : errorMessage(thread.error, "메시지를 불러올 수 없습니다")
      : !authLoading && isAuthenticated && !currentProfile
        ? "프로필를 선택해주세요"
        : "";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // Image handling state
  interface ImageObject {
    tempId: string;
    file: File;
    preview: string;
    uploadedId?: string;
  }
  const [images, setImages] = useState<ImageObject[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

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

  // Mark what the other profile sent as read: once per batch of unread
  // messages, a moment after they arrive, not once per message.
  const currentProfileId = currentProfile?.id;
  const otherProfileId = otherProfile?.id;
  const latestUnreadId = thread.data?.messages
    .filter((message) => !message.is_sender && !message.read_at)
    .at(-1)?.id;
  const markedUpToRef = useRef<string | null>(null);
  useEffect(() => {
    if (!latestUnreadId || !currentProfileId || !otherProfileId) return;
    if (markedUpToRef.current === latestUnreadId) return;
    const timer = setTimeout(() => {
      markedUpToRef.current = latestUnreadId;
      mutate("messages:markConversationRead", {
        profile_id: currentProfileId,
        other_profile_id: otherProfileId,
      }).catch((err) => {
        markedUpToRef.current = null;
        console.error("Failed to mark messages as read:", err);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [latestUnreadId, currentProfileId, otherProfileId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImages(Array.from(e.target.files || []));
  };

  const addImages = (files: File[]) => {
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
        continue;
      }

      if (file.size > MAX_IMAGE_FILE_SIZE) {
        toast.error("이미지 크기는 10MB 이하여야 합니다");
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const newImageObjects: ImageObject[] = validFiles.map((file) => ({
      tempId: `${Date.now()}-${Math.random()}`,
      file,
      preview: "",
    }));

    setImages((prev) => [...prev, ...newImageObjects]);

    // Load previews asynchronously
    newImageObjects.forEach((imageObj) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setImages((prev) =>
            prev.map((img) =>
              img.tempId === imageObj.tempId
                ? { ...img, preview: result }
                : img,
            ),
          );
        }
      };
      reader.readAsDataURL(imageObj.file);
    });

    uploadImages(newImageObjects);
  };

  const uploadImages = async (imageObjects: ImageObject[]) => {
    setIsUploadingImages(true);
    try {
      const uploadPromises = imageObjects.map(async (imageObj) => {
        const uploaded = await uploadImage(imageObj.file);
        return { tempId: imageObj.tempId, uploadedId: uploaded.id };
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Update images with their uploaded IDs
      setImages((prev) =>
        prev.map((img) => {
          const result = uploadResults.find((r) => r.tempId === img.tempId);
          return result ? { ...img, uploadedId: result.uploadedId } : img;
        }),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "이미지 업로드에 실패했습니다",
      );
      // Remove the failed images
      const tempIds = imageObjects.map((obj) => obj.tempId);
      setImages((prev) => prev.filter((img) => !tempIds.includes(img.tempId)));
    } finally {
      setIsUploadingImages(false);
    }
  };

  const removeImage = (tempId: string) => {
    setImages((prev) => prev.filter((img) => img.tempId !== tempId));
  };

  const sendMessage = async () => {
    const uploadedImagesCount = images.filter((img) => img.uploadedId).length;
    if (
      (!newMessage.trim() && uploadedImagesCount === 0) ||
      !otherProfile ||
      isSending ||
      !currentProfile
    )
      return;

    try {
      setIsSending(true);
      // The live conversation shows the new message by itself.
      await mutate("messages:send", {
        profile_id: currentProfile.id,
        receiver_id: otherProfile.id,
        content: newMessage.trim(),
        image_ids: images
          .map((img) => img.uploadedId)
          .filter((id): id is string => id !== undefined),
      });
      setNewMessage("");
      setImages([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      if (reasonOf(err) === "blocked")
        toast.error(errorMessage(err, "메시지 전송에 실패했습니다"));
      else
        setSendError(errorMessage(err, "메시지 전송 중 오류가 발생했습니다"));
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (
    messageId: string,
    mode: "for_me" | "for_all",
  ) => {
    if (!currentProfile) return;

    try {
      setDeletingMessageId(messageId);

      await mutate("messages:remove", {
        profile_id: currentProfile.id,
        message_id: messageId,
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

  // Reactions: the live conversation shows them once the call returns.
  const addReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile) return;

    try {
      await mutate("messages:addReaction", {
        profile_id: currentProfile.id,
        message_id: messageId,
        emoji,
      });
    } catch (err) {
      toast.error(errorMessage(err, "반응을 추가할 수 없습니다"));
    }
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!currentProfile) return;

    try {
      await mutate("messages:removeReaction", {
        profile_id: currentProfile.id,
        message_id: messageId,
        emoji,
      });
    } catch (err) {
      toast.error(errorMessage(err, "반응을 제거할 수 없습니다"));
    }
  };

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (createdAt: string) => {
    const date = new Date(createdAt);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return "오늘";
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return "어제";
    }

    return date.toLocaleDateString("ko-KR");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-3">
              로그인이 필요합니다
            </h1>
            <p className="text-muted-foreground mb-6">
              메시지를 확인하려면 로그인해주세요.
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
                대화를 불러오는 중...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
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
              to="/messages"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              메시지 목록으로
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
                메시지
              </Link>
              {otherProfile && (
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    profilePictureUrl={
                      otherProfile.profile_picture_url || undefined
                    }
                    name={otherProfile.name}
                    username={otherProfile.username}
                    size="md"
                    className="border-2 border-border"
                  />
                  <div>
                    <h1 className="font-bold text-foreground">
                      {otherProfile.name}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      @{otherProfile.username}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-4xl mx-auto px-4 py-6 flex flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto space-y-4 mb-6 relative"
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageCircle />
                    </EmptyMedia>
                    <EmptyTitle>아직 메시지가 없습니다</EmptyTitle>
                    <EmptyDescription>첫 메시지를 보내보세요!</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            ) : (
              messages
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((message, index) => {
                  const prevMessage = messages[index - 1];
                  const showDate =
                    index === 0 ||
                    !prevMessage ||
                    formatDate(message.created_at) !==
                      formatDate(prevMessage.created_at);

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="text-center my-4">
                          <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                      )}

                      <div
                        className={`flex ${
                          message.sender.id === currentProfile?.id
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <MessageBubble
                          content={message.content}
                          timestamp={formatTime(message.created_at)}
                          isFromMe={message.sender.id === currentProfile?.id}
                          images={message.images}
                          currentProfileId={currentProfile?.id}
                          onDelete={() => handleDeleteClick(message.id)}
                        >
                          <DirectMessageReactions
                            reactions={message.reactions || []}
                            currentProfileId={currentProfile?.id}
                            onAddReaction={(emoji) =>
                              addReaction(message.id, emoji)
                            }
                            onRemoveReaction={(emoji) =>
                              removeReaction(message.id, emoji)
                            }
                            isFromMe={message.sender.id === currentProfile?.id}
                          />
                        </MessageBubble>
                      </div>
                    </div>
                  );
                })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-marsh">
            {/* Image previews */}
            {images.length > 0 && (
              <div className="mb-3 pb-3 border-b border-border">
                <div className="flex flex-wrap gap-2">
                  {images.map((image) => (
                    <div key={image.tempId} className="relative group">
                      <img
                        src={image.preview}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(image.tempId)}
                        disabled={isUploadingImages || isSending}
                        className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90 disabled:opacity-50"
                        title="이미지 제거"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {isUploadingImages && !image.uploadedId && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                          <div className="text-white text-xs font-medium">
                            업로드 중...
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImages || isSending}
                className="flex-shrink-0 w-10 h-10 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="이미지 첨부"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={(e) => {
                  const files = pastedImages(e);
                  if (files.length === 0) return;
                  e.preventDefault();
                  addImages(files);
                }}
                placeholder="메시지를 입력하세요..."
                className="flex-1 resize-none border-0 focus:ring-0 p-0 text-sm placeholder:text-muted-foreground max-h-32"
                rows={1}
                disabled={isSending}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={
                  (!newMessage.trim() &&
                    images.filter((img) => img.uploadedId).length === 0) ||
                  isSending ||
                  isUploadingImages
                }
                className="flex-shrink-0 w-10 h-10 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
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
                    상대방에게는 계속 보입니다
                  </div>
                </div>
              </button>
              {(() => {
                const msg = messages.find(
                  (m) => m.id === confirmDeleteMessageId,
                );
                const isFromMe = msg?.sender.id === currentProfile?.id;
                const withinTimeWindow =
                  msg &&
                  Date.now() - new Date(msg.created_at).getTime() <=
                    2 * 60 * 1000;
                return isFromMe && withinTimeWindow;
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
