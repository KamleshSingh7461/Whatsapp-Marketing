import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Contact, RFMSegment } from '../types';
import { parseContactsText, ParsedContactResult } from '../lib/contactParser';

interface BulkContactUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingContacts: Contact[];
  onImportContacts: (contacts: Contact[]) => void;
}

export const BulkContactUploadModal: React.FC<BulkContactUploadModalProps> = ({
  isOpen,
  onClose,
  existingContacts,
  onImportContacts,
}) => {
  const [activeTab, setActiveTab] = useState<'sheet' | 'paste'>('sheet');
  const [rawText, setRawText] = useState('');
  const [customTags, setCustomTags] = useState('Instagram Leads, Academics Course');
  const [cohort, setCohort] = useState<RFMSegment>('NEW_LEADS');
  const [parseResult, setParseResult] = useState<ParsedContactResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetInfo, setSheetInfo] = useState<{ sheetName: string; rowCount: number } | null>(null);

  if (!isOpen) return null;

  const handleParse = (text: string, sourceFileName?: string) => {
    setRawText(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const tagsArray = customTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const res = parseContactsText(text, {
      defaultCohort: cohort,
      customTags: tagsArray,
      existingContacts,
    });
    setParseResult(res);
    if (sourceFileName) setFileName(sourceFileName);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const isExcel = /\.(xlsx|xls|ods)$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
          const totalSheetRows = range.e.r - range.s.r;

          setSheetInfo({
            sheetName: firstSheetName,
            rowCount: Math.max(0, totalSheetRows),
          });
          handleParse(csvText, file.name);
        } catch (err: any) {
          alert('Could not read Excel file: ' + (err.message || 'Invalid format'));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV or TSV or plain text
      setSheetInfo(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          handleParse(content, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    if (!parseResult || parseResult.valid.length === 0) return;
    setIsImporting(true);
    try {
      onImportContacts(parseResult.valid);
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        'Full Name': 'Munna YT',
        'Phone Number': '+919734116954',
        'Email': 'mirtitan28@gmail.com',
        'Platform': 'Instagram',
        'Campaign Name': 'Academics Course',
        'Audience Tags': 'Instagram Lead, New Lead',
      },
      {
        'Full Name': 'Satish Yadav',
        'Phone Number': '+917759092310',
        'Email': 'ysatishkumar246@gmail.com',
        'Platform': 'Instagram',
        'Campaign Name': 'Academics Course',
        'Audience Tags': 'Instagram Lead',
      },
      {
        'Full Name': 'Elena Rostova',
        'Phone Number': '+919876543210',
        'Email': 'elena@example.com',
        'Platform': 'Website',
        'Campaign Name': 'Summer Promo',
        'Audience Tags': 'VIP Tier 1',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    XLSX.writeFile(workbook, 'FGSN_Contacts_Template.xlsx');
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-card" style={{ maxWidth: 880, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Bulk Contact & Spreadsheet Upload</h3>
            <p className="modal-subtitle">
              Import contacts directly from Excel Sheets (<code>.xlsx</code>, <code>.xls</code>), CSV files, or Meta & Instagram Lead Ad exports.
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Upload Mode Tabs & Sample Template Download */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`tag-filter-btn ${activeTab === 'sheet' ? 'active' : ''}`}
              onClick={() => setActiveTab('sheet')}
            >
              📊 Upload Excel Sheet / CSV
            </button>
            <button
              type="button"
              className={`tag-filter-btn ${activeTab === 'paste' ? 'active' : ''}`}
              onClick={() => setActiveTab('paste')}
            >
              📋 Paste Text / TSV / Meta Export
            </button>
          </div>

          <button
            type="button"
            className="btn-outline-sm"
            onClick={downloadSampleTemplate}
            title="Download formatted sample Excel spreadsheet"
            style={{ fontSize: '0.78rem' }}
          >
            📥 Download Sample Sheet (.xlsx)
          </button>
        </div>

        {activeTab === 'sheet' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: '2px dashed #25D366',
              borderRadius: 10,
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              backgroundColor: '#F0FDF4',
              marginBottom: 16,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onClick={() => document.getElementById('bulk-sheet-input')?.click()}
          >
            <input
              id="bulk-sheet-input"
              type="file"
              accept=".xlsx,.xls,.ods,.csv,.tsv,.txt"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#166534', marginBottom: 4 }}>
              {fileName ? `Selected File: ${fileName}` : 'Upload Excel Sheet (.xlsx, .xls) or CSV'}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#4B5563', marginBottom: 8 }}>
              Click to select or drag and drop your spreadsheet here
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="status-chip success" style={{ fontSize: '0.72rem' }}>.xlsx</span>
              <span className="status-chip success" style={{ fontSize: '0.72rem' }}>.xls</span>
              <span className="status-chip success" style={{ fontSize: '0.72rem' }}>.csv</span>
              <span className="status-chip success" style={{ fontSize: '0.72rem' }}>Google Sheets / Meta Ads Export</span>
            </div>

            {sheetInfo && (
              <div style={{ marginTop: 12, padding: '6px 12px', background: '#FFFFFF', borderRadius: 6, display: 'inline-block', border: '1px solid #BBF7D0', fontSize: '0.8rem', color: '#15803D' }}>
                Sheet: <strong>{sheetInfo.sheetName}</strong> ({sheetInfo.rowCount} rows detected)
              </div>
            )}
          </div>
        )}

        {activeTab === 'paste' && (
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Paste Excel Table, Tab-Delimited TSV, CSV, or Meta Lead Export:</span>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Auto-detects columns like: name, phone_number, email, campaign</span>
            </label>
            <textarea
              className="form-input"
              rows={7}
              placeholder="Copy from Excel or Meta Ads and paste here...&#10;e.g.&#10;full_name	phone_number	email	campaign_name&#10;Munna YT	p:+919734116954	mirtitan28@gmail.com	Academics Cource&#10;Satish Yadav	p:+917759092310	ysatishkumar246@gmail.com	Academics Cource"
              value={rawText}
              onChange={(e) => handleParse(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
            />
          </div>
        )}

        {/* Configuration Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Audience Tags (Applied to batch):</label>
            <input
              type="text"
              className="form-input"
              value={customTags}
              onChange={(e) => {
                setCustomTags(e.target.value);
                if (rawText) handleParse(rawText);
              }}
              placeholder="e.g. Instagram Leads, Academics Course"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Audience Cohort / RFM Segment:</label>
            <select
              className="form-input"
              value={cohort}
              onChange={(e) => {
                setCohort(e.target.value as RFMSegment);
                if (rawText) handleParse(rawText);
              }}
            >
              <option value="NEW_LEADS">New Leads</option>
              <option value="POTENTIAL_LOYALIST">High Intent / Potential</option>
              <option value="LOYAL_CUSTOMERS">Frequent Buyers</option>
              <option value="CHAMPIONS">VIP Tier 1</option>
            </select>
          </div>
        </div>

        {/* Parse Results Overview */}
        {parseResult && (
          <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="status-chip success" style={{ fontSize: '0.82rem', padding: '5px 12px', fontWeight: 600 }}>
                ✓ {parseResult.valid.length} Valid Contacts Ready to Import
              </span>
              {parseResult.invalid.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowErrors(!showErrors)}
                  className="status-chip danger"
                  style={{ fontSize: '0.82rem', padding: '5px 12px', cursor: 'pointer', border: 'none' }}
                >
                  ⚠ {parseResult.invalid.length} Skipped / Invalid ({showErrors ? 'Hide details' : 'Show details'})
                </button>
              )}
            </div>

            {/* Error / Skipped Details */}
            {showErrors && parseResult.invalid.length > 0 && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '8px 12px', marginBottom: 12, maxHeight: 140, overflowY: 'auto' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#991B1B', marginBottom: 4 }}>Skipped Entries:</p>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: '#B91C1C' }}>
                  {parseResult.invalid.slice(0, 15).map((err, idx) => (
                    <li key={idx}>
                      Row {err.row}: <strong>{err.name}</strong> ({err.phone}) — {err.reason}
                    </li>
                  ))}
                  {parseResult.invalid.length > 15 && (
                    <li>...and {parseResult.invalid.length - 15} more invalid items</li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            {parseResult.valid.length > 0 && (
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 16 }}>
                <table className="corporate-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>WhatsApp Phone</th>
                      <th>Email</th>
                      <th>Source / Campaign</th>
                      <th>Audience Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.valid.slice(0, 25).map((c, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td><strong>{c.displayName}</strong></td>
                        <td><code>{c.phone}</code></td>
                        <td><span className="text-secondary">{c.email || c.attributes?.email || '—'}</span></td>
                        <td>
                          <span className="text-secondary">{c.attributes?.campaign || c.attributes?.platform || 'Direct Upload'}</span>
                        </td>
                        <td>
                          <div className="tags-flex">
                            {c.tags.map((t, ti) => (
                              <span key={ti} className="tag-pill-corporate" style={{ fontSize: '0.7rem' }}>{t}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!parseResult || parseResult.valid.length === 0 || isImporting}
            onClick={handleImport}
          >
            {isImporting
              ? 'Importing...'
              : `Import ${parseResult?.valid.length || 0} Contacts to CRM`}
          </button>
        </div>
      </div>
    </div>
  );
};
