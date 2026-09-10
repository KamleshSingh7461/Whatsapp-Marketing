import React, { useState } from 'react';
import { AutomationFlow } from '../types';
import { CurrencyCode, formatCurrency } from '../lib/currency';

interface AutomationsViewProps {
  flows: AutomationFlow[];
  currency?: CurrencyCode;
  onToggleStatus: (flowId: string) => void;
}

export const AutomationsView: React.FC<AutomationsViewProps> = ({
  flows,
  currency = 'INR',
  onToggleStatus,
}) => {
  const [selectedFlowId, setSelectedFlowId] = useState<string>(flows[0]?.id || '');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const activeFlow = flows.find(f => f.id === selectedFlowId) || flows[0];

  const totalAutoRevenue = flows.reduce((acc, f) => acc + f.stats.revenue, 0);
  const totalTriggered = flows.reduce((acc, f) => acc + f.stats.triggered, 0);
  const totalConverted = flows.reduce((acc, f) => acc + f.stats.converted, 0);

  return (
    <div className="view-container">
      <div className="page-header-row">
        <div>
          <h2 className="view-title">Automated Event-Driven Workflows</h2>
          <p className="view-subtitle">
            Trigger real-time WhatsApp notifications and recovery sequences upon customer webhooks.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsNewModalOpen(true)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create New Workflow
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Automated Attributed Revenue</span>
            <span className="metric-trend-badge positive">24/7 Active</span>
          </div>
          <div className="metric-primary-value text-primary-brand">{formatCurrency(totalAutoRevenue, currency)}</div>
          <div className="metric-footer-text">Directly attributed to recovery drips</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Workflow Executions</span>
          </div>
          <div className="metric-primary-value">{totalTriggered.toLocaleString()}</div>
          <div className="metric-footer-text">Message delivery success rate</div>
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
          <div className="metric-footer-text">Webhook subscriptions verified</div>
        </div>
      </div>

      {/* Split Workflow Directory and Visual Canvas or Zero State */}
      {flows.length === 0 ? (
        <div className="panel-card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#F1F5F9', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>No Automated Workflows Active</h4>
          <p style={{ fontSize: '0.84rem', color: '#64748B', maxWidth: 440, margin: '0 auto 16px auto', lineHeight: 1.4 }}>
            Connect ecommerce triggers (abandoned checkout, back-in-stock alerts, order tracking updates) to recover sales automatically.
          </p>
          <button className="btn-primary" onClick={() => setIsNewModalOpen(true)}>
            Create Your First Workflow
          </button>
        </div>
      ) : (
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
      )}

      {isNewModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create Workflow Automation</h3>
                <p className="modal-subtitle">Configure trigger events and automated WhatsApp recovery drips</p>
              </div>
              <button className="close-btn" onClick={() => setIsNewModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding: '16px 0' }}>
              <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: 16 }}>
                Select an integration event from Shopify, WooCommerce, or Custom Webhooks to trigger automated conversations:
              </p>
              <div className="form-group">
                <label>Workflow Name</label>
                <input type="text" className="form-input" placeholder="e.g. Back-In-Stock Customer Notification" defaultValue="Back-In-Stock Customer Notification" />
              </div>
              <div className="form-group">
                <label>Event Webhook Trigger</label>
                <select className="form-input">
                  <option>Inventory Item Stock Restocked &gt; 0</option>
                  <option>Cart Inactive for 60 Minutes</option>
                  <option>Fulfillment Status Changed to Out for Delivery</option>
                  <option>Customer VIP Tier Achieved</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setIsNewModalOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => setIsNewModalOpen(false)}>Save & Enable Workflow</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
