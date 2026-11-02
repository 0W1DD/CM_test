// The use log: a member uses an item from their inventory, kept off the
// timeline, and the staff confirm it. Each call is one transaction: a
// refused use takes nothing from the inventory.
import { actingProfile, isStaff, requireStaff, requireUnmuted, } from "../modules/access.js";
import { argsOf, id, ids, invalid, list, notFound, optionalText, text, uuidv7, } from "../modules/core.js";
import { hiddenFrom, useJson, usesPurgeWhere, viewerOf, } from "../modules/item-uses.js";
import { notifyProfiles, usesPath } from "../modules/posts.js";
import { consumeItem, failShop, listInventory, ShopError, transferItem, validateItemExists, } from "../modules/shop.js";
const entryName = (row) => row.qty > 1 ? `${row.item_name} ${row.qty}개` : row.item_name;
/**
 * Tells the staff a new entry waits for them: each owner's and moderator's
 * main profile, but the member who wrote it.
 */
async function notifyStaff(ctx, entry, sender) {
    const { rows } = await ctx.sql `
    SELECT p.id FROM members m
    JOIN profile_owners o ON o.member = m.member AND o.role = 'owner'
    JOIN profiles p ON p.id = o.profile_id
    WHERE m.role IN ('owner', 'moderator') AND m.member != ${sender.member}
      AND p.is_primary = 1 AND p.activated_at IS NOT NULL AND p.deleted_at IS NULL`;
    const what = entry.kind === "transfer" ? "양도" : "사용";
    await notifyProfiles(ctx, {
        type: "use_request",
        title: `${what} 승인 요청`,
        message: `${sender.name}님이 ${entryName(entry)} ${what} 승인을 요청했습니다`,
        sender: sender.id,
        postId: null,
        useId: entry.id,
        recipients: rows.map((row) => row.id),
        path: usesPath,
        actorMember: sender.member,
    });
}
/**
 * Uses an item the acting profile holds: a consumable is spent, anything
 * else only shown. `note` says how it was used; `secret` hides the item and
 * the note from everyone but the profile's owner and the staff.
 */
export async function use(ctx, args) {
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
        else if (!(await listInventory(ctx, profile.id)).some((row) => row.itemId === itemId && row.qty > 0))
            throw new ShopError("INVALID_REQUEST", `보유하고 있지 않습니다: ${found.name}`, "not_owned");
        return found;
    });
    const { rows } = await ctx.sql `
    INSERT INTO item_uses (id, profile_id, item_id, item_name, note, secret, consumed, created_at)
    VALUES (${uuidv7(ctx.now)}, ${profile.id}, ${itemId}, ${item.name}, ${note},
      ${secret ? 1 : 0}, ${item.consumable ? 1 : 0}, ${ctx.now})
    RETURNING *`;
    if (rows[0])
        await notifyStaff(ctx, rows[0], {
            id: profile.id,
            name: profile.name,
            member: profile.membership.member,
        });
    const viewer = await viewerOf(ctx, profile.membership.member, false);
    return (await useJson(ctx, rows, viewer))[0];
}
/**
 * Confirms a use (the owner or a moderator); confirming twice keeps the
 * first. The one who wrote it is told, from `profile_id` when given (the
 * staff member's profile), or else from their main profile.
 */
export async function approve(ctx, args) {
    const membership = await requireStaff(ctx);
    const a = argsOf(args);
    const useId = id(ctx, a.use_id, "use_id");
    const { changes } = await ctx.sql `
    UPDATE item_uses SET approved_at = ${ctx.now}, approved_by = ${membership.member}
    WHERE id = ${useId} AND approved_at IS NULL`;
    const { rows } = await ctx.sql `
    SELECT * FROM item_uses WHERE id = ${useId}`;
    const entry = rows[0];
    if (!entry)
        notFound(ctx, "사용 기록을 찾을 수 없습니다.");
    if (changes) {
        let senderId = null;
        if (a.profile_id !== undefined && a.profile_id !== null)
            senderId = (await actingProfile(ctx, a.profile_id)).id;
        else {
            const { rows: own } = await ctx.sql `
        SELECT p.id FROM profile_owners o JOIN profiles p ON p.id = o.profile_id
        WHERE o.member = ${membership.member} AND o.role = 'owner'
          AND p.deleted_at IS NULL
        ORDER BY p.is_primary DESC, p.created_at LIMIT 1`;
            senderId = own[0]?.id ?? null;
        }
        const what = entry.kind === "transfer" ? "양도" : "사용";
        await notifyProfiles(ctx, {
            type: "use_approved",
            title: `${what} 승인`,
            message: `${entryName(entry)} ${what}${entry.kind === "transfer" ? "가" : "이"} 승인되었습니다`,
            sender: senderId ?? entry.profile_id,
            postId: null,
            useId: entry.id,
            recipients: [entry.profile_id],
            path: usesPath,
            actorMember: membership.member,
        });
    }
    const viewer = await viewerOf(ctx, membership.member, true);
    return (await useJson(ctx, rows, viewer))[0];
}
/**
 * Hands an item the acting profile holds to another profile (by
 * `to_username`), `qty` of it (1 when absent), and writes it to the use log
 * as a transfer for the staff to confirm. `note` and `secret` as for a use;
 * a secret transfer shows in full to both sides and the staff.
 */
