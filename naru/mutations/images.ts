// Registering an upload as an image: the page uploads to Naru Media
// (member.media.upload), measures it, and names it here before using it.
import { memberId } from "../modules/access.js";
import { argsOf, invalid, text } from "../modules/core.js";
import type { MutationCtx } from "../modules/core.js";
import { type ImageRow, imageJson } from "../modules/images.js";

export async function register(ctx: MutationCtx, args: unknown) {
  const member = memberId(ctx);
  const a = argsOf(args);
  const uploadId = text(ctx, a.upload_id, "upload_id", { max: 200 });
  const width = Number(a.width);
  const height = Number(a.height);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 100000 ||
    height > 100000
  )
    invalid(ctx, "이미지 크기가 올바르지 않습니다.");
  const { rows: uploads } = await ctx.sql<{
    id: string;
    url: string;
    name: string;
    type: string;
    member: string | null;
  }>`SELECT id, url, name, type, member FROM _naru_uploads WHERE id = ${uploadId}`;
  const upload = uploads[0];
  if (!upload || upload.member !== member)
    invalid(ctx, "업로드를 찾을 수 없습니다.", "invalid_upload");
  if (!upload.type.startsWith("image/"))
    invalid(ctx, "이미지 파일만 올릴 수 있습니다.", "not_image");
  const { rows } = await ctx.sql<ImageRow>`
    INSERT INTO images (id, url, width, height, filename, member, created_at)
    VALUES (${upload.id}, ${upload.url}, ${width}, ${height}, ${upload.name}, ${member}, ${ctx.now})
    ON CONFLICT (id) DO UPDATE SET width = excluded.width, height = excluded.height
    RETURNING *`;
  return imageJson(rows[0]);
}
