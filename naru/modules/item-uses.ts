// The use log (item_uses): how a use reads to the one looking. A secret use
// keeps its item and note from everyone but its owner and the staff.
import { type Ctx, iso, type SqlValue } from "./core.js";
import { authorsById } from "./post-data.js";

export interface ItemUseRow {
  id: string;
  profile_id: string;
  item_id: string;
  item_name: string;
  note: string | null;
  secret: number;
  consumed: number;
  approved_at: number | null;
  approved_by: string | null;
  created_at: number;
  [key: string]: SqlValue;
}

/** Who may see a secret use in full: the staff, and the member who owns its profile. */
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

export async function useJson(
  ctx: Ctx,
  rows: readonly ItemUseRow[],
  viewer: Viewer,
) {
  const profiles = await authorsById(
    ctx,
    rows.map((row) => row.profile_id),
  );
  return rows.map((row) => {
    const hidden =
      row.secret === 1 &&
      !viewer.staff &&
      !viewer.ownProfiles.has(row.profile_id);
    return {
      id: row.id,
      profile: profiles.get(row.profile_id) ?? null,
      item_name: hidden ? null : row.item_name,
      note: hidden ? null : row.note,
      secret: row.secret === 1,
      hidden,
      consumed: row.consumed === 1,
      status: row.approved_at === null ? "pending" : "approved",
      approved_at: iso(row.approved_at),
      created_at: iso(row.created_at),
    };
  });
}
