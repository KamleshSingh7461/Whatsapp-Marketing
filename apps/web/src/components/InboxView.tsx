import React, { useState } from 'react';
import { Conversation, Message, Template, User } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { canSendMessages } from '../lib/permissions';

interface InboxViewProps {
  conversations: Conversation[];
  messagesByConvId: Record<string, Message[]>;
  templates?: Template[];
  teamMembers?: User[];
  currency?: CurrencyCode;
  currentUser?: User | null;
  onSendMessage: (convId: string, text: string, isInternalNote?: boolean) => void;
  onSendTemplateMessage?: (convId: string, template: Template, renderedText: string) => void;
  onSimulateInbound: (convId: string, text: string) => void;
  onToggleResolve?: (convId: string) => void;
  onAssignAgent?: (convId: string, agent: string) => void;
  onStartNewChat?: (phone: string, name?: string, text?: string, templateName?: string) => Promise<string | void>;
}

const CANNED_RESPONSES = [
  { label: 'Welcome & Support Greeting', text: 'Welcome to Freedom Global Sports Network! 🏆 How can our team assist you with our tournament passes, official merchandise, or membership today?' },
  { label: 'Order Status & Tracking', text: 'Hello! Your FGSN sports order is packed and dispatched. 📦 Track your shipment live here: https://fgsnlive.com/track' },
  { label: 'VIP Promo Voucher (FGSN20)', text: 'Here is your exclusive VIP code: *FGSN20*. Enjoy 20% off all official sportswear and event tickets at checkout: https://fgsnlive.com' },
  { label: 'Live Tournament Stream Pass', text: 'Access the official live HD match broadcast and match replays with your FGSN Pass: https://fgsnlive.com/live' },
  { label: 'Secure UPI & Card Payment Link', text: 'You can securely complete your checkout via this encrypted payment gateway: https://pay.fgsnlive.com/checkout' },
  { label: 'Helpdesk Hours & Contact', text: 'Our dedicated FGSN WhatsApp desk is active 24/7. Please let us know if you need assistance with anything else!' },
];

const INBOUND_SIMULATION_PRESETS = [
  'When is the next live tournament match schedule?',
  'Where can I track my official FGSN sports jersey order?',
  'Does the FGSN20 discount code apply to match tickets?',
  'Can I upgrade my FGSN membership pass to VIP access?',
  'Can you send me the payment link to complete my booking?',
];

