import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Contact, RFMSegment } from '../types';
import { parseContactsText, ParsedContactResult } from '../lib/contactParser';
import { POPULAR_COUNTRY_CODES } from '../lib/countryCodes';
import { CopyIcon, DownloadIcon, ShieldCheckIcon, UploadIcon } from './WhatsAppIcons';

interface BulkContactUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingContacts: Contact[];
  onImportContacts: (contacts: Contact[]) => Promise<void> | void;
}

export const BulkContactUploadModal: React.FC<BulkContactUploadModalProps> = ({
  isOpen,
  onClose,
  existingContacts,
  onImportContacts,
}) => {
  const [activeTab, setActiveTab] = useState<'sheet' | 'paste'>('sheet');
  const [rawText, setRawText] = useState('');
  const [defaultCountryCode, setDefaultCountryCode] = useState('+91');
  const [customTags, setCustomTags] = useState('Instagram Leads, Academics Course');
  const [cohort, setCohort] = useState<RFMSegment>('NEW_LEADS');
  const [parseResult, setParseResult] = useState<ParsedContactResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetInfo, setSheetInfo] = useState<{ sheetName: string; rowCount: number } | null>(null);

  if (!isOpen) return null;

  const handleParse = (text: string, sourceFileName?: string, countryCodeToUse = defaultCountryCode, tagsStringToUse = customTags, cohortToUse = cohort) => {
    setRawText(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    const tagsArray = tagsStringToUse
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const res = parseContactsText(text, {
      defaultCohort: cohortToUse,
      customTags: tagsArray,
      existingContacts,
      defaultCountryCode: countryCodeToUse,
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

  const handleImport = async () => {
    if (!parseResult || parseResult.valid.length === 0 || isImporting) return;
    setIsImporting(true);
    try {
      await onImportContacts(parseResult.valid);
      alert(`Imported ${parseResult.valid.length} contacts into your CRM.`);
      onClose();
    } catch (e: any) {
      alert(`Import error: ${e.message || 'Error saving contacts'}`);
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <UploadIcon size={15} color="currentColor" />
              Upload spreadsheet
            </button>
            <button
              type="button"
              className={`tag-filter-btn ${activeTab === 'paste' ? 'active' : ''}`}
              onClick={() => setActiveTab('paste')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CopyIcon size={15} color="currentColor" />
              Paste text or Meta export
            </button>
          </div>

          <button
            type="button"
            className="btn-outline-sm"
            onClick={downloadSampleTemplate}
            title="Download formatted sample Excel spreadsheet"
            style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <DownloadIcon size={15} color="currentColor" />
            Download sample sheet (.xlsx)
          </button>
        </div>

        {activeTab === 'sheet' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: '2px dashed #00a884',
              borderRadius: 10,
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              backgroundColor: '#f1fbf8',
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
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#e7fce3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#008069" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111b21', marginBottom: 4 }}>
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
              <div style={{ marginTop: 12, padding: '6px 12px', background: '#FFFFFF', borderRadius: 6, display: 'inline-block', border: '1px solid #cbf8c7', fontSize: '0.8rem', color: '#008069' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16, background: '#F8FAFC', padding: 14, borderRadius: 8, border: '1px solid #E2E8F0' }}>
          {/* Default Country Code Selector */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Default Country Code:</span>
            </label>
            <select
              className="form-input"
              value={defaultCountryCode}
              onChange={(e) => {
                const newCode = e.target.value;
                setDefaultCountryCode(newCode);
                if (rawText) handleParse(rawText, fileName || undefined, newCode);
              }}
              style={{ fontWeight: 600, background: '#FFFFFF' }}
            >
              {POPULAR_COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} ({c.name})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 3, display: 'block' }}>
              Applied automatically to 10-digit numbers lacking prefix
            </span>
          </div>

          {/* Audience Tags Input & Chips */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1E293B' }}>Audience Tags (Applied to batch):</label>
            <input
              type="text"
              className="form-input"
              value={customTags}
              onChange={(e) => {
                setCustomTags(e.target.value);
                if (rawText) handleParse(rawText, fileName || undefined, defaultCountryCode, e.target.value);
              }}
              placeholder="e.g. Instagram Leads, Academics Course"
              style={{ background: '#FFFFFF' }}
            />
            {/* Quick Tag Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
              {['Instagram Leads', 'Facebook Leads', 'New Lead', 'Academics Course', 'VIP Client', 'Hot Lead'].map(tag => {
                const isSelected = customTags.split(',').map(t => t.trim()).includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      let current = customTags.split(',').map(t => t.trim()).filter(Boolean);
                      if (isSelected) {
                        current = current.filter(t => t !== tag);
                      } else {
                        current.push(tag);
                      }
                      const updatedTags = current.join(', ');
                      setCustomTags(updatedTags);
                      if (rawText) handleParse(rawText, fileName || undefined, defaultCountryCode, updatedTags);
                    }}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      borderRadius: 12,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #008069' : '1px solid #CBD5E1',
                      background: isSelected ? '#e7fce3' : '#FFFFFF',
                      color: isSelected ? '#008069' : '#475569',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cohort Segment */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1E293B' }}>Audience Cohort / RFM Segment:</label>
            <select
              className="form-input"
              value={cohort}
              onChange={(e) => {
                const newCohort = e.target.value as RFMSegment;
                setCohort(newCohort);
                if (rawText) handleParse(rawText, fileName || undefined, defaultCountryCode, customTags, newCohort);
              }}
              style={{ background: '#FFFFFF' }}
            >
              <option value="NEW_LEADS">New Leads</option>
              <option value="POTENTIAL_LOYALIST">High Intent / Potential</option>
              <option value="LOYAL_CUSTOMERS">Frequent Buyers</option>
              <option value="CHAMPIONS">VIP Tier 1</option>
            </select>
          </div>
        </div>

        {/* Parse Results Overview */}
        {parseResult && (() => {
          const duplicateEntries = parseResult.invalid.filter(x =>
            x.reason.includes('Duplicate') || x.reason.includes('Already exists')
          );
          const otherErrors = parseResult.invalid.filter(x =>
            !x.reason.includes('Duplicate') && !x.reason.includes('Already exists')
          );

          return (
            <div style={{ marginTop: 12, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="status-chip success" style={{ fontSize: '0.82rem', padding: '5px 12px', fontWeight: 600 }}>
                  ✓ {parseResult.valid.length} Valid Contacts Ready to Import
                </span>

                {duplicateEntries.length > 0 && (
                  <span
                    className="status-chip warning"
                    style={{
                      fontSize: '0.82rem',
                      padding: '5px 12px',
                      fontWeight: 600,
                      background: '#FEF3C7',
                      color: '#92400E',
                      border: '1px solid #FDE68A',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Meta CRM rules: The same phone number cannot be added two times"
                  >
                    <ShieldCheckIcon size={15} color="currentColor" />
                    {duplicateEntries.length} duplicate {duplicateEntries.length === 1 ? 'contact' : 'contacts'} prevented
                  </span>
                )}

                {parseResult.invalid.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowErrors(!showErrors)}
                    className="status-chip danger"
                    style={{ fontSize: '0.82rem', padding: '5px 12px', cursor: 'pointer', border: 'none' }}
                  >
                    {parseResult.invalid.length} skipped ({showErrors ? 'hide details' : 'show details'})
                  </button>
                )}
              </div>

              {/* Error / Skipped Details */}
              {showErrors && parseResult.invalid.length > 0 && (
                <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '8px 12px', marginBottom: 12, maxHeight: 160, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#991B1B', margin: 0 }}>
                      Skipped Entries ({parseResult.invalid.length} total, {duplicateEntries.length} duplicates prevented):
                    </p>
                    <span style={{ fontSize: '0.72rem', color: '#7F1D1D' }}>Duplicates are safely rejected to prevent multi-contact conflicts</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: '#B91C1C' }}>
                    {parseResult.invalid.slice(0, 20).map((err, idx) => {
                      const isDup = err.reason.includes('Duplicate') || err.reason.includes('Already exists');
                      return (
                        <li key={idx} style={{ marginBottom: 2 }}>
                          Row {err.row}: <strong>{err.name}</strong> ({err.phone}) &bull;{' '}
                          <span style={{ color: isDup ? '#92400E' : '#B91C1C', fontWeight: isDup ? 600 : 400 }}>
                            {err.reason}
                          </span>
                        </li>
                      );
                    })}
                    {parseResult.invalid.length > 20 && (
                      <li>...and {parseResult.invalid.length - 20} more skipped items</li>
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
          );
        })()}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!parseResult || parseResult.valid.length === 0 || isImporting}
            onClick={handleImport}
            style={{
              backgroundColor: isImporting ? '#047857' : '#059669',
              minWidth: 260,
            }}
          >
            {isImporting
              ? `Saving ${parseResult?.valid.length || 0} contacts…`
              : `Import ${parseResult?.valid.length || 0} Contacts to CRM`}
          </button>
        </div>
      </div>
    </div>
  );
};
