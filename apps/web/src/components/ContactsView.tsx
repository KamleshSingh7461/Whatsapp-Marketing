import React, { useState } from 'react';
import { Contact, RFMSegment, Template, User } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { canManageContacts } from '../lib/permissions';
import { BulkContactUploadModal } from './BulkContactUploadModal';

export const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 India (+91)' },
  { code: '+1', label: '🇺🇸 US / Canada (+1)' },
  { code: '+44', label: '🇬🇧 UK (+44)' },
  { code: '+971', label: '🇦🇪 UAE (+971)' },
  { code: '+966', label: '🇸🇦 Saudi Arabia (+966)' },
  { code: '+65', label: '🇸🇬 Singapore (+65)' },
  { code: '+61', label: '🇦🇺 Australia (+61)' },
  { code: '+49', label: '🇩🇪 Germany (+49)' },
  { code: '+33', label: '🇫🇷 France (+33)' },
  { code: '+34', label: '🇪🇸 Spain (+34)' },
];

export function cleanPhoneWithCountry(countryCode: string, rawPhone: string): string {
  let digits = rawPhone.replace(/[^\d]/g, '');
  if (!digits) return '';
  const prefixDigits = countryCode.replace(/[^\d]/g, '');
  
  if (digits.length === 10) {
    return `+${prefixDigits}${digits}`;
  }
  if (digits.startsWith(prefixDigits) && digits.length > prefixDigits.length) {
    return `+${digits}`;
  }
  return `+${prefixDigits}${digits}`;
}

