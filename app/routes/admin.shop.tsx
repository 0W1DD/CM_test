// The shop's currencies, items, grants and transactions (commung's console
// communities.$slug.shop): staff see it, the owner changes it.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Edit2, Gift, Package, Plus, Star, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  AdminGate,
  BackToAdmin,
  PageHeader,
} from "~/components/community-admin-kit";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";
import { errorMessage, mutate, query } from "~/lib/naru";

export function meta() {
  return [
    { title: "상점 관리" },
    { name: "description", content: "상점의 통화와 상품을 관리합니다" },
  ];
}

interface Currency {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
interface Item {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currencyId: string;
  currencyName: string;
  consumable: boolean;
  isUnique: boolean;
}
interface Transaction {
  id: string;
  profileId: string;
  profileName: string | null;
  profileUsername: string | null;
  kind: string;
  source: string;
  currencyId: string | null;
  currencyDelta: number | null;
  itemId: string | null;
  itemQtyDelta: number | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string;
}

/** A call's refusal as an Error with its message (or `fallback`). */
async function orFail<T>(call: Promise<T>, fallback: string): Promise<T> {
  try {
    return await call;
  } catch (error) {
    throw new Error(errorMessage(error, fallback));
  }
}

async function fetchCurrencies(): Promise<Currency[]> {
  return orFail(
    query<Currency[]>("shop:adminCurrencies"),
    "통화 목록을 가져오지 못했습니다",
  );
}
async function fetchItems(): Promise<Item[]> {
  return orFail(
    query<Item[]>("shop:adminItems"),
    "상품 목록을 가져오지 못했습니다",
  );
}
async function fetchTransactions(): Promise<Transaction[]> {
  const result = await orFail(
    query<{ data: Transaction[] }>("shop:adminTransactions", {}),
    "거래 내역을 가져오지 못했습니다",
  );
  return result.data;
}

function CurrencyDialog({
  slug,
  currency,
  onClose,
}: {
  slug: string;
  currency?: Currency;
  onClose: () => void;
}) {
  const [name, setName] = useState(currency?.name ?? "");
  const [description, setDescription] = useState(currency?.description ?? "");
  const [isDefault, setIsDefault] = useState(currency?.isDefault ?? false);
  const queryClient = useQueryClient();
  const nameId = useId();
  const descriptionId = useId();
  const defaultId = useId();

  const mutation = useMutation({
    mutationFn: async () => {
      const json = {
        name,
        description: description || null,
        is_default: isDefault,
      };
      await orFail(
        currency
          ? mutate("shop:adminUpdateCurrency", {
              currency_id: currency.id,
              ...json,
            })
          : mutate("shop:adminCreateCurrency", json),
        "저장에 실패했습니다",
      );
    },
    onSuccess: () => {
      toast.success(
        currency ? "통화가 수정되었습니다" : "통화가 추가되었습니다",
      );
      queryClient.invalidateQueries({ queryKey: ["shop-currencies", slug] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{currency ? "통화 수정" : "새 통화"}</DialogTitle>
        <DialogDescription>
          커뮤에서 사용할 통화를 정의합니다. 예: 골드, 별점, 조개
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor={nameId}>이름</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="골드"
            maxLength={50}
          />
        </div>
        <div>
          <Label htmlFor={descriptionId}>설명 (선택)</Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id={defaultId}
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <Label htmlFor={defaultId}>기본 통화로 설정</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          disabled={!name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ItemDialog({
  slug,
  currencies,
  item,
  onClose,
}: {
  slug: string;
  currencies: Currency[];
  item?: Item;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceAmount, setPriceAmount] = useState(
    item?.priceAmount.toString() ?? "",
  );
  const [currencyId, setCurrencyId] = useState(
    item?.currencyId ?? currencies.find((c) => c.isDefault)?.id ?? "",
  );
  const [consumable, setConsumable] = useState(item?.consumable ?? false);
  const [isUnique, setIsUnique] = useState(item?.isUnique ?? false);
  const queryClient = useQueryClient();
  const nameId = useId();
  const descriptionId = useId();
  const priceId = useId();
  const consumableId = useId();
  const uniqueId = useId();

  const mutation = useMutation({
    mutationFn: async () => {
      const price = Number.parseInt(priceAmount, 10);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("가격은 1 이상의 정수여야 합니다");
      }
      if (!currencyId) {
        throw new Error("통화를 선택하세요");
      }
      const json = {
        name,
        description: description || null,
        price_amount: price,
        currency_id: currencyId,
        consumable,
        is_unique: isUnique,
      };
      await orFail(
        item
          ? mutate("shop:adminUpdateItem", { item_id: item.id, ...json })
          : mutate("shop:adminCreateItem", json),
        "저장에 실패했습니다",
      );
    },
    onSuccess: () => {
      toast.success(item ? "상품이 수정되었습니다" : "상품이 추가되었습니다");
      queryClient.invalidateQueries({ queryKey: ["shop-items", slug] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{item ? "상품 수정" : "새 상품"}</DialogTitle>
        <DialogDescription>
          상점에서 판매할 상품을 등록합니다.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor={nameId}>이름</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="검"
            maxLength={100}
          />
        </div>
        <div>
          <Label htmlFor={descriptionId}>설명 (선택)</Label>
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={priceId}>가격</Label>
            <Input
              id={priceId}
              type="number"
              min={1}
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>통화</Label>
            <Select value={currencyId} onValueChange={setCurrencyId}>
              <SelectTrigger>
                <SelectValue placeholder="통화 선택" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.isDefault ? " (기본)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={consumableId}
            type="checkbox"
            checked={consumable}
            onChange={(e) => setConsumable(e.target.checked)}
          />
          <Label htmlFor={consumableId}>소모품 (사용 시 차감)</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={uniqueId}
            type="checkbox"
            checked={isUnique}
            onChange={(e) => setIsUnique(e.target.checked)}
          />
          <Label htmlFor={uniqueId}>한 명당 하나만 구매 가능</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          disabled={
            !name.trim() || !priceAmount || !currencyId || mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "저장 중..." : "저장"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface ProfileSearchResult {
  id: string;
  name: string;
  username: string;
}

function GrantDialog({
  slug,
  currencies,
  items,
  onClose,
}: {
  slug: string;
  currencies: Currency[];
  items: Item[];
  onClose: () => void;
}) {
  const [action, setAction] = useState<"grant" | "revoke">("grant");
  const [kind, setKind] = useState<"currency" | "item">("currency");
  const [everyone, setEveryone] = useState(false);
  const [profileQuery, setProfileQuery] = useState("");
  const [profileResults, setProfileResults] = useState<ProfileSearchResult[]>(
    [],
  );
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<
    ProfileSearchResult[]
  >([]);
  const [currencyId, setCurrencyId] = useState(
    currencies.find((c) => c.isDefault)?.id ?? currencies[0]?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const profileInputId = useId();
  const amountId = useId();
  const qtyId = useId();
  const reasonId = useId();
  const toEveryone = action === "grant" && everyone;
  const verb = action === "grant" ? "지급" : "회수";

  const mutation = useMutation({
    mutationFn: async () => {
      const what =
        kind === "currency"
          ? {
              kind: "currency" as const,
              currency_id: currencyId,
              amount: Number.parseInt(amount, 10),
            }
          : {
              kind: "item" as const,
              item_id: itemId,
              qty: Number.parseInt(qty, 10) || 1,
            };
      const why = { reason: reason || null };
      if (toEveryone) {
        const { count } = await orFail(
          mutate<{ count: number }>("shop:adminGrantMany", {
            all: true,
            ...what,
            ...why,
          }),
          "지급에 실패했습니다",
        );
        return count;
      }
      if (selectedProfiles.length === 0)
        throw new Error("받을 프로필을 골라 주세요");
      if (action === "grant") {
        const { count } = await orFail(
          mutate<{ count: number }>("shop:adminGrantMany", {
            profile_ids: selectedProfiles.map((p) => p.id),
            ...what,
            ...why,
          }),
          "지급에 실패했습니다",
        );
        return count;
      }
      // Taking back goes one profile at a time, each refused on its own
      // when the profile holds too little.
      let done = 0;
      for (const profile of selectedProfiles) {
        await orFail(
          mutate("shop:adminRevoke", { profile_id: profile.id, ...what, ...why }),
          `@${profile.username}에게서 회수하지 못했습니다`,
        );
        done++;
      }
      return done;
    },
    onSuccess: (count) => {
      toast.success(
        action === "grant"
          ? `${count}명에게 지급했습니다`
          : `${count}명에게서 회수했습니다`,
      );
      queryClient.invalidateQueries({ queryKey: ["shop-transactions", slug] });
      onClose();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey: ["shop-transactions", slug] });
    },
  });

  const addProfile = (p: ProfileSearchResult) => {
    setSelectedProfiles((prev) =>
      prev.some((x) => x.id === p.id) ? prev : [...prev, p],
    );
    setProfileQuery("");
    setShowProfileDropdown(false);
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>지급 · 회수</DialogTitle>
        <DialogDescription>
          통화나 상품을 여러 명에게 한 번에 지급하거나, 잘못 준 것을 회수합니다.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={action === "grant" ? "default" : "outline"}
            size="sm"
            onClick={() => setAction("grant")}
          >
            지급
          </Button>
          <Button
            type="button"
            variant={action === "revoke" ? "default" : "outline"}
            size="sm"
            onClick={() => setAction("revoke")}
          >
            회수
          </Button>
          <span className="w-px bg-border mx-1" aria-hidden="true" />
          <Button
            type="button"
            variant={kind === "currency" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("currency")}
          >
            통화
          </Button>
          <Button
            type="button"
            variant={kind === "item" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("item")}
          >
            상품
          </Button>
        </div>
        {action === "grant" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={everyone}
              onChange={(e) => setEveryone(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            멤버 전원에게 지급 (봇 제외)
          </label>
        )}
        {!toEveryone && (
          <div className="relative">
            <Label htmlFor={profileInputId}>
              {action === "grant" ? "받는 프로필" : "회수할 프로필"} (여러 명
              선택 가능)
            </Label>
            {selectedProfiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedProfiles.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 pl-2 pr-1 h-7 rounded-md border border-primary/50 bg-primary/10 text-sm"
                  >
                    {p.name}
                    <span className="text-muted-foreground">@{p.username}</span>
                    <button
                      type="button"
                      aria-label={`${p.name} 빼기`}
                      className="p-0.5 rounded hover:bg-accent"
                      onClick={() =>
                        setSelectedProfiles((prev) =>
                          prev.filter((x) => x.id !== p.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              id={profileInputId}
              className="mt-1.5"
              value={profileQuery}
              onChange={async (e) => {
                const q = e.target.value;
                setProfileQuery(q);
                setShowProfileDropdown(true);
                try {
                  setProfileResults(
                    await query<ProfileSearchResult[]>("shop:adminProfiles", {
                      q,
                    }),
                  );
                } catch {
                  /* ignore */
                }
              }}
              onFocus={() => setShowProfileDropdown(true)}
              placeholder="이름 또는 사용자명으로 검색해서 추가"
            />
            {showProfileDropdown && profileResults.length > 0 && (
              <div className="absolute left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-md border bg-card shadow-md">
                {profileResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => addProfile(p)}
                  >
                    <span className="font-medium">{p.name}</span>{" "}
                    <span className="text-muted-foreground">@{p.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {kind === "currency" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>통화</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger>
                  <SelectValue placeholder="통화 선택" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={amountId}>금액</Label>
              <Input
                id={amountId}
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>상품</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="상품 선택" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={qtyId}>수량</Label>
              <Input
                id={qtyId}
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
        )}
        <div>
          <Label htmlFor={reasonId}>사유 (선택)</Label>
          <Input
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder={action === "grant" ? "출석 보상" : "룰렛 결과"}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          disabled={
            (!toEveryone && selectedProfiles.length === 0) ||
            (kind === "currency" ? !amount : !itemId || !qty) ||
            mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending
            ? `${verb} 중...`
            : toEveryone
              ? "전원에게 지급"
              : `${selectedProfiles.length || ""}명 ${verb}`.trim()}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CurrencyCard({
  slug,
  currency,
}: {
  slug: string;
  currency: Currency;
}) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await orFail(
        mutate("shop:adminDeleteCurrency", { currency_id: currency.id }),
        "삭제에 실패했습니다",
      );
    },
    onSuccess: () => {
      toast.success("통화가 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["shop-currencies", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{currency.name}</span>
            {currency.isDefault && (
              <Badge variant="secondary">
                <Star className="h-3 w-3 mr-1" />
                기본
              </Badge>
            )}
          </div>
          {currency.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {currency.description}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <Dialog open={editing} onOpenChange={setEditing}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            {editing && (
              <CurrencyDialog
                slug={slug}
                currency={currency}
                onClose={() => setEditing(false)}
              />
            )}
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (
                window.confirm(`"${currency.name}" 통화를 삭제하시겠습니까?`)
              ) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ItemCard({
  slug,
  item,
  currencies,
}: {
  slug: string;
  item: Item;
  currencies: Currency[];
}) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await orFail(
        mutate("shop:adminDeleteItem", { item_id: item.id }),
        "삭제에 실패했습니다",
      );
    },
    onSuccess: () => {
      toast.success("상품이 삭제되었습니다");
      queryClient.invalidateQueries({ queryKey: ["shop-items", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{item.name}</span>
              <Badge variant="secondary">
                {item.priceAmount} {item.currencyName}
              </Badge>
              {item.consumable && <Badge variant="outline">소모품</Badge>}
              {item.isUnique && <Badge variant="outline">유니크</Badge>}
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.description}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Dialog open={editing} onOpenChange={setEditing}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              {editing && (
                <ItemDialog
                  slug={slug}
                  currencies={currencies}
                  item={item}
                  onClose={() => setEditing(false)}
                />
              )}
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`"${item.name}" 상품을 삭제하시겠습니까?`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionRow({ txn }: { txn: Transaction }) {
  const kindLabel: Record<string, string> = {
    currency_grant: "통화 지급",
    currency_charge: "통화 차감",
    currency_refund: "통화 환불",
    item_grant: "상품 지급",
    item_purchase: "상품 구매",
    item_consume: "상품 소비",
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm border-b last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {txn.source === "owner_grant" && txn.kind === "currency_charge"
              ? "통화 회수"
              : txn.source === "owner_grant" && txn.kind === "item_consume"
                ? "상품 회수"
                : (kindLabel[txn.kind] ?? txn.kind)}
          </span>
          <Badge variant="outline" className="font-mono text-xs">
            {txn.source}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {txn.profileName ? (
            <>
              <span className="font-medium">{txn.profileName}</span>{" "}
              <span className="font-mono">@{txn.profileUsername}</span>
            </>
          ) : (
            <span className="font-mono">
              profile {txn.profileId.slice(0, 8)}…
            </span>
          )}
          {txn.currencyDelta !== null && ` · ${txn.currencyDelta}`}
          {txn.itemQtyDelta !== null && ` · ${txn.itemQtyDelta}개`}
        </div>
        {txn.reason && (
          <div className="text-xs text-muted-foreground italic">
            {txn.reason}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(txn.createdAt).toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

export default function AdminShop() {
  return (
    <AdminGate
      allow="staff"
      icon={Coins}
      title="상점 관리"
      denied="상점 관리 권한이 없습니다. 커뮤 소유자와 모더레이터만 상점을 볼 수 있습니다."
    >
      <ShopPage />
    </AdminGate>
  );
}

function ShopPage() {
  const { instanceSlug: slug } = useCurrentInstance();
  const slugStr = slug;

  const [creatingCurrency, setCreatingCurrency] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [granting, setGranting] = useState(false);

  const { data: currencies = [], isLoading: currenciesLoading } = useQuery({
    queryKey: ["shop-currencies", slug],
    queryFn: fetchCurrencies,
  });
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["shop-items", slug],
    queryFn: fetchItems,
  });
  const { data: transactions = [], isLoading: txnsLoading } = useQuery({
    queryKey: ["shop-transactions", slug],
    queryFn: fetchTransactions,
  });

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <BackToAdmin />
          <Dialog open={granting} onOpenChange={setGranting}>
            <DialogTrigger asChild>
              <Button disabled={currencies.length === 0 && items.length === 0}>
                <Gift className="w-4 h-4 mr-2" />
                지급 · 회수
              </Button>
            </DialogTrigger>
            {granting && (
              <GrantDialog
                slug={slugStr}
                currencies={currencies}
                items={items}
                onClose={() => setGranting(false)}
              />
            )}
          </Dialog>
        </div>

        <PageHeader
          eyebrow="운영"
          icon={Coins}
          title="상점"
          description="통화와 상품을 정의하고 멤버에게 지급하세요"
          tone="butter"
        />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">통화</h2>
            <Dialog open={creatingCurrency} onOpenChange={setCreatingCurrency}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />새 통화
                </Button>
              </DialogTrigger>
              {creatingCurrency && (
                <CurrencyDialog
                  slug={slugStr}
                  onClose={() => setCreatingCurrency(false)}
                />
              )}
            </Dialog>
          </div>
          {currenciesLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : currencies.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                정의된 통화가 없습니다. 통화를 추가해 상점을 시작하세요.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {currencies.map((c) => (
                <CurrencyCard key={c.id} slug={slugStr} currency={c} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">상품</h2>
            <Dialog open={creatingItem} onOpenChange={setCreatingItem}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currencies.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" />새 상품
                </Button>
              </DialogTrigger>
              {creatingItem && (
                <ItemDialog
                  slug={slugStr}
                  currencies={currencies}
                  onClose={() => setCreatingItem(false)}
                />
              )}
            </Dialog>
          </div>
          {itemsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {currencies.length === 0
                  ? "통화를 먼저 추가하세요."
                  : "상품이 없습니다. 상품을 추가하면 멤버가 구매할 수 있습니다."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {items.map((i) => (
                <ItemCard
                  key={i.id}
                  slug={slugStr}
                  item={i}
                  currencies={currencies}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">거래 내역</h2>
          <Card>
            <CardContent className="p-4">
              {txnsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  거래 내역이 없습니다.
                </p>
              ) : (
                <div>
                  {transactions.map((t) => (
                    <TransactionRow key={t.id} txn={t} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
