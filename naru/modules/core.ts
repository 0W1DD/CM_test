// What every query and mutation shares: IDs, times, argument checks and
// refusals. Naru runs this in QuickJS: no crypto, Intl or console.
import type {
  MutationCtx,
  QueryCtx,
  SqlValue,
} from "../../types/functions";
import { randomInt } from "./random.js";

export type { MutationCtx, QueryCtx, SqlValue };
export type Ctx = QueryCtx | MutationCtx;
export type Row = Record<string, SqlValue>;

const HEX = "0123456789abcdef";
const randomHex = (length: number) => {
  let out = "";
  for (let i = 0; i < length; i++) out += HEX[randomInt(16)];
  return out;
};

/** A UUIDv7 for a new row, from the call's time and random bits. */
export function uuidv7(now: number): string {
  const time = Math.floor(now).toString(16).padStart(12, "0").slice(-12);
  const variant = HEX[8 + randomInt(4)];
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-7${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}

/** Milliseconds as the ISO string commung's API answered with, or null. */
export const iso = (ms: SqlValue | undefined): string | null =>
  typeof ms === "number" ? new Date(ms).toISOString() : null;

/** An ISO string (or milliseconds) from a page, as milliseconds; null if blank. */
export function msOf(ctx: Ctx, value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const ms =
    typeof value === "number" ? value : Date.parse(String(value));
  if (!Number.isFinite(ms)) invalid(ctx, `${field} 값이 올바르지 않습니다.`);
  return ms;
}

export const bool = (value: SqlValue | undefined) => value === 1;

/** Refuses a request whose arguments are wrong. */
export function invalid(ctx: Ctx, message: string, reason = "invalid"): never {
  return ctx.fail("INVALID_REQUEST", message, { reason });
}

export function notFound(ctx: Ctx, message: string): never {
  return ctx.fail("NOT_FOUND", message, { reason: "not_found" });
}

export function denied(ctx: Ctx, message: string, reason = "denied"): never {
  return ctx.fail("ACCESS_DENIED", message, { reason });
}

/** The arguments object, or {} when a call passed none. */
export const argsOf = (args: unknown): Record<string, unknown> =>
  args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>)
    : {};

/** A required string argument, trimmed unless `raw`. */
export function text(
  ctx: Ctx,
  value: unknown,
  field: string,
  { max = 10000, min = 1, raw = false } = {},
): string {
  if (typeof value !== "string") invalid(ctx, `${field}을(를) 입력해 주세요.`);
  const out = raw ? value : value.trim();
  if (out.length < min) invalid(ctx, `${field}을(를) 입력해 주세요.`);
  if (out.length > max) invalid(ctx, `${field}은(는) ${max}자 이하여야 합니다.`);
  return out;
}

/** An optional string argument: null when absent or blank. */
export function optionalText(
  ctx: Ctx,
  value: unknown,
  field: string,
  { max = 10000 } = {},
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") invalid(ctx, `${field} 값이 올바르지 않습니다.`);
  const out = value.trim();
  if (!out) return null;
  if (out.length > max) invalid(ctx, `${field}은(는) ${max}자 이하여야 합니다.`);
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A required ID argument (a UUID string). */
export function id(ctx: Ctx, value: unknown, field = "id"): string {
  if (typeof value !== "string" || !UUID.test(value))
    invalid(ctx, `${field} 값이 올바르지 않습니다.`);
  return value.toLowerCase();
}

export function optionalId(ctx: Ctx, value: unknown, field = "id") {
  return value === null || value === undefined || value === ""
    ? null
    : id(ctx, value, field);
}

/** A list of IDs, at most `max`. */
export function ids(ctx: Ctx, value: unknown, field: string, max = 100) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > max)
    invalid(ctx, `${field} 값이 올바르지 않습니다.`);
  return [...new Set(value.map((v) => id(ctx, v, field)))];
}

/** A page size: `fallback` when absent, at most `max`. */
export function limitOf(value: unknown, fallback = 20, max = 100): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export function offsetOf(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** A list bound as one value, for `IN (SELECT value FROM json_each(?))`. */
export const list = (values: readonly SqlValue[]) => JSON.stringify(values);
