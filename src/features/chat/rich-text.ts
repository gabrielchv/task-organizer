export type RichTextSegment =
  { type: "text"; value: string } | { type: "bold"; value: string };

/**
 * Splits `**bold**` runs out of an assistant reply.
 *
 * The model is asked for bold and nothing else, so a full markdown renderer
 * would be a dependency and an injection surface for one feature. Returning
 * segments rather than HTML keeps the escaping in React's hands.
 */
export function parseRichText(text: string): RichTextSegment[] {
  if (!text) return [];

  const segments: RichTextSegment[] = [];
  const pattern = /\*\*(.+?)\*\*/gs;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }
    segments.push({ type: "bold", value: match[1] ?? "" });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}
