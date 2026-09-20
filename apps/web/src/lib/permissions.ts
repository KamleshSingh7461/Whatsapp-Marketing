import { Role } from '../types';
import { TabType } from '../components/Sidebar';

/**
 * Role-Based Access Control (RBAC) definitions and helpers
 * 
 * ADMIN: Full unrestricted access to all modules, billing, team invites, credentials, and settings.
 * MARKETER: Full access to Campaigns, Templates, Audience & CRM, Automations, Analytics, and Inbox. (Restricted from WABA settings/billing/team).
 * AGENT: Customer support role. Chats only: no other page is shown or reachable. Templates can still be sent from inside a chat.
 * Call sheets (follow-up calls to customers who tapped a button): ADMIN (Operations Admin, Super Admin) and MARKETER only.
 * VIEWER: Read-only access across analytics, campaigns, templates, inbox, and audience.
 */

export const ROLE_ALLOWED_TABS: Record<Role, TabType[]> = {
  ADMIN: ['analytics', 'inbox', 'automations', 'calls', 'campaigns', 'templates', 'contacts', 'settings'],
  MARKETER: ['analytics', 'inbox', 'automations', 'calls', 'campaigns', 'templates', 'contacts'],
  AGENT: ['inbox'],
  VIEWER: ['analytics', 'inbox', 'campaigns', 'templates', 'contacts'],
};

export function canAccessTab(role: Role | undefined | null, tab: TabType): boolean {
  if (!role) return false;
  const allowed = ROLE_ALLOWED_TABS[role];
  return allowed ? allowed.includes(tab) : false;
}

export function getDefaultTabForRole(role: Role | undefined | null): TabType {
  if (role === 'AGENT') return 'inbox';
  if (role === 'MARKETER') return 'campaigns';
  if (role === 'VIEWER') return 'analytics';
  return 'inbox'; // ADMIN default or fallback
}

export function canManageSettings(role: Role | undefined | null): boolean {
  return role === 'ADMIN';
}

export function canManageTeam(role: Role | undefined | null): boolean {
  return role === 'ADMIN';
}

export function canManageBilling(role: Role | undefined | null): boolean {
  return role === 'ADMIN';
}

export function canManageWabaCredentials(role: Role | undefined | null): boolean {
  return role === 'ADMIN';
}

export function canCreateCampaigns(role: Role | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function canCreateTemplates(role: Role | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function canManageAutomations(role: Role | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function canManageContacts(role: Role | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function canSendMessages(role: Role | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER' || role === 'AGENT';
}
