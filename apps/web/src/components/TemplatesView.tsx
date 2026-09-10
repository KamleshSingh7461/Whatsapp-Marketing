import React, { useState } from 'react';
import { Template, TemplateCategory } from '../types';
import fgsnLogo from '../assets/logo.png';

interface TemplatesViewProps {
  templates: Template[];
  onCreateTemplate: (template: Partial<Template>) => void;
}

const PROMOTIONAL_KEYWORDS = ['sale', 'discount', 'offer', 'deal', 'buy now', 'coupon', '% off', 'special price', 'clearance'];

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  onCreateTemplate,
}) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en_US');
  const [category, setCategory] = useState<TemplateCategory>('MARKETING');
  const [headerType, setHeaderType] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [headerText, setHeaderText] = useState('Exclusive VIP Offer');
  const [bodyText, setBodyText] = useState('Hello {{1}}, your 20% promotional code {{2}} is active through this weekend.');
  const [footerText, setFooterText] = useState('Reply STOP to unsubscribe');
  const [buttonText, setButtonText] = useState('Shop Now');

  const [varValues, setVarValues] = useState<Record<string, string>>({
    '1': 'Elena',
    '2': 'VIP20',
  });

  const handleVarChange = (key: string, val: string) => {
    setVarValues(prev => ({ ...prev, [key]: val }));
  };

  const getRenderedBody = () => {
    let rendered = bodyText;
    Object.entries(varValues).forEach(([k, v]) => {
      rendered = rendered.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`);
    });
    return rendered;
  };

  const checkMiscategorization = (cat: TemplateCategory, body: string, header: string) => {
    if (cat !== 'UTILITY') return null;
    const combined = `${header} ${body}`.toLowerCase();
    const hit = PROMOTIONAL_KEYWORDS.find((kw) => combined.includes(kw));
    return hit
      ? `Meta Compliance Alert: Contains promotional terminology ("${hit}"). Meta will classify this template as Marketing and apply the standard marketing tier rate.`
      : null;
  };

  const warning = checkMiscategorization(category, bodyText, headerText);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) return;

    onCreateTemplate({
      name: name.trim().toLowerCase().replace(/\s+/g, '_'),
      language,
      category,
      status: 'APPROVED',
      bodyJson: {
        header: headerText ? { type: headerType, text: headerText } : undefined,
        body: bodyText,
        footer: footerText || undefined,
        buttons: buttonText ? [{ type: 'QUICK_REPLY', text: buttonText }] : undefined,
      },
      sampleVariables: varValues,
      warning: warning || undefined,
    });

    setName('');
    setHeaderText('');
    setBodyText('');
    setFooterText('');
  };

  return (
    <div className="view-container">
      <div className="page-header-row">
        <div>
          <h2 className="view-title">Template Studio & Compliance Sandbox</h2>
          <p className="view-subtitle">Author and test WhatsApp Cloud API message templates with variable parameters and compliance verification</p>
        </div>
      </div>

      <div className="template-grid-split">
        {/* Left: Template Builder Form */}
        <div className="panel-card">
          <h3 className="panel-title">Template Configuration</h3>
          <p className="panel-desc" style={{ marginBottom: 16 }}>
            Variables like <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code> will be populated dynamically upon dispatch.
          </p>

          <form onSubmit={handleSubmit} className="template-form">
            <div className="form-group">
              <label>Template Identifier (snake_case)</label>
              <input
                type="text"
                required
                placeholder="e.g. order_dispatch_notification"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                  className="form-input"
                >
                  <option value="MARKETING">Marketing (Promotions & Offers)</option>
                  <option value="UTILITY">Utility (Order updates & Tracking)</option>
                  <option value="AUTHENTICATION">Authentication (OTPs)</option>
                </select>
              </div>

              <div className="form-group half">
                <label>Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="form-input"
                >
                  <option value="en_US">English (US)</option>
                  <option value="es_ES">Spanish</option>
                  <option value="pt_BR">Portuguese</option>
                  <option value="hi_IN">Hindi</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <div className="header-type-toggle">
                <label>Header Format</label>
                <div className="btn-group-segmented">
                  <button
                    type="button"
                    className={`btn-seg-item ${headerType === 'TEXT' ? 'active' : ''}`}
                    onClick={() => setHeaderType('TEXT')}
                  >
                    Text
                  </button>
                  <button
                    type="button"
                    className={`btn-seg-item ${headerType === 'IMAGE' ? 'active' : ''}`}
                    onClick={() => setHeaderType('IMAGE')}
                  >
                    Image
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder={headerType === 'TEXT' ? 'e.g. Shipment Dispatched' : 'https://cdn.example.com/banner.jpg'}
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Body Text</label>
              <textarea
                rows={4}
                required
                placeholder="Hello {{1}}, your order #{{2}} is confirmed..."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="form-input textarea"
              />
            </div>

            {/* Variable Test Values */}
            <div className="variable-test-container">
              <span className="var-test-title">Sample Variable Sandbox:</span>
              <div className="var-inputs-row">
                <div className="var-input-group">
                  <label>{'{{1}}'} Name:</label>
                  <input
                    type="text"
                    value={varValues['1'] || ''}
                    onChange={(e) => handleVarChange('1', e.target.value)}
                    placeholder="Elena"
                    className="form-input sm"
                  />
                </div>
                <div className="var-input-group">
                  <label>{'{{2}}'} Param:</label>
                  <input
                    type="text"
                    value={varValues['2'] || ''}
                    onChange={(e) => handleVarChange('2', e.target.value)}
                    placeholder="VIP20"
                    className="form-input sm"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>Footer Text (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Reply STOP to unsubscribe"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Quick Reply Button</label>
              <input
                type="text"
                placeholder="e.g. Track Order"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Compliance Warning Alert */}
            {warning && (
              <div className="compliance-warning-card">
                <p>{warning}</p>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ marginTop: 12 }}>
              Save & Submit to Meta
            </button>
          </form>
        </div>

        {/* Right: Realistic iPhone 16 Pro WhatsApp Device Preview */}
        <div className="panel-card phone-simulator-panel">
          <div className="simulator-header">
            <div className="simulator-badge-row">
              <span className="live-preview-chip">
                <span className="live-dot" />
                iOS WhatsApp Device Preview
              </span>
              <span className="device-tag">iPhone 16 Pro</span>
            </div>
            <span className="preview-subtext">Real-time Meta Cloud API rendering</span>
          </div>

          {/* iPhone Hardware Chassis */}
          <div className="iphone-chassis">
            {/* Dynamic Island */}
            <div className="iphone-dynamic-island">
              <span className="camera-lens" />
            </div>

            {/* Hardware Side Buttons */}
            <div className="hw-btn volume-up" />
            <div className="hw-btn volume-down" />
            <div className="hw-btn power-btn" />

            {/* Screen Inner Viewport */}
            <div className="iphone-screen">
              {/* iOS Status Bar */}
              <div className="ios-status-bar">
                <span className="ios-time">9:41</span>
                <div className="ios-status-icons">
                  <svg className="ios-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="2" y="16" width="3" height="6" rx="0.5" />
                    <rect x="7" y="12" width="3" height="10" rx="0.5" />
                    <rect x="12" y="8" width="3" height="14" rx="0.5" />
                    <rect x="17" y="4" width="3" height="18" rx="0.5" />
                  </svg>
                  <svg className="ios-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z" />
                  </svg>
                  <div className="ios-battery">
                    <div className="ios-battery-fill" />
                  </div>
                </div>
              </div>

              {/* WhatsApp iOS Navigation Bar */}
              <div className="wa-ios-nav-header">
                <div className="wa-nav-left">
                  <span className="wa-back-chevron">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span className="wa-unread-badge">3</span>
                  </span>
                  
                  <div className="wa-partner-avatar">
                    <img src={fgsnLogo} alt="FGSN" className="wa-avatar-img" />
                    <span className="wa-verified-mini" title="Verified Business">
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="#FFFFFF">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                      </svg>
                    </span>
                  </div>

                  <div className="wa-partner-meta">
                    <div className="wa-partner-name-row">
                      <span className="wa-partner-name">FGSN Official</span>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="#059669" className="verified-shield">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <span className="wa-partner-desc">Official WhatsApp Business Account</span>
                  </div>
                </div>

                <div className="wa-nav-right">
                  <button type="button" className="wa-nav-icon-btn" title="Video Call">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  </button>
                  <button type="button" className="wa-nav-icon-btn" title="Voice Call">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chat Canvas with Wallpaper Background */}
              <div className="wa-chat-viewport">
                {/* Date Capsule */}
                <div className="wa-date-pill">
                  <span>Today</span>
                </div>

                {/* Encryption Shield Banner */}
                <div className="wa-encryption-bubble">
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="#6B7280">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#6B7280" strokeWidth="2" fill="none" />
                  </svg>
                  <span>Messages are end-to-end encrypted with Meta Cloud API.</span>
                </div>

                {/* Rendered WhatsApp Message Bubble */}
                <div className="wa-bubble-card">
                  {/* Optional Image Header */}
                  {headerType === 'IMAGE' && headerText && (
                    <div className="wa-bubble-media-header">
                      {headerText.startsWith('http') ? (
                        <img src={headerText} alt="Template Header" className="wa-bubble-img" />
                      ) : (
                        <div className="wa-media-placeholder">
                          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#94A3B8" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <span>Header Image Preview</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text Header */}
                  {headerType === 'TEXT' && headerText && (
                    <div className="wa-bubble-header-title">{headerText}</div>
                  )}

                  {/* Body Content */}
                  <div className="wa-bubble-body-content">
                    {getRenderedBody() || 'Enter your template body copy on the left to see the instant live preview.'}
                  </div>

                  {/* Footer Content */}
                  {footerText && (
                    <div className="wa-bubble-footer-text">{footerText}</div>
                  )}

                  {/* Time & Double Checkmark */}
                  <div className="wa-bubble-meta-row">
                    <span className="wa-bubble-time">10:42 AM</span>
                    <span className="wa-double-check" title="Delivered & Read">✓✓</span>
                  </div>

                  {/* Interactive Quick Reply / Call-to-Action Buttons */}
                  {buttonText && (
                    <div className="wa-bubble-actions">
                      <button type="button" className="wa-action-button">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        <span>{buttonText}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom WhatsApp Composer Bar */}
              <div className="wa-ios-composer">
                <div className="wa-composer-plus">＋</div>
                <div className="wa-composer-input-pill">
                  <span>Message</span>
                </div>
                <div className="wa-composer-icons">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#007AFF" strokeWidth="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#007AFF" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </div>
              </div>

              {/* iOS Home Indicator */}
              <div className="ios-home-bar" />
            </div>
          </div>
        </div>
      </div>

      {/* Templates Table */}
      <div className="panel-card" style={{ marginTop: 24 }}>
        <h3 className="panel-title">Approved Message Templates</h3>
        <table className="corporate-table">
          <thead>
            <tr>
              <th>Template Identifier</th>
              <th>Category</th>
              <th>Status</th>
              <th>Language</th>
              <th>Created Date</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#64748B', padding: '2.5rem 1rem' }}>
                  <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4 }}>No message templates submitted</p>
                  <span style={{ fontSize: '0.78rem' }}>Use the Template Creator above to design and submit your first WhatsApp template to Meta for instant approval.</span>
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                    {t.warning && <div className="text-warning-sm">{t.warning}</div>}
                  </td>
                  <td>
                    <span className="status-chip neutral">{t.category}</span>
                  </td>
                  <td>
                    <span className={`status-chip ${t.status === 'APPROVED' ? 'success' : t.status === 'PENDING' ? 'warning' : 'neutral'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>{t.language}</td>
                  <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
