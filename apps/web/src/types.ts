export type Role = 'ADMIN' | 'AGENT' | 'MARKETER' | 'VIEWER';

export type QualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

export type MessagingTier = 'TIER_250' | 'TIER_2K' | 'TIER_10K' | 'TIER_100K' | 'UNLIMITED';

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED';

export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED';

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
  email?: string;
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
  templateData?: any;
  headerText?: string;
  headerType?: string;
  footerText?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'audio';
  buttons?: Array<any>;
  isInternalNote?: boolean; // For private agent notes
  authorName?: string;
  timestamp: string;
  errorCode?: string | null;
}

export interface Conversation {
  id: string;
  contact: Contact;
  windowExpiresAt?: string | null; // 24h Meta customer care window
  unreadCount: number;
  lastMessage?: Message;
  assignedAgent?: string;
  status: 'OPEN' | 'RESOLVED' | 'PENDING';
  sentiment?: CustomerSentiment;
}

/** Live, measured progress of a server-sent campaign (derived from its recipient rows). */
export interface CampaignProgress {
  total: number;
  queued: number;
  sending: number;
  /** Accepted by Meta, no delivery receipt yet. */
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  cancelled: number;
  /** Handed to Meta successfully: sent + delivered + read. */
  accepted: number;
  /** Finished one way or another: accepted + failed + cancelled. */
  processed: number;
  percentDone: number;
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
  startedAt?: string | null;
  completedAt?: string | null;
  /** True when the server owns the sending (survives closing the browser). */
  serverSend?: boolean;
  /** e.g. 'DAILY_LIMIT' while a sending campaign is waiting for Meta's daily cap to free up. */
  pauseReason?: string | null;
  progress?: CampaignProgress;
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
  isSuperAdmin?: boolean;
}

/** Totals per Meta pricing category and pricing type, from GET /whatsapp/insights. */
export type MetaPricingBreakdown = Record<string, Record<string, { volume: number; cost: number }>>;

export interface MetaInsights {
  available: true;
  days: number;
  /** First and last calendar day covered, "YYYY-MM-DD" in the business timezone. */
  startDay: string;
  endDay: string;
  sent: number;
  delivered: number;
  received: number;
  pricing: MetaPricingBreakdown;
}

export type MetaInsightsResponse = MetaInsights | { available: false; days: number; reason: string };

/** "When a customer taps this button on this template, do this." Managed on the Automations page. */
export interface ReplyRule {
  id: string;
  name: string;
  /** null means "any template" */
  templateName: string | null;
  buttonText: string;
  tags: string[];
  replyText: string | null;
  active: boolean;
  createdAt: string;
  /** People on this rule's call sheet (one per person). */
  leadCount: number;
  lastLeadAt: string | null;
  callStatusCounts: Record<CallStatus, number>;
}

export interface ReplyRuleInput {
  name: string;
  templateName: string | null;
  buttonText: string;
  tags: string[];
  replyText: string | null;
  active?: boolean;
}

export type CallStatus = 'CALL_PENDING' | 'CALLED_NOT_PICKED' | 'CALL_DONE' | 'FOLLOW_UP_PENDING';

/** One person on a rule's call sheet. A person who taps twice is still one row. */
export interface CallLeadRow {
  id: string;
  ruleId: string;
  contact: { id: string; displayName: string | null; phone: string; tags: string[] };
  templateName: string | null;
  buttonText: string;
  firstTapAt: string;
  lastTapAt: string;
  tapCount: number;
  status: CallStatus;
  remarks: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CallLeadHistoryEntry {
  id: string;
  status: CallStatus;
  remarks: string | null;
  byName: string;
  byRole: string;
  createdAt: string;
}

export interface CallOverview {
  days: 1 | 7 | 30;
  since: string;
  people: Array<{
    userId: string;
    name: string;
    role: string;
    updates: number;
    leadsTouched: number;
    byStatus: Record<CallStatus, number>;
    lastActiveAt: string;
  }>;
  pipeline: Record<CallStatus, number>;
  recent: Array<{
    id: string;
    at: string;
    status: CallStatus;
    remarks: string | null;
    byName: string;
    byRole: string;
    leadId: string;
    ruleName: string;
    contactName: string;
    phone: string;
  }>;
}
