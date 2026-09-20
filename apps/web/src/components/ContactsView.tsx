import React, { useState } from 'react';
import { Contact, RFMSegment, Template, User } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import { canManageContacts } from '../lib/permissions';
import { csvCell, csvText, downloadCsv } from '../lib/csv';
import { formatBlockUntil, metaBlockOf, metaBlockReason } from '../lib/metaDelivery';
import { BulkContactUploadModal } from './BulkContactUploadModal';
import {
  POPULAR_COUNTRY_CODES,
  cleanPhoneWithCountry,
  formatPhoneNumber,
  formatPhoneInput,
  isSamePhoneNumber,
  validatePhoneNumber,
} from '../lib/countryCodes';
import {
  AlertTriangleIcon,
  ChatsNavIcon,
  CloseIcon,
  ContactsNavIcon,
  DownloadIcon,
  FlameIcon,
  LayersIcon,
  MenuDotsIcon,
  PencilIcon,
  RepeatIcon,
  SearchIcon,
  ShieldCheckIcon,
  StarIcon,
  TemplateIcon,
  UploadIcon,
  UserAvatarPlaceholder,
  UserPlusIcon,
} from './WhatsAppIcons';

interface ContactsViewProps {
  contacts: Contact[];
  templates?: Template[];
  currency?: CurrencyCode;
  currentUser?: User | null;
  onAddContact: (contact: Contact) => void;
  /** Editing is only offered when this is provided; an Edit button that discards changes is worse than none. */
  onUpdateContact?: (contact: Contact) => void;
  onBulkAddContacts?: (contacts: Contact[]) => void;
  onStartChat?: (contact: Contact) => void;
  onAutoCategorizeContacts?: () => void;
  onDirectSendTemplate?: (contact: Contact, template: Template) => Promise<{ success?: boolean; error?: string } | void>;
}

const PRESET_TAGS = [
  'VIP Customers',
  'High Intent',
  'Frequent Buyer',
  'New Lead',
  'Internal Team',
  'Batch 1: Contacts 1 - 500',
  'Batch 2: Contacts 501 - 1000',
  'Batch 3: Contacts 1001 - 2000',
  'Batch 4: Contacts 2001 - 3000',
];

const COHORTS: Record<string, { label: string; tone: string }> = {
  CHAMPIONS: { label: 'VIP Tier 1', tone: 'vip' },
  LOYAL_CUSTOMERS: { label: 'Frequent Buyer', tone: 'loyal' },
  POTENTIAL_LOYALIST: { label: 'High Intent', tone: 'potential' },
  AT_RISK: { label: 'At Risk', tone: 'risk' },
  NEW_LEADS: { label: 'New Lead', tone: 'new' },
};

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE_CHECKOUT: 'Online checkout',
  CLICK_TO_WHATSAPP_AD: 'Meta ad click',
  QR_CODE: 'Retail QR code',
};

// The API hands every contact the same stock photo; showing one face for everyone is misleading,
// so it is treated as "no photo" and the WhatsApp placeholder is used instead.
const STOCK_AVATAR_MARKER = 'photo-1534528741775-53994a69daeb';

const MAX_TAGS_SHOWN = 4;

const isHotTag = (t: string) => {
  const l = t.toLowerCase();
  return l.includes('yes') || l.includes('hot lead');
};
const isHotLead = (c: Contact) => (c.tags || []).some(isHotTag);

