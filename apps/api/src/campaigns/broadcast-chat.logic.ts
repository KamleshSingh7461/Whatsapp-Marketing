// How a broadcast message looks when it is shown in a person's chat. No database here, so it can be checked with:
//   npx tsx src/campaigns/broadcast-chat.logic.check.ts

/** Broadcasts older than this are not added to a chat when the person replies: too old to be what they answer. */
export const BROADCAST_CHAT_LOOKBACK_DAYS = 30;

/**
 * The text the person received. Server-sent broadcasts fill {{1}} with the contact's name ("there" without one);
 * browser-sent ones send the template without variables, so its text is shown as it is.
 */
export function broadcastText(body: string, opts: { serverSend: boolean; name?: string | null; templateName: string }): string {
  const text = (body || '').trim();
  if (!text) return `[Template: ${opts.templateName}]`;
  if (!opts.serverSend) return text;
  const name = (opts.name || '').trim();
  return text.replace(/\{\{1\}\}/g, name && !name.startsWith('+') ? name : 'there');
}

/** A broadcast number's delivery state, as a chat message status. Not yet handed to Meta counts as sent. */
export function chatStatusFor(recipientStatus: string): 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' {
  switch (recipientStatus) {
    case 'DELIVERED':
      return 'DELIVERED';
    case 'READ':
      return 'READ';
    case 'FAILED':
    case 'CANCELLED':
      return 'FAILED';
    default:
      return 'SENT';
  }
}

/** Same number in every format we store: digits only, 10-digit Indian numbers given their 91. */
export function chatPhone(phone: string): string {
  const d = String(phone || '').replace(/[^\d]/g, '');
  return d.length === 10 ? '91' + d : d;
}
