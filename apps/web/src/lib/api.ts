const API_BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function setToken(token: string) {
  localStorage.setItem('accessToken', token);
}

export function clearToken() {
  localStorage.removeItem('accessToken');
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `API error ${response.status}`;
    try {
      const text = await response.text();
      try {
        const errorJson = JSON.parse(text);
        message = Array.isArray(errorJson?.message)
          ? errorJson.message.join(', ')
          : (errorJson?.message || message);
      } catch {
        if (text) message = text;
      }
    } catch {
      // fallback to default message
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// Auth API Calls
export async function loginApi(email: string, password: string) {
  const data = await apiFetch<{ accessToken: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.accessToken);
  return data;
}

export async function getMeApi() {
  return apiFetch<any>('/auth/me');
}

export async function createInviteApi(email: string, role: string) {
  return apiFetch<{
    id: string;
    email: string;
    role: string;
    token: string;
    expiresAt: string;
    emailSent?: boolean;
    emailMessage?: string;
    inviteLink?: string;
  }>('/auth/invite', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function validateInviteApi(token: string) {
  return apiFetch<{ email: string; role: string; invitedByName: string; expiresAt: string }>(
    `/auth/invite/${token}`,
  );
}

export async function registerInviteApi(token: string, name: string, password: string) {
  const data = await apiFetch<{ accessToken: string; user: any }>('/auth/register-invite', {
    method: 'POST',
    body: JSON.stringify({ token, name, password }),
  });
  setToken(data.accessToken);
  return data;
}

export async function getTeamMembersApi() {
  return apiFetch<any[]>('/auth/team');
}

export async function deleteTeamMemberApi(id: string) {
  return apiFetch<{ success: boolean }>(`/auth/team/${id}`, {
    method: 'DELETE',
  });
}

// Billing & Payment Methods API Calls
export async function getPaymentMethodsApi() {
  return apiFetch<any[]>('/billing/payment-methods');
}

export async function addPaymentMethodApi(pm: {
  type: string;
  name: string;
  provider: string;
  last4?: string;
  expiry?: string;
  billingEmail?: string;
  isDefault?: boolean;
  metaBillingAccountId?: string;
}) {
  return apiFetch<any>('/billing/payment-methods', {
    method: 'POST',
    body: JSON.stringify(pm),
  });
}

export async function setDefaultPaymentMethodApi(id: string) {
  return apiFetch<any>(`/billing/payment-methods/${id}/default`, {
    method: 'PATCH',
  });
}

export async function deletePaymentMethodApi(id: string) {
  return apiFetch<{ success: boolean }>(`/billing/payment-methods/${id}`, {
    method: 'DELETE',
  });
}

export async function getMetaBillingStatusApi() {
  return apiFetch<any>('/billing/meta-status');
}

// Webhook API Calls
export async function getWebhookStatusApi() {
  return apiFetch<any>('/webhooks/whatsapp/status');
}

export async function getLiveMessagingLedgerApi() {
  return apiFetch<{
    conversations: any[];
    messagesByConvId: Record<string, any[]>;
    metrics: {
      totalOutbound: number;
      totalDelivered: number;
      totalInbound: number;
      marketingDelivered?: number;
      serviceDelivered?: number;
      utilityDelivered?: number;
      marketingCostINR?: number;
      totalCostINR?: number;
    };
  }>('/whatsapp/ledger');
}

export async function markConversationReadApi(conversationId: string) {
  return apiFetch<{ success: boolean }>(`/inbox/conversations/${conversationId}/read`, {
    method: 'POST',
  });
}

export async function updateConversationStatusApi(conversationId: string, status: 'OPEN' | 'RESOLVED') {
  return apiFetch<{ success: boolean; status: string }>(`/inbox/conversations/${conversationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function assignConversationAgentApi(conversationId: string, agent: string) {
  return apiFetch<{ success: boolean; agent: string }>(`/inbox/conversations/${conversationId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ agent }),
  });
}

export async function testWebhookPingApi() {
  return apiFetch<{ success: boolean; message: string; timestamp: string }>(
    '/webhooks/whatsapp/test-ping',
    {
      method: 'POST',
    },
  );
}

// Contacts API Calls
export async function getContactsApi() {
  return apiFetch<any[]>('/contacts');
}

export async function saveContactApi(contact: { phone: string; displayName?: string; tags?: string[]; optedIn?: boolean }) {
  return apiFetch<any>('/contacts', {
    method: 'POST',
    body: JSON.stringify(contact),
  });
}

export async function bulkSaveContactsApi(contacts: Array<{ phone: string; displayName?: string; tags?: string[] }>) {
  if (!contacts || contacts.length === 0) return [];
  const BATCH_SIZE = 300;
  const results = [];
  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const chunk = contacts.slice(i, i + BATCH_SIZE);
    const res = await apiFetch<any[]>('/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify({ contacts: chunk }),
    });
    if (Array.isArray(res)) {
      results.push(...res);
    }
  }
  return results;
}

