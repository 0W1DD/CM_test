import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { query } from "~/lib/naru";
import { getReadOnlyMarkdownInstance } from "~/lib/markdown-utils";

interface InventoryEntry {
  itemId: string;
  itemName: string;
  itemDescription: string | null;
  qty: number;
  consumable: boolean;
  isUnique: boolean;
}

const md = getReadOnlyMarkdownInstance();

export function ProfileInventory({ username }: { username: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["profile-inventory", username],
    queryFn: async () => {
      return await query<{ profile_id: string; items: InventoryEntry[] }>(
        "shop:inventory",
        { username },
      ).catch(() => null);
    },
    staleTime: 30_000,
  });

  if (isLoading || !data || data.items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground">보유 상품</h3>
      <div className="bg-card rounded-2xl shadow-sm border border-border p-4 space-y-3">
        {data.items.map((entry) => (
          <div
            key={entry.itemId}
            className="flex items-start gap-3 py-2 border-b last:border-b-0"
          >
            <Package className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{entry.itemName}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  ×{entry.qty}
                </span>
                {entry.consumable && (
                  <Badge variant="outline" className="text-xs">
                    소모품
                  </Badge>
                )}
                {entry.isUnique && (
                  <Badge variant="outline" className="text-xs">
                    유니크
                  </Badge>
                )}
              </div>
              {entry.itemDescription && (
                <div
                  className="prose prose-sm dark:prose-invert mt-1 text-sm text-muted-foreground max-w-none"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized html
                  dangerouslySetInnerHTML={{
                    __html: md.render(entry.itemDescription),
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
