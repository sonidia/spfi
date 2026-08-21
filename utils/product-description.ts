const ALLOWED_HTML_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "ul",
]);

const VOID_HTML_TAGS = new Set(["br", "hr"]);

export function renderProductDescription(value: string) {
  const source = String(value || "").trim();
  if (!source) return "";

  return /<\/?[a-z][^>]*>/i.test(source)
    ? sanitizeProductDescriptionHtml(source)
    : renderMarkdown(source);
}

export function sanitizeProductDescriptionHtml(value: string) {
  const withoutUnsafeBlocks = value.replace(
    /<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );

  return withoutUnsafeBlocks
    .split(/(<[^>]*>)/g)
    .map((token) =>
      token.startsWith("<") ? sanitizeHtmlTag(token) : escapeHtml(token),
    )
    .join("");
}

function sanitizeHtmlTag(value: string) {
  const match = value.match(/^<\s*(\/?)\s*([a-z0-9]+)\b([^>]*)>/i);
  if (!match) return escapeHtml(value);

  const closing = Boolean(match[1]);
  const tag = String(match[2]).toLowerCase();
  if (!ALLOWED_HTML_TAGS.has(tag)) return "";
  if (closing) return VOID_HTML_TAGS.has(tag) ? "" : `</${tag}>`;
  if (VOID_HTML_TAGS.has(tag)) return `<${tag}>`;

  if (tag === "a") {
    const href = readHtmlAttribute(match[3] || "", "href");
    const safeHref = safeDescriptionUrl(href);
    return safeHref
      ? `<a href="${escapeHtmlAttribute(safeHref)}" rel="noopener noreferrer">`
      : "<a>";
  }

  return `<${tag}>`;
}

function readHtmlAttribute(source: string, name: string) {
  const match = source.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match?.[1] || match?.[2] || match?.[3] || "";
}

function renderMarkdown(value: string) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] || "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test((lines[index] || "").trim())) {
        code.push(lines[index] || "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1]?.length || 1;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2] || "")}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index] || "")) {
        quote.push((lines[index] || "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      output.push(
        `<blockquote>${renderInlineMarkdown(quote.join("\n")).replaceAll("\n", "<br>")}</blockquote>`,
      );
      continue;
    }

    const listMatch = line.match(/^\s*(?:([-+*])|(\d+)\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[2]);
      const tag = ordered ? "ol" : "ul";
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] || "").match(
          ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/,
        );
        if (!item) break;
        items.push(`<li>${renderInlineMarkdown(item[1] || "")}</li>`);
        index += 1;
      }
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !isMarkdownBlockStart(lines[index] || "")) {
      paragraph.push((lines[index] || "").trim());
      index += 1;
    }
    output.push(
      `<p>${renderInlineMarkdown(paragraph.join("\n")).replaceAll("\n", "<br>")}</p>`,
    );
  }

  return output.join("");
}

function isMarkdownBlockStart(value: string) {
  return (
    !value.trim() ||
    /^```/.test(value.trim()) ||
    /^(#{1,6})\s+/.test(value) ||
    /^\s*>\s?/.test(value) ||
    /^\s*(?:[-+*]|\d+\.)\s+/.test(value) ||
    /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(value)
  );
}

function renderInlineMarkdown(value: string) {
  const codeTokens: string[] = [];
  let rendered = escapeHtml(value).replace(/`([^`\n]+)`/g, (_, code: string) => {
    const token = `@@PRODUCT_CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  rendered = rendered.replace(
    /\[([^\]\n]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (match, label: string, href: string) => {
      const safeHref = safeDescriptionUrl(href.replaceAll("&amp;", "&"));
      return safeHref
        ? `<a href="${escapeHtmlAttribute(safeHref)}" rel="noopener noreferrer">${label}</a>`
        : label;
    },
  );
  rendered = rendered
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

  return rendered.replace(/@@PRODUCT_CODE_(\d+)@@/g, (_, tokenIndex: string) => {
    return codeTokens[Number(tokenIndex)] || "";
  });
}

function safeDescriptionUrl(value: string) {
  const url = String(value || "").trim();
  if (!url || /[\u0000-\u001f\u007f]/.test(url)) return "";
  if (/^(?:https?:|mailto:|tel:)/i.test(url)) return url;
  if (/^(?:\/|#)/.test(url) && !/^\/\//.test(url)) return url;
  return "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
