import { randomInt } from "./random.js";
const HEX = "0123456789abcdef";
const randomHex = (length) => {
    let out = "";
    for (let i = 0; i < length; i++)
        out += HEX[randomInt(16)];
    return out;
};
/** A UUIDv7 for a new row, from the call's time and random bits. */
export function uuidv7(now) {
    const time = Math.floor(now).toString(16).padStart(12, "0").slice(-12);
    const variant = HEX[8 + randomInt(4)];
    return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}
/** Milliseconds as the ISO string commung's API answered with, or null. */
export const iso = (ms) => typeof ms === "number" ? new Date(ms).toISOString() : null;
/** An ISO string (or milliseconds) from a page, as milliseconds; null if blank. */
export function msOf(ctx, value, field) {
    if (value === null || value === undefined || value === "")
        return null;
    const ms = typeof value === "number" ? value : Date.parse(String(value));
    if (!Number.isFinite(ms))
        invalid(ctx, `${field} 값이 올바르지 않습니다.`);
    return ms;
}
export const bool = (value) => value === 1;
/** Refuses a request whose arguments are wrong. */
export function invalid(ctx, message, reason = "invalid") {
    return ctx.fail("INVALID_REQUEST", message, { reason });
}
export function notFound(ctx, message) {
    return ctx.fail("NOT_FOUND", message, { reason: "not_found" });
}
export function denied(ctx, message, reason = "denied") {
    return ctx.fail("ACCESS_DENIED", message, { reason });
}
/** The arguments object, or {} when a call passed none. */
export const argsOf = (args) => args && typeof args === "object" && !Array.isArray(args)
    ? args
    : {};
/** A required string argument, trimmed unless `raw`. */
export function text(ctx, value, field, { max = 10000, min = 1, raw = false } = {}) {
    if (typeof value !== "string")
        invalid(ctx, `${field}을(를) 입력해 주세요.`);
    const out = raw ? value : value.trim();
    if (out.length < min)
        invalid(ctx, `${field}을(를) 입력해 주세요.`);
    if (out.length > max)
        invalid(ctx, `${field}은(는) ${max}자 이하여야 합니다.`);
    return out;
}
/** An optional string argument: null when absent or blank. */
export function optionalText(ctx, value, field, { max = 10000 } = {}) {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== "string")
        invalid(ctx, `${field} 값이 올바르지 않습니다.`);
    const out = value.trim();
    if (!out)
        return null;
    if (out.length > max)
        invalid(ctx, `${field}은(는) ${max}자 이하여야 합니다.`);
    return out;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A required ID argument (a UUID string). */
export function id(ctx, value, field = "id") {
    if (typeof value !== "string" || !UUID.test(value))
        invalid(ctx, `${field} 값이 올바르지 않습니다.`);
    return value.toLowerCase();
}
export function optionalId(ctx, value, field = "id") {
    return value === null || value === undefined || value === ""
        ? null
        : id(ctx, value, field);
}
/** A list of IDs, at most `max`. */
export function ids(ctx, value, field, max = 100) {
    if (value === null || value === undefined)
        return [];
    if (!Array.isArray(value) || value.length > max)
        invalid(ctx, `${field} 값이 올바르지 않습니다.`);
    return [...new Set(value.map((v) => id(ctx, v, field)))];
}
/** A page size: `fallback` when absent, at most `max`. */
export function limitOf(value, fallback = 20, max = 100) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1)
        return fallback;
    return Math.min(Math.floor(n), max);
}
export function offsetOf(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
/** A list bound as one value, for `IN (SELECT value FROM json_each(?))`. */
export const list = (values) => JSON.stringify(values);
