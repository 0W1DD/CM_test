import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Coins,
  Lock,
  Package,
  ScrollText,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useAuth } from "~/hooks/useAuth";
import { useCommunityProfilesQuery } from "~/hooks/useCommunityProfiles";
import {
  type ShopInventoryEntry,
  type ShopItem,
  useShopSummary,
} from "~/hooks/useShopSummary";
import { errorMessage, mutate } from "~/lib/naru";

export function meta() {
  return [
    { title: "상점" },
    { name: "description", content: "커뮤 상점에서 상품을 구매하세요" },
  ];
}

function ItemRow({
  item,
  balance,
  onBuy,
  pending,
}: {
  item: ShopItem;
  balance: number;
  onBuy: (item: ShopItem) => void;
  pending: boolean;
}) {
  const canAfford = balance >= item.priceAmount;
  const [open, setOpen] = useState(false);
  // Long descriptions fold to two lines so the list stays scannable.
  const long =
    (item.description?.length ?? 0) > 90 ||
    (item.description?.split("\n").length ?? 0) > 2;

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Package className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-semibold break-words">{item.name}</h3>
            {item.consumable && (
              <Badge variant="outline" className="text-xs">
                소모품
              </Badge>
            )}
            {item.isUnique && (
              <Badge variant="outline" className="text-xs">
                유니크
              </Badge>
            )}
          </div>
          {item.description && (
            <>
              <p
                className={`mt-1 text-sm text-muted-foreground whitespace-pre-line break-words ${
                  long && !open ? "line-clamp-2" : ""
                }`}
              >
                {item.description}
              </p>
              {long && (
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="mt-1 text-xs font-medium text-primary hover:underline"
                >
                  {open ? "접기" : "설명 더보기"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center justify-between gap-3 pl-8 sm:justify-end sm:pl-0">
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
          {item.priceAmount.toLocaleString("ko-KR")} {item.currencyName}
        </span>
        <Button
          size="sm"
          className="min-w-[4.5rem]"
          disabled={!canAfford || pending}
          onClick={() => onBuy(item)}
        >
          {!canAfford ? "잔액 부족" : pending ? "구매 중..." : "구매"}
        </Button>
      </div>
    </li>
  );
}

export default function ShopPage() {
  const { currentProfile } = useAuth();
  const { data, isLoading, refetch } = useShopSummary();
  const queryClient = useQueryClient();

  const buy = useMutation({
    mutationFn: async (item: ShopItem) => {
      if (!currentProfile) throw new Error("프로필을 선택하세요");
      try {
        await mutate("shop:buy", {
          profile_id: currentProfile.id,
          item_id: item.id,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "구매에 실패했습니다"));
      }
      return item;
    },
    onSuccess: (item) => {
      toast.success(`🛒 ${item.name} 구매 완료!`);
      queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Using an item, or handing it to someone, writes it to the use log, off
  // the timeline, where the staff confirm it; a secret entry shows to
  // others only as a secret.
  const [using, setUsing] = useState<string | null>(null);
  const [mode, setMode] = useState<"use" | "transfer">("use");
  const [note, setNote] = useState("");
  const [secret, setSecret] = useState(false);
  const [to, setTo] = useState("");
  const [qty, setQty] = useState(1);
  const startUsing = (
    itemId: string | null,
    nextMode: "use" | "transfer" = "use",
  ) => {
    setUsing(itemId);
    setMode(nextMode);
    setNote("");
    setSecret(false);
    setTo("");
    setQty(1);
  };
  const { data: profiles = [] } = useCommunityProfilesQuery(
    using !== null && mode === "transfer",
  );
  const recipients = profiles.filter((p) => p.id !== currentProfile?.id);
  const use = useMutation({
    mutationFn: async (entry: ShopInventoryEntry) => {
      if (!currentProfile) throw new Error("프로필을 선택하세요");
      try {
        await mutate("uses:use", {
          profile_id: currentProfile.id,
          item_id: entry.itemId,
          note,
          secret,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "사용하지 못했습니다"));
      }
      return entry.itemName;
    },
    onSuccess: (name) => {
      toast.success(`${name}을(를) 사용했습니다. 사용 로그에 기록됐어요.`);
      startUsing(null);
      queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
      queryClient.invalidateQueries({ queryKey: ["item-uses"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const transfer = useMutation({
    mutationFn: async (entry: ShopInventoryEntry) => {
      if (!currentProfile) throw new Error("프로필을 선택하세요");
      if (!to) throw new Error("받는 사람을 고르세요");
      try {
        await mutate("uses:transfer", {
          profile_id: currentProfile.id,
          item_id: entry.itemId,
          to_username: to,
          qty,
          note,
          secret,
        });
      } catch (error) {
        throw new Error(errorMessage(error, "양도하지 못했습니다"));
      }
      return entry.itemName;
    },
    onSuccess: (name) => {
      toast.success(`${name}을(를) 양도했습니다. 사용 로그에 기록됐어요.`);
      startUsing(null);
      queryClient.invalidateQueries({ queryKey: ["shop-summary"] });
      queryClient.invalidateQueries({ queryKey: ["item-uses"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const busy = use.isPending || transfer.isPending;

  if (isLoading || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Skeleton className="h-32 w-full mb-6" />
        <div className="space-y-2">
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const defaultCurrency = data.default_currency ?? data.currencies[0] ?? null;
  const balanceForItem = (item: ShopItem) =>
    data.balances.find((b) => b.currencyId === item.currencyId)?.amount ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header with balances */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          상점
        </h1>
        {data.balances.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {data.balances.map((b) => (
              <div
                key={b.currencyId}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-butter/30 text-butter-ink text-sm"
              >
                <Coins className="h-3.5 w-3.5" />
                <span className="tabular-nums font-medium">
                  {b.amount.toLocaleString("ko-KR")}
                </span>
                <span>{b.currencyName}</span>
                {b.isDefault && (
                  <span className="text-xs text-butter-ink/70">(기본)</span>
                )}
              </div>
            ))}
          </div>
        ) : defaultCurrency ? (
          <p className="text-sm text-muted-foreground">아직 잔액이 없습니다.</p>
        ) : null}
      </div>

      {/* What each currency is for, which members could not see before */}
      {data.currencies.some((c) => c.description) && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">화폐 안내</h2>
          <ul className="border border-border rounded-md divide-y divide-border">
            {data.currencies.map((c) => (
              <li key={c.id} className="flex gap-3 px-4 py-2.5 text-sm">
                <span className="font-semibold whitespace-nowrap flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-butter-ink" />
                  {c.name}
                </span>
                <span className="text-muted-foreground whitespace-pre-line break-words min-w-0">
                  {c.description ?? "설명이 없습니다."}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Items grid */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">상품</h2>
        {!data.has_items ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                상점이 아직 준비 중입니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="framed divide-y divide-border">
            {data.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                balance={balanceForItem(item)}
                onBuy={(i) => buy.mutate(i)}
                pending={buy.isPending}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Inventory */}
      {data.inventory.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">보유 상품</h2>
            <Link
              to="/uses"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ScrollText className="h-4 w-4" />
              사용 로그
            </Link>
          </div>
          <Card>
            <CardContent className="p-4 space-y-2">
              {data.inventory.map((entry) => (
                <div key={entry.itemId} className="border-b last:border-b-0">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">
                        {entry.itemName}
                      </span>
                      {entry.consumable && (
                        <Badge variant="outline" className="text-xs">
                          소모품
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm tabular-nums whitespace-nowrap">
                      ×{entry.qty}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || entry.qty < 1}
                      onClick={() =>
                        startUsing(
                          using === entry.itemId && mode === "use"
                            ? null
                            : entry.itemId,
                          "use",
                        )
                      }
                    >
                      {entry.consumable ? "사용" : "꺼내 보이기"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || entry.qty < 1}
                      onClick={() =>
                        startUsing(
                          using === entry.itemId && mode === "transfer"
                            ? null
                            : entry.itemId,
                          "transfer",
                        )
                      }
                    >
                      양도
                    </Button>
                  </div>
                  {using === entry.itemId && (
                    <form
                      className="mb-3 space-y-2 border-[1.5px] border-[var(--frame)] bg-background p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (mode === "transfer") transfer.mutate(entry);
                        else use.mutate(entry);
                      }}
                    >
                      {mode === "transfer" && (
                        <div className="flex gap-2">
                          <select
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="min-w-0 flex-1 border border-border bg-card px-2 h-9 text-sm"
                          >
                            <option value="">받는 사람 고르기</option>
                            {recipients.map((p) => (
                              <option key={p.id} value={p.username}>
                                {p.name} (@{p.username})
                              </option>
                            ))}
                          </select>
                          {entry.qty > 1 && (
                            <input
                              type="number"
                              min={1}
                              max={entry.qty}
                              step={1}
                              value={qty}
                              onChange={(e) =>
                                setQty(
                                  Math.min(
                                    entry.qty,
                                    Math.max(1, Number(e.target.value) || 1),
                                  ),
                                )
                              }
                              aria-label="수량"
                              className="w-20 border border-border bg-card px-2 h-9 text-sm"
                            />
                          )}
                        </div>
                      )}
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                        rows={2}
                        placeholder={
                          mode === "transfer"
                            ? "양도하며 남길 말 (선택)"
                            : "어떻게 사용하나요? (선택)"
                        }
                        className="w-full resize-none border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={secret}
                            onChange={(e) => setSecret(e.target.checked)}
                          />
                          <Lock className="h-3.5 w-3.5" />
                          {mode === "transfer" ? "비밀로 양도" : "비밀로 사용"}
                        </label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => startUsing(null)}
                          >
                            취소
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={busy || (mode === "transfer" && !to)}
                          >
                            {mode === "transfer"
                              ? "양도하기"
                              : entry.consumable
                                ? "사용하기"
                                : "꺼내 보이기"}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        타임라인에는 올라가지 않고 사용 로그에 기록되며,
                        운영진이 확인하면 승인됩니다.
                        {mode === "transfer" &&
                          " 아이템은 바로 받는 사람에게 넘어갑니다."}
                        {secret &&
                          (mode === "transfer"
                            ? " 비밀 양도는 주고받는 사람과 운영진에게만 내용이 보입니다."
                            : " 비밀 사용은 나와 운영진에게만 내용이 보입니다.")}
                      </p>
                    </form>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
