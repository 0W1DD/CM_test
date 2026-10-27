import { useQuery } from "@tanstack/react-query";
import { query } from "~/lib/naru";
import { useAuth } from "./useAuth";

export interface ShopCurrency {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  currencyId: string;
  currencyName: string;
  consumable: boolean;
  isUnique: boolean;
}

export interface ShopBalance {
  currencyId: string;
  currencyName: string;
  isDefault: boolean;
  amount: number;
}

export interface ShopInventoryEntry {
  itemId: string;
  itemName: string;
  qty: number;
  consumable: boolean;
}

export interface ShopSummary {
  default_currency: ShopCurrency | null;
  currencies: ShopCurrency[];
  items: ShopItem[];
  balances: ShopBalance[];
  inventory: ShopInventoryEntry[];
  has_currency: boolean;
  has_items: boolean;
}

export function useShopSummary() {
  const { currentProfile } = useAuth();
  const profileId = currentProfile?.id;

  return useQuery<ShopSummary | null>({
    queryKey: ["shop-summary", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      return await query<ShopSummary>("shop:summary", {
        profile_id: profileId,
      }).catch(() => null);
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });
}
