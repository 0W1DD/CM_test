import { Coins } from "lucide-react";
import { Link } from "react-router";
import { useShopSummary } from "~/hooks/useShopSummary";

export function BalancePill({
  compact = false,
  fullWidth = false,
}: {
  compact?: boolean;
  fullWidth?: boolean;
}) {
  const { data } = useShopSummary();
  if (!data || !data.has_currency) return null;

  const currency = data.default_currency ?? data.currencies[0];
  if (!currency) return null;

  const balance =
    data.balances.find((b) => b.currencyId === currency.id)?.amount ?? 0;
  const formatted = balance.toLocaleString("ko-KR");
  const title = `${formatted} ${currency.name}`;

  if (compact) {
    return (
      <Link
        to="/shop"
        title={title}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-butter/40 text-butter-ink hover:bg-butter/60 transition-colors"
      >
        <Coins className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link
      to="/shop"
      title={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-butter/40 text-butter-ink text-sm font-medium hover:bg-butter/60 transition-colors ${
        fullWidth ? "w-full justify-center" : ""
      }`}
    >
      <Coins className="h-4 w-4" />
      <span className="tabular-nums">{formatted}</span>
      <span className="text-butter-ink/80">{currency.name}</span>
    </Link>
  );
}
