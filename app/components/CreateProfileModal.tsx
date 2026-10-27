import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";

interface CreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateProfileModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProfileModalProps) {
  const { createProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    bio: "",
    is_primary: false,
  });
  const [usernameError, setUsernameError] = useState("");
  const nameId = useId();
  const usernameId = useId();
  const bioId = useId();
  const isPrimaryId = useId();

  // Username validation function
  const validateUsername = useCallback(
    (username: string | undefined): string => {
      if (!username) {
        return "사용자명을 입력해주세요";
      }
      const trimmed = username.trim();

      if (!trimmed) {
        return "사용자명을 입력해주세요";
      }

      if (trimmed.length > 50) {
        return "사용자명은 50자를 초과할 수 없습니다";
      }

      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return "사용자명은 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다";
      }

      return "";
    },
    [],
  );

  // Handle username change with validation
  const handleUsernameChange = (value: string) => {
    // Apply same filtering as console: replace spaces with underscores, remove non-alphanumeric/underscore
    const filtered = value.replace(/\s/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

    setFormData({ ...formData, username: filtered });

    // Validate
    const error = validateUsername(filtered);
    setUsernameError(error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }
    if (!formData.username.trim()) {
      toast.error("사용자명을 입력해주세요");
      return;
    }
    if (usernameError) {
      toast.error("유효한 사용자명을 입력해주세요");
      return;
    }

    setIsLoading(true);
    try {
      await createProfile({
        name: formData.name.trim(),
        username: formData.username.trim(),
        bio: formData.bio.trim() || undefined,
        is_primary: formData.is_primary,
      });
      setFormData({ name: "", username: "", bio: "", is_primary: false });
      setUsernameError("");
      onSuccess?.();
      onClose();
    } catch (_error) {
      // Error already handled in createProfile
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 프로필 만들기</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor={nameId}>이름 *</FieldLabel>
            <Input
              id={nameId}
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="표시될 이름"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={usernameId}>사용자명 *</FieldLabel>
            <Input
              id={usernameId}
              value={formData.username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="@username (영문, 숫자, 언더스코어만 사용 가능)"
              required
            />
            <FieldError>{usernameError}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={bioId}>소개</FieldLabel>
            <Textarea
              id={bioId}
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              placeholder="이 프로필에 대해 소개해주세요..."
              rows={3}
            />
          </Field>
          <Field orientation="horizontal">
            <input
              type="checkbox"
              id={isPrimaryId}
              checked={formData.is_primary}
              onChange={(e) =>
                setFormData({ ...formData, is_primary: e.target.checked })
              }
              className="rounded border-border"
            />
            <FieldLabel htmlFor={isPrimaryId} className="text-sm">
              메인 프로필로 설정
            </FieldLabel>
          </Field>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={isLoading || !!usernameError}>
              {isLoading ? "생성 중..." : "프로필 만들기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
