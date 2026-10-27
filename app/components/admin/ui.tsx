// What the community's admin and apply pages share, from commung's console:
// its page header, status and role badges, table, a markdown field with
// image insertion, and the gate that keeps a page to the owner or staff.
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CheckIcon,
  ClockIcon,
  Crown,
  ImagePlus,
  Lock,
  Shield,
  User,
  XIcon,
} from "lucide-react";
import MarkdownIt from "markdown-it";
import type * as React from "react";
import { type ReactNode, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { LoadingState } from "~/components/shared/LoadingState";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/hooks/useAuth";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { errorMessage } from "~/lib/naru";
import { uploadImage } from "~/lib/upload-image";
import { cn } from "~/lib/utils";

const TONES = {
  primary: {
    eyebrow: "text-primary",
    icon: "text-primary",
    iconBg: "bg-primary/15",
    blob: "from-primary/20 via-primary/10 to-transparent",
  },
  mint: {
    eyebrow: "text-mint-ink",
    icon: "text-mint-ink",
    iconBg: "bg-mint/40",
    blob: "from-mint/40 via-mint/20 to-transparent",
  },
  lilac: {
    eyebrow: "text-lilac-ink",
    icon: "text-lilac-ink",
    iconBg: "bg-lilac/40",
    blob: "from-lilac/40 via-lilac/20 to-transparent",
  },
  butter: {
    eyebrow: "text-butter-ink",
    icon: "text-butter-ink",
    iconBg: "bg-butter/40",
    blob: "from-butter/40 via-butter/20 to-transparent",
  },
  blossom: {
    eyebrow: "text-blossom-ink",
    icon: "text-blossom-ink",
    iconBg: "bg-blossom/40",
    blob: "from-blossom/40 via-blossom/20 to-transparent",
  },
} as const;

export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  children,
  tone = "primary",
}: {
  eyebrow?: string;
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <section className="relative isolate transform-gpu overflow-hidden rounded-3xl border border-border/70 bg-card/70 backdrop-blur-sm shadow-marsh px-6 sm:px-8 py-7 mb-6">
      <div
        className={`pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-gradient-to-br ${t.blob} blur-2xl`}
      />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {Icon && (
            <span
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${t.iconBg} ${t.icon} shadow-marsh`}
            >
              <Icon className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${t.eyebrow} mb-1.5`}
              >
                {eyebrow}
              </p>
            )}
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </section>
  );
}

const APPLICATION_STATUS = {
  pending: {
    label: "대기 중",
    icon: ClockIcon,
    className: "bg-butter/40 text-butter-ink dark:bg-butter/25",
  },
  approved: {
    label: "승인됨",
    icon: CheckIcon,
    className: "bg-mint/40 text-mint-ink dark:bg-mint/25",
  },
  rejected: {
    label: "거절됨",
    icon: XIcon,
    className: "bg-destructive/15 text-destructive",
  },
} as const;

export type ApplicationStatus = keyof typeof APPLICATION_STATUS;

export function StatusBadge({ status }: { status: string }) {
  const config = APPLICATION_STATUS[status as ApplicationStatus];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Badge className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export type Role = "owner" | "moderator" | "member";

export const ROLE_CONFIG = {
  owner: {
    label: "소유자",
    icon: Crown,
    className: "bg-destructive/15 text-destructive",
  },
  moderator: {
    label: "모더레이터",
    icon: Shield,
    className: "bg-primary/15 text-primary",
  },
  member: {
    label: "멤버",
    icon: User,
    className: "bg-muted text-muted-foreground",
  },
} as const;

export function RoleBadge({ role }: { role: Role }) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Badge className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}
export const TableHeader = ({
  className,
  ...props
}: React.ComponentProps<"thead">) => (
  <thead className={cn("[&_tr]:border-b", className)} {...props} />
);
export const TableBody = ({
  className,
  ...props
}: React.ComponentProps<"tbody">) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);
export const TableRow = ({
  className,
  ...props
}: React.ComponentProps<"tr">) => (
  <tr
    className={cn("hover:bg-muted/50 border-b transition-colors", className)}
    {...props}
  />
);
export const TableHead = ({
  className,
  ...props
}: React.ComponentProps<"th">) => (
  <th
    className={cn(
      "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap",
      className,
    )}
    {...props}
  />
);
export const TableCell = ({
  className,
  ...props
}: React.ComponentProps<"td">) => (
  <td
    className={cn("p-2 align-middle whitespace-nowrap", className)}
    {...props}
  />
);

const md = new MarkdownIt({ linkify: true, breaks: true });

/** Markdown (no raw HTML) rendered as commung's console rendered messages. */
export function Markdown({ source }: { source: string }) {
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-4 bg-muted/30"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown-it escapes HTML
      dangerouslySetInnerHTML={{ __html: md.render(source) }}
    />
  );
}

/**
 * A markdown textarea with an image button: the image is uploaded and its
 * markdown inserted at the cursor (commung's MarkdownEditor's image upload).
 */
export function MarkdownField({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 8,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const insertImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드할 수 있습니다");
      return;
    }
    setUploading(true);
    try {
      const image = await uploadImage(file);
      const at = textareaRef.current?.selectionStart ?? value.length;
      const snippet = `![${image.filename}](${image.url})`;
      onChange(`${value.slice(0, at)}${snippet}${value.slice(at)}`);
    } catch (error) {
      toast.error(errorMessage(error, "이미지 업로드에 실패했습니다"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || uploading}
        rows={rows}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? <Spinner /> : <ImagePlus className="h-4 w-4" />}
          이미지 넣기
        </Button>
        <span className="text-xs text-muted-foreground">
          마크다운 사용 가능
        </span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImage(file);
        }}
      />
    </div>
  );
}

/** A centered empty state with an icon, as the console's pages show. */
export function Notice({
  icon: Icon = Lock,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </EmptyHeader>
        {children}
      </Empty>
    </div>
  );
}

/**
 * Renders `children` only for the community's owner (`owner`) or its owner
 * and moderators (`staff`); others see why not.
 */
export function AdminGate({
  need,
  children,
}: {
  need: "owner" | "staff";
  children: ReactNode;
}) {
  const { user, isLoading, login } = useAuth();
  const {
    isOwner,
    isModerator,
    isLoading: instanceLoading,
  } = useCurrentInstance();
  if (isLoading || instanceLoading)
    return (
      <LoadingState
        message="인증 확인 중..."
        asCard={false}
        className="py-16"
      />
    );
  if (!user)
    return (
      <Notice
        title="로그인이 필요합니다"
        description="관리하려면 로그인해주세요"
      >
        <Button onClick={() => login()}>로그인</Button>
      </Notice>
    );
  const allowed = need === "owner" ? isOwner : isModerator;
  if (!allowed)
    return (
      <Notice
        title="접근 권한이 없습니다"
        description={
          need === "owner"
            ? "커뮤 소유자만 접근할 수 있습니다."
            : "모더레이터 또는 소유자만 접근할 수 있습니다."
        }
      >
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" />
            홈으로
          </Button>
        </Link>
      </Notice>
    );
  return <>{children}</>;
}

/** The "back to admin" button atop each admin page. */
export function BackToAdmin() {
  return (
    <div className="mb-2">
      <Link to="/admin">
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4" />
          관리로 돌아가기
        </Button>
      </Link>
    </div>
  );
}

/** "2026년 10월 16일 오후 12:00", or "-". */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "알 수 없음";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
