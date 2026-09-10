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
      const errorJson = await response.json();
      message = errorJson.message || message;
    } catch {
      message = await response.text();
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

export async function testWebhookPingApi() {
  return apiFetch<{ success: boolean; message: string; timestamp: string }>(
    '/webhooks/whatsapp/test-ping',
    {
      method: 'POST',
    },
  );
}
