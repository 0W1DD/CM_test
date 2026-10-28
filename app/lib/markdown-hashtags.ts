import type MarkdownIt from "markdown-it";

// The same tags the site indexes (hashtagsIn in naru/modules/posts.ts): a
// `#` that starts a word, then letters, digits and underscores.
const HASHTAG = /(^|\s)#([\p{L}\p{N}_]+)/gu;

/** Where a tag leads: the search for it. */
export const hashtagHref = (tag: string) =>
  `/search?q=${encodeURIComponent(`#${tag}`)}`;

/**
 * Turns `#tags` in a post's text into links to their search. Text inside
 * links and code is left alone (code is never a text token).
 */
export function hashtags(md: MarkdownIt) {
  md.core.ruler.after("linkify", "hashtag", (state) => {
    for (const block of state.tokens) {
      if (block.type !== "inline" || !block.children) continue;
      const out: typeof block.children = [];
      let inLink = 0;
      for (const token of block.children) {
        if (token.type === "link_open") inLink++;
        if (token.type === "link_close") inLink--;
        if (token.type !== "text" || inLink > 0 || !token.content.includes("#")) {
          out.push(token);
          continue;
        }
        const text = token.content;
        let last = 0;
        for (const match of text.matchAll(HASHTAG)) {
          const lead = match[1] ?? "";
          const tag = match[2] ?? "";
          const start = (match.index ?? 0) + lead.length;
          if (start > last) {
            const before = new state.Token("text", "", 0);
            before.content = text.slice(last, start);
            out.push(before);
          }
          const open = new state.Token("link_open", "a", 1);
          open.attrs = [
            ["href", hashtagHref(tag)],
            ["class", "hashtag"],
          ];
          const label = new state.Token("text", "", 0);
          label.content = `#${tag}`;
          out.push(open, label, new state.Token("link_close", "a", -1));
          last = start + tag.length + 1;
        }
        if (last === 0) {
          out.push(token);
        } else if (last < text.length) {
          const rest = new state.Token("text", "", 0);
          rest.content = text.slice(last);
          out.push(rest);
        }
      }
      block.children = out;
    }
  });
}
