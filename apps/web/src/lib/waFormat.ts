// WhatsApp text formatting, read the way WhatsApp reads it, so Chats shows a message as the customer sees it instead
// of with its * and _ marks. Checked by scripts/waFormat.check.ts.
//
//   *bold*   _italic_   ~strikethrough~   ```monospace```   `inline code`
//
// Rules (as on the phone):
//  - A mark only opens at the start of the text or after a space / punctuation, and must be followed by a non-space.
//  - It only closes before a space / punctuation / the end, and must follow a non-space. So "5*3*2" and "file_name_v2"
//    stay as typed.
//  - Marks never span a line break, except ``` which may.
//  - Marks can be combined: *_bold italic_*.

export interface WaSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
}

type Style = Omit<WaSegment, 'text'>;

const MARKS: Record<string, keyof Style> = { '*': 'bold', _: 'italic', '~': 'strike' };

const isWordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);
const isSpace = (ch: string | undefined) => !ch || /\s/.test(ch);

/** Where the mark opened at `open` closes on the same line, or -1. */
function closingIndex(text: string, open: number, mark: string): number {
  for (let i = open + 2; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') return -1;
    if (ch === mark && !isSpace(text[i - 1]) && !isWordChar(text[i + 1])) return i;
  }
  return -1;
}

function parse(text: string, style: Style, out: WaSegment[]) {
  let plain = '';
  const flush = () => {
    if (plain) out.push({ text: plain, ...style });
    plain = '';
  };

  let i = 0;
  while (i < text.length) {
    // ```monospace``` (may span lines; nothing inside is formatted)
    if (text.startsWith('```', i)) {
      const end = text.indexOf('```', i + 3);
      if (end > i + 3) {
        flush();
        out.push({ text: text.slice(i + 3, end), ...style, mono: true });
        i = end + 3;
        continue;
      }
    }

    const ch = text[i];
    const opensHere = !isWordChar(text[i - 1]) && !isSpace(text[i + 1]);

    // `inline code`
    if (ch === '`' && opensHere) {
      const end = closingIndex(text, i, '`');
      if (end > 0) {
        flush();
        out.push({ text: text.slice(i + 1, end), ...style, mono: true });
        i = end + 1;
        continue;
      }
    }

    const key = MARKS[ch];
    if (key && !style[key] && opensHere) {
      const end = closingIndex(text, i, ch);
      if (end > 0) {
        flush();
        parse(text.slice(i + 1, end), { ...style, [key]: true }, out);
        i = end + 1;
        continue;
      }
    }

    plain += ch;
    i++;
  }
  flush();
}

/** The text split into runs of the same style. Plain text comes back as one unstyled run. */
export function parseWaFormatting(text: string): WaSegment[] {
  const out: WaSegment[] = [];
  parse(String(text ?? ''), {}, out);
  return out;
}

/** The text without its formatting marks, for one-line previews (chat list, template list). */
export function stripWaFormatting(text: string): string {
  return parseWaFormatting(text).map(s => s.text).join('');
}

/**
 * Wraps the selected part of `value` in a mark (the editor's B / I / S buttons). With nothing selected the marks are
 * inserted with the cursor between them. Returns the new value and where the selection should be.
 */
export function wrapSelection(value: string, start: number, end: number, mark: string) {
  const close = mark === '```' ? '```' : mark;
  // Spaces stay outside the marks: "*hello *" would not be bold on the phone.
  let s = start;
  let e = end;
  while (s < e && /\s/.test(value[s])) s++;
  while (e > s && /\s/.test(value[e - 1])) e--;
  const selected = value.slice(s, e);
  // Already wrapped in this mark: unwrap instead.
  if (selected && value.slice(s - mark.length, s) === mark && value.slice(e, e + close.length) === close) {
    const next = value.slice(0, s - mark.length) + selected + value.slice(e + close.length);
    return { value: next, start: s - mark.length, end: e - mark.length };
  }
  const next = value.slice(0, s) + mark + selected + close + value.slice(e);
  return { value: next, start: s + mark.length, end: e + mark.length };
}
