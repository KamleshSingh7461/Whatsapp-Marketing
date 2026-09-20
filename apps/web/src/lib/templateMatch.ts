import { Message, Template } from '../types';

export type TemplateButtonKind = 'reply' | 'url' | 'phone' | 'copy';

export interface TemplateButtonView {
  text: string;
  kind: TemplateButtonKind;
}

export interface TemplateParts {
  /** The template this message was sent from, when we could tell. */
  template?: Template;
  headerText?: string;
  footerText?: string;
  buttons: TemplateButtonView[];
}

const alnum = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

const MIN_SEGMENT = 10; // ignore fragments too short to identify a template
const SNIPPET = 25; // characters of a fragment that must appear in the message

/** The fixed text between a template's {{variables}}, normalised for comparison. */
const segmentsOf = (body: string) =>
  body
    .split(/\{\{.*?\}\}/)
    .map(alnum)
    .filter(s => s.length >= MIN_SEGMENT);

/**
 * How strongly a sent message's text looks like this template's body.
 * Whole fixed fragments found in the message count most. Only the opening of a fragment matching counts as a weak
 * match. 0 = not this template.
 */
function textScore(messageAlnum: string, body: string): number {
  const segments = segmentsOf(body);
  if (segments.length === 0) return 0;
  const whole = segments.filter(s => messageAlnum.includes(s));
  if (whole.length > 0) return whole.reduce((n, s) => n + s.length, 0);
  return segments.some(s => messageAlnum.includes(s.substring(0, SNIPPET))) ? 1 : 0;
}

/**
 * Finds the template a sent message belongs to: by the template id/name saved with the message, otherwise by its text.
 * Only messages WE sent are matched, so a customer's reply is never decorated with a template's buttons.
 * If two templates open with the same words, the one whose text fits the message best wins.
 */
export function findMatchedTemplate(msg: Message, templates: Template[]): Template | undefined {
  if (msg.direction !== 'OUTBOUND') return undefined;

  const wanted = msg.templateId || (msg as any).templateName;
  if (wanted) {
    const byId = templates.find(
      t => t && (t.id === wanted || t.name === wanted || t.metaTemplateId === wanted),
    );
    if (byId) return byId;
  }

  if (!msg.content) return undefined;
  const messageAlnum = alnum(msg.content);
  let best: Template | undefined;
  let bestScore = 0;
  for (const t of templates) {
    if (!t?.bodyJson?.body) continue;
    const score = textScore(messageAlnum, t.bodyJson.body);
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

function kindOf(btn: any): TemplateButtonKind {
  const type = typeof btn === 'object' && btn ? String(btn.type || '').toUpperCase() : '';
  if (type === 'URL' || btn?.url) return 'url';
  if (type === 'PHONE_NUMBER' || btn?.phone || btn?.phone_number) return 'phone';
  if (type === 'COPY_CODE') return 'copy';
  return 'reply';
}

/** Header, footer and buttons to draw for a message: what was saved with it first, then what the template has. */
export function templateParts(msg: Message, templates: Template[]): TemplateParts {
  const template = findMatchedTemplate(msg, templates);
  const tplBody = template?.bodyJson;
  const data = (msg as any).templateData;

  const headerType = msg.headerType || data?.header?.type || tplBody?.header?.type;
  const headerText = msg.headerText || data?.header?.text || tplBody?.header?.text;
  const footerText = msg.footerText || data?.footer || tplBody?.footer;
  const rawButtons: any[] = msg.buttons || data?.buttons || tplBody?.buttons || [];

  const buttons: TemplateButtonView[] = rawButtons
    .map(b => ({
      text: typeof b === 'string' ? b : b?.text || b?.title || b?.label || '',
      kind: kindOf(b),
    }))
    .filter(b => b.text);

  return {
    template,
    // An image/video header has no text to show here; only a text header is drawn.
    headerText: headerType && headerType !== 'TEXT' ? undefined : headerText || undefined,
    footerText: typeof footerText === 'string' && footerText ? footerText : undefined,
    buttons,
  };
}
