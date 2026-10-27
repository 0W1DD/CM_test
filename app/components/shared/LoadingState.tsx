import { Spinner } from "~/components/ui/spinner";

interface LoadingStateProps {
  /**
   * Message to display while loading
   */
  message?: string;
  /**
   * Size of the spinner
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * Optional className for the container
   */
  className?: string;
  /**
   * Whether to show as a card (with background and border)
   * @default true
   */
  asCard?: boolean;
}

const spinnerSizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/**
 * Reusable loading state component
 */
export function LoadingState({
  message = "로딩 중...",
  size = "md",
  className = "",
  asCard = true,
}: LoadingStateProps) {
  const content = (
    <div className="flex items-center justify-center gap-3">
      <Spinner className={spinnerSizes[size]} />
      <span className="text-muted-foreground">{message}</span>
    </div>
  );

  if (asCard) {
    return (
      <div
        className={`bg-card border-b border-border p-8 text-center ${className}`}
      >
        {content}
      </div>
    );
  }

  return <div className={className}>{content}</div>;
}
