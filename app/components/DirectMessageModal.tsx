import { Send } from "lucide-react";
import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { PostPreview } from "~/components/PostPreview";
import { errorMessage, mutate } from "~/lib/naru";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";

interface DirectMessageModalProps {
  postId: string;
  postAuthor: {
    username: string;
    name: string;
  };
  isOpen: boolean;
  onClose: () => void;
  currentProfileId: string;
  receiverId: string;
}

export function DirectMessageModal({
  postId,
  postAuthor,
  isOpen,
  onClose,
  currentProfileId,
  receiverId,
}: DirectMessageModalProps) {
  const navigate = useNavigate();
  const textareaId = useId();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Auto-generate post link
  const postLink = `${window.location.origin}/${postAuthor.username}/${postId}`;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("메시지를 입력해주세요");
      return;
    }

    setIsSending(true);
    try {
      const messageContent = `${postLink}\n\n${message.trim()}`;

      await mutate("messages:send", {
        profile_id: currentProfileId,
        receiver_id: receiverId,
        content: messageContent,
        image_ids: [],
      });
      toast.success("메시지가 전송되었습니다");
      onClose();
      setMessage("");
      // Navigate to the conversation
      navigate(`/messages/${postAuthor.username}`);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(errorMessage(error, "메시지 전송에 실패했습니다"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>다이렉트 메시지 보내기</DialogTitle>
          <DialogDescription>
            {postAuthor.name}(@{postAuthor.username})님에게 게시물 링크와 함께
            메시지를 보냅니다
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">답장할 게시물:</p>
            <PostPreview
              postUrl={postLink}
              currentProfileId={currentProfileId}
            />
          </div>

          <div>
            <label
              htmlFor={textareaId}
              className="text-sm font-medium text-foreground mb-2 block"
            >
              메시지
            </label>
            <Textarea
              id={textareaId}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              rows={4}
              disabled={isSending}
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSending}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {isSending ? "전송 중..." : "전송"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
