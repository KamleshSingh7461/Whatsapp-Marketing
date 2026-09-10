import React, { useState } from 'react';
import { Conversation, Message, Template } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';

interface InboxViewProps {
  conversations: Conversation[];
  messagesByConvId: Record<string, Message[]>;
  templates?: Template[];
  currency?: CurrencyCode;
  onSendMessage: (convId: string, text: string, isInternalNote?: boolean) => void;
  onSendTemplateMessage?: (convId: string, template: Template, renderedText: string) => void;
  onSimulateInbound: (convId: string, text: string) => void;
  onToggleResolve?: (convId: string) => void;
  onAssignAgent?: (convId: string, agent: string) => void;
  onStartNewChat?: (phone: string, name?: string, text?: string, templateName?: string) => Promise<string | void>;
}

const CANNED_RESPONSES = [
  { label: 'Order Status Inquiry', text: 'Hello, your shipment is in transit and can be tracked in real time here: https://tracking.example.com/order' },
  { label: 'Promotion Code (VIP 20%)', text: 'Here is your 20% promotional code: VIP20. Valid on all catalog items through end of week.' },
  { label: 'Return & Exchange Policy', text: 'We offer standard 30-day returns and exchanges. Would you like me to generate a prepaid return label for you?' },
  { label: 'Payment Link Assistance', text: 'You can securely complete your checkout using this direct encrypted link: https://pay.example.com/checkout/vip' },
  { label: 'Support Desk Hours', text: 'Our dedicated WhatsApp support desk is active 24/7. Please let us know if you have any further questions!' },
];

const INBOUND_SIMULATION_PRESETS = [
  'Can you confirm if the silk blazer is available in midnight blue?',
  'Does the 20% discount code apply to audio accessories as well?',
  'Where can I track my order #ORD-98214 shipped yesterday?',
  'I left some items in my cart, can you send me the checkout link?',
  'What is your return policy for international shipments?',
];

