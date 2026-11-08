export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape user-provided text before putting it into HTML. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => escapeMap[char] ?? char);
}

interface LayoutInput {
  preheader: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}

/** Minimal, client-safe HTML layout (inline styles, single column, real link fallback). */
export function renderLayout({
  preheader,
  heading,
  paragraphs,
  action,
  footnote,
}: LayoutInput): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#27272a">${p}</p>`)
    .join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#18181b;color:#fafafa;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#52525b">Or paste this link into your browser:<br><a href="${escapeHtml(action.url)}" style="color:#1d4ed8;word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : "";
  const foot = footnote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#71717a">${footnote}</p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-weight:700;font-size:16px;color:#09090b">Tracklane</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#09090b">${escapeHtml(heading)}</h1>
${body}${button}${foot}
</td></tr></table></td></tr></table></body></html>`;
}