const COUNTRIES_LONGEST_FIRST = [...POPULAR_COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

/** "+" + digits, using the same normalisation the inbox uses. */
const toE164 = (countryCode: string, raw: string) => {
  const digits = cleanPhoneWithCountry(countryCode, raw);
  return digits ? `+${digits}` : '';
};

const displayPhone = (phone: string) => {
  const digits = (phone || '').replace(/[^\d]/g, '');
  return digits ? `+${digits}` : phone;
};

/** Splits a stored number into a country code and the local part shown in the input. */
const splitPhone = (phone: string): { code: string; local: string } => {
  const digits = (phone || '').replace(/[^\d]/g, '');
  for (const c of COUNTRIES_LONGEST_FIRST) {
    const cd = c.code.replace(/[^\d]/g, '');
    if (digits.startsWith(cd) && digits.length - cd.length >= 6) {
      return { code: c.code, local: formatPhoneNumber(c.code, digits.slice(cd.length)) };
    }
  }
  return { code: '+91', local: formatPhoneNumber('+91', digits) };
};

const ContactAvatar: React.FC<{ contact: Contact; size?: number }> = ({ contact, size = 40 }) => {
  const usable = contact.avatarUrl && !contact.avatarUrl.includes(STOCK_AVATAR_MARKER);
  return usable ? (
    <img src={contact.avatarUrl} alt="" className="wa-avatar-img" />
  ) : (
    <UserAvatarPlaceholder size={size} />
  );
};

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
  const [showMenu, setShowMenu] = useState(false);

  const canManage = canManageContacts(currentUser?.role);
  const approvedTemplates = templates.filter(t => t.status === 'APPROVED');

  // Every tag that can be picked: the presets plus anything already used on a contact.
  const allExistingTags = Array.from(new Set([...PRESET_TAGS, ...contacts.flatMap(c => c.tags || [])])).filter(Boolean);

  // Add contact form
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['New Lead']);
  const [newCustomTag, setNewCustomTag] = useState('');

  // Edit contact form
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('+91');
  const [editPhone, setEditPhone] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editRfm, setEditRfm] = useState<RFMSegment>('NEW_LEADS');
  const [editOptedIn, setEditOptedIn] = useState(true);
  const [editNewCustomTag, setEditNewCustomTag] = useState('');

  // Direct template dialog
  const [directTplContact, setDirectTplContact] = useState<Contact | null>(null);
  const [selectedTplId, setSelectedTplId] = useState<string>('');
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [directFeedback, setDirectFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ------------------------------------------------------------------ derived data
  const q = search.trim().toLowerCase();
  const qDigits = q.replace(/[^\d]/g, '');

  const filtered = contacts.filter(c => {
    const matchesSearch =
      !q ||
      (c.displayName || '').toLowerCase().includes(q) ||
      (qDigits.length > 0 && (c.phone || '').replace(/[^\d]/g, '').includes(qDigits)) ||
      (c.tags || []).some(t => t.toLowerCase().includes(q));
    if (!matchesSearch) return false;
    if (selectedRfm === 'ALL') return true;
    if (selectedRfm === 'YES_LEADS') return isHotLead(c);
    return c.rfmSegment === selectedRfm;
  });

  const hotLeadCount = contacts.filter(isHotLead).length;
  const vipContacts = contacts.filter(c => c.rfmSegment === 'CHAMPIONS');
  const loyalContacts = contacts.filter(c => c.rfmSegment === 'LOYAL_CUSTOMERS');
  const avg = (list: Contact[]) =>
    list.length > 0 ? Math.round(list.reduce((a, c) => a + (c.lifetimeValue || 0), 0) / list.length) : 0;
  const optedInCount = contacts.filter(c => c.optedIn).length;

  const filterChips: Array<[string, string, number | null]> = [
    ['ALL', 'All', contacts.length],
    ['YES_LEADS', 'YES leads', hotLeadCount],
    ['CHAMPIONS', 'VIP Tier 1', null],
    ['LOYAL_CUSTOMERS', 'Frequent buyers', null],
    ['POTENTIAL_LOYALIST', 'High intent', null],
    ['NEW_LEADS', 'New leads', null],
  ];

  // ------------------------------------------------------------------ exports
  const handleExportCsv = () => {
    if (contacts.length === 0) {
      alert('No contacts to export.');
      return;
    }
    downloadCsv(
      `FGSN_Contacts_CRM_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Customer Name', 'WhatsApp Phone', 'Cohort', 'Opt-In Status', 'Source', 'Audience Tags', 'Lifetime Value', 'Total Orders', 'Last Active'],
      contacts.map(c => [
        csvText(c.displayName || ''),
        csvCell(c.phone),
        csvCell(c.rfmSegment || 'NEW_LEADS'),
        c.optedIn ? 'Opted In' : 'Opted Out',
        csvCell(c.optInSource || 'ORGANIC_INBOUND'),
        csvText((c.tags || []).join(', ')),
        String(c.lifetimeValue || 0),
        String(c.totalOrders || 0),
        c.lastActiveAt ? new Date(c.lastActiveAt).toLocaleDateString() : '',
      ]),
    );
  };

  const handleExportYesLeadCoverageSheet = () => {
    // Only people actually tagged as YES leads. (This used to fall back to every opted-in contact when there
    // were none, which put people who never said yes on a call sheet.)
    const listToExport = contacts.filter(isHotLead);
    if (listToExport.length === 0) {
      alert('Nobody has replied "Yes" yet, so there is no call sheet to export. People appear here once they do.');
      return;
    }
    downloadCsv(
      `FGSN_YES_Lead_Coverage_Sheet_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Lead Name', 'WhatsApp Phone Number', 'Opt-In Tag', 'Opt-In Date', 'Assigned Representative', 'Call Status', 'Notes / Preferred Time'],
      listToExport.map(c => [
        csvText(c.displayName || ''),
        csvCell(c.phone),
        csvText((c.tags || []).join('; ')),
        csvCell(c.optedInAt ? new Date(c.optedInAt).toLocaleString() : new Date().toLocaleDateString()),
        csvCell('Unassigned Representative'),
        csvCell('Pending Call'),
        csvCell('Wants Subject Matter Expert Call'),
      ]),
    );
  };

  // ------------------------------------------------------------------ add contact
  const addPhoneE164 = toE164(countryCode, phone);
  const addValidation = validatePhoneNumber(countryCode, phone);
  const addDuplicate = phone.trim() ? contacts.find(c => isSamePhoneNumber(c.phone, addPhoneE164)) : undefined;

  const closeAddModal = () => {
    setIsModalOpen(false);
    setName('');
    setPhone('');
    setCountryCode('+91');
    setSelectedTags(['New Lead']);
    setNewCustomTag('');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !addValidation.isValid || addDuplicate) return;

    const finalTags = Array.from(new Set([...selectedTags, ...(newCustomTag.trim() ? [newCustomTag.trim()] : [])]));

    const newContact: Contact = {
      id: `cnt_${Date.now()}`,
      displayName: name.trim(),
      phone: addPhoneE164,
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
    closeAddModal();
  };

  // ------------------------------------------------------------------ edit contact
  const editPhoneE164 = toE164(editCountryCode, editPhone);
  const editValidation = validatePhoneNumber(editCountryCode, editPhone);
  const editDuplicate =
    editingContact && editPhone.trim()
      ? contacts.find(c => c.id !== editingContact.id && isSamePhoneNumber(c.phone, editPhoneE164))
      : undefined;

  const handleStartEdit = (contact: Contact) => {
    const { code, local } = splitPhone(contact.phone);
    setEditingContact(contact);
    setEditName(contact.displayName);
    setEditCountryCode(code);
    setEditPhone(local);
    setEditTags(contact.tags || []);
    setEditRfm(contact.rfmSegment || 'NEW_LEADS');
    setEditOptedIn(contact.optedIn ?? true);
    setEditNewCustomTag('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editName.trim() || !editPhone.trim() || !editValidation.isValid || editDuplicate) return;

    const finalTags = Array.from(new Set([...editTags, ...(editNewCustomTag.trim() ? [editNewCustomTag.trim()] : [])]));

    onUpdateContact?.({
      ...editingContact,
      displayName: editName.trim(),
      phone: editPhoneE164,
      tags: finalTags,
      rfmSegment: editRfm,
      optedIn: editOptedIn,
    });
    setEditingContact(null);
  };

  // ------------------------------------------------------------------ direct template
  const openDirectTemplate = (c: Contact) => {
    setDirectTplContact(c);
    setSelectedTplId(approvedTemplates[0]?.id || '');
    setDirectFeedback(null);
  };

  const handleDirectSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTplContact) return;
    const selectedTpl = approvedTemplates.find(t => t.id === selectedTplId) || approvedTemplates[0];
    if (!selectedTpl) {
      setDirectFeedback({ type: 'error', message: 'There is no approved template to send.' });
      return;
    }
    setIsSendingDirect(true);
    setDirectFeedback(null);
    try {
      if (onDirectSendTemplate) {
        const res = await onDirectSendTemplate(directTplContact, selectedTpl);
        if (res && (res as any).success === false) {
          setDirectFeedback({ type: 'error', message: (res as any).error || 'Meta could not deliver this template.' });
        } else {
          setDirectFeedback({ type: 'success', message: `"${selectedTpl.name}" was sent to ${displayPhone(directTplContact.phone)}.` });
        }
      } else {
        setDirectFeedback({ type: 'success', message: `"${selectedTpl.name}" was dispatched.` });
      }
    } catch (err: any) {
      setDirectFeedback({ type: 'error', message: err.message || 'Something went wrong while sending.' });
    } finally {
      setIsSendingDirect(false);
    }
  };

  // ------------------------------------------------------------------ shared form pieces
  // A plain render function, NOT a nested component: a component defined inside another gets a new
  // identity every render, which would remount the input and drop focus after each keystroke.
  const renderTagPicker = ({
    selected,
    onToggle,
    custom,
    onCustomChange,
    onCustomAdd,
  }: {
    selected: string[];
    onToggle: (tag: string) => void;
    custom: string;
    onCustomChange: (v: string) => void;
    onCustomAdd: () => void;
  }) => (
    <>
      <div className="wa-tags-selector">
        {allExistingTags.map(tag => {
          const isSelected = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              className={`wa-tag-pill-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => onToggle(tag)}
              aria-pressed={isSelected}
            >
              {isSelected ? '✓ ' : '+ '}
              {tag}
            </button>
          );
        })}
        {/* Tags created just now aren't in the shared list yet: show them so they can be seen and removed. */}
        {selected
          .filter(tag => !allExistingTags.includes(tag))
          .map(tag => (
            <button
              key={tag}
              type="button"
              className="wa-tag-pill-btn selected custom"
              onClick={() => onToggle(tag)}
              title="Click to remove this tag"
            >
              ✓ {tag} ✕
            </button>
          ))}
      </div>
      <div className="wa-add-custom-tag-row">
        <input
          type="text"
          placeholder="Create a new tag…"
          className="wa-custom-tag-input"
          value={custom}
          onChange={e => onCustomChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCustomAdd();
            }
          }}
        />
        <button type="button" className="wa-add-tag-btn" onClick={onCustomAdd} disabled={!custom.trim()}>
          Add tag
        </button>
      </div>
    </>
  );

  const phoneHint = (validation: { isValid: boolean; message: string }, value: string) =>
    value.trim() ? (
      <span className={`wa-ct-hint ${validation.isValid ? 'is-ok' : 'is-bad'}`}>{validation.message}</span>
    ) : null;

  const duplicateAlert = (dup: Contact) => (
    <div className="wa-duplicate-alert">
      <div className="wa-duplicate-alert-content">
        <span className="wa-duplicate-alert-icon">
          <AlertTriangleIcon size={18} />
        </span>
        <div>
          <strong>This number is already saved:</strong> {dup.displayName} ({displayPhone(dup.phone)}).
        </div>
      </div>
      {onStartChat && (
        <button
          type="button"
          className="wa-duplicate-action-btn"
          onClick={() => {
            onStartChat(dup);
            setIsModalOpen(false);
            setEditingContact(null);
          }}
        >
          Open chat
        </button>
      )}
    </div>
  );

  // ------------------------------------------------------------------ render
  return (
    <div className="wa-ct-page">
      {/* Toolbar */}
      <div className="wa-bc-toolbar">
        <p className="wa-bc-lede">Everyone you can message on WhatsApp. Only opted-in contacts receive broadcasts.</p>

        <div className="wa-ct-toolbar-actions">
          {canManage && (
            <>
              <button type="button" className="wa-ct-btn" onClick={() => setIsBulkModalOpen(true)} title="Import contacts from CSV, Excel or a Meta Lead Ads export">
                <UploadIcon size={17} color="#54656f" />
                <span>Import</span>
              </button>
              <button type="button" className="wa-ct-btn" onClick={handleExportCsv} title="Download all contacts as CSV">
                <DownloadIcon size={17} color="#54656f" />
                <span>Export</span>
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`wa-icon-btn ${showMenu ? 'active' : ''}`}
                  onClick={() => setShowMenu(prev => !prev)}
                  title="More actions"
                  aria-label="More actions"
                  aria-haspopup="menu"
                  aria-expanded={showMenu}
                >
                  <MenuDotsIcon size={20} color="#54656f" />
                </button>

                {showMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowMenu(false)} />
                    <div className="wa-header-menu-dropdown" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="wa-menu-item"
                        onClick={() => {
                          setShowMenu(false);
                          handleExportYesLeadCoverageSheet();
                        }}
                      >
                        <span className="wa-ct-menu-row">
                          <FlameIcon size={17} color="#54656f" />
                          Export YES-lead call sheet
                        </span>
                      </button>
                      {onAutoCategorizeContacts && (
                        <button
                          type="button"
                          role="menuitem"
                          className="wa-menu-item"
                          onClick={() => {
                            setShowMenu(false);
                            onAutoCategorizeContacts();
                          }}
                        >
                          <span className="wa-ct-menu-row">
                            <LayersIcon size={17} color="#54656f" />
                            Sort contacts into batches
                          </span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <button type="button" className="wa-bc-primary" onClick={() => setIsModalOpen(true)}>
            <UserPlusIcon size={17} color="#ffffff" />
            Add contact
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="wa-bc-kpis">
        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-red">
            <FlameIcon size={20} color="currentColor" />
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">"YES" hot-lead opt-ins</span>
            <strong className="wa-bc-kpi-value">{hotLeadCount.toLocaleString()}</strong>
            <span className="wa-bc-kpi-foot">Ready for a representative call</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-amber">
            <StarIcon size={20} color="currentColor" />
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">VIP Tier 1 average value</span>
            <strong className="wa-bc-kpi-value">{formatCurrency(avg(vipContacts), currency)}</strong>
            <span className="wa-bc-kpi-foot">{vipContacts.length} VIP {vipContacts.length === 1 ? 'contact' : 'contacts'}</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-teal">
            <RepeatIcon size={20} color="currentColor" />
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Frequent buyers average</span>
            <strong className="wa-bc-kpi-value">{formatCurrency(avg(loyalContacts), currency)}</strong>
            <span className="wa-bc-kpi-foot">{loyalContacts.length} loyal {loyalContacts.length === 1 ? 'customer' : 'customers'}</span>
          </div>
        </div>

        <div className="wa-bc-kpi">
          <div className="wa-bc-kpi-icon tone-green">
            <ShieldCheckIcon size={20} color="currentColor" />
          </div>
          <div className="wa-bc-kpi-body">
            <span className="wa-bc-kpi-label">Verified opt-in contacts</span>
            <strong className="wa-bc-kpi-value is-brand">
              {optedInCount.toLocaleString()} <span className="wa-ct-kpi-of">/ {contacts.length.toLocaleString()}</span>
            </strong>
            <span className="wa-bc-kpi-foot">WhatsApp-compliant opt-ins</span>
          </div>
        </div>
      </div>

      {/* Contacts list */}
      <section className="wa-bc-card">
        <div className="wa-bc-card-head">
          <h3 className="wa-bc-card-title">Contacts</h3>
          <span className="wa-bc-count">
            {filtered.length === contacts.length ? `${contacts.length} total` : `${filtered.length} of ${contacts.length}`}
          </span>
        </div>

        <div className="wa-search-section">
          <div className="wa-search-bar">
            <SearchIcon size={16} color="#54656f" />
            <input
              type="text"
              className="wa-search-input"
              placeholder="Search by name, phone number or tag"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search contacts"
            />
            {search && (
              <button type="button" className="wa-clear-search-btn" onClick={() => setSearch('')} title="Clear" aria-label="Clear search">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="wa-filter-chips">
          {filterChips.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`wa-chip ${selectedRfm === key ? 'active' : ''}`}
              onClick={() => setSelectedRfm(key)}
            >
              {label}
              {count !== null && <span className="wa-chip-count">({count})</span>}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="wa-bc-empty">
            <div className="wa-bc-empty-icon">
              <ContactsNavIcon size={30} color="#008069" />
            </div>
            {contacts.length === 0 ? (
              <>
                <h4>No contacts yet</h4>
                <p>Add a verified WhatsApp number, or import your customer list from a spreadsheet.</p>
                <div className="wa-ct-empty-actions">
                  <button type="button" className="wa-bc-primary" onClick={() => setIsModalOpen(true)}>
                    <UserPlusIcon size={17} color="#ffffff" />
                    Add contact
                  </button>
                  {canManage && (
                    <button type="button" className="wa-ct-btn" onClick={() => setIsBulkModalOpen(true)}>
                      <UploadIcon size={17} color="#54656f" />
                      <span>Import</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h4>No contacts match</h4>
                <p>Try a different search, or clear the filter to see everyone.</p>
                <button
                  type="button"
                  className="wa-ct-btn"
                  onClick={() => {
                    setSearch('');
                    setSelectedRfm('ALL');
                  }}
                >
                  Clear search and filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="wa-ct-scroll">
          <table className="wa-ct-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Opt-in</th>
                <th>Cohort</th>
                <th>Tags</th>
                <th>Value</th>
                <th>Last active</th>
                <th className="wa-ct-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const cohort = COHORTS[c.rfmSegment || 'NEW_LEADS'] || COHORTS.NEW_LEADS;
                const tags = c.tags || [];
                const last = c.lastActiveAt ? new Date(c.lastActiveAt) : null;
                const resting = metaBlockOf(c);
                return (
                  <tr key={c.id}>
                    <td data-label="Contact">
                      <div className="wa-ct-person">
                        <div className="wa-ct-avatar">
                          <ContactAvatar contact={c} size={40} />
                        </div>
                        <div className="wa-ct-person-text">
                          <div className="wa-ct-name">{c.displayName}</div>
                          <div className="wa-ct-phone">{displayPhone(c.phone)}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Opt-in">
                      <span className={`wa-bc-status ${c.optedIn ? 'tone-done' : 'tone-fail'}`}>
                        <span className="wa-bc-status-dot" />
                        {c.optedIn ? 'Opted in' : 'Opted out'}
                      </span>
                      <div className="wa-bc-muted wa-ct-source">{SOURCE_LABEL[c.optInSource || ''] || 'Organic inbound'}</div>
                      {resting && (
                        <div className="wa-ct-rest" title={`${metaBlockReason(resting)}. Left out of broadcasts until ${formatBlockUntil(resting)}.`}>
                          <span className="wa-bc-status tone-live">
                            <span className="wa-bc-status-dot" />
                            Meta not delivering · until {formatBlockUntil(resting)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td data-label="Cohort">
                      <span className={`wa-ct-badge tone-${cohort.tone}`}>{cohort.label}</span>
                    </td>
                    <td data-label="Tags">
                      {tags.length > 0 ? (
                        <div className="wa-ct-tags" title={tags.join(', ')}>
                          {tags.slice(0, MAX_TAGS_SHOWN).map((t, i) => (
                            <span key={i} className={`wa-crm-tag-chip ${isHotTag(t) ? 'is-hot' : ''}`}>
                              {t}
                            </span>
                          ))}
                          {tags.length > MAX_TAGS_SHOWN && <span className="wa-ct-more">+{tags.length - MAX_TAGS_SHOWN}</span>}
                        </div>
                      ) : (
                        <span className="wa-bc-muted">No tags</span>
                      )}
                    </td>
                    <td data-label="Value">
                      <div className="wa-ct-value">{formatCurrency(c.lifetimeValue || 0, currency)}</div>
                      <div className="wa-bc-muted">
                        {c.totalOrders || 0} {(c.totalOrders || 0) === 1 ? 'order' : 'orders'}
                      </div>
                    </td>
                    <td data-label="Last active">{last && !isNaN(last.getTime()) ? last.toLocaleDateString() : '—'}</td>
                    <td data-label="Actions">
                      <div className="wa-ct-actions">
                        <button
                          type="button"
                          className="wa-icon-btn wa-ct-act"
                          onClick={() => onStartChat && onStartChat(c)}
                          title={`Open chat with ${c.displayName}`}
                          aria-label={`Open chat with ${c.displayName}`}
                        >
                          <ChatsNavIcon size={19} color="#54656f" />
                          <span className="wa-ct-act-label">Chat</span>
                        </button>
                        <button
                          type="button"
                          className="wa-icon-btn wa-ct-act"
                          onClick={() => openDirectTemplate(c)}
                          title={`Send an approved template to ${c.displayName}`}
                          aria-label={`Send an approved template to ${c.displayName}`}
                        >
                          <TemplateIcon size={19} color="#54656f" />
                          <span className="wa-ct-act-label">Template</span>
                        </button>
                        {onUpdateContact && (
                          <button
                            type="button"
                            className="wa-icon-btn wa-ct-act"
                            onClick={() => handleStartEdit(c)}
                            title={`Edit ${c.displayName}`}
                            aria-label={`Edit ${c.displayName}`}
                          >
                            <PencilIcon size={19} color="#54656f" />
                            <span className="wa-ct-act-label">Edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>

      {/* Send template dialog */}
      {directTplContact && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="wa-modal-card" style={{ maxWidth: 480, width: '92%' }}>
            <div className="wa-modal-header">
              <div>
                <h3 className="wa-modal-title">Send a template</h3>
                <p className="wa-modal-subtitle">
                  To {directTplContact.displayName} · {displayPhone(directTplContact.phone)}
                </p>
              </div>
              <button type="button" className="wa-modal-close-btn" onClick={() => setDirectTplContact(null)} title="Close" aria-label="Close">
                <CloseIcon size={18} color="#54656f" />
              </button>
            </div>

            <form onSubmit={handleDirectSend} className="wa-modal-form">
              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-ct-tpl">Approved template</label>
                {approvedTemplates.length === 0 ? (
                  <div className="wa-tpl-alert is-error" role="alert" style={{ marginTop: 0 }}>
                    There are no approved templates yet. Create one on the Templates page and wait for Meta to approve it.
                  </div>
                ) : (
                  <select id="wa-ct-tpl" className="wa-modal-input" value={selectedTplId} onChange={e => setSelectedTplId(e.target.value)}>
                    {approvedTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category} · {t.language})
                      </option>
                    ))}
                  </select>
                )}
                <span className="wa-form-hint">Templates are the only messages WhatsApp lets you send outside the 24-hour reply window.</span>
              </div>

              {directFeedback && (
                <div
                  className={`wa-tpl-alert ${directFeedback.type === 'success' ? 'is-success' : 'is-error'}`}
                  role={directFeedback.type === 'error' ? 'alert' : 'status'}
                  style={{ marginTop: 0 }}
                >
                  {directFeedback.message}
                </div>
              )}

              <div className="wa-modal-actions">
                <button type="button" className="wa-modal-cancel-btn" onClick={() => setDirectTplContact(null)}>
                  Close
                </button>
                <button type="submit" className="wa-modal-submit-btn" disabled={isSendingDirect || approvedTemplates.length === 0}>
                  {isSendingDirect ? 'Sending…' : 'Send template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add contact dialog */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="wa-modal-card" style={{ maxWidth: 500, width: '92%' }}>
            <div className="wa-modal-header">
              <div>
                <h3 className="wa-modal-title">Add contact</h3>
                <p className="wa-modal-subtitle">Save a verified WhatsApp number to your audience</p>
              </div>
              <button type="button" className="wa-modal-close-btn" onClick={closeAddModal} title="Close" aria-label="Close">
                <CloseIcon size={18} color="#54656f" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="wa-modal-form">
              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-ct-add-name">
                  Full name <span className="wa-ct-req">*</span>
                </label>
                <input
                  id="wa-ct-add-name"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Rahul Sharma"
                  className="wa-modal-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-ct-add-phone">
                  WhatsApp number <span className="wa-ct-req">*</span>
                </label>
                <div className="wa-phone-input-row">
                  <select
                    className="wa-country-select"
                    value={countryCode}
                    onChange={e => {
                      setCountryCode(e.target.value);
                      if (phone) setPhone(formatPhoneNumber(e.target.value, phone));
                    }}
                    aria-label="Country code"
                  >
                    {POPULAR_COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.name})
                      </option>
                    ))}
                  </select>
                  <input
                    id="wa-ct-add-phone"
                    type="tel"
                    required
                    className={`wa-phone-number-input ${addDuplicate ? 'has-warning' : ''}`}
                    placeholder={POPULAR_COUNTRY_CODES.find(c => c.code === countryCode)?.sampleDigits || 'Phone number'}
                    value={phone}
                    onChange={e => setPhone(formatPhoneInput(countryCode, e.target.value, (e.nativeEvent as InputEvent).inputType))}
                  />
                </div>
                {addDuplicate && duplicateAlert(addDuplicate)}
                {phoneHint(addValidation, phone)}
              </div>

              <div className="wa-form-group">
                <label className="wa-form-label">Tags</label>
                {renderTagPicker({
                  selected: selectedTags,
                  onToggle: tag => setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])),
                  custom: newCustomTag,
                  onCustomChange: setNewCustomTag,
                  onCustomAdd: () => {
                    const tag = newCustomTag.trim();
                    if (tag && !selectedTags.includes(tag)) setSelectedTags(prev => [...prev, tag]);
                    setNewCustomTag('');
                  },
                })}
              </div>

              <div className="wa-modal-actions">
                <button type="button" className="wa-modal-cancel-btn" onClick={closeAddModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wa-modal-submit-btn"
                  disabled={!name.trim() || !phone.trim() || !addValidation.isValid || !!addDuplicate}
                >
                  Save contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit contact dialog */}
      {editingContact && onUpdateContact && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="wa-modal-card" style={{ maxWidth: 500, width: '92%' }}>
            <div className="wa-modal-header">
              <div>
                <h3 className="wa-modal-title">Edit contact</h3>
                <p className="wa-modal-subtitle">Update details and tags for {editingContact.displayName}</p>
              </div>
              <button type="button" className="wa-modal-close-btn" onClick={() => setEditingContact(null)} title="Close" aria-label="Close">
                <CloseIcon size={18} color="#54656f" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="wa-modal-form">
              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-ct-edit-name">
                  Full name <span className="wa-ct-req">*</span>
                </label>
                <input
                  id="wa-ct-edit-name"
                  type="text"
                  required
                  className="wa-modal-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>

              <div className="wa-form-group">
                <label className="wa-form-label" htmlFor="wa-ct-edit-phone">
                  WhatsApp number <span className="wa-ct-req">*</span>
                </label>
                <div className="wa-phone-input-row">
                  <select
                    className="wa-country-select"
                    value={editCountryCode}
                    onChange={e => {
                      setEditCountryCode(e.target.value);
                      if (editPhone) setEditPhone(formatPhoneNumber(e.target.value, editPhone));
                    }}
                    aria-label="Country code"
                  >
                    {POPULAR_COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.name})
                      </option>
                    ))}
                  </select>
                  <input
                    id="wa-ct-edit-phone"
                    type="tel"
                    required
                    className={`wa-phone-number-input ${editDuplicate ? 'has-warning' : ''}`}
                    value={editPhone}
                    onChange={e => setEditPhone(formatPhoneInput(editCountryCode, e.target.value, (e.nativeEvent as InputEvent).inputType))}
                  />
                </div>
                {editDuplicate && duplicateAlert(editDuplicate)}
                {phoneHint(editValidation, editPhone)}
              </div>

              <div className="wa-ct-two-col">
                <div className="wa-form-group">
                  <label className="wa-form-label" htmlFor="wa-ct-edit-rfm">Cohort</label>
                  <select id="wa-ct-edit-rfm" className="wa-modal-input" value={editRfm} onChange={e => setEditRfm(e.target.value as RFMSegment)}>
                    <option value="NEW_LEADS">New Lead</option>
                    <option value="CHAMPIONS">VIP Tier 1</option>
                    <option value="LOYAL_CUSTOMERS">Frequent Buyer</option>
                    <option value="POTENTIAL_LOYALIST">High Intent</option>
                    <option value="AT_RISK">At Risk</option>
                  </select>
                </div>
                <div className="wa-form-group">
                  <label className="wa-form-label" htmlFor="wa-ct-edit-optin">WhatsApp opt-in</label>
                  <select
                    id="wa-ct-edit-optin"
                    className="wa-modal-input"
                    value={editOptedIn ? 'IN' : 'OUT'}
                    onChange={e => setEditOptedIn(e.target.value === 'IN')}
                  >
                    <option value="IN">Opted in</option>
                    <option value="OUT">Opted out</option>
                  </select>
                </div>
              </div>

              <div className="wa-form-group">
                <label className="wa-form-label">Tags ({editTags.length} selected)</label>
                {renderTagPicker({
                  selected: editTags,
                  onToggle: tag => setEditTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])),
                  custom: editNewCustomTag,
                  onCustomChange: setEditNewCustomTag,
                  onCustomAdd: () => {
                    const tag = editNewCustomTag.trim();
                    if (tag && !editTags.includes(tag)) setEditTags(prev => [...prev, tag]);
                    setEditNewCustomTag('');
                  },
                })}
              </div>

              <div className="wa-modal-actions">
                <button type="button" className="wa-modal-cancel-btn" onClick={() => setEditingContact(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wa-modal-submit-btn"
                  disabled={!editName.trim() || !editPhone.trim() || !editValidation.isValid || !!editDuplicate}
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk upload dialog */}
      <BulkContactUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        existingContacts={contacts}
        onImportContacts={newContacts => {
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
