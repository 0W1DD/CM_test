// Images: uploads to Naru Media the uploader registered with their size.
import { type Ctx, invalid, iso, list, type SqlValue } from "./core.js";

export interface ImageRow {
  id: string;
  url: string;
  width: number;
  height: number;
  filename: string;
  member: string | null;
  created_at: number;
}

/** An image as commung's API answered it. */
export const imageJson = (row: ImageRow) => ({
  id: row.id,
  url: row.url,
  width: row.width,
  height: row.height,
  filename: row.filename,
  created_at: iso(row.created_at),
});

/**
 * The images `imageIds` names, all the caller's own uploads and not deleted,
 * in the given order; refuses any other.
 */
export async function ownImages(
  ctx: Ctx,
  imageIds: readonly string[],
): Promise<ImageRow[]> {
  if (!imageIds.length) return [];
  const { rows } = await ctx.sql<ImageRow>`
    SELECT * FROM images
    WHERE id IN (SELECT value FROM json_each(${list(imageIds)}))
      AND deleted_at IS NULL AND member = ${ctx.member?.id ?? null}`;
  const byId = new Map(rows.map((row) => [row.id, row]));
  return imageIds.map((imageId) => {
    const row = byId.get(imageId);
    if (!row) invalid(ctx, "잘못된 이미지입니다.", "invalid_image");
    return row;
  });
}

/** Images by ID, for answers. */
export async function imagesById(
  ctx: Ctx,
  imageIds: readonly SqlValue[],
): Promise<Map<string, ImageRow>> {
  const wanted = [...new Set(imageIds.filter((v) => typeof v === "string"))];
  if (!wanted.length) return new Map();
  const { rows } = await ctx.sql<ImageRow>`
    SELECT * FROM images WHERE id IN (SELECT value FROM json_each(${list(wanted)}))`;
  return new Map(rows.map((row) => [row.id, row]));
}
