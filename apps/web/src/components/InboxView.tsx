import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Conversation, Message, Template, User } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { POPULAR_COUNTRY_CODES, cleanPhoneWithCountry, isSamePhoneNumber, formatPhoneNumber, formatPhoneInput, validatePhoneNumber } from '../lib/countryCodes';
import {
  WhatsAppLogoIcon,
  DoubleCheckIcon,
  SingleCheckIcon,
  VerifiedBadgeIcon,
  SearchIcon,
  NewChatIcon,
  MenuDotsIcon,
  SmileyIcon,
  PaperclipIcon,
  SendIcon,
  BackArrowIcon,
  PhoneCallIcon,
  VideoCallIcon,
  LockIcon,
  UserAvatarPlaceholder,
  TemplateIcon,
  CloseIcon,
  CopyIcon,
  TagIcon,
  ChatsNavIcon,
  ContactsNavIcon,
} from './WhatsAppIcons';

interface InboxViewProps {
  conversations: Conversation[];
  messagesByConvId: Record<string, Message[]>;
  templates?: Template[];
  teamMembers?: User[];
  currency?: CurrencyCode;
  currentUser?: User | null;
  onSendMessage: (convId: string, text: string, isInternalNote?: boolean, mediaUrl?: string) => void;
  onSendTemplateMessage?: (convId: string, template: Template, renderedText: string) => void;
  onSimulateInbound: (convId: string, text: string) => void;
  onToggleResolve?: (convId: string) => void;
  onAssignAgent?: (convId: string, agent: string) => void;
  onStartNewChat?: (phone: string, name?: string, text?: string, templateName?: string, tags?: string[]) => Promise<string | void>;
  onMarkConversationRead?: (convId: string) => void;
  onToggleMobileSidebar?: () => void;
}

const CANNED_RESPONSES = [
  { label: 'Welcome & Support Greeting', text: 'Welcome to Freedom Global Sports Network! 🏆 How can our team assist you with tournament passes, official merchandise, or membership today?' },
  { label: 'Order Status & Tracking', text: 'Hello! Your FGSN sports order is packed and dispatched. 📦 Track your shipment live here: https://fgsnlive.com/track' },
  { label: 'VIP Promo Voucher (FGSN20)', text: 'Here is your exclusive VIP code: *FGSN20*. Enjoy 20% off all official sportswear and event tickets at checkout: https://fgsnlive.com' },
  { label: 'Live Tournament Stream Pass', text: 'Access the official live HD match broadcast and match replays with your FGSN Pass: https://fgsnlive.com/live' },
  { label: 'Secure UPI & Card Payment Link', text: 'You can securely complete your checkout via this encrypted payment gateway: https://pay.fgsnlive.com/checkout' },
  { label: 'Helpdesk Hours & Contact', text: 'Our dedicated WhatsApp desk is active 24/7. Please let us know if you need assistance with anything else!' },
];

const INBOUND_SIMULATION_PRESETS = [
  'When is the next live tournament match schedule?',
  'Where can I track my official FGSN sports jersey order?',
  'Does the FGSN20 discount code apply to match tickets?',
  'Can I upgrade my FGSN membership pass to VIP access?',
  'Can you send me the payment link to complete my booking?',
];

