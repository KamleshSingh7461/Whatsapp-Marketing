import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

interface Company {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export function SuperAdminConsole() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Company[]>('/companies')
      .then(setCompanies)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="shell">
      <header>
        <h1>Super Admin Console</h1>
        <p className="hint">Companies you've onboarded onto the platform (§04 of the plan).</p>
      </header>

      {error && (
        <p className="error">
          {error} — log in first (POST /api/auth/login); this view calls a protected endpoint.
        </p>
      )}
      {!error && !companies && <p className="hint">Loading companies…</p>}
      {companies && companies.length === 0 && <p className="hint">No companies yet.</p>}
      {companies && companies.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.status}</td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
