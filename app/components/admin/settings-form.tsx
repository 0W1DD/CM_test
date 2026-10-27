// The community settings form (commung's community form fields), for the
// owner's settings page and the site owner's first setup.
import { ImageIcon, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { CommunitySettings } from "~/components/admin/types";
import { MarkdownField } from "~/components/admin/ui";
import { Button } from "~/components/ui/button";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { errorMessage } from "~/lib/naru";
import { uploadImage } from "~/lib/upload-image";

interface Flags {
  recruiting: boolean;
  mute_new_members: boolean;
  show_all_replies: boolean;
  bump_on_reply: boolean;
  auto_approve: boolean;
}

/** The end a community without one is saved with: 2099-12-31 23:59 (KST). */
const INDEFINITE_END = new Date("2099-12-31T23:59:00+09:00");

function Check({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <Field orientation="horizontal">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-primary"
      />
      <div className="space-y-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </div>
    </Field>
  );
}

/**
 * A picture the settings keep by its image ID (images:register): its
 * preview, and the ID to send, undefined while unchanged and null once
 * removed.
 */
function useImageChoice(initialUrl: string | null | undefined) {
  const [preview, setPreview] = useState(initialUrl ?? null);
  const [id, setId] = useState<string | null | undefined>();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const select = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다");
      return;
    }
    setUploading(true);
    setError("");
    setPreview(URL.createObjectURL(file));
    try {
      const image = await uploadImage(file);
      setId(image.id);
      setPreview(image.url);
    } catch (err) {
      setError(errorMessage(err, "이미지 업로드에 실패했습니다"));
      setPreview(initialUrl ?? null);
    } finally {
      setUploading(false);
    }
  };
  const remove = () => {
    setPreview(null);
    setId(null);
  };
  return { preview, id, uploading, error, select, remove };
}

function ImageChoiceField({
  label,
  choice,
}: {
  label: string;
  choice: ReturnType<typeof useImageChoice>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border-2 border-dashed border-border rounded-lg p-4">
        {choice.preview ? (
          <div className="relative">
            <img
              src={choice.preview}
              alt="미리보기"
              className="w-full h-auto rounded"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={choice.remove}
              disabled={choice.uploading}
            >
              <X className="h-4 w-4" />
            </Button>
            {choice.uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                <div className="text-white text-sm">업로드 중...</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={choice.uploading}
              >
                이미지 선택
              </Button>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) choice.select(file);
            e.target.value = "";
          }}
        />
      </div>
      {choice.error && (
        <p className="text-sm text-destructive">{choice.error}</p>
      )}
    </div>
  );
}

