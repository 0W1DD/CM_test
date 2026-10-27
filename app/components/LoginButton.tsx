import { signIn } from "~/lib/naru";

interface LoginButtonProps {
  className?: string;
  children?: React.ReactNode;
}

/** Signs in with a Naru account, and comes back to this page. */
export function LoginButton({
  className,
  children = "로그인하기",
}: LoginButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void signIn()}
      className={
        className ||
        "inline-flex items-center justify-center px-7 py-3 bg-primary text-primary-foreground font-semibold rounded-full shadow-marsh hover:shadow-marsh-lg hover:-translate-y-px transition-all duration-200"
      }
    >
      {children}
    </button>
  );
}
