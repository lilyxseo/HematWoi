import { useState, useEffect } from 'react';
import PageHeader from '../../layout/PageHeader';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="space-y-4">
      <PageHeader title="Reports" />
      {loading && <div className="text-sm">Loading...</div>}
      {!loading && !error && (
        <div className="text-sm">No reports available.</div>
      )}
      {error && (
        <div role="alert" className="text-danger text-sm">
          {error}
        </div>
      )}
    </section>
  );
}
