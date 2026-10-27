import { ShopError } from "./shop.js";
/** A command, typed: `export default defineCommand({ name, description, run })`. */
export const defineCommand = (command) => command;
// ---------- For the shop's commands ----------
/** Runs a shop change, answering the shop's refusal as the reply. */
export async function orShopMessage(fn) {
    try {
        return await fn();
    }
    catch (error) {
        if (error instanceof ShopError)
            return error.message;
        throw error;
    }
}
export function itemNotFound(name) {
    return new ShopError("NOT_FOUND", `상품을 찾을 수 없습니다: ${name}`, "not_found");
}