// Layout breakpoints. Keep in step with styles.css (search "SINGLE_PANE_MAX").
//  - up to SINGLE_PANE_MAX: phone layout, one pane at a time (list, chat or contact info)
//  - above it: chat list and conversation side by side
//  - from INFO_PANEL_DEFAULT_OPEN_MIN up there is room for the contact info column too
const SINGLE_PANE_MAX = 760;
const INFO_PANEL_DEFAULT_OPEN_MIN = 1431;

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
  onMarkConversationRead,
  onToggleMobileSidebar,
}) => {
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'crm'>('list');
  const [selectedConvId, setSelectedConvId] = useState<string>(conversations[0]?.id || '');
  const [inputText, setInputText] = useState('');
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showCanned, setShowCanned] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showInboundModal, setShowInboundModal] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [customInboundText, setCustomInboundText] = useState('');
  const [selectedTemplateForModal, setSelectedTemplateForModal] = useState<Template | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'MINE' | 'RESOLVED'>('ALL');
  // The info panel is a side column only on wide windows. On narrower ones it slides over the chat (see
  // styles.css), so it starts closed there instead of covering the conversation.
  const [showContactInfo, setShowContactInfo] = useState<boolean>(
    () => typeof window === 'undefined' || window.innerWidth >= INFO_PANEL_DEFAULT_OPEN_MIN,
  );

  // Mobile Touch Swipe Gesture Tracking (Swipe right to navigate back)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const chatListScrollPos = useRef<number>(0);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  const handleChatListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    chatListScrollPos.current = e.currentTarget.scrollTop;
  };

  // Preserve and restore exact scroll position of the chat list across navigation and message sends
  useEffect(() => {
    if (chatListRef.current) {
      if (Math.abs(chatListRef.current.scrollTop - chatListScrollPos.current) > 2) {
        chatListRef.current.scrollTop = chatListScrollPos.current;
      }
    }
  }, [mobileView, selectedConvId, conversations]);

  // Push state to browser history when changing views so mobile back gestures work natively
  const navigateMobile = (view: 'list' | 'chat' | 'crm', convId?: string) => {
    setMobileView(view);
    if (typeof window !== 'undefined') {
      window.history.pushState({ fgsnScreen: view, convId: convId || selectedConvId }, '');
    }
  };

  const handleGoBackFromChat = () => {
    if (typeof window !== 'undefined' && window.history.state && window.history.state.fgsnScreen === 'chat') {
      window.history.back();
    } else {
      setMobileView('list');
    }
  };

  const handleGoBackFromCrm = () => {
    if (typeof window !== 'undefined' && window.history.state && window.history.state.fgsnScreen === 'crm') {
      window.history.back();
    } else {
      setMobileView('chat');
    }
  };

  // Listen to popstate event (Hardware Back button, swipe back in Safari/Chrome, browser Back)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (showNewChatModal || showTemplateModal || showInboundModal || showCanned) {
        setShowNewChatModal(false);
        setShowTemplateModal(false);
        setShowInboundModal(false);
        setShowCanned(false);
        return;
      }

      const state = e.state;
      if (!state || state.fgsnScreen === 'list') {
        setMobileView('list');
      } else if (state.fgsnScreen === 'chat') {
        setMobileView('chat');
        if (state.convId) setSelectedConvId(state.convId);
      } else if (state.fgsnScreen === 'crm') {
        setMobileView('crm');
      } else {
        setMobileView('list');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showNewChatModal, showTemplateModal, showInboundModal, showCanned]);

  // Touch gesture handlers for swiping right to go back, swiping left for CRM, and edge-swiping for drawer
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (mobileView === 'chat' && dx > 8) {
        setSwipeOffset(Math.max(0, dx));
      } else if (mobileView === 'crm' && dx > 8) {
        setSwipeOffset(Math.max(0, dx));
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    const startX = touchStartRef.current.x;

    setIsSwiping(false);
    setSwipeOffset(0);
    touchStartRef.current = null;

    const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 1.2;
    const isSwipeRight = dx > 50 || (dx > 30 && dt < 280);
    const isSwipeLeft = dx < -50 || (dx < -30 && dt < 280);

    if (isHorizontalSwipe) {
      if (mobileView === 'chat') {
        if (isSwipeRight) {
          handleGoBackFromChat();
        } else if (isSwipeLeft) {
          navigateMobile('crm');
        }
      } else if (mobileView === 'crm') {
        if (isSwipeRight) {
          handleGoBackFromCrm();
        }
      } else if (mobileView === 'list') {
        if (startX < 45 && isSwipeRight && onToggleMobileSidebar) {
          onToggleMobileSidebar();
        }
      }
    }
  };

  const handleSeedDemoChat = async () => {
    if (onStartNewChat) {
      try {
        const id = await onStartNewChat(
          '919876543210',
          'Rahul Sharma',
          'Hello! When does the upcoming live FGSN tournament start? Also, does the FGSN20 coupon code apply to VIP passes?'
        );
        if (id) {
          setSelectedConvId(id);
          navigateMobile('chat', id);
        }
      } catch (e) {}
    }
  };

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
  const [newCountryCode, setNewCountryCode] = useState<string>('+91');
  const [newChatPhone, setNewChatPhone] = useState<string>('');
  const [newChatName, setNewChatName] = useState<string>('');
  const [newChatTags, setNewChatTags] = useState<string[]>(['New Lead']);
  const [newCustomTagInput, setNewCustomTagInput] = useState<string>('');
  const [newChatMsgType, setNewChatMsgType] = useState<'TEMPLATE' | 'TEXT'>('TEMPLATE');
  const [newSelectedTemplateName, setNewSelectedTemplateName] = useState(templates[0]?.name || 'fgsn_account_welcome_notice');
  const [newChatText, setNewChatText] = useState<string>('');
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null);

  // Dynamic formatting & validation for phone input
  const phoneValidation = useMemo(() => {
    return validatePhoneNumber(newCountryCode, newChatPhone);
  }, [newCountryCode, newChatPhone]);

  const phoneHasDigits = /\d/.test(newChatPhone);

  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Typing stops at a full number for the country; a paste is kept whole so it can be checked, not cut short.
    const formatted = formatPhoneInput(newCountryCode, e.target.value, (e.nativeEvent as InputEvent).inputType);
    setNewChatPhone(formatted);
  };

  const handleCountryCodeChange = (code: string) => {
    setNewCountryCode(code);
    if (newChatPhone) {
      const reformatted = formatPhoneNumber(code, newChatPhone);
      setNewChatPhone(reformatted);
    }
  };

  const handleAttachImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WEBP, etc.)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Normalized phone number combining country code and typed digits
  const normalizedPhone = useMemo(() => {
    return cleanPhoneWithCountry(newCountryCode, newChatPhone);
  }, [newCountryCode, newChatPhone]);

  // Real-time duplicate check: detect if this contact already exists in conversations
  const existingConversation = useMemo(() => {
    const rawDigits = newChatPhone.replace(/[^\d]/g, '');
    if (!rawDigits || rawDigits.length < 5) return null;
    return conversations.find(c => isSamePhoneNumber(c.contact?.phone, normalizedPhone));
  }, [newChatPhone, normalizedPhone, conversations]);

  const handleOpenExistingChat = (convId: string) => {
    setSelectedConvId(convId);
    navigateMobile('chat', convId);
    setShowNewChatModal(false);
    setNewChatPhone('');
    setNewChatName('');
    setNewChatText('');
  };

  const handleToggleTag = (tag: string) => {
    setNewChatTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const tag = newCustomTagInput.trim();
    if (tag && !newChatTags.includes(tag)) {
      setNewChatTags(prev => [...prev, tag]);
      setNewCustomTagInput('');
    }
  };

  const handleStartNewChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValidation.isValid || !normalizedPhone) return;

    // Duplicate prevention: If contact already exists, switch to existing conversation!
    if (existingConversation) {
      handleOpenExistingChat(existingConversation.id);
      return;
    }

    setNewChatLoading(true);
    try {
      if (onStartNewChat) {
        const finalTags = Array.from(new Set([
          ...newChatTags,
          ...(newCustomTagInput.trim() ? [newCustomTagInput.trim()] : []),
        ]));

        const createdConvId = await onStartNewChat(
          normalizedPhone,
          newChatName.trim() || undefined,
          newChatMsgType === 'TEXT' ? newChatText.trim() : undefined,
          newChatMsgType === 'TEMPLATE' ? newSelectedTemplateName : undefined,
          finalTags.length > 0 ? finalTags : ['New Lead']
        );
        if (createdConvId) {
          setSelectedConvId(createdConvId);
          navigateMobile('chat', createdConvId);
        }
      }
      setShowNewChatModal(false);
      setNewChatPhone('');
      setNewChatName('');
      setNewChatText('');
      setNewChatTags(['New Lead']);
      setNewCustomTagInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to send WhatsApp message');
    } finally {
      setNewChatLoading(false);
    }
  };

  const activeConversation = conversations.find(c => c.id === selectedConvId) || conversations[0];
  const messages = (activeConversation && messagesByConvId[activeConversation.id]) || [];

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length, selectedConvId]);

  const handleSelectConversation = (id: string) => {
    setSelectedConvId(id);
    navigateMobile('chat', id);
    if (onMarkConversationRead) {
      onMarkConversationRead(id);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !attachedImagePreview) || !activeConversation) return;
    onSendMessage(
      activeConversation.id,
      inputText.trim() || 'Image attachment',
      isNoteMode,
      attachedImagePreview || undefined
    );
    setInputText('');
    setAttachedImagePreview(null);
    setIsNoteMode(false);
  };

  const handleInsertCanned = (text: string) => {
    setInputText(prev => (prev ? `${prev} ${text}` : text));
    setShowCanned(false);
  };

  const handleDispatchTemplate = (tpl: Template) => {
    if (!activeConversation) return;
    let rendered = tpl.bodyJson?.body || (tpl as any).body || '';
    if (activeConversation.contact) {
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
    if (!expiresAt) return { expired: true, text: 'Session Expired', hours: 0, percent: 0 };
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { expired: true, text: 'Session Expired', hours: 0, percent: 0 };
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const percent = Math.min(100, Math.round((diff / (24 * 3600000)) * 100));
    return {
      expired: false,
      text: `${hours}h ${mins}m left`,
      hours,
      percent,
    };
  };

  const myName = currentUser?.name || 'Admin';

  const isMine = (c: Conversation) => {
    if (!c.assignedAgent || c.assignedAgent === 'Unassigned') return false;
    return (
      c.assignedAgent === myName ||
      c.assignedAgent === currentUser?.name ||
      c.assignedAgent === currentUser?.email
    );
  };

  const filteredConversations = conversations.filter(c => {
    const lastContent = c.lastMessage?.content || '';
    const matchesSearch =
      c.contact.displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.phone.includes(search) ||
      lastContent.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'ALL') return true;
    if (filter === 'UNREAD') return c.unreadCount > 0;
    if (filter === 'MINE') return isMine(c);
    if (filter === 'RESOLVED') return c.status === 'RESOLVED';
    return true;
  });

  const windowState = activeConversation ? getWindowStatus(activeConversation.windowExpiresAt) : null;
  const filteredCanned = cannedList.filter(
    c => c.label.toLowerCase().includes(cannedSearch.toLowerCase()) || c.text.toLowerCase().includes(cannedSearch.toLowerCase())
  );

  return (
    <div className={`wa-inbox-container mobile-${mobileView}`}>
      {/* Left Column: WhatsApp Chat List */}
      <div
        className="wa-sidebar-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* WhatsApp Web Style Top Header */}
        <div className="wa-sidebar-header">
          <div className="wa-sidebar-header-left">
            {onToggleMobileSidebar && (
              <button
                className="wa-icon-btn wa-mobile-hamburger-btn"
                onClick={onToggleMobileSidebar}
                title="Open Navigation Menu"
                type="button"
                aria-label="Open Navigation Menu"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#54656f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <span className="wa-header-title">Chats</span>
          </div>

          <div className="wa-header-actions">
            {/* New Chat Button (Iconic WhatsApp speech bubble icon) */}
            <button
              className="wa-icon-btn"
              onClick={() => {
                setShowNewChatModal(true);
                if (typeof window !== 'undefined') window.history.pushState({ fgsnModal: true }, '');
              }}
              title="New Chat"
              type="button"
            >
              <NewChatIcon size={20} color="#54656f" />
            </button>

            {/* Authentic WhatsApp Options Menu Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                className={`wa-icon-btn ${showMenuDropdown ? 'active' : ''}`}
                onClick={() => setShowMenuDropdown(prev => !prev)}
                title="Menu"
                type="button"
                aria-label="Menu"
              >
                <MenuDotsIcon size={20} color="#54656f" />
              </button>

              {showMenuDropdown && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setShowMenuDropdown(false)}
                  />
                  <div className="wa-header-menu-dropdown">
                    <button
                      type="button"
                      className="wa-menu-item"
                      onClick={() => {
                        setShowMenuDropdown(false);
                        setShowNewChatModal(true);
                      }}
                    >
                      <span>New chat</span>
                    </button>
                    <button
                      type="button"
                      className="wa-menu-item"
                      onClick={() => {
                        setShowMenuDropdown(false);
                        setFilter('ALL');
                      }}
                    >
                      <span>All chats</span>
                    </button>
                    <button
                      type="button"
                      className="wa-menu-item"
                      onClick={() => {
                        setShowMenuDropdown(false);
                        setFilter('UNREAD');
                      }}
                    >
                      <span>Unread chats</span>
                    </button>
                    {activeConversation && (
                      <button
                        type="button"
                        className="wa-menu-item"
                        onClick={() => {
                          setShowMenuDropdown(false);
                          setShowInboundModal(true);
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🧪 Simulate Inbound Reply</span>
                          <span style={{ fontSize: 10, background: '#e9edef', color: '#54656f', padding: '1px 5px', borderRadius: 4 }}>Dev</span>
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="wa-menu-item"
                      onClick={() => {
                        setShowMenuDropdown(false);
                        window.location.hash = 'settings';
                      }}
                    >
                      <span>WABA Settings</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* WhatsApp Search Bar */}
        <div className="wa-search-section">
          <div className="wa-search-bar">
            <SearchIcon size={16} color="#54656f" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="wa-search-input"
            />
            {search && (
              <button
                className="wa-clear-search-btn"
                onClick={() => setSearch('')}
                title="Clear"
                type="button"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Authentic WhatsApp Filter Chips (All, Unread, Mine, Resolved) */}
        <div className="wa-filter-chips">
          <button
            className={`wa-chip ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
            type="button"
          >
            All
          </button>
          <button
            className={`wa-chip ${filter === 'UNREAD' ? 'active' : ''}`}
            onClick={() => setFilter('UNREAD')}
            type="button"
          >
            Unread
            {conversations.filter(c => c.unreadCount > 0).length > 0 && (
              <span className="wa-chip-count">({conversations.filter(c => c.unreadCount > 0).length})</span>
            )}
          </button>
          <button
            className={`wa-chip ${filter === 'MINE' ? 'active' : ''}`}
            onClick={() => setFilter('MINE')}
            type="button"
          >
            Assigned to me
          </button>
          <button
            className={`wa-chip ${filter === 'RESOLVED' ? 'active' : ''}`}
            onClick={() => setFilter('RESOLVED')}
            type="button"
          >
            Resolved
          </button>
        </div>

        {/* WhatsApp Chat List */}
        <div className="wa-chat-list" ref={chatListRef} onScroll={handleChatListScroll}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#667781' }}>
              <div style={{ marginBottom: 16 }}>
                <WhatsAppLogoIcon size={48} color="#8696a0" />
              </div>
              <p style={{ fontSize: 16, fontWeight: 500, color: '#111b21', margin: '0 0 6px' }}>
                {search ? 'No chats found' : 'No chats yet'}
              </p>
              <p style={{ fontSize: 13.5, color: '#667781', lineHeight: 1.5, margin: '0 0 20px' }}>
                {search
                  ? `No conversations match "${search}".`
                  : 'Start a new conversation or test with a sample client chat.'}
              </p>
              {search ? (
                <button
                  className="wa-chip active"
                  style={{ padding: '0 16px', margin: '0 auto' }}
                  onClick={() => setSearch('')}
                  type="button"
                >
                  Clear search
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 220, margin: '0 auto' }}>
                  <button
                    className="wa-chip active"
                    style={{ justifyContent: 'center', height: 36, background: '#008069', color: '#ffffff' }}
                    onClick={() => {
                      setShowNewChatModal(true);
                      if (typeof window !== 'undefined') window.history.pushState({ fgsnModal: true }, '');
                    }}
                    type="button"
                  >
                    Start New Chat
                  </button>
                  {onStartNewChat && (
                    <button
                      className="wa-chip"
                      style={{ justifyContent: 'center', height: 36 }}
                      onClick={handleSeedDemoChat}
                      type="button"
                    >
                      Load Demo Client Chat
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = activeConversation && conv.id === activeConversation.id;
              const isOutbound = conv.lastMessage?.direction === 'OUTBOUND';
              const isRead = conv.lastMessage?.status === 'READ';

              return (
                <div
                  key={conv.id}
                  className={`wa-chat-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  {/* Contact Avatar */}
                  <div className="wa-avatar-wrap">
                    {conv.contact.avatarUrl ? (
                      <img src={conv.contact.avatarUrl} alt={conv.contact.displayName} className="wa-avatar-img" />
                    ) : (
                      <UserAvatarPlaceholder size={49} />
                    )}
                  </div>

                  {/* Contact Text Content */}
                  <div className="wa-chat-content">
                    <div className="wa-chat-top-row">
                      <div className="wa-contact-title">
                        <span>{conv.contact.displayName}</span>
                        <VerifiedBadgeIcon size={14} />
                      </div>
                      <span className="wa-chat-time">
                        {conv.lastMessage?.timestamp
                          ? new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    <div className="wa-chat-bottom-row">
                      <div className="wa-message-preview">
                        {isOutbound && (
                          <DoubleCheckIcon isRead={isRead} size={15} />
                        )}
                        <span>{conv.lastMessage?.content || 'Started conversation'}</span>
                      </div>

                      {conv.unreadCount > 0 && !isSelected && (
                        <span className="wa-unread-badge">{conv.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile Floating Action Button (FAB) */}
        <button
          className="wa-fab-btn"
          onClick={() => {
            setShowNewChatModal(true);
            if (typeof window !== 'undefined') window.history.pushState({ fgsnModal: true }, '');
          }}
          title="Start New Chat"
          type="button"
        >
          <NewChatIcon size={24} color="#ffffff" />
        </button>
      </div>

      {/* Center Column: WhatsApp Chat Pane */}
      {activeConversation ? (
        <div
          className="wa-chat-pane mobile-touch-pane wa-chat-wallpaper"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: isSwiping && swipeOffset > 0 && (mobileView === 'chat' || mobileView === 'crm') ? `translateX(${swipeOffset}px)` : undefined,
          }}
        >
          {/* Chat Header */}
          <div className="wa-chat-header">
            <div
              className="wa-chat-header-user"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= SINGLE_PANE_MAX) {
                  navigateMobile('crm');
                } else {
                  setShowContactInfo(prev => !prev);
                }
              }}
              style={{ cursor: 'pointer' }}
              title="Click to toggle Contact info"
            >
              <button
                className="wa-icon-btn mobile-back-touch-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGoBackFromChat();
                }}
                title="Back to Chats (or swipe right)"
                type="button"
              >
                <BackArrowIcon size={22} color="#54656f" />
              </button>

              <div className="wa-header-avatar">
                {activeConversation.contact.avatarUrl ? (
                  <img src={activeConversation.contact.avatarUrl} alt={activeConversation.contact.displayName} className="wa-avatar-img" />
                ) : (
                  <UserAvatarPlaceholder size={40} />
                )}
              </div>

              <div className="wa-header-info">
                <div className="wa-header-name">
                  <span>{activeConversation.contact.displayName}</span>
                  <VerifiedBadgeIcon size={15} />
                </div>
                <span className="wa-header-sub">
                  +{activeConversation.contact.phone.replace(/[^0-9]/g, '')} &bull; {windowState?.expired ? 'session expired' : 'active 24h'}
                </span>
              </div>
            </div>

            <div className="wa-header-actions">
              {/* Voice & Video Call Stubs */}
              <button className="wa-icon-btn hide-on-compact" title="Start Call" type="button">
                <PhoneCallIcon size={19} color="#54656f" />
              </button>
              <button className="wa-icon-btn hide-on-compact" title="Video Call" type="button">
                <VideoCallIcon size={20} color="#54656f" />
              </button>

              {/* View CRM Details */}
              <button
                className={`wa-icon-btn ${showContactInfo ? 'active' : ''}`}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth <= SINGLE_PANE_MAX) {
                    navigateMobile('crm');
                  } else {
                    setShowContactInfo(prev => !prev);
                  }
                }}
                title="Toggle Contact Info"
                type="button"
              >
                <ContactsNavIcon size={20} color={showContactInfo ? '#008069' : '#54656f'} />
              </button>

              {/* Status Toggle (Resolve / Reopen) */}
              <button
                className="wa-chip"
                style={{
                  height: 28,
                  fontSize: 12,
                  padding: '0 10px',
                  background: activeConversation.status === 'RESOLVED' ? '#e9edef' : '#e7fce3',
                  color: activeConversation.status === 'RESOLVED' ? '#54656f' : '#008069',
                }}
                onClick={() => onToggleResolve && onToggleResolve(activeConversation.id)}
                type="button"
              >
                {activeConversation.status === 'RESOLVED' ? 'Reopen' : 'Resolve'}
              </button>
            </div>
          </div>

          {/* 24-Hour Policy Window Alert */}
          {windowState && (
            <div className={`wa-window-notice ${!windowState.expired ? 'active-window' : ''}`}>
              <span>
                {windowState.expired
                  ? '24-hour customer service window expired. Outbound replies require an approved template.'
                  : `Customer care session active: ${windowState.text}`}
              </span>
              {windowState.expired && (
                <button
                  className="wa-chip active"
                  style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                  onClick={() => setShowTemplateModal(true)}
                  type="button"
                >
                  Send Template
                </button>
              )}
            </div>
          )}

          {/* Chat Messages Scroll List */}
          <div className="wa-messages-scroll" ref={chatMessagesRef}>
            {/* Centered Date Badge */}
            <div className="wa-date-pill-wrap">
              <span className="wa-date-pill">Today</span>
            </div>

            {messages.map((msg) => {
              if (msg.isInternalNote) {
                return (
                  <div key={msg.id} className="wa-internal-note">
                    <div className="wa-note-header">
                      <span><LockIcon size={12} color="#b45309" /> Internal Team Note &bull; {msg.authorName || 'Team'}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="wa-note-body">{msg.content}</p>
                  </div>
                );
              }

              const isOutbound = msg.direction === 'OUTBOUND';
              const isRead = msg.status === 'READ';

              const isMediaUrlImg = !!msg.mediaUrl && (
                /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(msg.mediaUrl) ||
                msg.mediaUrl.startsWith('/api/whatsapp/media/') ||
                msg.mediaUrl.startsWith('data:image/') ||
                msg.mediaUrl.includes('images.unsplash.com')
              );
              const isContentImg = !!msg.content && (
                /\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i.test(msg.content.trim()) ||
                msg.content.startsWith('data:image/') ||
                msg.content.includes('images.unsplash.com') ||
                msg.content.startsWith('/api/whatsapp/media/')
              );
              const imageUrl = msg.mediaUrl || (isContentImg ? msg.content.trim() : null);
              const hasImage = !!imageUrl || msg.mediaType === 'image';

              const caption = msg.content && msg.content !== imageUrl && !msg.content.startsWith('data:image/') && msg.content !== 'Image attachment' && msg.content !== '[IMAGE Message]'
                ? msg.content
                : null;

              return (
                <div key={msg.id} className={`wa-bubble-row ${isOutbound ? 'outbound' : 'inbound'}`}>
                  <div className={`wa-bubble ${isOutbound ? 'outbound-bubble' : 'inbound-bubble'} ${hasImage ? 'has-media' : ''}`}>
                    {/* Image Attachment Rendering */}
                    {hasImage && imageUrl && (
                      <div className="wa-bubble-media-wrap">
                        <img
                          src={imageUrl}
                          alt="WhatsApp Media"
                          className="wa-bubble-media-img"
                          loading="lazy"
                          onClick={() => window.open(imageUrl, '_blank')}
                        />
                      </div>
                    )}

                    {/* Message Content / Caption */}
                    {caption && <p className="wa-bubble-text" style={{ marginTop: hasImage ? 4 : 0 }}>{caption}</p>}
                    {!caption && !hasImage && <p className="wa-bubble-text">{msg.content}</p>}

                    {/* Meta line: Time + Checkmark */}
                    <div className="wa-bubble-meta">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isOutbound && (
                        <DoubleCheckIcon isRead={isRead} size={15} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies Picker Dropdown */}
          {showCanned && (
            <div
              style={{
                position: 'absolute',
                bottom: 64,
                left: 16,
                right: 16,
                maxWidth: 480,
                maxHeight: 280,
                background: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(11, 20, 26, 0.2)',
                border: '1px solid #e9edef',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 20,
              }}
            >
              <div style={{ padding: '10px 14px', background: '#f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e9edef' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111b21' }}>Quick Responses ({filteredCanned.length})</span>
                <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#667781', fontSize: 16 }} onClick={() => setShowCanned(false)}>✕</button>
              </div>
              <div style={{ padding: '6px 12px', borderBottom: '1px solid #e9edef' }}>
                <input
                  type="text"
                  placeholder="Search quick replies..."
                  value={cannedSearch}
                  onChange={e => setCannedSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, border: '1px solid #e9edef', borderRadius: 6, outline: 'none' }}
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                {filteredCanned.map((cr, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleInsertCanned(cr.text)}
                    style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f6f6' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f6f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <strong style={{ fontSize: 12.5, color: '#111b21', display: 'block' }}>{cr.label}</strong>
                    <span style={{ fontSize: 12, color: '#667781' }}>{cr.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WhatsApp Composer Bar */}
          <form className="wa-composer" onSubmit={handleSend}>
            {/* Mode switch: Team Note toggle */}
            <button
              className="wa-icon-btn"
              type="button"
              onClick={() => setIsNoteMode(!isNoteMode)}
              title={isNoteMode ? 'Switch to WhatsApp message' : 'Switch to internal note'}
              style={{ color: isNoteMode ? '#b45309' : '#54656f' }}
            >
              <LockIcon size={20} color={isNoteMode ? '#b45309' : '#54656f'} />
            </button>

            {/* Quick replies shortcut */}
            <button
              className="wa-icon-btn"
              type="button"
              onClick={() => setShowCanned(!showCanned)}
              title="Quick replies (/)"
            >
              <SmileyIcon size={22} color="#54656f" />
            </button>

            {/* Template dispatch button */}
            <button
              className="wa-icon-btn"
              type="button"
              onClick={() => setShowTemplateModal(true)}
              title="Send Approved WhatsApp Template"
            >
              <TemplateIcon size={20} color="#54656f" />
            </button>

            {/* Media Attachment Button */}
            <label className="wa-icon-btn" title="Attach Image" style={{ cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAttachImageFile}
              />
              <PaperclipIcon size={20} color={attachedImagePreview ? '#00a884' : '#54656f'} />
            </label>

            {/* Message Input Box & Attached Image Preview */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {attachedImagePreview && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#f0f2f5',
                  borderRadius: 8,
                  padding: '4px 8px',
                  width: 'fit-content'
                }}>
                  <img
                    src={attachedImagePreview}
                    alt="Preview"
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }}
                  />
                  <span style={{ fontSize: 12, color: '#54656f' }}>Image attached</span>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', fontSize: 14, padding: 2 }}
                    onClick={() => setAttachedImagePreview(null)}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="wa-composer-input-wrap" style={{ background: isNoteMode ? '#fffbeb' : '#ffffff', border: isNoteMode ? '1px solid #fef3c7' : 'none', width: '100%' }}>
                <textarea
                  rows={1}
                  placeholder={isNoteMode ? 'Write internal note for team...' : (attachedImagePreview ? 'Add a caption (optional)...' : 'Type a message')}
                  className="wa-composer-textarea"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
              </div>
            </div>

            {/* Circular Send Button */}
            <button
              type="submit"
              className="wa-send-circle-btn"
              title="Send message"
              disabled={!inputText.trim() && !attachedImagePreview}
              style={{
                opacity: (inputText.trim() || attachedImagePreview) ? 1 : 0.65,
                background: isNoteMode ? '#b45309' : '#00a884',
              }}
            >
              <SendIcon size={18} color="#ffffff" />
            </button>
          </form>
        </div>
      ) : (
        /* WhatsApp Desktop Empty State Screen */
        <div className="wa-desktop-empty">
          <div className="wa-desktop-illustration">
            <WhatsAppLogoIcon size={88} color="#00a884" />
          </div>
          <h2 className="wa-desktop-title">WhatsApp for Business</h2>
          <p className="wa-desktop-sub">
            Send and receive official Meta Cloud API customer messages seamlessly. Select a chat from the queue or start a new conversation.
          </p>
          <button
            className="wa-desktop-btn"
            onClick={() => {
              setShowNewChatModal(true);
              if (typeof window !== 'undefined') window.history.pushState({ fgsnModal: true }, '');
            }}
            type="button"
          >
            Start New Conversation
          </button>
          <div className="wa-encryption-footer">
            <LockIcon size={13} color="#8696a0" />
            <span>End-to-end encrypted with official WhatsApp Business Cloud API</span>
          </div>
        </div>
      )}

      {/* Right Column: Authentic WhatsApp Contact Info Panel */}
      {activeConversation && (showContactInfo || mobileView === 'crm') && (
        <div
          className="wa-crm-col mobile-touch-pane"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: isSwiping && swipeOffset > 0 && mobileView === 'crm' ? `translateX(${swipeOffset}px)` : undefined,
          }}
        >
          {/* WhatsApp Web Style Contact Info Header */}
          <div className="wa-crm-header">
            <button
              className="wa-icon-btn"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth <= SINGLE_PANE_MAX) {
                  handleGoBackFromCrm();
                } else {
                  setShowContactInfo(false);
                }
              }}
              title="Close Contact Info"
              type="button"
            >
              <CloseIcon size={18} color="#54656f" />
            </button>
            <span className="wa-crm-title">Contact info</span>
          </div>

          {/* Scrollable WhatsApp Cards */}
          <div className="wa-crm-scroll">
            {/* 1. Hero Profile Card */}
            <div className="wa-crm-card" style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 20 }}>
              <div className="wa-crm-avatar-hero">
                {activeConversation.contact.avatarUrl ? (
                  <img
                    src={activeConversation.contact.avatarUrl}
                    alt={activeConversation.contact.displayName}
                    className="wa-crm-avatar-img"
                  />
                ) : (
                  <UserAvatarPlaceholder size={96} />
                )}
              </div>

              <div className="wa-crm-hero-name">
                <span>{activeConversation.contact.displayName}</span>
                <VerifiedBadgeIcon size={16} />
              </div>

              <div className="wa-crm-hero-phone">
                <span>+{activeConversation.contact.phone.replace(/[^0-9]/g, '')}</span>
                <button
                  type="button"
                  className="wa-copy-btn"
                  title="Copy Phone Number"
                  onClick={() => {
                    navigator.clipboard?.writeText(activeConversation.contact.phone);
                  }}
                >
                  <CopyIcon size={13} color="#8696a0" />
                </button>
              </div>

              {/* WhatsApp Action Buttons */}
              <div className="wa-crm-action-bar">
                <button
                  className="wa-crm-circle-btn"
                  type="button"
                  title="Voice Call"
                  onClick={() => onSendMessage(activeConversation.id, '📞 Attempted WhatsApp voice call', true)}
                >
                  <div className="wa-crm-circle-icon">
                    <PhoneCallIcon size={17} color="#008069" />
                  </div>
                  <span className="wa-crm-circle-label">Audio</span>
                </button>

                <button
                  className="wa-crm-circle-btn"
                  type="button"
                  title="Video Call"
                  onClick={() => onSendMessage(activeConversation.id, '📹 Attempted WhatsApp video call', true)}
                >
                  <div className="wa-crm-circle-icon">
                    <VideoCallIcon size={17} color="#008069" />
                  </div>
                  <span className="wa-crm-circle-label">Video</span>
                </button>

                <button
                  className="wa-crm-circle-btn"
                  type="button"
                  title="Search Chat"
                  onClick={() => setSearch(activeConversation.contact.displayName)}
                >
                  <div className="wa-crm-circle-icon">
                    <SearchIcon size={17} color="#008069" />
                  </div>
                  <span className="wa-crm-circle-label">Search</span>
                </button>
              </div>
            </div>

            {/* 2. Commercial Summary (ERP Data) */}
            <div className="wa-crm-card">
              <span className="wa-crm-card-title">Commercial Summary</span>
              <div className="wa-crm-metric-row">
                <div className="wa-crm-metric-box">
                  <span className="wa-crm-metric-lbl">Lifetime Value</span>
                  <span className="wa-crm-metric-val" style={{ color: '#008069' }}>
                    {formatCurrency(activeConversation.contact.lifetimeValue || 0, currency)}
                  </span>
                </div>
                <div className="wa-crm-metric-box">
                  <span className="wa-crm-metric-lbl">Total Orders</span>
                  <span className="wa-crm-metric-val">
                    {activeConversation.contact.totalOrders || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Customer Labels / Tags */}
            <div className="wa-crm-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TagIcon size={14} color="#667781" />
                <span className="wa-crm-card-title" style={{ margin: 0 }}>Labels</span>
              </div>
              <div className="wa-crm-tags-wrap">
                {activeConversation.contact.tags && activeConversation.contact.tags.length > 0 ? (
                  activeConversation.contact.tags.map((tag, i) => (
                    <span key={i} className="wa-crm-tag-chip">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 13, color: '#8696a0' }}>No labels assigned</span>
                )}
              </div>
            </div>

            {/* 4. One-Click Instant WhatsApp Messages */}
            <div className="wa-crm-card">
              <span className="wa-crm-card-title">Quick Actions</span>
              <div className="wa-crm-actions-col">
                <button
                  type="button"
                  className="wa-crm-msg-btn"
                  onClick={() => onSendMessage(activeConversation.id, `Hello ${activeConversation.contact.displayName}, here is your order tracking link: https://fgsnlive.com/track`, false)}
                >
                  <ChatsNavIcon size={16} color="#00a884" />
                  <span>Send Order Tracking Link</span>
                </button>
                <button
                  type="button"
                  className="wa-crm-msg-btn"
                  onClick={() => onSendMessage(activeConversation.id, `Special VIP offer for you ${activeConversation.contact.displayName}: Use code *FGSN20* for 20% off today: https://fgsnlive.com`, false)}
                >
                  <ChatsNavIcon size={16} color="#00a884" />
                  <span>Send FGSN20 Promo Code</span>
                </button>
                <button
                  type="button"
                  className="wa-crm-msg-btn"
                  onClick={() => onSendMessage(activeConversation.id, `Hello ${activeConversation.contact.displayName}, you can complete payment securely here: https://pay.fgsnlive.com/checkout`, false)}
                >
                  <ChatsNavIcon size={16} color="#00a884" />
                  <span>Send Payment Link</span>
                </button>
              </div>
            </div>

            {/* 5. End-to-End Encryption & Security */}
            <div className="wa-crm-card">
              <div className="wa-crm-security-row">
                <LockIcon size={16} color="#8696a0" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111b21', marginBottom: 2 }}>
                    End-to-end encrypted
                  </div>
                  <div style={{ fontSize: 12, color: '#8696a0', lineHeight: 1.4 }}>
                    Messages and calls are secured with official Meta Cloud API Enterprise encryption.
                  </div>
                </div>
              </div>
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
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 14,
                fontSize: '0.8rem',
                color: '#166534',
                lineHeight: 1.45,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start'
              }}>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>🧪</span>
                <div>
                  <strong>Developer Sandbox Tool:</strong> In production, customer replies arrive automatically via Meta WhatsApp Cloud API webhooks. Use this simulator to test incoming message flows, bots, and the 24-hour customer care window reset.
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: 12 }}>
                Select a standard inquiry preset or type a custom customer message:
              </p>

              <div className="inbound-presets-list">
                {INBOUND_SIMULATION_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`preset-pill-btn ${customInboundText === preset ? 'active' : ''}`}
                    style={customInboundText === preset ? { borderColor: '#008069', background: '#e7fce3', color: '#008069', fontWeight: 600 } : {}}
                    onClick={() => setCustomInboundText(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <label>Or customize the customer response:</label>
                <input
                  type="text"
                  placeholder="e.g. Can I change my shipping address?"
                  className="form-input"
                  value={customInboundText}
                  onChange={(e) => setCustomInboundText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customInboundText.trim()) {
                      e.preventDefault();
                      handleTriggerInboundPreset(customInboundText.trim());
                    }
                  }}
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
                <p className="modal-subtitle">Directly dispatch a pre-approved template message</p>
              </div>
              <button className="close-btn" onClick={() => setShowTemplateModal(false)}>✕</button>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
              {templates.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: '0.86rem' }}>No approved templates found in Template Studio.</p>
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
                    <p className="tpl-pick-body">{tpl.bodyJson?.body || (tpl as any).body}</p>
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
                Dispatch Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start New Conversation Modal */}
      {showNewChatModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="wa-modal-card" style={{ maxWidth: 500, width: '92%' }}>
            <div className="wa-modal-header">
              <div>
                <h3 className="wa-modal-title">New WhatsApp Chat</h3>
                <p className="wa-modal-subtitle">Start a conversation or send an approved Meta template</p>
              </div>
              <button
                className="wa-modal-close-btn"
                onClick={() => setShowNewChatModal(false)}
                type="button"
                title="Close"
              >
                <CloseIcon size={18} color="#54656f" />
              </button>
            </div>

            <form onSubmit={handleStartNewChatSubmit} className="wa-modal-form">
              {/* Recipient Phone with Default Country Code Selection */}
              <div className="wa-form-group">
                <label className="wa-form-label">
                  Recipient WhatsApp Phone Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="wa-phone-input-row">
                  <select
                    className="wa-country-select"
                    value={newCountryCode}
                    onChange={(e) => handleCountryCodeChange(e.target.value)}
                    title="Select Country Code"
                  >
                    {POPULAR_COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.name})
                      </option>
                    ))}
                  </select>

                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    required
                    placeholder={POPULAR_COUNTRY_CODES.find(c => c.code === newCountryCode)?.sampleDigits || 'Phone number'}
                    className={`wa-phone-number-input ${existingConversation ? 'has-warning' : ''}${phoneValidation.status === 'invalid' ? ' has-error' : ''}`}
                    value={newChatPhone}
                    onChange={handlePhoneInputChange}
                    aria-invalid={phoneValidation.status === 'invalid'}
                    aria-describedby="new-chat-phone-msg"
                    autoFocus
                  />
                </div>

                {/* Duplicate Contact Prevention Alert */}
                {existingConversation && (
                  <div className="wa-duplicate-alert">
                    <div className="wa-duplicate-alert-content">
                      <span className="wa-duplicate-alert-icon">⚠️</span>
                      <div>
                        <strong>Contact already exists:</strong> {existingConversation.contact.displayName} (+{existingConversation.contact.phone}).
                        <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 2 }}>
                          Same contact cannot be added twice. Click below to open their existing chat.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="wa-duplicate-action-btn"
                      onClick={() => handleOpenExistingChat(existingConversation.id)}
                    >
                      Open Existing Chat
                    </button>
                  </div>
                )}

                <span
                  id="new-chat-phone-msg"
                  role="status"
                  className={`wa-form-hint wa-phone-msg${phoneHasDigits ? (phoneValidation.status === 'valid' ? ' is-ok' : phoneValidation.status === 'invalid' ? ' is-bad' : '') : ''}`}
                >
                  {!phoneHasDigits
                    ? `Enter the customer’s mobile number. The ${POPULAR_COUNTRY_CODES.find(c => c.code === newCountryCode)?.name} code (${newCountryCode}) is added for you.`
                    : phoneValidation.isValid
                      ? `${phoneValidation.message}. Will be sent to +${normalizedPhone}`
                      : phoneValidation.message}
                </span>
              </div>

              {/* Contact Name (Optional) */}
              <div className="wa-form-group">
                <label className="wa-form-label">Contact Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  className="wa-modal-input"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                />
              </div>

              {/* Tags & Labels Selection */}
              <div className="wa-form-group">
                <label className="wa-form-label">Customer Tags & Labels</label>
                <div className="wa-tags-selector">
                  {['New Lead', 'VIP Client', 'Support', 'Sports Fan', 'Pass Holder', 'Hot Lead'].map(tag => {
                    const isSelected = newChatTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        className={`wa-tag-pill-btn ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleToggleTag(tag)}
                      >
                        {isSelected ? '✓ ' : '+ '}{tag}
                      </button>
                    );
                  })}
                  {/* Custom tag chips that aren't in preset */}
                  {newChatTags.filter(t => !['New Lead', 'VIP Client', 'Support', 'Sports Fan', 'Pass Holder', 'Hot Lead'].includes(t)).map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="wa-tag-pill-btn selected custom"
                      onClick={() => handleToggleTag(tag)}
                      title="Click to remove tag"
                    >
                      ✓ {tag} ✕
                    </button>
                  ))}
                </div>

                <div className="wa-add-custom-tag-row">
                  <input
                    type="text"
                    placeholder="Add custom tag (e.g. Tournament VIP)..."
                    className="wa-custom-tag-input"
                    value={newCustomTagInput}
                    onChange={(e) => setNewCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="wa-add-tag-btn"
                    onClick={handleAddCustomTag}
                    disabled={!newCustomTagInput.trim()}
                  >
                    Add Tag
                  </button>
                </div>
              </div>

              {/* Message Type */}
              <div className="wa-form-group">
                <label className="wa-form-label">Message Type</label>
                <select
                  className="wa-modal-input"
                  value={newChatMsgType}
                  onChange={(e) => setNewChatMsgType(e.target.value as any)}
                >
                  <option value="TEMPLATE">Approved Meta Template (Recommended for 1st message)</option>
                  <option value="TEXT">Direct Text Message</option>
                </select>
              </div>

              {newChatMsgType === 'TEMPLATE' ? (
                <div className="wa-form-group">
                  <label className="wa-form-label">Select Meta Template</label>
                  <select
                    className="wa-modal-input"
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
                <div className="wa-form-group">
                  <label className="wa-form-label">Message Text</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Type your WhatsApp message..."
                    className="wa-modal-textarea"
                    value={newChatText}
                    onChange={(e) => setNewChatText(e.target.value)}
                  />
                </div>
              )}

              {/* Modal Actions */}
              <div className="wa-modal-actions">
                <button
                  type="button"
                  className="wa-modal-cancel-btn"
                  onClick={() => setShowNewChatModal(false)}
                >
                  Cancel
                </button>

                {existingConversation ? (
                  <button
                    type="button"
                    className="wa-modal-submit-btn"
                    style={{ background: '#008069' }}
                    onClick={() => handleOpenExistingChat(existingConversation.id)}
                  >
                    Open Existing Chat
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="wa-modal-submit-btn"
                    disabled={newChatLoading || !phoneValidation.isValid}
                  >
                    {newChatLoading ? 'Sending...' : 'Send Message'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
