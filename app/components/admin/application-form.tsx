// The application form's fields (profile name, profile ID, message), as
// commung's console apply and application edit pages had them.
import { useId } from "react";
import { MarkdownField } from "~/components/admin/ui";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export interface ApplicationFormValues {
  profileName: string;
  profileUsername: string;
  message: string;
}

export function ApplicationFormFields({
  values,
  onChange,
  disabled,
  withoutMessage = false,
}: {
  values: ApplicationFormValues;
  onChange: (values: ApplicationFormValues) => void;
  disabled?: boolean;
  /** Only the profile's name and ID (the owner's first profile). */
  withoutMessage?: boolean;
}) {
  const profileNameId = useId();
  const profileUsernameId = useId();
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={profileNameId}>프로필 이름</Label>
        <Input
          id={profileNameId}
          placeholder="커뮤에서 사용할 이름을 입력하세요"
          value={values.profileName}
          onChange={(e) => onChange({ ...values, profileName: e.target.value })}
          required
          maxLength={100}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          커뮤 내에서 표시될 이름입니다
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={profileUsernameId}>프로필 ID *</Label>
        <Input
          id={profileUsernameId}
          placeholder="@username (영문, 숫자, 언더스코어만 사용 가능)"
          value={values.profileUsername}
          onChange={(e) =>
            onChange({
              ...values,
              profileUsername: e.target.value
                .replace(/\s/g, "_")
                .replace(/[^a-zA-Z0-9_]/g, "")
                .toLowerCase(),
            })
          }
          required
          maxLength={50}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          @{values.profileUsername || "username"} 형태로 표시됩니다
        </p>
      </div>

      {!withoutMessage && (
        <div className="space-y-2">
          <Label>신청 메시지 (선택사항)</Label>
          <MarkdownField
            value={values.message}
            onChange={(message) => onChange({ ...values, message })}
            placeholder="가입하고 싶은 이유나 자기소개를 작성해주세요..."
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            운영자에게 전달될 메시지입니다. 텍스트에 이미지를 직접 삽입할 수
            있습니다.
          </p>
        </div>
      )}
    </>
  );
}
