/**
 * Reply rules: "when a customer taps a button on one of our templates, do this".
 *
 * Everything here is plain functions with no database or network, so it can be tested with the exact
 * payload Meta documents for a button tap. A rule is matched on WHICH template and WHICH button was
 * tapped, never on the wording of a typed message, so changing a template's button text or language
 * only means editing (or adding) a rule.
 */

/** What a customer tapped, read from Meta's inbound `messages[]` entry. */
export interface ButtonTap {
  /** The button label, plus the payload when it differs from the label. Compared after normalising. */
  labels: string[];
  /** WhatsApp message id of the template message that carried the button (Meta's `context.id`). */
  contextMessageId?: string;
}

export interface RuleLike {
  id: string;
  name: string;
  /** Template name the rule applies to. null means "any template". */
  templateName: string | null;
  buttonText: string;
  tags: string[];
  replyText: string | null;
  active: boolean;
  createdAt: Date;
}

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Meta sends a tap on a template quick-reply button as `type: "button"` with `button.text` (the label)
 * and `button.payload`, and `context.id` = the id of the message that held the button. A typed reply,
 * even the word "yes", is `type: "text"` and is deliberately NOT a button tap.
 */
export function extractButtonTap(message: any): ButtonTap | null {
  if (!message || message.type !== 'button' || !message.button) return null;
  const labels: string[] = [];
  for (const candidate of [message.button.text, message.button.payload]) {
    if (nonEmpty(candidate) && !labels.some(l => normalizeLabel(l) === normalizeLabel(candidate))) {
      labels.push(candidate.trim());
    }
  }
  if (labels.length === 0) return null;
  const ctx = message.context?.id;
  return { labels, contextMessageId: nonEmpty(ctx) ? ctx : undefined };
}

/** Case, spacing and width differences must not stop a rule matching ("Yes", " YES ", full-width "Ｙｅｓ"). */
export function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buttonMatches(rule: Pick<RuleLike, 'buttonText'>, labels: string[]): boolean {
  const wanted = normalizeLabel(rule.buttonText);
  return wanted.length > 0 && labels.some(l => normalizeLabel(l) === wanted);
}

/**
 * The rules that apply to one tap, oldest first.
 *  - only active rules
 *  - the button label must match
 *  - a rule for a named template needs that template to be the one tapped; a rule for "any template" always
 *    passes the template test (including when we could not work out which template it was)
 *  - a rule for a specific template beats "any template" rules, so adding a rule for a new campaign does not
 *    also fire the general one
 */
export function pickMatchingRules<T extends RuleLike>(
  rules: T[],
  templateName: string | null,
  labels: string[],
): T[] {
  const wantedTemplate = templateName ? normalizeLabel(templateName) : null;
  const matches = rules
    .filter(r => r.active && buttonMatches(r, labels))
    .filter(r =>
      r.templateName === null
        ? true
        : wantedTemplate !== null && normalizeLabel(r.templateName) === wantedTemplate,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const specific = matches.filter(r => r.templateName !== null);
  return specific.length > 0 ? specific : matches;
}

export function mergeTags(existing: string[] | null | undefined, add: string[]): string[] {
  const out: string[] = [];
  for (const t of [...(existing ?? []), ...add]) {
    if (nonEmpty(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Accepts an array or a comma-separated string. Trims, drops blanks and repeats, caps length and count. */
export function cleanTagList(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  const out: string[] = [];
  for (const item of raw) {
    const t = String(item ?? '').replace(/\s+/g, ' ').trim().slice(0, 50);
    if (t && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length === 10) break;
  }
  return out;
}

export interface RuleInput {
  name: string;
  templateName: string | null;
  buttonText: string;
  tags: string[];
  replyText: string | null;
  active: boolean;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

/** Checks a create or update body. For updates (`partial`), only the fields that were sent are checked. */
export function validateRuleInput(input: any, partial = false): Validation<Partial<RuleInput>> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Nothing was sent.' };
  const out: Partial<RuleInput> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);

  if (!partial || has('name')) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) return { ok: false, error: 'Give the rule a name.' };
    if (name.length > 80) return { ok: false, error: 'The rule name can be at most 80 characters.' };
    out.name = name;
  }

  if (!partial || has('buttonText')) {
    const button = typeof input.buttonText === 'string' ? input.buttonText.trim() : '';
    if (!button) return { ok: false, error: 'Say which button this rule is for.' };
    if (button.length > 60) return { ok: false, error: 'The button text can be at most 60 characters.' };
    out.buttonText = button;
  }

  if (has('templateName') || !partial) {
    const t = typeof input.templateName === 'string' ? input.templateName.trim() : '';
    if (t.length > 120) return { ok: false, error: 'The template name is too long.' };
    out.templateName = t === '' ? null : t;
  }

  if (has('tags') || !partial) {
    out.tags = cleanTagList(input.tags);
  }

  if (has('replyText') || !partial) {
    const r = typeof input.replyText === 'string' ? input.replyText.trim() : '';
    if (r.length > 1000) return { ok: false, error: 'The automatic reply can be at most 1000 characters.' };
    out.replyText = r === '' ? null : r;
  }

  if (has('active')) {
    if (typeof input.active !== 'boolean') return { ok: false, error: 'Active must be true or false.' };
    out.active = input.active;
  } else if (!partial) {
    out.active = true;
  }

  return { ok: true, value: out };
}
