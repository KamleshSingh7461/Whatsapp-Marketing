import React from 'react';
import { RevenueAnalytics } from '../types';
import { CurrencyCode, formatCurrency, formatRate, getCurrencySymbol } from '../lib/currency';

interface AnalyticsViewProps {
  analytics: RevenueAnalytics;
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analytics,
  currency,
  onCurrencyChange,
}) => {
  const {
    funnel,
    dailyTrend,
    marketingCost,
    utilityCost,
    serviceCost,
    regionalPricing,
    channelComparison,
    freeServiceUsed,
  } = analytics;

  // Conversion rates (guarded for zero-state)
  const deliveryRate = funnel.sent > 0 ? ((funnel.delivered / funnel.sent) * 100).toFixed(1) : '0.0';
  const openRate = funnel.delivered > 0 ? ((funnel.read / funnel.delivered) * 100).toFixed(1) : '0.0';
  const clickReplyRate = funnel.read > 0 ? ((funnel.engaged / funnel.read) * 100).toFixed(1) : '0.0';
  const finalConversionRate = funnel.engaged > 0 ? ((funnel.converted / funnel.engaged) * 100).toFixed(1) : '0.0';
  const overallSentToConverted = funnel.sent > 0 ? ((funnel.converted / funnel.sent) * 100).toFixed(1) : '0.0';

  // Total cost breakdown
  const totalCost = marketingCost + utilityCost + serviceCost;
  const mktPercent = totalCost > 0 ? Math.round((marketingCost / totalCost) * 100) : 0;
  const utilPercent = totalCost > 0 ? Math.round((utilityCost / totalCost) * 100) : 0;
  const srvPercent = totalCost > 0 ? 100 - mktPercent - utilPercent : 0;

  const maxRevenue = Math.max(...dailyTrend.map(d => d.revenue), 1000);
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="view-container">
      {/* Executive Page Header */}
      <div className="page-header-row">
        <div>
          <h2 className="view-title">Sales Performance & Revenue Attribution</h2>
          <p className="view-subtitle">
            Comprehensive financial analytics across broadcast marketing, automated recoveries, and Meta Cloud API spend.
          </p>
        </div>
        <div className="currency-segmented-group" title="Select Display Currency">
          {(['USD', 'EUR', 'INR', 'GBP'] as const).map(c => (
            <button
              key={c}
              className={`currency-seg-btn ${currency === c ? 'active' : ''}`}
              onClick={() => onCurrencyChange(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {funnel.sent === 0 && (
        <div className="corporate-guide-box" style={{ background: '#F8FAFC', borderLeft: '4px solid #059669', marginBottom: 20 }}>
          <h3 className="guide-title">Production Dashboard Initialized</h3>
          <p style={{ fontSize: '0.84rem', color: '#475569' }}>
            Live delivery efficiency, read rates, and attributed sales will stream here automatically as broadcast campaigns and automated workflows are dispatched.
          </p>
        </div>
      )}

      {/* 4 Core Financial Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Attributed Revenue</span>
            <span className="metric-trend-badge positive">+{analytics.revenueGrowth}%</span>
          </div>
          <div className="metric-primary-value">
            {formatCurrency(analytics.totalRevenue, currency)}
          </div>
          <div className="metric-footer-text">
            Average Order Value: <strong>{formatCurrency(analytics.averageOrderValue, currency, 2)}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Marketing Return on Spend</span>
            <span className="metric-trend-badge highlight">{analytics.roiMultiplier.toFixed(1)}x ROI</span>
          </div>
          <div className="metric-primary-value">{analytics.roiMultiplier.toFixed(1)}x</div>
          <div className="metric-footer-text">
            {formatCurrency(analytics.totalSpend > 0 ? analytics.totalRevenue / analytics.totalSpend : 0, currency, 2)} return per {formatCurrency(1, currency)} spent on Meta API
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">LTV to CAC Ratio</span>
            <span className="metric-trend-badge neutral">{analytics.cacValue > 0 ? (analytics.ltvValue / analytics.cacValue).toFixed(1) : '0.0'}x</span>
          </div>
          <div className="metric-primary-value">
            {formatCurrency(analytics.ltvValue, currency)} <span className="sub-unit">LTV</span>
          </div>
          <div className="metric-footer-text">
            Customer Acquisition Cost: <strong>{formatCurrency(analytics.cacValue, currency, 2)}</strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Free Care Quota Remaining</span>
            <span className="metric-trend-badge positive">{1000 - freeServiceUsed} left</span>
          </div>
          <div className="metric-primary-value">{1000 - freeServiceUsed} <span className="sub-unit">/ 1,000</span></div>
          <div className="metric-footer-text">
            Standard Meta 1,000 monthly zero-cost service chats
          </div>
        </div>
      </div>

      {/* Conversion Funnel + Trajectory Charts */}
      <div className="charts-double-row">
        {/* Conversion Funnel Column */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">End-to-End Conversion Funnel</h3>
              <p className="panel-desc">Recipient stage drop-off from broadcast dispatch to order checkout</p>
            </div>
            <span className="status-chip success">{overallSentToConverted}% Net Conversion</span>
          </div>

          <div className="funnel-container">
            {/* Step 1: Sent */}
            <div className="funnel-step">
              <div className="funnel-info">
                <span className="step-name">1. Messages Dispatched</span>
                <span className="step-count">{funnel.sent.toLocaleString()}</span>
              </div>
              <div className="funnel-track">
                <div className="funnel-bar f-step-1" style={{ width: funnel.sent > 0 ? '100%' : '0%' }} />
              </div>
              <div className="step-dropoff">{funnel.sent > 0 ? '100% baseline volume' : 'No messages dispatched yet'}</div>
            </div>

            {/* Step 2: Delivered */}
            <div className="funnel-step">
              <div className="funnel-info">
                <span className="step-name">2. Successfully Delivered</span>
                <span className="step-count">{funnel.delivered.toLocaleString()} ({deliveryRate}%)</span>
              </div>
              <div className="funnel-track">
                <div className="funnel-bar f-step-2" style={{ width: `${deliveryRate}%` }} />
              </div>
              <div className="step-dropoff">Carrier network delivery efficiency</div>
            </div>

            {/* Step 3: Read */}
            <div className="funnel-step">
              <div className="funnel-info">
                <span className="step-name">3. Read & Opened</span>
                <span className="step-count">{funnel.read.toLocaleString()} ({openRate}% of delivered)</span>
              </div>
              <div className="funnel-track">
                <div className="funnel-bar f-step-3" style={{ width: `${openRate}%` }} />
              </div>
              <div className="step-dropoff">Recipient open confirmation rate</div>
            </div>

            {/* Step 4: Clicked / Engaged */}
            <div className="funnel-step">
              <div className="funnel-info">
                <span className="step-name">4. CTA Clicked / Inbound Replies</span>
                <span className="step-count">{funnel.engaged.toLocaleString()} ({clickReplyRate}% CTR)</span>
              </div>
              <div className="funnel-track">
                <div className="funnel-bar f-step-4" style={{ width: `${clickReplyRate}%` }} />
              </div>
              <div className="step-dropoff">Interactive quick-reply button clicks and customer replies</div>
            </div>

            {/* Step 5: Converted */}
            <div className="funnel-step highlight-step">
              <div className="funnel-info">
                <span className="step-name">5. Purchases & Conversions</span>
                <span className="step-count text-primary-brand">{funnel.converted.toLocaleString()} Orders ({finalConversionRate}%)</span>
              </div>
              <div className="funnel-track">
                <div className="funnel-bar f-step-5" style={{ width: `${finalConversionRate}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Revenue Trajectory */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Revenue & Dispatch Trajectory</h3>
              <p className="panel-desc">Daily revenue compared against broadcast message volume</p>
            </div>
          </div>

          <div className="chart-legend-corporate">
            <span className="legend-item"><span className="legend-box brand" /> Revenue ({symbol})</span>
            <span className="legend-item"><span className="legend-box blue" /> Volume Sent</span>
            <span className="legend-item"><span className="legend-box slate" /> Meta Cost ({symbol})</span>
          </div>

          <div className="trend-bar-chart">
            {dailyTrend.map((item, idx) => {
              const heightPercent = maxRevenue > 0 ? Math.round((item.revenue / maxRevenue) * 100) : 0;
              return (
                <div className="trend-column" key={idx}>
                  <div className="bar-tooltip">
                    <strong>{item.date}</strong>
                    <div>Revenue: {formatCurrency(item.revenue, currency)}</div>
                    <div>Conversions: {item.conversions}</div>
                    <div>Cost: {formatCurrency(item.cost, currency, 2)}</div>
                  </div>
                  <div className="column-bars">
                    <div className="bar-revenue" style={{ height: `${heightPercent}%` }} />
                  </div>
                  <span className="column-label">{item.date}</span>
                </div>
              );
            })}
          </div>

          {/* Meta Cost Breakdown by Category */}
          <div className="cost-breakdown-box">
            <h4 className="cost-title">Meta API Spend Distribution by Category</h4>
            <div className="stacked-cost-bar">
              <div
                className="cost-segment marketing"
                style={{ width: `${mktPercent}%` }}
                title={`Marketing: ${formatCurrency(marketingCost, currency)}`}
              />
              <div
                className="cost-segment utility"
                style={{ width: `${utilPercent}%` }}
                title={`Utility: ${formatCurrency(utilityCost, currency)}`}
              />
              <div
                className="cost-segment service"
                style={{ width: `${srvPercent}%` }}
                title={`Service: ${formatCurrency(serviceCost, currency)}`}
              />
            </div>
            <div className="cost-legend-row">
              <div className="cost-legend-tag">
                <span className="tag-dot mkt" /> Marketing ({mktPercent}% — {formatCurrency(marketingCost, currency)})
              </div>
              <div className="cost-legend-tag">
                <span className="tag-dot util" /> Utility & Tracking ({utilPercent}% — {formatCurrency(utilityCost, currency)})
              </div>
              <div className="cost-legend-tag">
                <span className="tag-dot srv" /> Customer Care ({srvPercent}% — {formatCurrency(serviceCost, currency)})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Channel Benchmarks & Regional Rate Matrix */}
      <div className="charts-double-row" style={{ marginTop: 24 }}>
        {/* Channel Benchmarks Table */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Cross-Channel ROI Benchmark</h3>
              <p className="panel-desc">WhatsApp performance metrics against traditional enterprise channels</p>
            </div>
          </div>

          <table className="corporate-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Open Rate</th>
                <th>CTR</th>
                <th>Conversion Rate</th>
                <th>ROI Multiple</th>
              </tr>
            </thead>
            <tbody>
              <tr className="featured-row">
                <td><strong className="text-primary-brand">WhatsApp Business</strong></td>
                <td><strong>{channelComparison.whatsapp.openRate}%</strong></td>
                <td><strong>{channelComparison.whatsapp.ctr}%</strong></td>
                <td><strong>{channelComparison.whatsapp.conversionRate}%</strong></td>
                <td><span className="status-chip success">{channelComparison.whatsapp.roi}x</span></td>
              </tr>
              <tr>
                <td>SMS Marketing</td>
                <td>{channelComparison.sms.openRate}%</td>
                <td>{channelComparison.sms.ctr}%</td>
                <td>{channelComparison.sms.conversionRate}%</td>
                <td>{channelComparison.sms.roi}x</td>
              </tr>
              <tr>
                <td>Email Marketing</td>
                <td>{channelComparison.email.openRate}%</td>
                <td>{channelComparison.email.ctr}%</td>
                <td>{channelComparison.email.conversionRate}%</td>
                <td>{channelComparison.email.roi}x</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Regional Pricing Matrix */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Meta Cloud API Regional Rates ({currency})</h3>
              <p className="panel-desc">Per-conversation rate schedule across primary operating markets</p>
            </div>
          </div>

          <table className="corporate-table mini">
            <thead>
              <tr>
                <th>Region</th>
                <th>Marketing</th>
                <th>Utility</th>
                <th>Service</th>
                <th>Auth (OTP)</th>
              </tr>
            </thead>
            <tbody>
              {regionalPricing.map((r) => (
                <tr key={r.code}>
                  <td><strong>{r.country}</strong></td>
                  <td>{formatRate(r.marketingRate, currency, 4)}</td>
                  <td>{formatRate(r.utilityRate, currency, 4)}</td>
                  <td>{formatRate(r.serviceRate, currency, 4)}</td>
                  <td>{formatRate(r.authRate, currency, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