export async function autoCategorizeContactsApi() {
  return apiFetch<any[]>('/contacts/auto-categorize', {
    method: 'POST',
  });
}

// Campaigns API Calls
export async function getCampaignsApi() {
  return apiFetch<any[]>('/campaigns');
}

export async function createCampaignApi(cmp: {
  name: string;
  templateName: string;
  targetTags?: string[];
  totalRecipients?: number;
  stats?: any;
  status?: any;
}) {
  return apiFetch<any>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(cmp),
  });
}

export async function updateCampaignApi(id: string, update: { status?: any; stats?: any }) {
  return apiFetch<any>(`/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}

// Server-side broadcast sending: the server owns the send loop, so it survives closing the browser.
export async function getServerSendStatusApi() {
  return apiFetch<{ enabled: boolean; stub: boolean }>('/campaigns/server-send');
}

export async function launchCampaignApi(body: {
  name: string;
  templateName: string;
  language?: string;
  category?: string;
  targetTags?: string[];
}) {
  return apiFetch<any>('/campaigns/launch', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type CampaignAction = 'pause' | 'resume' | 'cancel' | 'retry-failed';

export async function campaignActionApi(id: string, action: CampaignAction) {
  return apiFetch<any>(`/campaigns/${id}/${action}`, { method: 'POST' });
}

export async function getCampaignRecipientsApi(
  id: string,
  opts: { status?: string; limit?: number; offset?: number } = {},
) {
  const q = new URLSearchParams();
  if (opts.status) q.set('status', opts.status);
  if (opts.limit) q.set('limit', String(opts.limit));
  if (opts.offset) q.set('offset', String(opts.offset));
  const qs = q.toString();
  return apiFetch<{
    items: Array<{
      id: string;
      phone: string;
      displayName: string | null;
      status: string;
      errorCode: string | null;
      errorMessage: string | null;
      attempts: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }>(`/campaigns/${id}/recipients${qs ? `?${qs}` : ''}`);
}

// Automations API Calls
export async function getFlowsApi() {
  return apiFetch<any[]>('/automations');
}

export async function updateFlowStatusApi(id: string, status: 'ACTIVE' | 'PAUSED') {
  return apiFetch<any>(`/automations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// Meta message delivery insights (same figures as WhatsApp Manager > Insights)
export async function getMetaInsightsApi(days: number) {
  return apiFetch<import('../types').MetaInsightsResponse>(`/whatsapp/insights?days=${days}`);
}

// Reply rules (Automations page)
export async function getReplyRulesApi() {
  return apiFetch<import('../types').ReplyRule[]>('/reply-rules');
}

export async function createReplyRuleApi(input: import('../types').ReplyRuleInput) {
  return apiFetch<import('../types').ReplyRule>('/reply-rules', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateReplyRuleApi(id: string, patch: Partial<import('../types').ReplyRuleInput>) {
  return apiFetch<import('../types').ReplyRule>(`/reply-rules/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteReplyRuleApi(id: string) {
  return apiFetch<{ ok: boolean }>(`/reply-rules/${id}`, { method: 'DELETE' });
}

export async function getReplyRuleLeadsApi(id: string, from?: string) {
  const qs = from ? `?from=${encodeURIComponent(from)}` : '';
  return apiFetch<import('../types').CallLeadRow[]>(`/reply-rules/${id}/leads${qs}`);
}

// Call sheets (who has been called, with remarks, and who did it)
export async function updateCallLeadApi(id: string, body: { status: import('../types').CallStatus; remarks: string }) {
  return apiFetch<{ id: string; status: import('../types').CallStatus; remarks: string | null; updatedAt: string | null; updatedBy: string | null }>(
    `/call-leads/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function getCallLeadHistoryApi(id: string) {
  return apiFetch<import('../types').CallLeadHistoryEntry[]>(`/call-leads/${id}/history`);
}

export async function getCallOverviewApi(days: number) {
  return apiFetch<import('../types').CallOverview>(`/call-leads/overview?days=${days}`);
}
