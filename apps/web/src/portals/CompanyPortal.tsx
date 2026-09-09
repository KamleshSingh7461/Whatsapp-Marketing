export function CompanyPortal() {
  return (
    <div className="shell">
      <header>
        <h1>Company Portal</h1>
        <p className="hint">
          Placeholder for the Company Admin / Agent / Marketer / Viewer surface (§04, §07 of the plan):
          WhatsApp connection status, shared inbox, templates, campaigns.
        </p>
      </header>
      <p className="hint">Next up: auth screens, then the Embedded Signup "Connect WhatsApp" flow against
        <code> POST /api/companies/:companyId/whatsapp/connect</code>.</p>
    </div>
  );
}
