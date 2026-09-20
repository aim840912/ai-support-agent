/**
 * Converts the model's Markdown into the small HTML subset Telegram accepts.
 *
 * Why HTML and not MarkdownV2: MarkdownV2 requires escaping eighteen
 * characters, and a single unpaired one makes Telegram reject the *entire*
 * message with "can't parse entities" — the user then receives nothing at all.
 * HTML needs three characters escaped and permits five tags, so the failure
 * surface is far smaller. The plain-text retry in the client covers whatever
 * still slips through.
 *
 * Telegram supports: b, i, u, s, code, pre, a, blockquote, tg-spoiler.
 * Anything else is rejected, so this converts a deliberately narrow subset and
 * strips the rest rather than guessing.
 */

const CODE_BLOCK = /```(?:[a-zA-Z0-9]*)\n?([\s\S]*?)```/g;
const INLINE_CODE = /`([^`\n]+)`/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Applies inline formatting to text that is already HTML-escaped.
 *
 * Bold runs before italic: `**x**` would otherwise be consumed as two
 * adjacent italic markers.
 */
function inlineFormat(escaped: string): string {
  return (
    escaped
      // [label](https://…) — only http(s), so a javascript: URL cannot be
      // smuggled into a link.
      .replace(
        /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_m, label, href) => `<a href="${href}">${label}</a>`
      )
      .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
      .replace(/__([^_\n]+)__/g, "<b>$1</b>")
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>")
      .replace(/(^|[\s(])_([^_\n]+)_/g, "$1<i>$2</i>")
      .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
  );
}

function formatLine(line: string): string {
  // Headings have no Telegram equivalent; bold is the closest thing that
  // survives, and dropping the hashes is better than showing them.
  const heading = line.match(/^#{1,6}\s+(.*)$/);
  if (heading) return `<b>${inlineFormat(escapeHtml(heading[1]))}</b>`;

  const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
  if (bullet) return `${bullet[1]}• ${inlineFormat(escapeHtml(bullet[2]))}`;

  return inlineFormat(escapeHtml(line));
}

/**
 * Markdown in, Telegram-flavoured HTML out.
 *
 * Code spans are extracted before anything else and restored at the end, so
 * formatting characters inside them are never interpreted.
 */
export function toTelegramHtml(markdown: string): string {
  const stash: string[] = [];
  const keep = (html: string) => {
    stash.push(html);
    return `\u0000${stash.length - 1}\u0000`;
  };

  let text = markdown
    .replace(CODE_BLOCK, (_m, code) => keep(`<pre>${escapeHtml(code.replace(/\n$/, ""))}</pre>`))
    .replace(INLINE_CODE, (_m, code) => keep(`<code>${escapeHtml(code)}</code>`));

  text = text.split("\n").map(formatLine).join("\n");

  return text.replace(/\u0000(\d+)\u0000/g, (_m, index) => stash[Number(index)]);
}
