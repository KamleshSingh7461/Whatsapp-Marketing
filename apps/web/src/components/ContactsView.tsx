import React, { useState } from 'react';
import { Contact, RFMSegment } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';

interface ContactsViewProps {
  contacts: Contact[];
  currency?: CurrencyCode;
  onAddContact: (contact: Contact) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  currency = 'USD',
  onAddContact,
}) => {
  const [search, setSearch] = useState('');
  const [selectedRfm, setSelectedRfm] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tagsInput, setTagsInput] = useState('');

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

    const newContact: Contact = {
      id: `cnt_${Date.now()}`,
      displayName: name.trim(),
      phone: phone.trim(),
      optedIn: true,
      optedInAt: new Date().toISOString(),
      optInSource: 'ORGANIC_INBOUND',
      tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean),
      rfmSegment: 'NEW_LEADS',
      lifetimeValue: 0,
      totalOrders: 0,
      lastActiveAt: new Date().toISOString(),
    };

    onAddContact(newContact);
    setIsModalOpen(false);
    setName('');
    setPhone('');
    setTagsInput('');
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
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={() => alert('Exporting contacts CSV...')}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
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
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">VIP Tier 1 Threshold</span>
          </div>
          <div className="metric-primary-value text-primary-brand">{formatCurrency(2480, currency)}+</div>
          <div className="metric-footer-text">Repeat buyers with 10+ completed orders</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Frequent Buyers Avg</span>
          </div>
          <div className="metric-primary-value">{formatCurrency(1200, currency)}+</div>
          <div className="metric-footer-text">Active in past 60 days</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">High Intent Cart Avg</span>
          </div>
          <div className="metric-primary-value">{formatCurrency(890, currency)}</div>
          <div className="metric-footer-text">High-value abandoned checkouts</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Verified Opt-In Contacts</span>
          </div>
          <div className="metric-primary-value">{contacts.filter(c => c.optedIn).length} / {contacts.length}</div>
          <div className="metric-footer-text">WhatsApp compliant opt-ins</div>
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: '#64748B', padding: '3rem 1rem' }}>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Contact Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add New Contact</h3>
                <p className="modal-subtitle">Enroll a customer phone number into the WhatsApp database</p>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>WhatsApp Phone Number (E.164 with Country Code)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +14155552671"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Audience Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Customers, High Intent"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
