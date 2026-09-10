export type Role = 'ADMIN' | 'AGENT' | 'MARKETER' | 'VIEWER';

export type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

export type MessagingTier = 'TIER_250' | 'TIER_2K' | 'TIER_10K' | 'TIER_100K' | 'UNLIMITED';

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'FAILED';

export type CustomerSentiment = 'POSITIVE' | 'NEUTRAL' | 'FRUSTRATED';

export type RFMSegment = 'CHAMPIONS' | 'LOYAL_CUSTOMERS' | 'POTENTIAL_LOYALIST' | 'AT_RISK' | 'NEW_LEADS';

export type OptInSource = 'WEBSITE_CHECKOUT' | 'CLICK_TO_WHATSAPP_AD' | 'QR_CODE' | 'ORGANIC_INBOUND';

export interface WhatsappStatus {
  connected: boolean;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string | null;
  tier?: MessagingTier;
  qualityRating?: QualityRating;
  connectedAt?: string;
  dailyMessageLimit?: number;
  dailyMessagesSent?: number;
  spamReportRate?: number; // e.g. 0.04%
  blockRate?: number; // e.g. 0.12%
  freeMonthlyServiceUsed?: number; // out of 1000
}

export interface Template {
  id: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  metaTemplateId?: string | null;
  bodyJson: {
    header?: { type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; text?: string; url?: string };
    body: string;
    footer?: string;
    buttons?: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE'; text: string; url?: string; phone?: string; code?: string }>;
  };
  sampleVariables?: Record<string, string>;
  createdAt: string;
  warning?: string | null;
}

export interface Contact {
  id: string;
  phone: string;
  displayName: string;
  optedIn: boolean;
  optedInAt?: string | null;
  optInSource?: OptInSource;
  tags: string[];
  rfmSegment?: RFMSegment;
  attributes?: Record<string, any>;
  lifetimeValue?: number;
  totalOrders?: number;
  lastActiveAt?: string;
  avatarUrl?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  metaMessageId?: string | null;
  templateId?: string | null;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio';
  buttons?: Array<{ text: string; payload?: string }>;
  isInternalNote?: boolean; // For private agent notes
  authorName?: string;
  timestamp: string;
  errorCode?: string | null;
}

export interface Conversation {
  id: string;
  contact: Contact;
  windowExpiresAt: string | null; // 24h Meta customer care window
  unreadCount: number;
  lastMessage: Message;
  assignedAgent?: string;
  status: 'OPEN' | 'RESOLVED' | 'PENDING';
  sentiment?: CustomerSentiment;
}

export interface Campaign {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  category: TemplateCategory;
  status: CampaignStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  targetTags: string[];
  totalRecipients: number;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    clickedOrReplied: number;
    converted: number;
    failed: number;
    revenue: number;
    cost: number;
  };
}

export interface AutomationStep {
  id: string;
  type: 'TRIGGER' | 'DELAY' | 'SEND_TEMPLATE' | 'CONDITION' | 'TAG_CONTACT';
  title: string;
  description: string;
  config?: Record<string, any>;
}

export interface AutomationFlow {
  id: string;
  name: string;
  triggerEvent: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  stats: {
    triggered: number;
    delivered: number;
    converted: number;
    revenue: number;
  };
  steps: AutomationStep[];
}

export interface RegionalPricing {
  country: string;
  code: string;
  marketingRate: number;
  utilityRate: number;
  serviceRate: number;
  authRate: number;
}

export interface RevenueAnalytics {
  timeframe: '7d' | '30d' | '90d' | 'all';
  totalRevenue: number;
  revenueGrowth: number; // percentage
  totalSpend: number; // Meta conversation costs
  roiMultiplier: number; // e.g. 20.0x
  averageOrderValue: number;
  totalConversations: number;
  marketingCost: number;
  utilityCost: number;
  serviceCost: number;
  freeServiceUsed: number;
  cacValue: number; // Customer Acquisition Cost
  ltvValue: number; // Lifetime Value
  funnel: {
    sent: number;
    delivered: number;
    read: number;
    engaged: number; // clicked / replied
    converted: number; // purchased / lead converted
  };
  dailyTrend: Array<{
    date: string;
    revenue: number;
    cost: number;
    messages: number;
    conversions: number;
  }>;
  regionalPricing: RegionalPricing[];
  channelComparison: {
    whatsapp: { openRate: number; ctr: number; conversionRate: number; roi: number };
    sms: { openRate: number; ctr: number; conversionRate: number; roi: number };
    email: { openRate: number; ctr: number; conversionRate: number; roi: number };
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