export const InboxView: React.FC<InboxViewProps> = ({
  conversations,
  messagesByConvId,
  templates = [],
  currency = 'INR',
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
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'VIP'>('ALL');

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
    if (tpl.sampleVariables && activeConversation?.contact) {
      rendered = rendered.replace('{{customer_name}}', activeConversation.contact.displayName);
      rendered = rendered.replace('{{1}}', activeConversation.contact.displayName);
      rendered = rendered.replace('{{discount_code}}', 'VIP20');
      rendered = rendered.replace('{{order_id}}', 'ORD-98214');
    }

    if (onSendTemplateMessage) {
      onSendTemplateMessage(activeConversation.id, tpl, rendered);
    } else {
      onSendMessage(activeConversation.id, `[Template: ${tpl.name}]\n${rendered}`, false);
    }
    setShowTemplateModal(false);
  };

  const handleTriggerInboundPreset = (text: string) => {
    if (!activeConversation) return;
    onSimulateInbound(activeConversation.id, text);
    setShowInboundModal(false);
    setCustomInboundText('');
  };

  const getWindowStatus = (expiresAt: string | null) => {
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
        return <span className="status-chip success">Positive Sentiment</span>;
      case 'FRUSTRATED':
        return <span className="status-chip danger">Priority Attention</span>;
      default:
        return <span className="status-chip neutral">Neutral</span>;
    }
  };

  const filteredConversations = conversations.filter(c => {
    const matchesSearch =
      c.contact.displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.phone.includes(search) ||
      c.lastMessage.content.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return c.status === 'OPEN';
    if (filter === 'RESOLVED') return c.status === 'RESOLVED';
    if (filter === 'VIP') return c.contact.rfmSegment === 'CHAMPIONS' || (c.contact.lifetimeValue || 0) > 1000;
    return true;
  });

  const windowState = activeConversation ? getWindowStatus(activeConversation.windowExpiresAt) : null;

  return (
    <div className={`inbox-layout mobile-${mobileView}`}>
      {/* Left Column: Conversation Queue */}
      <div className="inbox-list-col">
        <div className="inbox-list-header">
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

          <div className="inbox-filter-tabs">
            <button className={`tab-filter ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
              All ({conversations.length})
            </button>
            <button className={`tab-filter ${filter === 'OPEN' ? 'active' : ''}`} onClick={() => setFilter('OPEN')}>
              Open ({conversations.filter(c => c.status === 'OPEN').length})
            </button>
            <button className={`tab-filter ${filter === 'RESOLVED' ? 'active' : ''}`} onClick={() => setFilter('RESOLVED')}>
              Resolved ({conversations.filter(c => c.status === 'RESOLVED').length})
            </button>
            <button className={`tab-filter ${filter === 'VIP' ? 'active' : ''}`} onClick={() => setFilter('VIP')}>
              VIP
            </button>
          </div>
        </div>

        <div className="conversation-scroll-list">
          {filteredConversations.length === 0 ? (
            <div className="empty-search-state" style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 14 }}>No active conversations found.</p>
              <button className="btn-primary" onClick={() => setShowNewChatModal(true)} style={{ padding: '10px 16px', fontSize: 13 }}>
                + Start New WhatsApp Conversation
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const itemWindowState = getWindowStatus(conv.windowExpiresAt);
              const isSelected = conv.id === selectedConvId;
              const isOutbound = conv.lastMessage.direction === 'OUTBOUND';

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
                        {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="conv-mid-line">
                      {isOutbound && (
                        <span className="msg-check-icon" title={conv.lastMessage.status}>
                          ✓✓
                        </span>
                      )}
                      <p className="conv-last-text">{conv.lastMessage.content}</p>
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
                  value={activeConversation.assignedAgent || 'Kamlesh Sharma'}
                  onChange={(e) => onAssignAgent && onAssignAgent(activeConversation.id, e.target.value)}
                  className="agent-select"
                >
                  <option value="Kamlesh Sharma">Kamlesh Sharma (You)</option>
                  <option value="Alex Carter">Alex Carter</option>
                  <option value="Elena Vance">Elena Vance</option>
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
              return (
                <div key={msg.id} className={`message-row ${isOutbound ? 'outbound' : 'inbound'}`}>
                  <div className={`message-bubble ${isOutbound ? 'outbound-bubble' : 'inbound-bubble'}`}>
                    <p className="message-text">{msg.content}</p>
                    <div className="message-meta">
                      <span className="msg-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOutbound && (
                        <span className="msg-status-indicator" title={`Status: ${msg.status}`}>
                          {msg.status === 'READ' ? (
                            <span className="ticks blue">✓✓</span>
                          ) : msg.status === 'DELIVERED' ? (
                            <span className="ticks">✓✓</span>
                          ) : (
                            <span className="ticks">✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Canned Responses Popover */}
          {showCanned && (
            <div className="canned-picker-popup">
              <div className="canned-head">
                <span>Quick Response Snippets</span>
                <button className="close-btn sm" onClick={() => setShowCanned(false)}>✕</button>
              </div>
              <div className="canned-list">
                {CANNED_RESPONSES.map((cr, idx) => (
                  <button key={idx} className="canned-item-btn" onClick={() => handleInsertCanned(cr.text)}>
                    <strong>{cr.label}</strong>
                    <p>{cr.text}</p>
                  </button>
                ))}
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
        <div className="inbox-chat-col empty-state">
          <p>Select a conversation from the left queue to start chatting.</p>
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
                onClick={() => onSendMessage(activeConversation.id, `Hello ${activeConversation.contact.displayName}, here is your VIP express tracking link: https://tracking.example.com/ORD-98214`, false)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Send Order Tracking Link
              </button>

              <button
                className="crm-action-btn"
                onClick={() => onSendMessage(activeConversation.id, `Special VIP offer for you ${activeConversation.contact.displayName}: Use code VIP20 at checkout for 20% off your entire order today!`, false)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Send VIP 20% Promo Code
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
