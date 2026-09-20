import React, { useState } from 'react';
import { AutomationFlow, Template } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';
import type { TabType } from './Sidebar';
import { ReplyRulesPanel } from './ReplyRulesPanel';

interface AutomationsViewProps {
  flows: AutomationFlow[];
  templates?: Template[];
  currency?: CurrencyCode;
  onToggleStatus: (flowId: string) => void;
  onNavigate?: (tab: TabType) => void;
}

const HOW_IT_WORKS: Array<{ title: string; body: string }> = [
  {
    title: 'A customer does something',
    body: 'For example, they tap a button such as “Interested” on a broadcast you sent.',
  },
  {
    title: 'A rule notices it',
    body: 'Every automation is one simple rule: “When this happens, do that.”',
  },
  {
    title: 'The system acts for you',
    body: 'It replies instantly and tags the contact, day or night, so your team knows who to follow up with.',
  },
];

const META_RULES: Array<{ title: string; body: string }> = [
  {
    title: 'You start a conversation with a template',
    body: 'WhatsApp only lets a business message a customer first using a template that Meta has approved. Broadcasts always use one.',
  },
  {
    title: 'A reply opens a 24-hour window',
    body: 'When a customer answers or taps a button, you can send normal free-text messages for the next 24 hours. Automatic replies work inside this window, which is why they can be plain text.',
  },
  {
    title: 'Only message people who agreed to it',
    body: 'Contacts who have not opted in are left out of broadcasts automatically. Keep it that way. Meta can restrict accounts that message people who did not ask.',
  },
];

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  flows,
  templates = [],
  currency = 'INR',
  onToggleStatus,
  onNavigate,
}) => {
  const [selectedFlowId, setSelectedFlowId] = useState<string>(flows[0]?.id || '');

  const activeFlow = flows.find(f => f.id === selectedFlowId) || flows[0];

  const totalAutoRevenue = flows.reduce((acc, f) => acc + f.stats.revenue, 0);
  const totalTriggered = flows.reduce((acc, f) => acc + f.stats.triggered, 0);
  const totalConverted = flows.reduce((acc, f) => acc + f.stats.converted, 0);

  const openTab = (tab: TabType, label: string) =>
    onNavigate ? (
      <button type="button" className="wa-au-link" onClick={() => onNavigate(tab)}>
        {label}
      </button>
    ) : (
      <strong>{label}</strong>
    );

  return (
    <div className="view-container wa-au-page">
      <div className="wa-au-hero">
        <h2 className="wa-au-title">Automations</h2>
        <p className="wa-au-lede">
          Automations are replies and follow-ups your account sends by itself, so no customer is left waiting, even at
          night or on weekends. New to WhatsApp Business? Read this page top to bottom. It takes two minutes.
        </p>
      </div>

      {/* 1. The idea, in plain words */}
      <section className="wa-au-card" aria-labelledby="au-how">
        <h3 className="wa-au-h" id="au-how">What is an automation?</h3>
        <ol className="wa-au-steps three">
          {HOW_IT_WORKS.map((s, i) => (
            <li key={s.title} className="wa-au-step">
              <span className="wa-au-num" aria-hidden="true">{i + 1}</span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 2. Reply rules: the automations that are live, managed here */}
      <ReplyRulesPanel templates={templates} onNavigate={onNavigate} />

      {/* 3. How to actually use it */}
      <section className="wa-au-card" aria-labelledby="au-use">
        <h3 className="wa-au-h" id="au-use">How to use it, step by step</h3>
        <ol className="wa-au-steps">
          <li className="wa-au-step">
            <span className="wa-au-num" aria-hidden="true">1</span>
            <div>
              <strong>Create a template with a button.</strong>
              <p>
                Go to {openTab('templates', 'Templates')}, write your message, and add a <em>Quick Reply</em> button, for
                example “Interested” or “Yes”. Submit it to Meta and wait until its status shows <em>Approved</em>.
              </p>
            </div>
          </li>
          <li className="wa-au-step">
            <span className="wa-au-num" aria-hidden="true">2</span>
            <div>
              <strong>Send it as a broadcast.</strong>
              <p>
                Go to {openTab('campaigns', 'Broadcasts')}, pick your approved template and your audience, and launch.
                Only contacts who opted in will receive it.
              </p>
            </div>
          </li>
          <li className="wa-au-step">
            <span className="wa-au-num" aria-hidden="true">3</span>
            <div>
              <strong>Create a reply rule for that template.</strong>
              <p>
                Above, click <em>New rule</em> and choose the template and its button. Add tags, and an automatic reply
                if you want one. You can do this before or after sending.
              </p>
            </div>
          </li>
          <li className="wa-au-step">
            <span className="wa-au-num" aria-hidden="true">4</span>
            <div>
              <strong>Customers tap the button. The rule does the rest.</strong>
              <p>They are tagged, get the reply, and are added to that rule’s list. You do not need to do anything.</p>
            </div>
          </li>
          <li className="wa-au-step">
            <span className="wa-au-num" aria-hidden="true">5</span>
            <div>
              <strong>Call them from the call sheet.</strong>
              <p>
                Open {openTab('calls', 'Call sheets')}. Everyone who tapped is listed for each rule. After each call, set
                the status (call pending, called but not picked, call done or follow up pending) and add remarks.
                Managers can see who did what.
              </p>
            </div>
          </li>
          <li className="wa-au-step">
            <span className="wa-au-num" aria-hidden="true">6</span>
            <div>
              <strong>When you change the template, add a new rule.</strong>
              <p>
                A new template or new button wording needs its own rule. Old rules keep collecting taps from old
                broadcasts, and each rule has its own call sheet, so campaigns never get mixed together.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* 4. Meta ground rules */}
      <section className="wa-au-card" aria-labelledby="au-meta">
        <h3 className="wa-au-h" id="au-meta">Three Meta rules to know before you start</h3>
        <ul className="wa-au-rules">
          {META_RULES.map(r => (
            <li key={r.title}>
              <strong>{r.title}</strong>
              <p>{r.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. What is not built yet */}
      <section className="wa-au-card muted" aria-labelledby="au-soon">
        <h3 className="wa-au-h" id="au-soon">
          Not available yet <span className="wa-au-badge soon">Coming later</span>
        </h3>
        <p className="wa-au-sub">
          Custom workflows, such as abandoned-cart reminders, order updates, back-in-stock alerts and timed follow-ups,
          are not built yet. There is no “create workflow” button on this page for that reason: it would not be able to
          save anything. Until they exist, the reply rules above are the only automations running.
        </p>
      </section>

      {/* Custom workflows: only shown once some exist */}
      {flows.length > 0 && (
        <>
          <h3 className="wa-au-h wa-au-section-gap">Your custom workflows</h3>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Automated Attributed Revenue</span>
              </div>
              <div className="metric-primary-value text-primary-brand">{formatCurrency(totalAutoRevenue, currency)}</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Workflow Executions</span>
              </div>
              <div className="metric-primary-value">{totalTriggered.toLocaleString()}</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Completed Conversions</span>
              </div>
              <div className="metric-primary-value">{totalConverted.toLocaleString()} Orders</div>
              <div className="metric-footer-text">
                {totalTriggered > 0 ? ((totalConverted / totalTriggered) * 100).toFixed(1) : '0.0'}% average conversion rate
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span className="metric-label">Active Workflows</span>
              </div>
              <div className="metric-primary-value">{flows.filter(f => f.status === 'ACTIVE').length} Running</div>
            </div>
          </div>

          <div className="automations-split-canvas">
            {/* Left: Workflow List */}
            <div className="panel-card flow-sidebar-panel">
              <h3 className="panel-title" style={{ marginBottom: 12 }}>Configured Automations</h3>
              <div className="flows-list-scroll">
                {flows.map((flow) => {
                  const isSelected = flow.id === selectedFlowId;
                  return (
                    <div
                      key={flow.id}
                      className={`flow-card-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedFlowId(flow.id)}
                    >
                      <div className="flow-card-head">
                        <span className="flow-name">{flow.name}</span>
                        <button
                          className={`status-chip ${flow.status === 'ACTIVE' ? 'success' : 'neutral'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStatus(flow.id);
                          }}
                        >
                          {flow.status === 'ACTIVE' ? 'Active' : 'Paused'}
                        </button>
                      </div>

                      <div className="flow-trigger-tag">
                        <span>Trigger:</span> {flow.triggerEvent}
                      </div>

                      <div className="flow-stats-mini">
                        <div>
                          <span className="f-stat-lbl">Triggered:</span>
                          <strong>{flow.stats.triggered}</strong>
                        </div>
                        <div>
                          <span className="f-stat-lbl">Conversions:</span>
                          <strong>{flow.stats.converted}</strong>
                        </div>
                        {flow.stats.revenue > 0 && (
                          <div>
                            <span className="f-stat-lbl">Revenue:</span>
                            <strong className="text-primary-brand">{formatCurrency(flow.stats.revenue, currency)}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Visual Node Sequence */}
            {activeFlow ? (
              <div className="panel-card workflow-visual-panel">
                <div className="workflow-canvas-header">
                  <div>
                    <span className="flow-kicker">Workflow Configuration</span>
                    <h3 className="flow-canvas-title">{activeFlow.name}</h3>
                    <span className="flow-canvas-trigger">Trigger Source: {activeFlow.triggerEvent}</span>
                  </div>

                  <div className="flow-canvas-stats">
                    <div className="stat-pill-sm">
                      <span>Attributed Sales:</span> <strong>{formatCurrency(activeFlow.stats.revenue, currency)}</strong>
                    </div>
                    <div className="stat-pill-sm">
                      <span>Conversion:</span> <strong>{activeFlow.stats.triggered > 0 ? ((activeFlow.stats.converted / activeFlow.stats.triggered) * 100).toFixed(1) : 0}%</strong>
                    </div>
                  </div>
                </div>

                {/* Visual Node Sequence */}
                <div className="workflow-nodes-container">
                  {activeFlow.steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <div className="workflow-node-card">
                        <div className="node-step-index">
                          {idx + 1}
                        </div>
                        <div className="node-content">
                          <div className="node-header">
                            <span className="node-type-label">{step.type.replace('_', ' ')}</span>
                          </div>
                          <h4 className="node-title">{step.title}</h4>
                          <p className="node-desc">{step.description}</p>
                        </div>
                      </div>

                      {idx < activeFlow.steps.length - 1 && (
                        <div className="node-connector-line" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