export const InboxView: React.FC<InboxViewProps> = ({
  conversations,
  messagesByConvId,
  templates = [],
  teamMembers = [],
  currency = 'INR',
  currentUser,
  onSendMessage,
  onSendTemplateMessage,
  onSimulateInbound,
  onToggleResolve,
  onAssignAgent,
  onStartNewChat,
}) => {
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'crm'>('list');
  const [selectedConvId, setSelectedConvId] = useState<string>(conversations[0]?.id || '');
  const [inputText, setInputText] = useState('');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showCanned, setShowCanned] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [customInboundText, setCustomInboundText] = useState('');
  const [selectedTemplateForModal, setSelectedTemplateForModal] = useState<Template | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'MINE' | 'UNASSIGNED' | 'OPEN' | 'RESOLVED'>('ALL');
  const [cannedList, setCannedList] = useState<Array<{ label: string; text: string }>>(() => {
    try {
      const saved = localStorage.getItem('fgsn_saved_canned_responses');
      return saved ? JSON.parse(saved) : CANNED_RESPONSES;
    } catch (e) {
      return CANNED_RESPONSES;
    }
  });
  const [cannedSearch, setCannedSearch] = useState('');
  const [showCannedEditor, setShowCannedEditor] = useState(false);
  const [cannedFormLabel, setCannedFormLabel] = useState('');
  const [cannedFormText, setCannedFormText] = useState('');

  const handleSaveCanned = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cannedFormLabel.trim() || !cannedFormText.trim()) return;
    const updated = [{ label: cannedFormLabel.trim(), text: cannedFormText.trim() }, ...cannedList];
    setCannedList(updated);
    try { localStorage.setItem('fgsn_saved_canned_responses', JSON.stringify(updated)); } catch (e) {}
    setCannedFormLabel('');
    setCannedFormText('');
    setShowCannedEditor(false);
  };

  const handleDeleteCanned = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = cannedList.filter((_, i) => i !== idx);
    setCannedList(updated);
    try { localStorage.setItem('fgsn_saved_canned_responses', JSON.stringify(updated)); } catch (e) {}
  };

  // Start New Chat Modal States
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [newChatMsgType, setNewChatMsgType] = useState<'TEMPLATE' | 'TEXT'>('TEMPLATE');
  const [newSelectedTemplateName, setNewSelectedTemplateName] = useState(templates[0]?.name || 'fgsn_account_welcome_notice');
  const [newChatText, setNewChatText] = useState('');
  const [newChatLoading, setNewChatLoading] = useState(false);

  const handleStartNewChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatPhone.trim()) return;

    setNewChatLoading(true);
    try {
      if (onStartNewChat) {
        const createdConvId = await onStartNewChat(
          newChatPhone.trim(),
          newChatName.trim() || undefined,
          newChatMsgType === 'TEXT' ? newChatText.trim() : undefined,
          newChatMsgType === 'TEMPLATE' ? newSelectedTemplateName : undefined,
        );
        if (createdConvId) {
          setSelectedConvId(createdConvId);
          setMobileView('chat');
        }
      }
      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatText('');
    } catch (err: any) {
      alert(err.message || 'Failed to send WhatsApp message');
    } finally {
      setNewChatLoading(false);
    }
  };

  const activeConversation = conversations.find(c => c.id === selectedConvId) || conversations[0];
  const messages = (selectedConvId && messagesByConvId[selectedConvId]) || [];

  const handleSelectConversation = (id: string) => {
    setSelectedConvId(id);
    setMobileView('chat');
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConvId) return;
    onSendMessage(selectedConvId, inputText.trim(), isNoteMode);
    setInputText('');
    setIsNoteMode(false);
  };

  const handleInsertCanned = (text: string) => {
    setInputText(prev => (prev ? `${prev} ${text}` : text));
    setShowCanned(false);
  };

  const handleDispatchTemplate = (tpl: Template) => {
    let rendered = tpl.bodyJson.body;
    if (activeConversation?.contact) {
      rendered = rendered.replace(/\{\{customer_name\}\}/gi, activeConversation.contact.displayName);
      rendered = rendered.replace(/\{\{1\}\}/gi, activeConversation.contact.displayName);
      rendered = rendered.replace(/\{\{discount_code\}\}/gi, 'VIP20');
      rendered = rendered.replace(/\{\{order_id\}\}/gi, 'ORD-98214');
    }

    if (onSendTemplateMessage) {
      onSendTemplateMessage(activeConversation.id, tpl, rendered);
    } else {
      onSendMessage(activeConversation.id, rendered, false);
    }
    setShowTemplateModal(false);
  };

  const handleTriggerInboundPreset = (text: string) => {
    if (!activeConversation) return;
    onSimulateInbound(activeConversation.id, text);
    setShowInboundModal(false);
    setCustomInboundText('');
  };

  const getWindowStatus = (expiresAt?: string | null) => {
    if (!expiresAt) return { expired: true, text: 'Session Expired (Template Required)', hours: 0, percent: 0 };
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { expired: true, text: 'Session Expired (Template Required)', hours: 0, percent: 0 };
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const percent = Math.min(100, Math.round((diff / (24 * 3600000)) * 100));
    return {
      expired: false,
      text: `24h Session Window: ${hours}h ${mins}m left`,
      hours,
      percent,
    };
  };

  const getSentimentBadge = (sentiment?: string) => {
    switch (sentiment) {
      case 'POSITIVE':
        return <span className="sentiment-badge positive">😊 Happy</span>;
      case 'FRUSTRATED':
        return <span className="sentiment-badge negative">😡 Escalation Risk</span>;
      default:
        return <span className="sentiment-badge neutral">😐 Inquired</span>;
    }
  };

  const myName = currentUser?.name || 'FGSN Super Admin';

  const filteredConversations = conversations.filter(c => {
    const lastContent = c.lastMessage?.content || '';
    const matchesSearch =
      c.contact.displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.phone.includes(search) ||
      lastContent.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'ALL') return true;
    if (filter === 'MINE') return c.assignedAgent === myName || (!c.assignedAgent && currentUser?.role === 'ADMIN');
    if (filter === 'UNASSIGNED') return !c.assignedAgent || c.assignedAgent === 'Unassigned';
    if (filter === 'OPEN') return c.status === 'OPEN';
    if (filter === 'RESOLVED') return c.status === 'RESOLVED';
    return true;
  });

  const windowState = activeConversation ? getWindowStatus(activeConversation.windowExpiresAt) : null;
  const filteredCanned = cannedList.filter(
    c => c.label.toLowerCase().includes(cannedSearch.toLowerCase()) || c.text.toLowerCase().includes(cannedSearch.toLowerCase())
  );

  return (
    <div className={`inbox-layout mobile-${mobileView}`}>
      {/* Left Column: Conversation Queue */}
      <div className="inbox-list-col">
        <div className="inbox-list-header">
          {/* Live WABA Inbox Banner */}
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#047857' }}>Live Shared Inbox</span>
            </div>
            <span style={{ fontSize: 11, color: '#059669', fontFamily: 'monospace', fontWeight: 600 }}>+91 86558 51749</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div className="search-bar-wrap" style={{ flex: 1 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="chat-search-input"
              />
            </div>
            <button
              className="btn-primary"
              onClick={() => setShowNewChatModal(true)}
              style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', borderRadius: 8 }}
            >
              + New Chat
            </button>
          </div>

          {/* 2-Tier Structured Filter Matrix (100% visible, zero scrolling needed) */}
          <div className="inbox-filter-matrix">
            <div className="filter-row primary-row">
              <button
                className={`filter-btn ${filter === 'OPEN' ? 'active' : ''}`}
                onClick={() => setFilter('OPEN')}
                title="View active open chats"
              >
                Open <span className="pill-count">({conversations.filter(c => c.status === 'OPEN').length})</span>
              </button>
              <button
                className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilter('ALL')}
                title="View all conversations"
              >
                All <span className="pill-count">({conversations.length})</span>
              </button>
              <button
                className={`filter-btn ${filter === 'RESOLVED' ? 'active' : ''}`}
                onClick={() => setFilter('RESOLVED')}
                title="View resolved chats"
              >
                Resolved <span className="pill-count">({conversations.filter(c => c.status === 'RESOLVED').length})</span>
              </button>
            </div>

            <div className="filter-row secondary-row">
              <button
                className={`filter-btn sub-btn ${filter === 'MINE' ? 'active' : ''}`}
                onClick={() => setFilter('MINE')}
                title="Assigned to me"
              >
                👤 Mine <span className="pill-count">({conversations.filter(c => c.assignedAgent === myName || (!c.assignedAgent && currentUser?.role === 'ADMIN')).length})</span>
              </button>
              <button
                className={`filter-btn sub-btn ${filter === 'UNASSIGNED' ? 'active' : ''}`}
                onClick={() => setFilter('UNASSIGNED')}
                title="Unassigned queue"
              >
                ⚡ Unassigned <span className="pill-count">({conversations.filter(c => !c.assignedAgent || c.assignedAgent === 'Unassigned').length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="inbox-conv-list">
          {filteredConversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
              <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4 }}>No active conversations</p>
              <span style={{ fontSize: '0.78rem' }}>Incoming WhatsApp messages and initiated chats will appear here.</span>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const itemWindowState = getWindowStatus(conv.windowExpiresAt);
              const isSelected = conv.id === selectedConvId;
              const isOutbound = conv.lastMessage?.direction === 'OUTBOUND';

              return (
                <div
                  key={conv.id}
                  className={`conversation-item ${isSelected ? 'selected' : ''} ${conv.status === 'RESOLVED' ? 'is-resolved' : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="conv-avatar-wrap">
                    {conv.contact.avatarUrl ? (
                      <img src={conv.contact.avatarUrl} alt={conv.contact.displayName} className="conv-avatar" />
                    ) : (
                      <div className="conv-avatar-placeholder">
                        {conv.contact.displayName.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                    <span className="online-indicator" title="WhatsApp Connected" />
                  </div>

                  <div className="conv-preview">
                    <div className="conv-top-line">
                      <span className="conv-name">{conv.contact.displayName}</span>
                      <span className="conv-time">
                        {conv.lastMessage?.timestamp
                          ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    <div className="conv-mid-line">
                      {isOutbound && (
                        <span className="msg-check-icon" title={conv.lastMessage?.status || 'SENT'}>
                          ✓✓
                        </span>
                      )}
                      <p className="conv-last-text">{conv.lastMessage?.content || 'Session initialized'}</p>
                    </div>

                    <div className="conv-badges">
                      <span className={`session-badge-pill ${itemWindowState.expired ? 'expired' : itemWindowState.hours < 4 ? 'warning' : 'active'}`}>
                        {itemWindowState.expired ? 'Expired' : `${itemWindowState.hours}h left`}
                      </span>
                      {conv.contact.tags[0] && (
                        <span className="tag-pill-corporate">{conv.contact.tags[0]}</span>
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="unread-counter-pill">{conv.unreadCount}</span>
                      )}
                      {conv.status === 'RESOLVED' && (
                        <span className="status-chip neutral" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>Resolved</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Center Column: Live Chat Interface */}
      {activeConversation ? (
        <div className="inbox-chat-col">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-user">
              <button
                className="inbox-mobile-back-btn"
                onClick={() => setMobileView('list')}
                title="Back to conversation list"
                aria-label="Back to queue"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Queue</span>
              </button>

              <div className="user-title-row">
                <span className="chat-user-name">{activeConversation.contact.displayName}</span>
                <span className="verified-wa-badge" title="Verified WhatsApp Number">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#059669">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </span>
                {getSentimentBadge(activeConversation.sentiment)}
              </div>
              <span className="chat-user-phone">{activeConversation.contact.phone}</span>
            </div>

            <div className="chat-header-actions">
              {/* Mobile View CRM Details Button */}
              <button
                className="btn-outline-sm inbox-mobile-crm-toggle"
                onClick={() => setMobileView(mobileView === 'crm' ? 'chat' : 'crm')}
                title="View customer CRM details"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>{mobileView === 'crm' ? 'Back to Chat' : 'Customer CRM'}</span>
              </button>

              {/* Agent Assignee */}
              <div className="agent-selector-box" title="Assigned Team Agent">
                <span className="agent-lbl">Agent:</span>
                <select
                  value={activeConversation.assignedAgent || 'Unassigned'}
                  onChange={(e) => onAssignAgent && onAssignAgent(activeConversation.id, e.target.value)}
                  className="agent-select"
                >
                  {currentUser && (
                    <option value={currentUser.name}>{currentUser.name} (You)</option>
                  )}
                  {teamMembers && teamMembers.filter(m => m.name !== currentUser?.name && m.email !== currentUser?.email && m.id !== currentUser?.id).map((m, idx) => (
                    <option key={idx} value={m.name}>{m.name} ({m.role})</option>
                  ))}
                  <option value="AI Support Bot">AI Support Bot</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
              </div>

              {/* Inbound Test Tool */}
              <button
                className="btn-outline-sm"
                onClick={() => setShowInboundModal(true)}
                title="Test customer reply and simulate 24-hour window refresh"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="hide-on-mobile">Simulate Inbound</span>
                <span className="show-on-mobile">Simulate</span>
              </button>

              {/* Status Toggle (Resolve / Reopen) */}
              <button
                className={`btn-outline-sm ${activeConversation.status === 'RESOLVED' ? 'btn-reopen' : 'btn-resolve'}`}
                onClick={() => onToggleResolve && onToggleResolve(activeConversation.id)}
                title={activeConversation.status === 'RESOLVED' ? 'Re-open this conversation' : 'Mark conversation as resolved'}
              >
                {activeConversation.status === 'RESOLVED' ? 'Reopen' : 'Resolve'}
              </button>
            </div>
          </div>

          {/* 24-Hour Session Banner */}
          {windowState && (
            <div className={`session-window-banner ${windowState.expired ? 'banner-expired' : 'banner-active'}`}>
              <div className="banner-left">
                <span className={`window-indicator-dot ${windowState.expired ? 'dot-red' : 'dot-green'}`} />
                <span className="banner-text">
                  {windowState.expired
                    ? 'Meta 24-Hour Service Window Expired — Outbound messages must use an Approved Template'
                    : `Active Customer Care Session: ${windowState.text}`}
                </span>
              </div>
              {!windowState.expired && (
                <div className="window-progress-mini">
                  <div className="window-fill" style={{ width: `${windowState.percent}%` }} />
                </div>
              )}
            </div>
          )}

          {/* Messages Area */}
          <div className="chat-messages-area">
            <div className="date-separator">
              <span>Today</span>
            </div>

            {messages.map((msg) => {
              if (msg.isInternalNote) {
                return (
                  <div key={msg.id} className="internal-note-box">
                    <div className="note-meta-line">
                      <div className="note-author">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <strong>Internal Team Note</strong> &bull; {msg.authorName || 'Team'}
                      </div>
                      <span className="note-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="note-text-content">{msg.content}</p>
                  </div>
                );
              }

              const isOutbound = msg.direction === 'OUTBOUND';
              const matchedTemplate = msg.templateId ? templates.find(t => t.id === msg.templateId || t.name === msg.templateId) : null;
              const headerText = msg.headerText || (msg as any).templateData?.header?.text || matchedTemplate?.bodyJson?.header?.text;
              const headerType = msg.headerType || (msg as any).templateData?.header?.type || matchedTemplate?.bodyJson?.header?.type;
              const footerText = msg.footerText || (msg as any).templateData?.footer || matchedTemplate?.bodyJson?.footer;
              const buttons = msg.buttons || (msg as any).templateData?.buttons || matchedTemplate?.bodyJson?.buttons;

              return (
                <div key={msg.id} className={`message-row ${isOutbound ? 'outbound' : 'inbound'}`}>
                  <div className={`message-bubble ${isOutbound ? 'outbound-bubble' : 'inbound-bubble'} ${matchedTemplate || headerText || buttons ? 'template-card-bubble' : ''}`}>
                    {/* Optional Template Media or Text Header */}
                    {headerType === 'IMAGE' && (
                      <div className="whatsapp-bubble-media-header">
                        <div className="media-placeholder-img">
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <span>Live Broadcast Event Banner</span>
                        </div>
                      </div>
                    )}
                    {headerText && headerType !== 'IMAGE' && (
                      <div className="whatsapp-bubble-header-text">
                        {headerText}
                      </div>
                    )}

                    {/* Main WhatsApp Message Body */}
                    <p className="message-text">{msg.content}</p>

                    {/* Optional Footer Text */}
                    {footerText && (
                      <div className="whatsapp-bubble-footer-text">
                        {footerText}
                      </div>
                    )}

                    {/* Delivery Status & Timestamp */}
                    <div className="message-meta">
                      <span className="msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOutbound && (
                        <span className="msg-status-indicator" title={`Status: ${msg.status}${msg.errorCode ? ` (${msg.errorCode})` : ''}`}>
                          {msg.status === 'READ' ? (
                            <span className="ticks blue">✓✓</span>
                          ) : msg.status === 'DELIVERED' ? (
                            <span className="ticks">✓✓</span>
                          ) : msg.status === 'FAILED' ? (
                            <span className="ticks failed" style={{ color: '#EF4444', fontWeight: 600, fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              ⚠ Failed
                            </span>
                          ) : (
                            <span className="ticks" title="Sent to Meta">✓</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* WhatsApp Action Buttons (Quick Replies, URL Link, Phone Call) */}
                    {buttons && buttons.length > 0 && (
                      <div className="whatsapp-bubble-buttons">
                        {buttons.map((btn: any, bIdx: number) => (
                          <div key={bIdx} className="whatsapp-bubble-btn">
                            {btn.type === 'URL' || btn.url ? (
                              <span className="btn-icon">↗</span>
                            ) : btn.type === 'PHONE_NUMBER' || btn.phone ? (
                              <span className="btn-icon">📞</span>
                            ) : (
                              <span className="btn-icon">↩</span>
                            )}
                            <span>{btn.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canned Responses Popover & Manager */}
          {showCanned && (
            <div className="canned-picker-popup">
              <div className="canned-head">
                <span>Quick Response Snippets ({filteredCanned.length})</span>
                <button className="close-btn sm" onClick={() => setShowCanned(false)}>✕</button>
              </div>

              <div className="canned-actions-bar">
                <input
                  type="text"
                  className="canned-search-input"
                  placeholder="Search quick replies..."
                  value={cannedSearch}
                  onChange={e => setCannedSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="canned-add-btn"
                  onClick={() => setShowCannedEditor(prev => !prev)}
                >
                  {showCannedEditor ? 'Cancel' : '+ New'}
                </button>
              </div>

              {showCannedEditor && (
                <form onSubmit={handleSaveCanned} style={{ padding: '8px 10px', background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                  <input
                    type="text"
                    placeholder="Snippet Title (e.g. VIP Pass Info)"
                    value={cannedFormLabel}
                    onChange={e => setCannedFormLabel(e.target.value)}
                    style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem', marginBottom: 6, borderRadius: 4, border: '1px solid #94A3B8' }}
                    required
                  />
                  <textarea
                    placeholder="Message Content..."
                    value={cannedFormText}
                    onChange={e => setCannedFormText(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '4px 8px', fontSize: '0.75rem', marginBottom: 6, borderRadius: 4, border: '1px solid #94A3B8' }}
                    required
                  />
                  <button type="submit" className="btn-primary sm" style={{ width: '100%', fontSize: '0.72rem', padding: '4px' }}>
                    Save Quick Response
                  </button>
                </form>
              )}

              <div className="canned-list">
                {filteredCanned.length === 0 ? (
                  <div style={{ padding: '12px', fontSize: '0.75rem', color: '#64748B', textAlign: 'center' }}>
                    No matching snippets found.
                  </div>
                ) : (
                  filteredCanned.map((cr, idx) => (
                    <div key={idx} className="canned-item-row">
                      <button className="canned-item-btn" onClick={() => handleInsertCanned(cr.text)}>
                        <strong>{cr.label}</strong>
                        <p>{cr.text}</p>
                      </button>
                      <button
                        className="canned-del-btn"
                        onClick={e => handleDeleteCanned(idx, e)}
                        title="Delete this quick response"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Chat Composer */}
          <div className="chat-composer-container">
            {windowState?.expired && !isNoteMode ? (
              <div className="window-expired-prompt">
                <div className="expired-info">
                  <strong>Meta Policy Session Expired</strong>
                  <p>Customer has not messaged in the past 24 hours. Regular text messages cannot be sent. You can either post an internal note or dispatch an approved WhatsApp template.</p>
                </div>
                <div className="expired-actions">
                  <button type="button" className="btn-secondary sm" onClick={() => setIsNoteMode(true)}>
                    Add Internal Note
                  </button>
                  <button type="button" className="btn-primary sm" onClick={() => setShowTemplateModal(true)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="9" y1="21" x2="9" y2="9"/>
                    </svg>
                    Send Approved Template
                  </button>
                </div>
              </div>
            ) : (
              <form className={`chat-composer ${isNoteMode ? 'note-mode' : ''}`} onSubmit={handleSend}>
                <div className="composer-toolbar">
                  <div className="toolbar-left">
                    {/* Mode Toggle */}
                    <div className="composer-mode-selector">
                      <button
                        type="button"
                        className={`mode-btn ${!isNoteMode ? 'active reply' : ''}`}
                        onClick={() => setIsNoteMode(false)}
                      >
                        WhatsApp Reply
                      </button>
                      <button
                        type="button"
                        className={`mode-btn ${isNoteMode ? 'active note' : ''}`}
                        onClick={() => setIsNoteMode(true)}
                      >
                        Internal Note
                      </button>
                    </div>

                    {!isNoteMode && (
                      <>
                        <button
                          type="button"
                          className="tool-btn"
                          onClick={() => setShowCanned(!showCanned)}
                          title="Insert quick response template"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                          </svg>
                          Quick Replies
                        </button>

                        <button
                          type="button"
                          className="tool-btn"
                          onClick={() => setShowTemplateModal(true)}
                          title="Dispatch an approved WhatsApp template"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                          </svg>
                          Send Template
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="composer-input-row">
                  <textarea
                    rows={2}
                    placeholder={
                      isNoteMode
                        ? 'Write a private note visible only to your internal team...'
                        : 'Type a message to send directly to customer on WhatsApp...'
                    }
                    className={`composer-textarea ${isNoteMode ? 'note-input-mode' : ''}`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                  />
                  <button type="submit" className={`btn-send-main ${isNoteMode ? 'note-send' : ''}`} title="Send (Enter)">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="inbox-chat-col empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, background: '#F8FAFC', textAlign: 'center', flex: 1 }}>
          <div style={{ width: 68, height: 68, borderRadius: 20, background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 12px rgba(5, 150, 105, 0.1)' }}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>FGSN Live Shared Inbox</h3>
          <p style={{ fontSize: 14, color: '#64748B', maxWidth: 440, lineHeight: 1.5, margin: '0 0 24px' }}>
            Send direct WhatsApp messages, dispatch Meta templates, and manage live customer conversations in real-time.
          </p>
          <button
            className="btn-primary"
            onClick={() => setShowNewChatModal(true)}
            style={{ padding: '12px 24px', fontSize: 14, fontWeight: 700, borderRadius: 10 }}
          >
            + Start New WhatsApp Conversation
          </button>
        </div>
      )}

      {/* Right Column: Customer Details CRM */}
      {activeConversation && (
        <div className="inbox-crm-col">
          <div className="crm-mobile-header">
            <button
              className="inbox-mobile-back-btn"
              onClick={() => setMobileView('chat')}
              title="Back to chat"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>Back to Chat</span>
            </button>
            <span className="crm-mobile-title">Customer CRM Profile</span>
          </div>

          <div className="crm-profile-card">
            <div className="crm-avatar-lg">
              {activeConversation.contact.avatarUrl ? (
                <img src={activeConversation.contact.avatarUrl} alt={activeConversation.contact.displayName} />
              ) : (
                <div className="avatar-placeholder-lg">
                  {activeConversation.contact.displayName.split(' ').map(n => n[0]).join('')}
                </div>
              )}
            </div>
            <h3 className="crm-name">{activeConversation.contact.displayName}</h3>
            <span className="crm-phone">{activeConversation.contact.phone}</span>
            {activeConversation.contact.rfmSegment && (
              <span className="status-chip success" style={{ marginTop: 6 }}>
                {activeConversation.contact.rfmSegment === 'CHAMPIONS' ? 'VIP Tier 1 Account' : 'Frequent Buyer'}
              </span>
            )}
          </div>

          <div className="crm-section">
            <h4 className="crm-section-title">Commercial Summary</h4>
            <div className="crm-grid-metrics">
              <div className="crm-stat">
                <span className="crm-stat-label">Lifetime Value</span>
                <span className="crm-stat-value text-primary-brand">
                  {formatCurrency(activeConversation.contact.lifetimeValue || 0, currency)}
                </span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-label">Total Orders</span>
                <span className="crm-stat-value">{activeConversation.contact.totalOrders || 0}</span>
              </div>
            </div>
          </div>

          <div className="crm-section">
            <h4 className="crm-section-title">Audience Segmentation</h4>
            <div className="tags-flex">
              {activeConversation.contact.tags.map((tag, i) => (
                <span key={i} className="tag-pill-corporate">{tag}</span>
              ))}
            </div>
          </div>

          {activeConversation.contact.attributes && (
            <div className="crm-section">
              <h4 className="crm-section-title">CRM Attributes</h4>
              <dl className="crm-attr-list">
                {Object.entries(activeConversation.contact.attributes).map(([k, v]) => (
                  <div key={k} className="attr-row">
                    <dt>{k}:</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Quick Commerce Actions */}
          <div className="crm-section">
            <h4 className="crm-section-title">One-Click Actions</h4>
            <div className="crm-actions-vertical">
              <button
                className="crm-action-btn"
                onClick={() => onSendMessage(activeConversation.id, `Hello ${activeConversation.contact.displayName}, here is your FGSN shipment tracking link: https://fgsnlive.com/track`, false)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Send Order & Match Tracking
              </button>

              <button
                className="crm-action-btn"
                onClick={() => onSendMessage(activeConversation.id, `Special VIP offer for you ${activeConversation.contact.displayName}: Use code *FGSN20* at checkout for 20% off official sportswear and event passes today! https://fgsnlive.com`, false)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Send FGSN20 Promo Code (20% Off)
              </button>

              <button
                className="crm-action-btn"
                onClick={() => onSendMessage(activeConversation.id, `Hi ${activeConversation.contact.displayName}, here is your direct access pass to stream live FGSN tournament matches in HD: https://fgsnlive.com/live-pass`, false)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Send Live Stream HD Match Pass
              </button>

              <button
                className="crm-action-btn"
                onClick={() => onSendMessage(activeConversation.id, `Hello ${activeConversation.contact.displayName}, you can complete your payment securely via UPI, Card, or Net Banking here: https://pay.fgsnlive.com/checkout`, false)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                Send Direct UPI / Payment Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inbound Simulator Modal */}
      {showInboundModal && activeConversation && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Simulate Inbound WhatsApp Reply</h3>
                <p className="modal-subtitle">Test customer message intake, webhook triggering, and 24h window reset</p>
              </div>
              <button className="close-btn" onClick={() => setShowInboundModal(false)}>✕</button>
            </div>

            <div style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: 12 }}>
                Select a standard inquiry preset or type a custom customer message:
              </p>

              <div className="inbound-presets-list">
                {INBOUND_SIMULATION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    className="preset-pill-btn"
                    onClick={() => handleTriggerInboundPreset(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Or type a custom customer response:</label>
                <input
                  type="text"
                  placeholder="e.g. Can I change my shipping address to 452 Broadway?"
                  className="form-input"
                  value={customInboundText}
                  onChange={(e) => setCustomInboundText(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowInboundModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!customInboundText.trim()}
                onClick={() => handleTriggerInboundPreset(customInboundText.trim())}
              >
                Send Simulated Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Dispatcher Modal */}
      {showTemplateModal && activeConversation && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Select Approved WhatsApp Template</h3>
                <p className="modal-subtitle">Directly dispatch a pre-approved template message to start or continue outreach</p>
              </div>
              <button className="close-btn" onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
              {templates.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: '0.86rem' }}>No approved templates found. Create one in the Template Studio first.</p>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`template-picker-card ${selectedTemplateForModal?.id === tpl.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplateForModal(tpl)}
                  >
                    <div className="tpl-pick-header">
                      <strong>{tpl.name}</strong>
                      <span className={`status-chip ${tpl.status === 'APPROVED' ? 'success' : 'neutral'}`}>{tpl.category}</span>
                    </div>
                    <p className="tpl-pick-body">{tpl.bodyJson.body}</p>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowTemplateModal(false)}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedTemplateForModal}
                onClick={() => selectedTemplateForModal && handleDispatchTemplate(selectedTemplateForModal)}
              >
                Dispatch Template to {activeConversation.contact.displayName}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start New Conversation Modal */}
      {showNewChatModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 480, width: '90%' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Start New WhatsApp Conversation</h3>
                <p className="modal-subtitle">Send a direct message or template via live Meta WABA</p>
              </div>
              <button className="close-btn" onClick={() => setShowNewChatModal(false)}>✕</button>
            </div>

            <form onSubmit={handleStartNewChatSubmit}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Recipient WhatsApp Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 917461913495 (with country code)"
                  className="form-input"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Include country code (e.g. 91 for India, 1 for US) without + or spaces.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Contact Display Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Kamlesh Singh"
                  className="form-input"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Message Type</label>
                <select
                  className="form-input"
                  value={newChatMsgType}
                  onChange={(e) => setNewChatMsgType(e.target.value as any)}
                >
                  <option value="TEMPLATE">Approved Meta Template Message (Recommended for 1st message)</option>
                  <option value="TEXT">Plain Text Message (Requires active 24h session window)</option>
                </select>
              </div>

              {newChatMsgType === 'TEMPLATE' ? (
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>Select Meta Template</label>
                  <select
                    className="form-input"
                    value={newSelectedTemplateName}
                    onChange={(e) => setNewSelectedTemplateName(e.target.value)}
                  >
                    {templates.length > 0 ? (
                      templates.map(t => (
                        <option key={t.id} value={t.name}>{t.name} ({t.category} - {t.language})</option>
                      ))
                    ) : (
                      <>
                        <option value="fgsn_account_welcome_notice">fgsn_account_welcome_notice (UTILITY)</option>
                        <option value="hello_world">hello_world (UTILITY)</option>
                      </>
                    )}
                  </select>
                </div>
              ) : (
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>Direct Message Text</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Type your WhatsApp message..."
                    className="form-input"
                    value={newChatText}
                    onChange={(e) => setNewChatText(e.target.value)}
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowNewChatModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={newChatLoading || !newChatPhone.trim()}>
                  {newChatLoading ? 'Sending via WABA...' : '🚀 Send & Start Conversation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
