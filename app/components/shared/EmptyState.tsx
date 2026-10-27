import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  /**
   * Icon to display (Lucide icon component)
   */
  icon?: LucideIcon;
  /**
   * Custom icon element if you want more control
   */
  iconElement?: ReactNode;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Action buttons or elements
   */
  actions?: ReactNode;
  /**
   * Optional className for the container
   */
  className?: string;
}

/**
 * Reusable empty state component for displaying when there's no content
 */
export function EmptyState({
  icon: Icon,
  iconElement,
  title,
  description,
  actions,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`bg-card border-b border-border p-12 text-center ${className}`}
    >
      <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
        {iconElement ? (
          iconElement
        ) : Icon ? (
          <Icon className="h-8 w-8 text-muted-foreground" />
        ) : (
          <span className="text-2xl">📝</span>
        )}
      </div>
      <h2 className="text-xl font-bold text-foreground mb-3">{title}</h2>
      {description && (
        <p className="text-muted-foreground mb-6">{description}</p>
      )}
      {actions && (
        <div className="flex items-center justify-center gap-3">{actions}</div>
      )}
    </div>
  );
}