interface ContactsViewProps {
  contacts: Contact[];
  templates?: Template[];
  currency?: CurrencyCode;
  currentUser?: User | null;
  onAddContact: (contact: Contact) => void;
  onUpdateContact?: (contact: Contact) => void;
  onBulkAddContacts?: (contacts: Contact[]) => void;
  onStartChat?: (contact: Contact) => void;
  onAutoCategorizeContacts?: () => void;
  onDirectSendTemplate?: (contact: Contact, template: Template) => Promise<{ success?: boolean; error?: string } | void>;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  templates = [],
  currency = 'INR',
  currentUser,
  onAddContact,
  onUpdateContact,
  onBulkAddContacts,
  onStartChat,
  onAutoCategorizeContacts,
  onDirectSendTemplate,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRfm, setSelectedRfm] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Extract all existing unique tags dynamically
  const allExistingTags = Array.from(
    new Set([
      'VIP Customers',
      'High Intent',
      'Frequent Buyer',
      'New Lead',
      'Internal Team',
      'Batch 1: Contacts 1 - 500',
      'Batch 2: Contacts 501 - 1000',
      'Batch 3: Contacts 1001 - 2000',
      'Batch 4: Contacts 2001 - 3000',
      ...contacts.flatMap(c => c.tags || [])
    ])
  ).filter(Boolean);

  // Form states for Add Contact
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['New Lead']);
  const [newCustomTag, setNewCustomTag] = useState('');

  // Form states for Edit Contact
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('+91');
  const [editPhone, setEditPhone] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editRfm, setEditRfm] = useState<RFMSegment>('NEW_LEADS');
  const [editOptedIn, setEditOptedIn] = useState(true);
  const [editNewCustomTag, setEditNewCustomTag] = useState('');

  // Direct Template Modal states
  const [directTplContact, setDirectTplContact] = useState<Contact | null>(null);
  const [selectedTplId, setSelectedTplId] = useState<string>(templates[0]?.id || '');
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [directFeedback, setDirectFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleExportCsv = () => {
    if (contacts.length === 0) {
      alert('No contacts to export.');
      return;
    }
    const headers = ['Customer Name', 'WhatsApp Phone', 'Cohort', 'Opt-In Status', 'Source', 'Audience Tags', 'Lifetime Value', 'Total Orders', 'Last Active'];
    const rows = contacts.map(c => [
      `"${(c.displayName || '').replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.rfmSegment || 'NEW_LEADS'}"`,
      c.optedIn ? 'Opted In' : 'Opted Out',
      `"${c.optInSource || 'ORGANIC_INBOUND'}"`,
      `"${(c.tags || []).join(', ')}"`,
      c.lifetimeValue || 0,
      c.totalOrders || 0,
      c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleDateString() : '',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FGSN_Contacts_CRM_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesRfm = selectedRfm === 'ALL' || c.rfmSegment === selectedRfm;
    return matchesSearch && matchesRfm;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    const formattedPhone = cleanPhoneWithCountry(countryCode, phone.trim());

    const finalTags = Array.from(new Set([
      ...selectedTags,
      ...(newCustomTag.trim() ? [newCustomTag.trim()] : [])
    ]));

    const newContact: Contact = {
      id: `cnt_${Date.now()}`,
      displayName: name.trim(),
      phone: formattedPhone,
      optedIn: true,
      optedInAt: new Date().toISOString(),
      optInSource: 'ORGANIC_INBOUND',
      tags: finalTags.length > 0 ? finalTags : ['New Lead'],
      rfmSegment: 'NEW_LEADS',
      lifetimeValue: 0,
      totalOrders: 0,
      lastActiveAt: new Date().toISOString(),
    };

    onAddContact(newContact);
    setIsModalOpen(false);
    setName('');
    setPhone('');
    setCountryCode('+91');
    setSelectedTags(['New Lead']);
    setNewCustomTag('');
  };

  const handleStartEdit = (contact: Contact) => {
    setEditingContact(contact);
    setEditName(contact.displayName);
    
    // Detect country code
    let cCode = '+91';
    let pNum = contact.phone;
    if (contact.phone.startsWith('+')) {
      const matched = COUNTRY_CODES.find(c => contact.phone.startsWith(c.code));
      if (matched) {
        cCode = matched.code;
        pNum = contact.phone.slice(matched.code.length);
      }
    }
    setEditCountryCode(cCode);
    setEditPhone(pNum);
    setEditTags(contact.tags || []);
    setEditRfm(contact.rfmSegment || 'NEW_LEADS');
    setEditOptedIn(contact.optedIn ?? true);
    setEditNewCustomTag('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editName.trim() || !editPhone.trim()) return;

    const formattedPhone = cleanPhoneWithCountry(editCountryCode, editPhone.trim());
    const finalTags = Array.from(new Set([
      ...editTags,
      ...(editNewCustomTag.trim() ? [editNewCustomTag.trim()] : [])
    ]));

    const updated: Contact = {
      ...editingContact,
      displayName: editName.trim(),
      phone: formattedPhone,
      tags: finalTags,
      rfmSegment: editRfm,
      optedIn: editOptedIn,
    };

    if (onUpdateContact) {
      onUpdateContact(updated);
    }
    setEditingContact(null);
  };

  const getRfmBadge = (segment?: RFMSegment) => {
    switch (segment) {
      case 'CHAMPIONS':
        return <span className="rfm-badge rfm-vip">VIP Tier 1</span>;
      case 'LOYAL_CUSTOMERS':
        return <span className="rfm-badge rfm-loyal">Frequent Buyer</span>;
      case 'POTENTIAL_LOYALIST':
        return <span className="rfm-badge rfm-potential">High Intent</span>;
      case 'AT_RISK':
        return <span className="rfm-badge rfm-risk">At Risk</span>;
      default:
        return <span className="rfm-badge rfm-new">New Lead</span>;
    }
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'WEBSITE_CHECKOUT':
        return 'Online Checkout';
      case 'CLICK_TO_WHATSAPP_AD':
        return 'Meta Ad Click';
      case 'QR_CODE':
        return 'Retail QR Code';
      default:
        return 'Organic Inbound';
    }
  };

  return (
    <div className="view-container">
      <div className="page-header-row">
        <div>
          <h2 className="view-title">Audience & Contact CRM</h2>
          <p className="view-subtitle">
            Manage verified WhatsApp opt-ins, purchase history, and RFM value segments
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canManageContacts(currentUser?.role) && (
            <>
              <button className="btn-secondary" onClick={handleExportCsv} title="Export all contacts to CSV">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
              <button className="btn-secondary" onClick={() => setIsBulkModalOpen(true)} title="Bulk upload contacts via CSV, TSV, or Meta Lead Ads export">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Bulk Upload
              </button>
              {onAutoCategorizeContacts && (
                <button
                  className="btn-secondary"
                  onClick={onAutoCategorizeContacts}
                  style={{ background: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857', fontWeight: 700 }}
                  title="Auto categorize imported contacts into 500-1000 batch chunks and VIP / Internal Team cohorts"
                >
                  ⚡ Auto-Categorize 3,000 Contacts
                </button>
              )}
            </>
          )}
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Contact
          </button>
        </div>
      </div>

      {/* Highlights Grid */}
      {(() => {
        const vipContacts = contacts.filter(c => c.rfmSegment === 'CHAMPIONS');
        const avgVipLtv = vipContacts.length > 0 ? Math.round(vipContacts.reduce((a, c) => a + (c.lifetimeValue || 0), 0) / vipContacts.length) : 0;
        const loyalContacts = contacts.filter(c => c.rfmSegment === 'LOYAL_CUSTOMERS');
        const avgLoyalLtv = loyalContacts.length > 0 ? Math.round(loyalContacts.reduce((a, c) => a + (c.lifetimeValue || 0), 0) / loyalContacts.length) : 0;
        const highIntent = contacts.filter(c => c.rfmSegment === 'POTENTIAL_LOYALIST');
        const avgHighIntentLtv = highIntent.length > 0 ? Math.round(highIntent.reduce((a, c) => a + (c.lifetimeValue || 0), 0) / highIntent.length) : 0;
        const optedInCount = contacts.filter(c => c.optedIn).length;

        return (
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">VIP Tier 1 Avg LTV</span>
              </div>
              <div className="metric-primary-value text-primary-brand">{formatCurrency(avgVipLtv, currency)}</div>
              <div className="metric-footer-text">{vipContacts.length} VIP contacts enrolled</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Frequent Buyers Avg</span>
              </div>
              <div className="metric-primary-value">{formatCurrency(avgLoyalLtv, currency)}</div>
              <div className="metric-footer-text">{loyalContacts.length} loyal customers</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">High Intent Cart Avg</span>
              </div>
              <div className="metric-primary-value">{formatCurrency(avgHighIntentLtv, currency)}</div>
              <div className="metric-footer-text">{highIntent.length} potential buyers</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Verified Opt-In Contacts</span>
              </div>
              <div className="metric-primary-value">{optedInCount} / {contacts.length}</div>
              <div className="metric-footer-text">WhatsApp compliant opt-ins</div>
            </div>
          </div>
        );
      })()}

      {/* Filter and Search Bar */}
      <div className="panel-card" style={{ marginBottom: 16 }}>
        <div className="crm-filter-bar">
          <div className="search-bar-wrap" style={{ flex: 1 }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Filter by customer name, phone or attribute..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="chat-search-input"
            />
          </div>

          <div className="tag-filter-pills">
            <button className={`tag-filter-btn ${selectedRfm === 'ALL' ? 'active' : ''}`} onClick={() => setSelectedRfm('ALL')}>
              All ({contacts.length})
            </button>
            <button className={`tag-filter-btn ${selectedRfm === 'CHAMPIONS' ? 'active' : ''}`} onClick={() => setSelectedRfm('CHAMPIONS')}>
              VIP Tier 1
            </button>
            <button className={`tag-filter-btn ${selectedRfm === 'LOYAL_CUSTOMERS' ? 'active' : ''}`} onClick={() => setSelectedRfm('LOYAL_CUSTOMERS')}>
              Frequent Buyers
            </button>
            <button className={`tag-filter-btn ${selectedRfm === 'POTENTIAL_LOYALIST' ? 'active' : ''}`} onClick={() => setSelectedRfm('POTENTIAL_LOYALIST')}>
              High Intent
            </button>
            <button className={`tag-filter-btn ${selectedRfm === 'NEW_LEADS' ? 'active' : ''}`} onClick={() => setSelectedRfm('NEW_LEADS')}>
              New Leads
            </button>
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="panel-card">
        <table className="corporate-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>WhatsApp Phone</th>
              <th>Cohort</th>
              <th>Opt-In Status</th>
              <th>Source</th>
              <th>Audience Tags</th>
              <th>Lifetime Value</th>
              <th>Orders</th>
              <th>Last Active</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: '#64748B', padding: '3rem 1rem' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>No contacts enrolled</p>
                  <span style={{ fontSize: '0.8rem' }}>Add verified WhatsApp opt-in numbers using "Add Contact" or import your customer list via CSV.</span>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="contact-cell">
                      <div className="avatar-sm">
                        {c.avatarUrl ? <img src={c.avatarUrl} alt={c.displayName} /> : c.displayName[0]}
                      </div>
                      <strong>{c.displayName}</strong>
                    </div>
                  </td>
                  <td><code>{c.phone}</code></td>
                  <td>{getRfmBadge(c.rfmSegment)}</td>
                  <td>
                    {c.optedIn ? (
                      <span className="status-chip success">Opted In</span>
                    ) : (
                      <span className="status-chip danger">Opted Out</span>
                    )}
                  </td>
                  <td>
                    <span className="text-secondary">{getSourceBadge(c.optInSource)}</span>
                  </td>
                  <td>
                    <div className="tags-flex">
                      {c.tags.map((t, i) => (
                        <span key={i} className="tag-pill-corporate">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <strong className="text-primary-brand">{formatCurrency(c.lifetimeValue || 0, currency)}</strong>
                  </td>
                  <td>{c.totalOrders || 0}</td>
                  <td>{c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn-secondary sm"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                        onClick={() => handleStartEdit(c)}
                        title={`Edit contact details and tags for ${c.displayName}`}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="btn-primary sm"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                        onClick={() => {
                          setDirectTplContact(c);
                          setDirectFeedback(null);
                        }}
                        title={`Send direct approved Meta WhatsApp template to ${c.displayName}`}
                      >
                        ⚡ Direct Template
                      </button>
                      <button
                        type="button"
                        className="btn-outline-sm"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 6 }}
                        onClick={() => onStartChat && onStartChat(c)}
                        title={`Open WhatsApp chat with ${c.displayName}`}
                      >
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                        Chat
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Direct Template Dispatch Modal */}
      {directTplContact && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Dispatch Direct Template Message</h3>
                <p className="modal-subtitle">Send approved Meta WhatsApp template to <strong>{directTplContact.displayName}</strong> (<code>{directTplContact.phone}</code>)</p>
              </div>
              <button className="close-btn" onClick={() => setDirectTplContact(null)}>✕</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const selectedTpl = templates.find(t => t.id === selectedTplId) || templates[0];
              if (!selectedTpl) {
                setDirectFeedback({ type: 'error', message: 'No template selected or available.' });
                return;
              }
              setIsSendingDirect(true);
              setDirectFeedback(null);
              try {
                if (onDirectSendTemplate) {
                  const res = await onDirectSendTemplate(directTplContact, selectedTpl);
                  if (res && (res as any).success === false) {
                    setDirectFeedback({ type: 'error', message: (res as any).error || 'Meta API failed to deliver template' });
                  } else {
                    setDirectFeedback({ type: 'success', message: `Template '${selectedTpl.name}' successfully sent to +${directTplContact.phone}!` });
                  }
                } else {
                  setDirectFeedback({ type: 'success', message: `Template '${selectedTpl.name}' dispatched!` });
                }
              } catch (err: any) {
                setDirectFeedback({ type: 'error', message: err.message || 'Dispatch error' });
              } finally {
                setIsSendingDirect(false);
              }
            }}>
              <div className="form-group">
                <label>Recipient Contact</label>
                <input
                  type="text"
                  disabled
                  value={`${directTplContact.displayName} • ${directTplContact.phone}`}
                  className="form-input"
                  style={{ background: '#F8FAFC' }}
                />
              </div>

              <div className="form-group">
                <label>Approved WhatsApp Template</label>
                <select
                  value={selectedTplId}
                  onChange={(e) => setSelectedTplId(e.target.value)}
                  className="form-input"
                >
                  {templates.length === 0 ? (
                    <option value="tpl_default">Direct Marketing Broadcast (Standard Rate)</option>
                  ) : (
                    templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category} - {t.language})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {directFeedback && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 12,
                  background: directFeedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                  color: directFeedback.type === 'success' ? '#047857' : '#DC2626',
                  border: `1px solid ${directFeedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                }}>
                  {directFeedback.type === 'success' ? '✓ ' : '⚠️ '}
                  {directFeedback.message}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setDirectTplContact(null)}>Close</button>
                <button type="submit" className="btn-primary" disabled={isSendingDirect}>
                  {isSendingDirect ? '⏳ Sending to Meta Cloud API...' : '⚡ Send Direct Template Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add New Contact</h3>
                <p className="modal-subtitle">Enroll a verified WhatsApp phone number into your CRM</p>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Country Code + Phone Row */}
              <div className="form-group">
                <label>WhatsApp Phone Number *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="form-input"
                    style={{ width: 170, fontWeight: 600 }}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 87664 53551 (10-digit number)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                </div>
                <span className="field-hint" style={{ fontSize: '0.74rem', color: '#059669', marginTop: 4, display: 'block' }}>
                  Formatted: <code>{cleanPhoneWithCountry(countryCode, phone) || 'Select country & enter number'}</code>
                </span>
              </div>

              {/* Tag Multi-Select Picker Chips */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Select Audience Tags</label>
                  <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Click chips to toggle</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 8, marginBottom: 8, maxHeight: 130, overflowY: 'auto' }}>
                  {allExistingTags.map((t) => {
                    const isSelected = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTags(prev => prev.filter(x => x !== t));
                          } else {
                            setSelectedTags(prev => [...prev, t]);
                          }
                        }}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: 20,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #059669' : '1px solid #CBD5E1',
                          background: isSelected ? '#ECFDF5' : '#FFFFFF',
                          color: isSelected ? '#047857' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {t}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Tag Input */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Create a new custom tag..."
                    value={newCustomTag}
                    onChange={(e) => setNewCustomTag(e.target.value)}
                    className="form-input sm"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary sm"
                    onClick={() => {
                      if (newCustomTag.trim()) {
                        const tag = newCustomTag.trim();
                        if (!selectedTags.includes(tag)) {
                          setSelectedTags(prev => [...prev, tag]);
                        }
                        setNewCustomTag('');
                      }
                    }}
                  >
                    + Add Tag
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {editingContact && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Edit Contact Details & Tags</h3>
                <p className="modal-subtitle">Update information for <strong>{editingContact.displayName}</strong></p>
              </div>
              <button className="close-btn" onClick={() => setEditingContact(null)}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Customer Display Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Country Code + Phone Row */}
              <div className="form-group">
                <label>WhatsApp Phone Number *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={editCountryCode}
                    onChange={(e) => setEditCountryCode(e.target.value)}
                    className="form-input"
                    style={{ width: 170, fontWeight: 600 }}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                </div>
                <span className="field-hint" style={{ fontSize: '0.74rem', color: '#059669', marginTop: 4, display: 'block' }}>
                  Formatted: <code>{cleanPhoneWithCountry(editCountryCode, editPhone)}</code>
                </span>
              </div>

              {/* RFM Cohort & Opt-In Row */}
              <div className="form-row">
                <div className="form-group half">
                  <label>RFM Value Cohort</label>
                  <select
                    value={editRfm}
                    onChange={(e) => setEditRfm(e.target.value as RFMSegment)}
                    className="form-input"
                  >
                    <option value="NEW_LEADS">New Lead</option>
                    <option value="CHAMPIONS">VIP Tier 1 (Champions)</option>
                    <option value="LOYAL_CUSTOMERS">Frequent Buyer</option>
                    <option value="POTENTIAL_LOYALIST">High Intent</option>
                    <option value="AT_RISK">At Risk</option>
                  </select>
                </div>

                <div className="form-group half">
                  <label>WhatsApp Opt-In Status</label>
                  <select
                    value={editOptedIn ? 'OPTED_IN' : 'OPTED_OUT'}
                    onChange={(e) => setEditOptedIn(e.target.value === 'OPTED_IN')}
                    className="form-input"
                  >
                    <option value="OPTED_IN">Opted In (Subscribed)</option>
                    <option value="OPTED_OUT">Opted Out (Unsubscribed)</option>
                  </select>
                </div>
              </div>

              {/* Tag Multi-Select Picker Chips */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ margin: 0 }}>Manage Audience Tags ({editTags.length} selected)</label>
                  <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Click chips to toggle</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 8, marginBottom: 8, maxHeight: 140, overflowY: 'auto' }}>
                  {allExistingTags.map((t) => {
                    const isSelected = editTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setEditTags(prev => prev.filter(x => x !== t));
                          } else {
                            setEditTags(prev => [...prev, t]);
                          }
                        }}
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: 20,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #059669' : '1px solid #CBD5E1',
                          background: isSelected ? '#ECFDF5' : '#FFFFFF',
                          color: isSelected ? '#047857' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {t}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Tag Input */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Create and attach new custom tag..."
                    value={editNewCustomTag}
                    onChange={(e) => setEditNewCustomTag(e.target.value)}
                    className="form-input sm"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary sm"
                    onClick={() => {
                      if (editNewCustomTag.trim()) {
                        const tag = editNewCustomTag.trim();
                        if (!editTags.includes(tag)) {
                          setEditTags(prev => [...prev, tag]);
                        }
                        setEditNewCustomTag('');
                      }
                    }}
                  >
                    + Add Tag
                  </button>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingContact(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      <BulkContactUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        existingContacts={contacts}
        onImportContacts={(newContacts) => {
          if (onBulkAddContacts) {
            onBulkAddContacts(newContacts);
          } else {
            newContacts.forEach(c => onAddContact(c));
          }
        }}
      />
    </div>
  );
};
