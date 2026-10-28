// The use log (item_uses): how a use or a transfer reads to the one looking,
// with the comments under it. A secret entry keeps its item, note, receiver
// and comments from everyone but the profiles in it and the staff.
import { type Ctx, iso, list, type SqlValue } from "./core.js";
import { authorsById } from "./post-data.js";

export interface ItemUseRow {
  id: string;
  profile_id: string;
  item_id: string;
  item_name: string;
  note: string | null;
  secret: number;
  consumed: number;
  kind: string;
  target_profile_id: string | null;
  qty: number;
  approved_at: number | null;
  approved_by: string | null;
  created_at: number;
  [key: string]: SqlValue;
}

/** Who may see a secret entry in full: the staff, and the members whose profiles are in it. */
export interface Viewer {
  staff: boolean;
  ownProfiles: Set<string>;
}

export async function viewerOf(
  ctx: Ctx,
  member: string,
  staff: boolean,
): Promise<Viewer> {
  const { rows } = await ctx.sql<{ profile_id: string }>`
    SELECT profile_id FROM profile_owners WHERE member = ${member}`;
  return { staff, ownProfiles: new Set(rows.map((row) => row.profile_id)) };
}

/** Whether `viewer` sees `row` only as a secret. */
export function hiddenFrom(row: ItemUseRow, viewer: Viewer) {
  return (
    row.secret === 1 &&
    !viewer.staff &&
    !viewer.ownProfiles.has(row.profile_id) &&
    !(row.target_profile_id && viewer.ownProfiles.has(row.target_profile_id))
  );
}

export async function useJson(
  ctx: Ctx,
  rows: readonly ItemUseRow[],
  viewer: Viewer,
) {
  const visibleIds = rows
    .filter((row) => !hiddenFrom(row, viewer))
    .map((row) => row.id);
  const { rows: comments } = visibleIds.length
    ? await ctx.sql<{
        id: string;
        use_id: string;
        profile_id: string;
        content: string;
        created_at: number;
      }>`SELECT * FROM item_use_comments
         WHERE use_id IN (SELECT value FROM json_each(${list(visibleIds)}))
         ORDER BY id`
    : { rows: [] };
  const profiles = await authorsById(ctx, [
    ...rows.map((row) => row.profile_id),
    ...rows.flatMap((row) => row.target_profile_id ?? []),
    ...comments.map((comment) => comment.profile_id),
  ]);
  return rows.map((row) => {
    const hidden = hiddenFrom(row, viewer);
    return {
      id: row.id,
      kind: row.kind === "transfer" ? "transfer" : "use",
      profile: profiles.get(row.profile_id) ?? null,
      target:
        hidden || !row.target_profile_id
          ? null
          : (profiles.get(row.target_profile_id) ?? null),
      item_name: hidden ? null : row.item_name,
      qty: row.qty,
      note: hidden ? null : row.note,
      secret: row.secret === 1,
      hidden,
      consumed: row.consumed === 1,
      status: row.approved_at === null ? "pending" : "approved",
      approved_at: iso(row.approved_at),
      created_at: iso(row.created_at),
      comments: hidden
        ? []
        : comments
            .filter((comment) => comment.use_id === row.id)
            .map((comment) => ({
              id: comment.id,
              profile: profiles.get(comment.profile_id) ?? null,
              content: comment.content,
              created_at: iso(comment.created_at),
            })),
    };
  });
}
