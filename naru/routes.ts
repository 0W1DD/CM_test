// Every page address is the app's one page: React Router draws the page the
// address names in the browser. Files (assets/) are served as they are.
// The page opens already in the community's look (modules/look.ts).

import type { QueryCtx } from "./modules/core.js";
import { lookHead } from "./modules/look.js";

export default async function route(ctx: QueryCtx) {
  const head = await lookHead(ctx);
  return head ? { file: "index.html", head } : { file: "index.html" };
}
