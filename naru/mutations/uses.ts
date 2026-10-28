// The use log: a member uses an item from their inventory, kept off the
// timeline, and the staff confirm it. Each call is one transaction: a
// refused use takes nothing from the inventory.
import {
  actingProfile,
  isStaff,
  requireStaff,
  requireUnmuted,
} from "../modules/access.js";
import {
  argsOf,
  id,
  invalid,
  type MutationCtx,
  notFound,
  optionalText,
  text,
  uuidv7,
} from "../modules/core.js";
import {
  hiddenFrom,
  type ItemUseRow,
  useJson,
  viewerOf,
} from "../modules/item-uses.js";
import {
  consumeItem,
  failShop,
  listInventory,
  ShopError,
  transferItem,
  validateItemExists,
} from "../modules/shop.js";

/**
 * Uses an item the acting profile holds: a consumable is spent, anything
 * else only shown. `note` says how it was used; `secret` hides the item and
 * the note from everyone but the profile's owner and the staff.
 */
export async function use(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  if (profile.activated_at === null)
    notFound(ctx, "프로필을 찾을 수 없습니다.");
  const itemId = id(ctx, a.item_id, "item_id");
  const note = optionalText(ctx, a.note, "사용 내용", { max: 500 });
  const secret = a.secret === true;
  const item = await failShop(ctx, async () => {
    const found = await validateItemExists(ctx, itemId);
    if (found.consumable)
      await consumeItem(ctx, {
        profileId: profile.id,
        itemId,
        actor: profile.membership.member,
        reason: "사용 로그",
      });
    else if (
      !(await listInventory(ctx, profile.id)).some(
        (row) => row.itemId === itemId && row.qty > 0,
      )
    )
      throw new ShopError(
        "INVALID_REQUEST",
        `보유하고 있지 않습니다: ${found.name}`,
        "not_owned",
      );
    return found;
  });
  const { rows } = await ctx.sql<ItemUseRow>`
    INSERT INTO item_uses (id, profile_id, item_id, item_name, note, secret, consumed, created_at)
    VALUES (${uuidv7(ctx.now)}, ${profile.id}, ${itemId}, ${item.name}, ${note},
      ${secret ? 1 : 0}, ${item.consumable ? 1 : 0}, ${ctx.now})
    RETURNING *`;
  const viewer = await viewerOf(ctx, profile.membership.member, false);
  return (await useJson(ctx, rows, viewer))[0];
}

/** Confirms a use (the owner or a moderator); confirming twice keeps the first. */
export async function approve(ctx: MutationCtx, args: unknown) {
  const membership = await requireStaff(ctx);
  const useId = id(ctx, argsOf(args).use_id, "use_id");
  await ctx.sql`
    UPDATE item_uses SET approved_at = ${ctx.now}, approved_by = ${membership.member}
    WHERE id = ${useId} AND approved_at IS NULL`;
  const { rows } = await ctx.sql<ItemUseRow>`
    SELECT * FROM item_uses WHERE id = ${useId}`;
  if (!rows[0]) notFound(ctx, "사용 기록을 찾을 수 없습니다.");
  const viewer = await viewerOf(ctx, membership.member, true);
  return (await useJson(ctx, rows, viewer))[0];
}

/**
 * Hands an item the acting profile holds to another profile (by
 * `to_username`), `qty` of it (1 when absent), and writes it to the use log
 * as a transfer for the staff to confirm. `note` and `secret` as for a use;
 * a secret transfer shows in full to both sides and the staff.
 */
export async function transfer(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  if (profile.activated_at === null)
    notFound(ctx, "프로필을 찾을 수 없습니다.");
  const itemId = id(ctx, a.item_id, "item_id");
  const username =
    typeof a.to_username === "string" ? a.to_username.replace(/^@/, "") : "";
  const qty = a.qty === undefined ? 1 : Number(a.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 1000)
    invalid(ctx, "수량은 1 이상 1000 이하의 정수여야 합니다.");
  const note = optionalText(ctx, a.note, "양도 내용", { max: 500 });
  const secret = a.secret === true;
  const { rows: targets } = await ctx.sql<{ id: string; username: string }>`
    SELECT id, username FROM profiles
    WHERE lower(username) = lower(${username})
      AND activated_at IS NOT NULL AND deleted_at IS NULL`;
  const target = targets[0];
  if (!target) notFound(ctx, "받는 사람을 찾을 수 없습니다.");
  if (target.id === profile.id)
    invalid(ctx, "자기 자신에게는 양도할 수 없습니다.", "self_transfer");
  const item = await failShop(ctx, () =>
    transferItem(ctx, {
      fromId: profile.id,
      toId: target.id,
      fromName: profile.username,
      toName: target.username,
      itemId,
      qty,
      actor: profile.membership.member,
    }),
  );
  const { rows } = await ctx.sql<ItemUseRow>`
    INSERT INTO item_uses (id, profile_id, item_id, item_name, note, secret, consumed,
      kind, target_profile_id, qty, created_at)
    VALUES (${uuidv7(ctx.now)}, ${profile.id}, ${itemId}, ${item.name}, ${note},
      ${secret ? 1 : 0}, 0, 'transfer', ${target.id}, ${qty}, ${ctx.now})
    RETURNING *`;
  const viewer = await viewerOf(ctx, profile.membership.member, false);
  return (await useJson(ctx, rows, viewer))[0];
}

/**
 * Comments under a use or a transfer as the acting profile (a staff member
 * may pick a bot profile they hold). A secret entry takes comments only
 * from those who see it in full.
 */
export async function comment(ctx: MutationCtx, args: unknown) {
  const a = argsOf(args);
  const profile = await actingProfile(ctx, a.profile_id);
  requireUnmuted(ctx, profile);
  const useId = id(ctx, a.use_id, "use_id");
  const content = text(ctx, a.content, "댓글", { max: 1000 });
  const { rows } = await ctx.sql<ItemUseRow>`
    SELECT * FROM item_uses WHERE id = ${useId}`;
  const entry = rows[0];
  const viewer = await viewerOf(
    ctx,
    profile.membership.member,
    isStaff(profile.membership),
  );
  if (!entry || hiddenFrom(entry, viewer))
    notFound(ctx, "사용 기록을 찾을 수 없습니다.");
  await ctx.sql`
    INSERT INTO item_use_comments (id, use_id, profile_id, content, created_at)
    VALUES (${uuidv7(ctx.now)}, ${useId}, ${profile.id}, ${content}, ${ctx.now})`;
  return (await useJson(ctx, [entry], viewer))[0];
}
