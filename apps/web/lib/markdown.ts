/**
 * Lightweight markdown-to-HTML converter for site pages.
 * Supports: ## headings, **bold**, - lists, [links](url), paragraphs.
 * No external dependencies needed.
 */
export function markdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const html: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    if (line.startsWith('### ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }

    // List items
    if (line.startsWith('- ')) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    // End list if we hit a non-list line
    if (inList) { html.push('</ul>'); inList = false; }

    // Empty line = paragraph break
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph
    html.push(`<p>${inline(line)}</p>`);
  }

  if (inList) html.push('</ul>');

  return html.join('\n');
}

function inline(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}
