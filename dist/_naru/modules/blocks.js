/** The members the calling member blocked ([] for visitors). */
export async function blockedMembers(ctx) {
    if (!ctx.member)
        return [];
    const { rows } = await ctx.sql `
    SELECT blocked FROM member_blocks WHERE blocker = ${ctx.member.id}
    LIMIT 1000`;
    return rows.map((row) => row.blocked);
}
/** Whether `blocker` blocked `blocked`. */
export async function isBlocked(ctx, blocker, blocked) {
    const { rows } = await ctx.sql `
    SELECT 1 FROM member_blocks WHERE blocker = ${blocker} AND blocked = ${blocked}`;
    return rows.length > 0;
}
