import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { TabType } from './Sidebar';
import { ReplyRule, ReplyRuleInput, Template } from '../types';
import {
  createReplyRuleApi,
  deleteReplyRuleApi,
  getReplyRulesApi,
  updateReplyRuleApi,
} from '../lib/api';

interface ReplyRulesPanelProps {
  templates: Template[];
  onNavigate?: (tab: TabType) => void;
}

interface FormState {
  name: string;
  templateName: string; // '' = any template
  buttonText: string;
  tags: string;
  replyText: string;
}

const EMPTY_FORM: FormState = { name: '', templateName: '', buttonText: '', tags: '', replyText: '' };

const REPLY_MAX = 1000;

const Icon: React.FC<{ size?: number; children: React.ReactNode }> = ({ size = 16, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto' }}>
    {children}
  </svg>
);

const quickReplyLabels = (t: Template | undefined): string[] =>
  (t?.bodyJson?.buttons || []).filter(b => b.type === 'QUICK_REPLY' && b.text).map(b => b.text);

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const ReplyRulesPanel: React.FC<ReplyRulesPanelProps> = ({ templates, onNavigate }) => {
  const [rules, setRules] = useState<ReplyRule[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReplyRule | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRules(await getReplyRulesApi());
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load your reply rules.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Templates that can be picked: approved ones, so a rule is never set up for something that cannot be sent.
  const pickable = useMemo(
    () => templates.filter(t => t.status === 'APPROVED').sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  );
  const templateNames = useMemo(() => Array.from(new Set(pickable.map(t => t.name))), [pickable]);
  const selectedTemplate = pickable.find(t => t.name === form.templateName);
  const buttonChoices = quickReplyLabels(selectedTemplate);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing('new');
  };

  const openEdit = (rule: ReplyRule) => {
    setForm({
      name: rule.name,
      templateName: rule.templateName || '',
      buttonText: rule.buttonText,
      tags: rule.tags.join(', '),
      replyText: rule.replyText || '',
    });
    setFormError(null);
    setEditing(rule);
  };

  const closeForm = () => {
    if (saving) return;
    setEditing(null);
  };

  const setTemplate = (templateName: string) => {
    const t = pickable.find(x => x.name === templateName);
    const labels = quickReplyLabels(t);
    setForm(f => ({
      ...f,
      templateName,
      // A template with buttons: start from its first button rather than leave a label that may not exist on it.
      buttonText: labels.length > 0 && !labels.includes(f.buttonText) ? labels[0] : f.buttonText,
    }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const input: ReplyRuleInput = {
      name: form.name.trim(),
      templateName: form.templateName.trim() || null,
      buttonText: form.buttonText.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      replyText: form.replyText.trim() || null,
    };
    if (!input.name) return setFormError('Give the rule a name.');
    if (!input.buttonText) return setFormError('Say which button this rule is for.');
    setSaving(true);
    setFormError(null);
    try {
      if (editing && editing !== 'new') await updateReplyRuleApi(editing.id, input);
      else await createReplyRuleApi(input);
      setEditing(null);
      await load();
    } catch (err: any) {
      setFormError(err?.message || 'Could not save the rule.');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (rule: ReplyRule, active: boolean) => {
    setBusyId(rule.id);
    setNotice(null);
    try {
      await updateReplyRuleApi(rule.id, { active });
      await load();
    } catch (err: any) {
      setNotice(err?.message || 'Could not change the rule.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (rule: ReplyRule) => {
    if (!window.confirm(`Delete the rule “${rule.name}”? This cannot be undone.`)) return;
    setBusyId(rule.id);
    setNotice(null);
    try {
      await deleteReplyRuleApi(rule.id);
      await load();
    } catch (err: any) {
      setNotice(err?.message || 'Could not delete the rule.');
    } finally {
      setBusyId(null);
    }
  };

  const isEditingExisting = editing !== null && editing !== 'new';

  return (
    <section className="wa-au-card" aria-labelledby="au-rules">
      <div className="wa-au-card-head">
        <div>
          <h3 className="wa-au-h" id="au-rules">Reply rules</h3>
          <p className="wa-au-sub">
            A reply rule watches for a customer tapping a button on one of your templates. It can tag them, send an
            automatic reply, and puts everyone who tapped on a call sheet for your team to follow up.
          </p>
        </div>
        <button type="button" className="wa-bc-primary wa-rr-new" onClick={openNew}>
          <Icon size={16}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>
          New rule
        </button>
      </div>

      {notice && <div className="wa-rr-notice" role="status">{notice}</div>}

      {rules === null && !loadError && <p className="wa-rr-empty">Loading your rules…</p>}

      {loadError && (
        <div className="wa-rr-notice is-error" role="alert">
          {loadError}{' '}
          <button type="button" className="wa-au-link" onClick={load}>Try again</button>
        </div>
      )}

      {rules !== null && rules.length === 0 && (
        <p className="wa-rr-empty">
          You have no reply rules yet. Create one to start collecting people who tap a button on your template.
        </p>
      )}

      <div className="wa-rr-list">
        {(rules || []).map(rule => (
          <article key={rule.id} className={`wa-rr-rule${rule.active ? '' : ' is-paused'}`}>
            <header className="wa-rr-rule-head">
              <h4>{rule.name}</h4>
              <span className={`wa-bc-status ${rule.active ? 'tone-done' : 'tone-idle'}`}>
                <span className="wa-bc-status-dot" />
                {rule.active ? 'Running' : 'Paused'}
              </span>
            </header>

            <div className="wa-rr-grid">
              <div className="wa-rr-block">
                <span className="wa-au-kicker">When</span>
                <p>
                  A customer taps the <strong>“{rule.buttonText}”</strong> button on{' '}
                  {rule.templateName ? <>the template <strong>{rule.templateName}</strong></> : <strong>any template</strong>}.
                </p>
                {!rule.templateName && (
                  <p className="wa-rr-hint">
                    If you also add a rule for one specific template, that rule is used for that template instead.
                  </p>
                )}
              </div>

              <div className="wa-rr-block">
                <span className="wa-au-kicker">Then</span>
                <ul>
                  <li>
                    {rule.tags.length > 0 ? (
                      <>Adds the tags{' '}{rule.tags.map(t => <span key={t} className="wa-bc-tag">{t}</span>)}</>
                    ) : (
                      'Adds no tags'
                    )}
                  </li>
                  <li>{rule.replyText ? 'Sends this reply:' : 'Sends no automatic reply'}</li>
                </ul>
                {rule.replyText && <div className="wa-au-bubble out wa-rr-bubble">{rule.replyText}</div>}
              </div>
            </div>

            <footer className="wa-rr-foot">
              <span className="wa-rr-count">
                <strong>{rule.leadCount.toLocaleString()}</strong> {rule.leadCount === 1 ? 'person' : 'people'} so far
                {rule.leadCount > 0 ? ` · ${rule.callStatusCounts.CALL_PENDING.toLocaleString()} call pending` : ''}
                {rule.lastLeadAt ? ` · latest ${when(rule.lastLeadAt)}` : ''}
              </span>

              <div className="wa-rr-actions">
                {rule.leadCount > 0 && onNavigate && (
                  <button type="button" className="wa-bc-act is-primary" onClick={() => onNavigate('calls')}>
                    Open call sheet
                  </button>
                )}
                <button type="button" className="wa-bc-act" onClick={() => openEdit(rule)}>Edit</button>
                <button type="button" className="wa-bc-act" disabled={busyId === rule.id} onClick={() => setActive(rule, !rule.active)}>
                  {rule.active ? 'Pause' : 'Resume'}
                </button>
                {rule.leadCount === 0 && (
                  <button type="button" className="wa-st-danger-btn" disabled={busyId === rule.id} onClick={() => remove(rule)}>
                    Delete
                  </button>
                )}
              </div>
            </footer>
          </article>
        ))}
      </div>

      {editing !== null && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="rr-form-title">
          <div className="modal-card" style={{ maxWidth: 520, width: '92%' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" id="rr-form-title">{isEditingExisting ? 'Edit reply rule' : 'New reply rule'}</h3>
                <p className="modal-subtitle">Choose the template and button, then say what should happen when a customer taps it.</p>
              </div>
              <button type="button" className="close-btn" onClick={closeForm} aria-label="Close">✕</button>
            </div>

            <form onSubmit={save}>
              <div className="form-group">
                <label htmlFor="rr-name">Rule name</label>
                <input
                  id="rr-name"
                  className="form-input"
                  type="text"
                  maxLength={80}
                  placeholder="For example: Tournament interest"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="rr-template">Template</label>
                <select id="rr-template" className="form-input" value={form.templateName} onChange={e => setTemplate(e.target.value)}>
                  <option value="">Any template</option>
                  {templateNames.map(n => <option key={n} value={n}>{n}</option>)}
                  {form.templateName && !templateNames.includes(form.templateName) && (
                    <option value={form.templateName}>{form.templateName}</option>
                  )}
                </select>
                <span className="wa-rr-field-hint">
                  Pick the template your broadcast uses. If you change the template later, add a new rule for it.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="rr-button">Button the customer taps</label>
                {buttonChoices.length > 0 ? (
                  <select id="rr-button" className="form-input" value={form.buttonText} onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))}>
                    {buttonChoices.map(b => <option key={b} value={b}>{b}</option>)}
                    {form.buttonText && !buttonChoices.includes(form.buttonText) && <option value={form.buttonText}>{form.buttonText}</option>}
                  </select>
                ) : (
                  <input
                    id="rr-button"
                    className="form-input"
                    type="text"
                    maxLength={60}
                    placeholder="Type the button text exactly as customers see it"
                    value={form.buttonText}
                    onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))}
                    required
                  />
                )}
                <span className="wa-rr-field-hint">Capital letters and extra spaces do not matter.</span>
              </div>

              <div className="form-group">
                <label htmlFor="rr-tags">Tags to add (optional)</label>
                <input
                  id="rr-tags"
                  className="form-input"
                  type="text"
                  placeholder="Separate with commas, for example: Hot Lead, Tournament"
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rr-reply">Automatic reply (optional)</label>
                <textarea
                  id="rr-reply"
                  className="form-input"
                  rows={4}
                  maxLength={REPLY_MAX}
                  placeholder="Leave empty to send no reply"
                  value={form.replyText}
                  onChange={e => setForm(f => ({ ...f, replyText: e.target.value }))}
                />
                <span className="wa-rr-field-hint">
                  Sent as a normal message. WhatsApp allows this because the customer just tapped your button.{' '}
                  {form.replyText.length}/{REPLY_MAX}
                </span>
              </div>

              {formError && <div className="wa-rr-notice is-error" role="alert">{formError}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
