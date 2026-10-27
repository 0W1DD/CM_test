// What the boards, shop, apps and bots admin pages share, from commung's
// console: its page header, checkbox, and the gate that keeps a page to the
// community's owner or its staff.
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import * as React from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
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
  tone = "primary",
}: {
  eyebrow?: string;
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
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
    </section>
  );
}

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => (
    <input
      type="checkbox"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";

/** A link back to the admin home, as the console's "커뮤로 돌아가기". */
export function BackToAdmin() {
  return (
    <div className="mb-2">
      <Link to="/admin">
        <Button variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          관리로 돌아가기
        </Button>
      </Link>
    </div>
  );
}

/**
 * Shows `children` only to the community's owner (`owner`) or its owner and
 * moderators (`staff`); others see why not, as the console did.
 */
export function AdminGate({
  allow,
  icon: Icon,
  title,
  denied,
  children,
}: {
  allow: "owner" | "staff";
  icon: LucideIcon;
  title: string;
  denied: string;
  children: ReactNode;
}) {
  const { userRole, isLoading } = useCurrentInstance();
  if (isLoading)
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-9 w-32" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  const allowed =
    userRole === "owner" || (allow === "staff" && userRole === "moderator");
  if (!allowed)
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                {title}
              </CardTitle>
              <CardDescription>{denied}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <Link to="/">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    홈으로 돌아가기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  return <>{children}</>;
}
