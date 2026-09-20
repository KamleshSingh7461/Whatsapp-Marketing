export const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Names and tags can originate from WhatsApp profile names, which anyone can set. A value that
// starts with = + - @ would be run as a formula when the CSV is opened in Excel, so neutralise it.
export const csvText = (v: string) => csvCell(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export const downloadCsv = (fileName: string, headers: string[], rows: string[][]) => {
  const csvContent = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