/** The settings form, also the owner's first setup (`onSubmit` differs). */
export function SettingsForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: CommunitySettings | null;
  submitLabel: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const ids = {
    name: useId(),
    birth: useId(),
    recruiting: useId(),
    mute: useId(),
    replies: useId(),
    bump: useId(),
    auto: useId(),
    gate: useId(),
  };
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [birthYear, setBirthYear] = useState(
    initial?.minimum_birth_year ? String(initial.minimum_birth_year) : "",
  );
  const [flags, setFlags] = useState<Flags>({
    recruiting: initial?.is_recruiting ?? false,
    mute_new_members: initial?.mute_new_members ?? false,
    show_all_replies: initial?.show_all_replies ?? false,
    bump_on_reply: initial?.bump_on_reply ?? false,
    auto_approve: initial?.auto_approve ?? false,
  });
  const date = (value: string | null | undefined) =>
    value ? new Date(value) : undefined;
  const [startDate, setStartDate] = useState(date(initial?.starts_at));
  const [endDate, setEndDate] = useState(date(initial?.ends_at));
  // No end: kept as the last minute of 2099, since the end date is required.
  const [indefinite, setIndefinite] = useState(
    initial?.ends_at ? new Date(initial.ends_at).getFullYear() >= 2099 : false,
  );
  const [recruitingStartDate, setRecruitingStartDate] = useState(
    date(initial?.recruiting_starts_at),
  );
  const [recruitingEndDate, setRecruitingEndDate] = useState(
    date(initial?.recruiting_ends_at),
  );
  const banner = useImageChoice(initial?.banner_image_url);
  // The front gate (components/front-gate.tsx): HTML and a picture.
  const gateImage = useImageChoice(initial?.gate_image_url);
  const [gateHtml, setGateHtml] = useState(initial?.gate_html ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const flag = (key: keyof Flags) => (checked: boolean) =>
    setFlags((prev) => ({ ...prev, [key]: checked }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const end = indefinite ? INDEFINITE_END : endDate;
    if (!startDate || !end)
      return setError("시작일과 종료일을 모두 선택해주세요");
    if (end <= startDate)
      return setError("종료일은 시작일보다 나중이어야 합니다");
    if (recruitingStartDate && !recruitingEndDate)
      return setError("모집 시작일을 설정했다면 모집 종료일도 설정해주세요");
    if (!recruitingStartDate && recruitingEndDate)
      return setError("모집 종료일을 설정했다면 모집 시작일도 설정해주세요");
    if (
      recruitingStartDate &&
      recruitingEndDate &&
      recruitingEndDate <= recruitingStartDate
    )
      return setError("모집 종료일은 모집 시작일보다 나중이어야 합니다");
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description || null,
        starts_at: startDate.toISOString(),
        ends_at: end.toISOString(),
        is_recruiting: flags.recruiting,
        recruiting_starts_at: recruitingStartDate?.toISOString() ?? null,
        recruiting_ends_at: recruitingEndDate?.toISOString() ?? null,
        minimum_birth_year: birthYear ? Number.parseInt(birthYear, 10) : null,
        mute_new_members: flags.mute_new_members,
        show_all_replies: flags.show_all_replies,
        bump_on_reply: flags.bump_on_reply,
        auto_approve: flags.auto_approve,
        ...(banner.id !== undefined ? { banner_image_id: banner.id } : {}),
        gate_html: gateHtml.trim() ? gateHtml : null,
        ...(gateImage.id !== undefined ? { gate_image_id: gateImage.id } : {}),
      });
    } catch (err) {
      setError(errorMessage(err, "커뮤 수정에 실패했습니다"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field>
        <FieldLabel htmlFor={ids.name}>커뮤 이름</FieldLabel>
        <Input
          id={ids.name}
          placeholder="커뮤 이름을 입력하세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <FieldDescription>
          커뮤의 주소는 나루 사이트의 주소입니다. 사용자 지정 도메인은 나루의
          사이트 설정에서 연결합니다.
        </FieldDescription>
      </Field>

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">커뮤 이미지</h3>
      <ImageChoiceField label="커뮤 배너 이미지 (선택사항)" choice={banner} />

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">첫 화면</h3>
      <p className="text-sm text-muted-foreground -mt-2 mb-4">
        아직 멤버가 아닌 방문자가 커뮤 첫 화면에서 로그인이나 가입 신청 버튼
        위로 보는 그림과 글입니다.
      </p>
      <ImageChoiceField label="첫 화면 그림 (선택사항)" choice={gateImage} />
      <Field>
        <FieldLabel htmlFor={ids.gate}>첫 화면 글 (HTML, 선택사항)</FieldLabel>
        <Textarea
          id={ids.gate}
          value={gateHtml}
          onChange={(e) => setGateHtml(e.target.value)}
          maxLength={20000}
          rows={8}
          spellCheck={false}
          placeholder="<h2>어서 오세요</h2>&#10;<p>커뮤 소개를 적어 주세요.</p>"
          className="font-mono text-sm"
        />
        <FieldDescription>
          글자 모양, 링크, 그림, 표, style 속성은 그대로 보이고, 스크립트와 입력
          양식은 빠집니다. 최대 2만 자입니다.
        </FieldDescription>
      </Field>

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">커뮤 일정</h3>
      <Field>
        <FieldLabel>시작일시</FieldLabel>
        <DateTimePicker
          value={startDate}
          onChange={setStartDate}
          maxDate={endDate ? new Date(endDate.getTime() - 1) : undefined}
        />
      </Field>
      <Field>
        <FieldLabel>종료일시</FieldLabel>
        <label className="flex items-center gap-2 text-sm mb-2">
          <input
            type="checkbox"
            checked={indefinite}
            onChange={(e) => setIndefinite(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          종료일 없음 (무기한 커뮤)
        </label>
        {!indefinite && (
          <DateTimePicker
            value={endDate}
            onChange={setEndDate}
            minDate={startDate ? new Date(startDate.getTime() + 1) : undefined}
          />
        )}
      </Field>

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">
        공개 모집 설정
      </h3>
      <Check
        id={ids.recruiting}
        checked={flags.recruiting}
        onChange={flag("recruiting")}
        label="현재 공개 모집 중"
        description="모집 중일 때 로그인한 나루 회원이 가입을 신청할 수 있습니다."
      />
      {flags.recruiting && (
        <>
          <Field>
            <FieldLabel>모집 시작일시</FieldLabel>
            <DateTimePicker
              value={recruitingStartDate}
              onChange={setRecruitingStartDate}
            />
          </Field>
          <Field>
            <FieldLabel>모집 종료일시</FieldLabel>
            <DateTimePicker
              value={recruitingEndDate}
              onChange={setRecruitingEndDate}
              minDate={
                recruitingStartDate
                  ? new Date(recruitingStartDate.getTime() + 1)
                  : undefined
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={ids.birth}>최소 나이 제한</FieldLabel>
            <Input
              id={ids.birth}
              type="number"
              placeholder="예: 2005 (2005년생 이상만 가입 가능)"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              min="1900"
              max={new Date().getFullYear()}
            />
            <FieldDescription>
              지정한 연도에 태어난 사람 이상만 커뮤에 가입할 수 있습니다.
              비워두면 제한이 없습니다.
            </FieldDescription>
          </Field>
        </>
      )}

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">멤버 관리</h3>
      <Check
        id={ids.mute}
        checked={flags.mute_new_members}
        onChange={flag("mute_new_members")}
        label="신규 멤버 자동 음소거"
        description="새로운 멤버가 자동으로 음소거되며 공개 글을 작성할 수 없습니다. 멤버 관리 페이지에서 개별적으로 음소거를 해제할 수 있습니다."
      />
      <Check
        id={ids.auto}
        checked={flags.auto_approve}
        onChange={flag("auto_approve")}
        label="가입 신청 자동 승인"
        description="가입 신청이 들어오면 운영자의 검토 없이 바로 승인합니다."
      />

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">타임라인</h3>
      <Check
        id={ids.replies}
        checked={flags.show_all_replies}
        onChange={flag("show_all_replies")}
        label="모든 답글 표시"
        description="타임라인에서 모든 답글을 펼쳐서 표시합니다. 비활성화하면 사용자가 참여하거나 언급된 답글만 기본으로 표시됩니다."
      />
      <Check
        id={ids.bump}
        checked={flags.bump_on_reply}
        onChange={flag("bump_on_reply")}
        label="답글도 타임라인에 올리기"
        description="새 답글이 원글 미리보기와 함께 타임라인 맨 위에 따로 올라옵니다. 옛날 게시물이 통째로 끌려 올라오지 않아, 지금 누가 누구와 대화하는지 시간순으로 볼 수 있습니다. (추천)"
      />

      <Separator className="my-6" />
      <div className="space-y-2">
        <Label>커뮤 소개</Label>
        <MarkdownField
          value={description}
          onChange={setDescription}
          placeholder="커뮤에 대한 소개를 작성해주세요..."
          disabled={saving}
        />
      </div>

      {error && (
        <div className="text-sm text-destructive text-center">{error}</div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={saving || banner.uploading || gateImage.uploading}
      >
        {saving && <Spinner />}
        {saving ? "저장 중..." : submitLabel}
      </Button>
    </form>
  );
}