export async function transfer(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    if (profile.activated_at === null)
        notFound(ctx, "프로필을 찾을 수 없습니다.");
    const itemId = id(ctx, a.item_id, "item_id");
    const username = typeof a.to_username === "string" ? a.to_username.replace(/^@/, "") : "";
    const qty = a.qty === undefined ? 1 : Number(a.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000)
        invalid(ctx, "수량은 1 이상 1000 이하의 정수여야 합니다.");
    const note = optionalText(ctx, a.note, "양도 내용", { max: 500 });
    const secret = a.secret === true;
    const { rows: targets } = await ctx.sql `
    SELECT id, username FROM profiles
    WHERE lower(username) = lower(${username})
      AND activated_at IS NOT NULL AND deleted_at IS NULL`;
    const target = targets[0];
    if (!target)
        notFound(ctx, "받는 사람을 찾을 수 없습니다.");
    if (target.id === profile.id)
        invalid(ctx, "자기 자신에게는 양도할 수 없습니다.", "self_transfer");
    const item = await failShop(ctx, () => transferItem(ctx, {
        fromId: profile.id,
        toId: target.id,
        fromName: profile.username,
        toName: target.username,
        itemId,
        qty,
        actor: profile.membership.member,
    }));
    const { rows } = await ctx.sql `
    INSERT INTO item_uses (id, profile_id, item_id, item_name, note, secret, consumed,
      kind, target_profile_id, qty, created_at)
    VALUES (${uuidv7(ctx.now)}, ${profile.id}, ${itemId}, ${item.name}, ${note},
      ${secret ? 1 : 0}, 0, 'transfer', ${target.id}, ${qty}, ${ctx.now})
    RETURNING *`;
    const entry = rows[0];
    if (entry) {
        await notifyProfiles(ctx, {
            type: "gift",
            title: "선물이 도착했습니다",
            message: `${profile.name}님이 보낸 ${entry.item_name} ${entry.qty}개가 도착했습니다`,
            sender: profile.id,
            postId: null,
            useId: entry.id,
            recipients: [target.id],
            path: usesPath,
            actorMember: profile.membership.member,
        });
        await notifyStaff(ctx, entry, {
            id: profile.id,
            name: profile.name,
            member: profile.membership.member,
        });
    }
    const viewer = await viewerOf(ctx, profile.membership.member, false);
    return (await useJson(ctx, rows, viewer))[0];
}
/**
 * Comments under a use or a transfer as the acting profile (a staff member
 * may pick a bot profile they hold). A secret entry takes comments only
 * from those who see it in full.
 */
export async function comment(ctx, args) {
    const a = argsOf(args);
    const profile = await actingProfile(ctx, a.profile_id);
    requireUnmuted(ctx, profile);
    const useId = id(ctx, a.use_id, "use_id");
    const content = text(ctx, a.content, "댓글", { max: 1000 });
    const { rows } = await ctx.sql `
    SELECT * FROM item_uses WHERE id = ${useId}`;
    const entry = rows[0];
    const viewer = await viewerOf(ctx, profile.membership.member, isStaff(profile.membership));
    if (!entry || hiddenFrom(entry, viewer))
        notFound(ctx, "사용 기록을 찾을 수 없습니다.");
    await ctx.sql `
    INSERT INTO item_use_comments (id, use_id, profile_id, content, created_at)
    VALUES (${uuidv7(ctx.now)}, ${useId}, ${profile.id}, ${content}, ${ctx.now})`;
    return (await useJson(ctx, [entry], viewer))[0];
}
/** Deletes the entries `where` picks, with their comments and notifications. */
async function deleteEntries(ctx, where, values) {
    const picked = `SELECT id FROM item_uses WHERE ${where}`;
    await ctx.sql(`DELETE FROM item_use_comments WHERE use_id IN (${picked})`, values);
    await ctx.sql(`DELETE FROM notifications WHERE use_id IN (${picked})`, values);
    const { changes } = await ctx.sql(`DELETE FROM item_uses WHERE ${where}`, values);
    return changes;
}
/**
 * Deletes use log entries by ID (`use_ids`; the owner or a moderator), with
 * their comments. What was used or handed over stays as it is.
 */
export async function remove(ctx, args) {
    await requireStaff(ctx);
    const useIds = ids(ctx, argsOf(args).use_ids, "use_ids");
    if (!useIds.length)
        invalid(ctx, "지울 기록을 골라 주세요.");
    const deleted = await deleteEntries(ctx, "id IN (SELECT value FROM json_each(?))", [list(useIds)]);
    return { deleted };
}
/**
 * Clears the use log (the owner or a moderator), as usesPurgeWhere picks.
 * Answers how many went.
 */
export async function purge(ctx, args) {
    await requireStaff(ctx);
    const { where, values } = usesPurgeWhere(ctx, argsOf(args));
    return { deleted: await deleteEntries(ctx, where, values) };
}
