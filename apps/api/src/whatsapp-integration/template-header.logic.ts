// Media headers on template sends. A template with an IMAGE / VIDEO / DOCUMENT header can only be sent with that media
// attached; without it Meta refuses with #132012 "Parameter format does not match format in the created template".
// The media we attach is the one the template was approved with (Meta's `example.header_handle`). No network here, so
// it can be checked with:
//   npx tsx src/whatsapp-integration/template-header.logic.check.ts

export const MEDIA_HEADER_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT'] as const;
export type MediaHeaderFormat = (typeof MEDIA_HEADER_FORMATS)[number];

export interface MediaHeader {
  format: MediaHeaderFormat;
  /** the sample media the template was approved with, if Meta returned one */
  exampleUrl: string | null;
}

/** The media header of a template as Meta returns it (`components` from GET /message_templates), or null. */
export function mediaHeaderOf(components: unknown): MediaHeader | null {
  if (!Array.isArray(components)) return null;
  const header = components.find((c: any) => String(c?.type || '').toUpperCase() === 'HEADER');
  const format = String(header?.format || '').toUpperCase();
  if (!(MEDIA_HEADER_FORMATS as readonly string[]).includes(format)) return null;
  const handle = header?.example?.header_handle;
  const url = Array.isArray(handle) ? handle.find((h: unknown) => typeof h === 'string' && /^https?:\/\//.test(h)) : null;
  return { format: format as MediaHeaderFormat, exampleUrl: url || null };
}

/** True when the caller already sent a header component (for example a different image chosen for this send). */
export function hasHeaderComponent(components: unknown): boolean {
  return Array.isArray(components) && components.some((c: any) => String(c?.type || '').toLowerCase() === 'header');
}

/** The header component Meta expects for a media header, pointing at an uploaded media id. */
export function mediaHeaderComponent(format: MediaHeaderFormat, mediaId: string) {
  const kind = format.toLowerCase() as 'image' | 'video' | 'document';
  return { type: 'header', parameters: [{ type: kind, [kind]: { id: mediaId } }] };
}

/** Caller's components with the media header added in front, unless the caller already gave one. */
export function withMediaHeader(components: any[] | undefined, format: MediaHeaderFormat, mediaId: string): any[] {
  const rest = Array.isArray(components) ? components : [];
  if (hasHeaderComponent(rest)) return rest;
  return [mediaHeaderComponent(format, mediaId), ...rest];
}
