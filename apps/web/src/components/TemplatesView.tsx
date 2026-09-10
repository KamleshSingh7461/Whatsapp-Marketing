import React, { useState } from 'react';
import { Template, TemplateCategory, User } from '../types';
import { canCreateTemplates } from '../lib/permissions';
import fgsnLogo from '../assets/logo.png';

interface TemplatesViewProps {
  templates: Template[];
  wabaAccountName?: string;
  displayPhoneNumber?: string;
  currentUser?: User | null;
  onCreateTemplate: (template: Partial<Template>) => Promise<{ success?: boolean; message?: string } | void> | void;
}

interface TemplateButtonConfig {
  id: string;
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
  text: string;
  url?: string;
  phone?: string;
  code?: string;
}

const PROMOTIONAL_KEYWORDS = ['sale', 'discount', 'offer', 'deal', 'buy now', 'coupon', '% off', 'special price', 'clearance', 'promo', 'cashback'];

const EMOJIS = ['👍', '🔥', '🏆', '⚽', '⚡', '🎉', '🚀', '💬', '📦', '💳', '✨', '🎟️'];

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  templates,
  wabaAccountName = 'Freedom Global Sports Network',
  displayPhoneNumber = '+91 86558 51749',
  currentUser,
  onCreateTemplate,
}) => {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en_US');
  const [category, setCategory] = useState<TemplateCategory>('MARKETING');
  
  // Header
  const [headerType, setHeaderType] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('TEXT');
  const [headerText, setHeaderText] = useState('Exclusive VIP Offer');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600');
  
  // Body & Footer
  const [bodyText, setBodyText] = useState('Hello {{1}}, welcome to Freedom Global Sports Network! Use code {{2}} at checkout for 20% off your live tournament pass.');
  const [footerText, setFooterText] = useState('Reply STOP to unsubscribe');

  // Multi-Button support matching Meta WhatsApp Manager
  const [buttons, setButtons] = useState<TemplateButtonConfig[]>([
    {
      id: 'btn_1',
      type: 'URL',
      text: 'Watch Live Stream',
      url: 'https://fgsnlive.com/live',
    },
    {
      id: 'btn_2',
      type: 'QUICK_REPLY',
      text: 'Contact Support',
    }
  ]);

  // Sample variable values for {{1}}, {{2}} in header and body
  const [varValues, setVarValues] = useState<Record<string, string>>({
    '1': 'Elena',
    '2': 'FGSN20',
  });

  // UI state
  const [previewMode, setPreviewMode] = useState<'device' | 'expanded'>('device');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Automatically detect variables in header and body
  const headerVariables = Array.from(new Set((headerText.match(/\{\{\d+\}\}/g) || []).map(v => v.replace(/\D/g, ''))));
  const bodyVariables = Array.from(new Set((bodyText.match(/\{\{\d+\}\}/g) || []).map(v => v.replace(/\D/g, ''))));
  const allDetectedVariables = Array.from(new Set([...headerVariables, ...bodyVariables]));

  // Auto populate Meta compliant presets
  const handleCategoryChange = (newCategory: TemplateCategory) => {
    setCategory(newCategory);

    if (newCategory === 'AUTHENTICATION') {
      setHeaderType('NONE');
      setHeaderText('');
      setBodyText('Your FGSN verification code is {{1}}. Valid for 10 minutes. Do not share this OTP with anyone.');
      setFooterText('Security Notification • Freedom Global Sports');
      setButtons([
        { id: 'btn_auth', type: 'COPY_CODE', text: 'Copy OTP Code', code: '948201' }
      ]);
      setVarValues({ '1': '948201' });
    } else if (newCategory === 'UTILITY') {
      setHeaderType('TEXT');
      setHeaderText('Match Pass & Order Confirmation');
      setBodyText('Hello {{1}}, your FGSN Match Pass for {{2}} is confirmed! Access starts 30 minutes before kickoff.');
      setFooterText('24/7 FGSN Customer Support');
      setButtons([
        { id: 'btn_u1', type: 'URL', text: 'View Tournament Pass', url: 'https://fgsnlive.com/pass' },
        { id: 'btn_u2', type: 'PHONE_NUMBER', text: 'Call Support Desk', phone: '+918655851749' }
      ]);
      setVarValues({ '1': 'Elena', '2': 'Premier League Quarter-Final' });
    } else {
      // MARKETING
      setHeaderType('TEXT');
      setHeaderText('Exclusive VIP Match Offer');
      setBodyText('Hi {{1}}, get 20% off all upcoming season tournament passes with promo code {{2}}.');
      setFooterText('Reply STOP to unsubscribe');
      setButtons([
        { id: 'btn_m1', type: 'URL', text: 'Claim 20% Off', url: 'https://fgsnlive.com/shop' },
        { id: 'btn_m2', type: 'QUICK_REPLY', text: 'Remind Me Later' }
      ]);
      setVarValues({ '1': 'Elena', '2': 'FGSN20' });
    }
  };

  const handleVarChange = (key: string, val: string) => {
    setVarValues(prev => ({ ...prev, [key]: val }));
  };

  // Add next dynamic variable in text
  const handleInsertVariable = () => {
    const nextNum = bodyVariables.length > 0 ? Math.max(...bodyVariables.map(Number)) + 1 : 1;
    setBodyText(prev => `${prev} {{${nextNum}}}`);
    if (!varValues[String(nextNum)]) {
      setVarValues(prev => ({ ...prev, [String(nextNum)]: `Sample_${nextNum}` }));
    }
  };

  const handleWrapText = (prefix: string, suffix: string = prefix) => {
    setBodyText(prev => `${prev} ${prefix}sample${suffix}`);
  };

  const handleAddEmoji = (emoji: string) => {
    setBodyText(prev => `${prev}${emoji}`);
  };

  // Button management
  const handleAddButton = () => {
    if (buttons.length >= 3) return;
    const newBtn: TemplateButtonConfig = {
      id: `btn_${Date.now()}`,
      type: 'QUICK_REPLY',
      text: `Action ${buttons.length + 1}`,
    };
    setButtons(prev => [...prev, newBtn]);
  };

  const handleUpdateButton = (id: string, updates: Partial<TemplateButtonConfig>) => {
    setButtons(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleRemoveButton = (id: string) => {
    setButtons(prev => prev.filter(b => b.id !== id));
  };

  // Render WhatsApp markdown with sample values and authentic styling
  const renderWhatsAppText = (rawText: string) => {
    if (!rawText) return null;

    // First replace dynamic variables {{n}} with sample values
    let processed = rawText;
    allDetectedVariables.forEach((k) => {
      const sample = varValues[k] || `{{${k}}}`;
      processed = processed.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), `⟦VAR_${k}_${sample}⟧`);
    });

    // Split lines
    const lines = processed.split('\n');

    return lines.map((line, lIdx) => {
      // Regex parsing for bold *text*, italic _text_, strikethrough ~text~, code `text`
      const parts: React.ReactNode[] = [];
      let cursor = 0;

      // Tokenize WhatsApp formatting
      const regex = /(⟦VAR_\d+_[^⟧]+⟧|\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        if (match.index > cursor) {
          parts.push(line.substring(cursor, match.index));
        }

        const token = match[0];
        if (token.startsWith('⟦VAR_')) {
          const content = token.replace(/^⟦VAR_\d+_/, '').replace(/⟧$/, '');
          parts.push(
            <span key={`var-${match.index}`} className="wa-var-highlight" title="Dynamic Parameter">
              {content}
            </span>
          );
        } else if (token.startsWith('*') && token.endsWith('*')) {
          parts.push(<strong key={`b-${match.index}`}>{token.slice(1, -1)}</strong>);
        } else if (token.startsWith('_') && token.endsWith('_')) {
          parts.push(<em key={`i-${match.index}`}>{token.slice(1, -1)}</em>);
        } else if (token.startsWith('~') && token.endsWith('~')) {
          parts.push(<del key={`s-${match.index}`}>{token.slice(1, -1)}</del>);
        } else if (token.startsWith('`') && token.endsWith('`')) {
          parts.push(<code key={`c-${match.index}`} className="wa-inline-code">{token.slice(1, -1)}</code>);
        }

        cursor = regex.lastIndex;
      }

      if (cursor < line.length) {
        parts.push(line.substring(cursor));
      }

      return (
        <React.Fragment key={lIdx}>
          {parts.length > 0 ? parts : <span>&nbsp;</span>}
          {lIdx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  const checkMiscategorization = (cat: TemplateCategory, body: string, header: string) => {
    if (cat !== 'UTILITY') return null;
    const combined = `${header} ${body}`.toLowerCase();
    const hit = PROMOTIONAL_KEYWORDS.find((kw) => combined.includes(kw));
    return hit
      ? `Meta Compliance Alert: Contains promotional terminology ("${hit}"). Meta will classify this template as Marketing and apply the marketing rate.`
      : null;
  };

  const warning = checkMiscategorization(category, bodyText, headerType === 'TEXT' ? headerText : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !bodyText.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    // Strict Meta snake_case name formatting
    const formattedName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    let headerObj: any = undefined;
    if (headerType === 'TEXT' && headerText.trim()) {
      headerObj = { type: 'TEXT', text: headerText.trim() };
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
      headerObj = { type: headerType, url: headerMediaUrl.trim() };
    }

    const buttonsObj: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE'; text: string; url?: string; phone?: string; code?: string }> = buttons.map(b => {
      if (b.type === 'URL') {
        return { type: 'URL' as const, text: b.text.trim(), url: b.url?.trim() || 'https://fgsnlive.com' };
      }
      if (b.type === 'PHONE_NUMBER') {
        return { type: 'PHONE_NUMBER' as const, text: b.text.trim(), phone: b.phone?.trim() || '+918655851749' };
      }
      if (b.type === 'COPY_CODE') {
        return { type: 'COPY_CODE' as const, text: b.text.trim(), code: b.code?.trim() || 'FGSN20' };
      }
      return { type: 'QUICK_REPLY' as const, text: b.text.trim() };
    });

    try {
      const result = await onCreateTemplate({
        name: formattedName,
        language,
        category,
        status: 'PENDING',
        bodyJson: {
          header: headerObj,
          body: bodyText,
          footer: footerText.trim() || undefined,
          buttons: buttonsObj.length > 0 ? buttonsObj : undefined,
        },
        sampleVariables: varValues,
        warning: warning || undefined,
      });

      if (result && (result as any).success === false) {
        setFeedback({
          type: 'error',
          message: (result as any).message || 'Meta API rejected this template. Saved as local draft.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Template "${formattedName}" successfully saved and submitted to Meta Cloud API! Status: PENDING / REVIEW.`,
        });
        setName('');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to submit template to Meta API',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="view-container">
      <div className="page-header-row">
        <div>
          <h2 className="view-title">Template Studio & Meta WhatsApp Manager</h2>
          <p className="view-subtitle">Author, configure variables, and submit compliant WhatsApp Cloud API message templates with real-time iPhone & Android preview</p>
        </div>
      </div>

      <div className="template-grid-split">
        {/* Left: Template Builder Form */}
        <div className="panel-card template-editor-card">
          <div className="template-section-header">
            <div>
              <h3 className="panel-title" style={{ margin: 0 }}>Template Configuration</h3>
              <p className="panel-desc" style={{ marginTop: 2, marginBottom: 0 }}>
                Build templates matching Meta WhatsApp Manager specification.
              </p>
            </div>
            <span className="badge-meta-spec">Meta v21.0 Compliant</span>
          </div>

          <form onSubmit={handleSubmit} className="template-form" style={{ marginTop: 16 }}>
            {/* Template Name & Category */}
            <div className="form-group">
              <label>Template Identifier (lowercase_snake_case) *</label>
              <input
                type="text"
                required
                placeholder="e.g. fgsn_match_pass_alert"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
              <span className="field-hint" style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Only lowercase alphanumeric characters and underscores are accepted by Meta.
              </span>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Category *</label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as TemplateCategory)}
                  className="form-input"
                >
                  <option value="MARKETING">Marketing (Promotions, Offers & News)</option>
                  <option value="UTILITY">Utility (Order Updates, Pass Confirmations)</option>
                  <option value="AUTHENTICATION">Authentication (OTPs & Security Codes)</option>
                </select>
              </div>

              <div className="form-group half">
                <label>Language *</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="form-input"
                >
                  <option value="en_US">English (US) - en_US</option>
                  <option value="en_GB">English (UK) - en_GB</option>
                  <option value="hi_IN">Hindi (India) - hi_IN</option>
                  <option value="es_ES">Spanish - es_ES</option>
                  <option value="pt_BR">Portuguese (BR) - pt_BR</option>
                  <option value="fr_FR">French - fr_FR</option>
                  <option value="ar">Arabic - ar</option>
                </select>
              </div>
            </div>

            {/* Header Configuration */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ margin: 0 }}>Header (Optional)</label>
                {headerType === 'TEXT' && (
                  <span className="char-counter">{headerText.length} / 60</span>
                )}
              </div>

              <div className="btn-group-segmented" style={{ marginBottom: 10 }}>
                {(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    className={`btn-seg-item ${headerType === fmt ? 'active' : ''}`}
                    onClick={() => setHeaderType(fmt)}
                  >
                    {fmt === 'NONE' ? 'None' : fmt === 'TEXT' ? 'Text' : fmt === 'IMAGE' ? '📷 Image' : fmt === 'VIDEO' ? '🎥 Video' : '📄 Document'}
                  </button>
                ))}
              </div>

              {headerType === 'TEXT' && (
                <input
                  type="text"
                  maxLength={60}
                  placeholder="e.g. Exclusive VIP Match Pass Announcement"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="form-input"
                />
              )}

              {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                <div>
                  <input
                    type="url"
                    placeholder="Sample Media URL (e.g. https://images.unsplash.com/... or https://fgsnlive.com/media/banner.jpg)"
                    value={headerMediaUrl}
                    onChange={(e) => setHeaderMediaUrl(e.target.value)}
                    className="form-input"
                  />
                  <span className="field-hint" style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 3 }}>
                    Meta requires a sample media URL to review media templates.
                  </span>
                </div>
              )}
            </div>

            {/* Body Copy with Meta WhatsApp Manager Toolbar */}
            <div className="form-group">
              <div className="template-toolbar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                <label style={{ margin: 0 }}>Body Copy (Required) *</label>
                <span className="char-counter">{bodyText.length} / 1024</span>
              </div>

              {/* Formatting & Variable Bar */}
              <div className="meta-wa-toolbar">
                <button
                  type="button"
                  className="meta-tool-btn add-var-pill"
                  onClick={handleInsertVariable}
                  title="Insert dynamic parameter (e.g. {{1}})"
                >
                  <span style={{ fontWeight: 700 }}>+</span> Add Variable
                </button>

                <div className="meta-tool-divider" />

                <button
                  type="button"
                  className="meta-tool-btn"
                  onClick={() => handleWrapText('*')}
                  title="Bold (*text*)"
                >
                  <strong>B</strong>
                </button>

                <button
                  type="button"
                  className="meta-tool-btn"
                  onClick={() => handleWrapText('_')}
                  title="Italic (_text_)"
                >
                  <em>I</em>
                </button>

                <button
                  type="button"
                  className="meta-tool-btn"
                  onClick={() => handleWrapText('~')}
                  title="Strikethrough (~text~)"
                >
                  <del>S</del>
                </button>

                <button
                  type="button"
                  className="meta-tool-btn"
                  onClick={() => handleWrapText('`')}
                  title="Monospace (`code`)"
                >
                  <code>&lt;&gt;</code>
                </button>

                <div className="meta-tool-divider" />

                {/* Quick Emojis */}
                <div className="meta-emoji-strip">
                  {EMOJIS.slice(0, 8).map(em => (
                    <button
                      key={em}
                      type="button"
                      className="meta-emoji-btn"
                      onClick={() => handleAddEmoji(em)}
                      title={`Insert ${em}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={5}
                required
                maxLength={1024}
                placeholder="Hello {{1}}, welcome to Freedom Global Sports Network! Use promo code {{2}} to get 20% off..."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="form-input textarea"
                style={{ fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit' }}
              />
            </div>

            {/* Variable Samples Sandbox (Meta Strict Requirement) */}
            {allDetectedVariables.length > 0 && (
              <div className="variable-test-container" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="var-test-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚡</span> Sample Variable Values (Required by Meta Graph API):
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Live Updated in Preview</span>
                </div>
                
                <div className="var-inputs-row">
                  {allDetectedVariables.map((vNum) => (
                    <div key={vNum} className="var-input-group">
                      <label>{`{{${vNum}}}`} Sample:</label>
                      <input
                        type="text"
                        required
                        value={varValues[vNum] || ''}
                        onChange={(e) => handleVarChange(vNum, e.target.value)}
                        placeholder={`e.g. Elena or FGSN20`}
                        className="form-input sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Text */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ margin: 0 }}>Footer Text (Optional)</label>
                <span className="char-counter">{footerText.length} / 60</span>
              </div>
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. Reply STOP to unsubscribe or FGSN Support"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Interactive Multi-Buttons Section */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <label style={{ margin: 0 }}>Interactive Buttons (Up to 3 Buttons)</label>
                  <span className="field-hint" style={{ display: 'block', fontSize: '0.72rem', color: '#64748B' }}>
                    Add Quick Replies, Website Links, Phone Call, or Copy Code CTAs
                  </span>
                </div>
                {buttons.length < 3 && (
                  <button
                    type="button"
                    className="btn-add-meta-button"
                    onClick={handleAddButton}
                  >
                    + Add Button
                  </button>
                )}
              </div>

              {buttons.length === 0 ? (
                <div className="empty-buttons-hint">
                  No buttons added. Click <strong>+ Add Button</strong> to attach interactive actions.
                </div>
              ) : (
                <div className="meta-buttons-list">
                  {buttons.map((btn, index) => (
                    <div key={btn.id} className="meta-button-item-card">
                      <div className="meta-button-header-row">
                        <span className="meta-button-badge">Button #{index + 1}</span>
                        <div className="meta-button-type-select">
                          <select
                            value={btn.type}
                            onChange={(e) => handleUpdateButton(btn.id, { type: e.target.value as any })}
                            className="form-input sm-select"
                          >
                            <option value="QUICK_REPLY">Quick Reply</option>
                            <option value="URL">Visit Website (URL)</option>
                            <option value="PHONE_NUMBER">Call Phone Number</option>
                            <option value="COPY_CODE">Copy Offer Code</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-btn"
                          onClick={() => handleRemoveButton(btn.id)}
                          title="Remove Button"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="meta-button-fields-row">
                        <div className="btn-field-col" style={{ flex: 1 }}>
                          <label className="sm-label">Button Title (Max 25 chars)</label>
                          <input
                            type="text"
                            required
                            maxLength={25}
                            placeholder="e.g. Shop Now"
                            value={btn.text}
                            onChange={(e) => handleUpdateButton(btn.id, { text: e.target.value })}
                            className="form-input sm"
                          />
                        </div>

                        {btn.type === 'URL' && (
                          <div className="btn-field-col" style={{ flex: 1.5 }}>
                            <label className="sm-label">Website URL</label>
                            <input
                              type="url"
                              required
                              placeholder="https://fgsnlive.com/shop"
                              value={btn.url || ''}
                              onChange={(e) => handleUpdateButton(btn.id, { url: e.target.value })}
                              className="form-input sm"
                            />
                          </div>
                        )}

                        {btn.type === 'PHONE_NUMBER' && (
                          <div className="btn-field-col" style={{ flex: 1.5 }}>
                            <label className="sm-label">Phone Number (with Country Code)</label>
                            <input
                              type="tel"
                              required
                              placeholder="+918655851749"
                              value={btn.phone || ''}
                              onChange={(e) => handleUpdateButton(btn.id, { phone: e.target.value })}
                              className="form-input sm"
                            />
                          </div>
                        )}

                        {btn.type === 'COPY_CODE' && (
                          <div className="btn-field-col" style={{ flex: 1.5 }}>
                            <label className="sm-label">Coupon / OTP Code</label>
                            <input
                              type="text"
                              required
                              placeholder="FGSN20"
                              value={btn.code || ''}
                              onChange={(e) => handleUpdateButton(btn.id, { code: e.target.value })}
                              className="form-input sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meta Miscategorization Compliance Guard */}
            {warning && (
              <div className="compliance-warning-card">
                <p>{warning}</p>
              </div>
            )}

            {/* Status Feedback Banner */}
            {feedback && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  background: feedback.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                  border: `1px solid ${feedback.type === 'success' ? '#A7F3D0' : '#FECACA'}`,
                  color: feedback.type === 'success' ? '#047857' : '#DC2626',
                }}
              >
                {feedback.type === 'success' ? '✓ ' : '⚠️ '}
                {feedback.message}
              </div>
            )}

            {canCreateTemplates(currentUser?.role) ? (
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
                style={{ marginTop: 14, width: '100%', padding: '12px 18px', fontSize: '0.92rem' }}
              >
                {isSubmitting ? '⏳ Submitting to Meta Graph API...' : '🚀 Save & Submit Template to Meta Cloud API'}
              </button>
            ) : (
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#F1F5F9', borderRadius: 8, color: '#64748B', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                🔒 Template Submission Restricted (Admin / Marketer Role Required)
              </div>
            )}
          </form>
        </div>

        {/* Right: Realistic Device Preview with Whole Message Viewport */}
        <div className="panel-card phone-simulator-panel">
          <div className="simulator-header">
            <div className="simulator-badge-row">
              <span className="live-preview-chip">
                <span className="live-dot" />
                Live Preview
              </span>
              <span className="device-tag">WhatsApp Cloud API</span>
            </div>

            {/* View Mode Toggle: Device vs Full Expanded View */}
            <div className="preview-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${previewMode === 'device' ? 'active' : ''}`}
                onClick={() => setPreviewMode('device')}
                title="View inside iPhone 16 Pro device chassis"
              >
                📱 iPhone View
              </button>
              <button
                type="button"
                className={`mode-btn ${previewMode === 'expanded' ? 'active' : ''}`}
                onClick={() => setPreviewMode('expanded')}
                title="View unconstrained full message bubble"
              >
                📜 Full View
              </button>
            </div>
          </div>

          {previewMode === 'device' ? (
            /* iPhone 16 Pro Chassis with Full Smooth Scroll */
            <div className="iphone-chassis">
              {/* Dynamic Island */}
              <div className="iphone-dynamic-island">
                <span className="camera-lens" />
              </div>

              {/* Screen Inner Viewport */}
              <div className="iphone-screen">
                {/* iOS Status Bar */}
                <div className="ios-status-bar">
                  <span className="ios-time">9:41</span>
                  <div className="ios-status-icons">
                    <svg className="ios-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                      <rect x="2" y="16" width="3" height="6" rx="0.5" />
                      <rect x="7" y="12" width="3" height="10" rx="0.5" />
                      <rect x="12" y="8" width="3" height="14" rx="0.5" />
                      <rect x="17" y="4" width="3" height="18" rx="0.5" />
                    </svg>
                    <svg className="ios-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
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
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span className="wa-unread-badge">3</span>
                    </span>
                    
                    <div className="wa-partner-avatar">
                      <img src={fgsnLogo} alt="FGSN" className="wa-avatar-img" />
                    </div>

                    <div className="wa-partner-meta">
                      <div className="wa-partner-name-row">
                        <span className="wa-partner-name">{wabaAccountName}</span>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="#059669" className="verified-shield">
                          <title>Verified Meta Business Account</title>
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      </div>
                      <span className="wa-partner-desc">{displayPhoneNumber} • Business Account</span>
                    </div>
                  </div>

                  <div className="wa-nav-right">
                    <button type="button" className="wa-nav-icon-btn" title="Video Call">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    </button>
                    <button type="button" className="wa-nav-icon-btn" title="Voice Call">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Chat Viewport with Smooth Scroll and Full Visibility */}
                <div className="wa-chat-viewport">
                  {/* Date Capsule */}
                  <div className="wa-date-pill">
                    <span>Today</span>
                  </div>

                  {/* Encryption Shield Banner */}
                  <div className="wa-encryption-bubble">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="#92400E" style={{ flexShrink: 0 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#92400E" strokeWidth="2" fill="none" />
                    </svg>
                    <span>Official WhatsApp Cloud API message with end-to-end encryption.</span>
                  </div>

                  {/* Rendered WhatsApp Message Bubble */}
                  <div className="wa-bubble-card">
                    {/* Image Header */}
                    {headerType === 'IMAGE' && (
                      <div className="wa-bubble-media-header">
                        {headerMediaUrl && headerMediaUrl.startsWith('http') ? (
                          <img src={headerMediaUrl} alt="Template Header" className="wa-bubble-img" />
                        ) : (
                          <div className="wa-media-placeholder">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#64748B" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                            <span>Header Image Attachment</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Video Header */}
                    {headerType === 'VIDEO' && (
                      <div className="wa-bubble-media-header video-header">
                        <div className="wa-video-placeholder">
                          <div className="play-icon-circle">▶</div>
                          <span>Video Preview ({headerMediaUrl.slice(0, 30)}...)</span>
                        </div>
                      </div>
                    )}

                    {/* Document Header */}
                    {headerType === 'DOCUMENT' && (
                      <div className="wa-doc-header-card">
                        <span className="doc-icon">📄</span>
                        <div className="doc-meta">
                          <span className="doc-name">Tournament_Pass_FGSN.pdf</span>
                          <span className="doc-size">PDF • 1.4 MB</span>
                        </div>
                      </div>
                    )}

                    {/* Text Header */}
                    {headerType === 'TEXT' && headerText && (
                      <div className="wa-bubble-header-title">
                        {renderWhatsAppText(headerText)}
                      </div>
                    )}

                    {/* Body Content with Rendered Markdown & Variables */}
                    <div className="wa-bubble-body-content">
                      {renderWhatsAppText(bodyText) || 'Enter your template body copy on the left to see the instant live preview.'}
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

                    {/* Multi-Buttons Stack */}
                    {buttons.length > 0 && (
                      <div className="wa-bubble-actions">
                        {buttons.map((btn) => (
                          <button key={btn.id} type="button" className="wa-action-button">
                            {btn.type === 'URL' && (
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            )}
                            {btn.type === 'PHONE_NUMBER' && (
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                              </svg>
                            )}
                            {btn.type === 'COPY_CODE' && (
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                            {btn.type === 'QUICK_REPLY' && (
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                                <polyline points="15 10 20 15 15 20" />
                                <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                              </svg>
                            )}
                            <span>{btn.text}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom spacer for comfortable scrolling */}
                  <div style={{ height: 16 }} />
                </div>

                {/* Bottom WhatsApp Composer Bar */}
                <div className="wa-ios-composer">
                  <div className="wa-composer-plus">＋</div>
                  <div className="wa-composer-input-pill">
                    <span>Message</span>
                  </div>
                  <div className="wa-composer-icons">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#007AFF" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#007AFF" strokeWidth="2">
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
          ) : (
            /* Expanded Full View - Unclipped for reviewing long messages */
            <div className="expanded-preview-canvas">
              <div className="expanded-preview-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={fgsnLogo} alt="FGSN" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                  <div>
                    <strong style={{ fontSize: 13, color: '#0F172A', display: 'block' }}>{wabaAccountName}</strong>
                    <span style={{ fontSize: 11, color: '#64748B' }}>{displayPhoneNumber} • Verified WhatsApp Account</span>
                  </div>
                </div>
                <span className="full-view-badge">100% Unclipped View</span>
              </div>

              <div className="expanded-chat-bg">
                <div className="wa-bubble-card expanded-bubble">
                  {/* Image Header */}
                  {headerType === 'IMAGE' && (
                    <div className="wa-bubble-media-header" style={{ maxHeight: 240 }}>
                      {headerMediaUrl && headerMediaUrl.startsWith('http') ? (
                        <img src={headerMediaUrl} alt="Template Header" className="wa-bubble-img" style={{ maxHeight: 240 }} />
                      ) : (
                        <div className="wa-media-placeholder" style={{ height: 120 }}>
                          <span>Header Image Attachment</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Video Header */}
                  {headerType === 'VIDEO' && (
                    <div className="wa-bubble-media-header video-header">
                      <div className="wa-video-placeholder">
                        <div className="play-icon-circle">▶</div>
                        <span>Video Stream Attachment ({headerMediaUrl})</span>
                      </div>
                    </div>
                  )}

                  {/* Document Header */}
                  {headerType === 'DOCUMENT' && (
                    <div className="wa-doc-header-card">
                      <span className="doc-icon">📄</span>
                      <div className="doc-meta">
                        <span className="doc-name">Tournament_Pass_FGSN.pdf</span>
                        <span className="doc-size">PDF Document</span>
                      </div>
                    </div>
                  )}

                  {/* Text Header */}
                  {headerType === 'TEXT' && headerText && (
                    <div className="wa-bubble-header-title">
                      {renderWhatsAppText(headerText)}
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="wa-bubble-body-content" style={{ fontSize: 14 }}>
                    {renderWhatsAppText(bodyText)}
                  </div>

                  {/* Footer Content */}
                  {footerText && (
                    <div className="wa-bubble-footer-text">{footerText}</div>
                  )}

                  {/* Time & Double Checkmark */}
                  <div className="wa-bubble-meta-row">
                    <span className="wa-bubble-time">10:42 AM</span>
                    <span className="wa-double-check">✓✓</span>
                  </div>

                  {/* Buttons */}
                  {buttons.length > 0 && (
                    <div className="wa-bubble-actions">
                      {buttons.map((btn) => (
                        <button key={btn.id} type="button" className="wa-action-button" style={{ padding: '11px 14px' }}>
                          <span style={{ fontWeight: 600 }}>{btn.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Templates Table */}
      <div className="panel-card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="panel-title" style={{ margin: 0 }}>Submitted Message Templates</h3>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Total: {templates.length} Templates</span>
        </div>
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
                    <span className={`status-chip ${t.status === 'APPROVED' ? 'success' : t.status === 'PENDING' ? 'warning' : 'danger'}`}>
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
