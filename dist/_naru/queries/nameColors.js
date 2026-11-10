export async function all(ctx) {
    const { rows } = await ctx.sql `
    SELECT profile_id, color, until FROM name_colors WHERE until > ${ctx.now}`;
    const out = {};
    for (const r of rows)
        out[r.profile_id] = {
            color: r.color,
            until: new Date(r.until).toISOString(),
        };
    return out;
}
