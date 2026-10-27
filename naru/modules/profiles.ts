// Profiles as commung's API answered them.
import { bool, type Ctx, iso, list, type SqlValue } from "./core.js";

/** The columns `profileJson` reads; select with `p` as the profile's alias. */
export const PROFILE_COLUMNS = `p.id, p.name, p.username, p.bio, p.is_primary,
  p.activated_at, p.created_at, p.updated_at, p.muted_at,
  p.online_status_visible, pic.url AS profile_picture_url`;
/** Joins the picture's image for `PROFILE_COLUMNS`. */
export const PROFILE_PICTURE_JOIN = "LEFT JOIN images pic ON pic.id = p.picture_id";

export interface ProfileJsonRow {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  is_primary: number;
  activated_at: number | null;
  created_at: number;
  updated_at: number;
  muted_at: number | null;
  online_status_visible: number;
  profile_picture_url: string | null;
  [key: string]: SqlValue;
}

export const profileJson = (row: ProfileJsonRow) => ({
  id: row.id,
  name: row.name,
  username: row.username,
  bio: row.bio,
  profile_picture_url: row.profile_picture_url,
  created_at: iso(row.created_at),
  updated_at: iso(row.updated_at),
  activated_at: iso(row.activated_at),
  is_active: row.activated_at !== null,
  is_primary: bool(row.is_primary),
  muted_at: iso(row.muted_at),
});

/** Profiles by ID (deleted ones too, for old posts), as `profileJson`. */
export async function profilesById(ctx: Ctx, ids: readonly SqlValue[]) {
  const wanted = [...new Set(ids.filter((v) => typeof v === "string"))];
  if (!wanted.length) return new Map<string, ReturnType<typeof profileJson>>();
  const { rows } = await ctx.sql<ProfileJsonRow>(
    `SELECT ${PROFILE_COLUMNS} FROM profiles p ${PROFILE_PICTURE_JOIN}
     WHERE p.id IN (SELECT value FROM json_each(?))`,
    [list(wanted)],
  );
  return new Map(rows.map((row) => [row.id, profileJson(row)]));
}
