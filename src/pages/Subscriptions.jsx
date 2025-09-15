import { useState } from 'react';
import SubscriptionForm from '../components/SubscriptionForm';
import SubscriptionList from '../components/SubscriptionList';
import {
  loadSubscriptions,
  saveSubscriptions,
  projectMonthlyCost,
} from '../lib/subscriptions';

const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' });

export default function Subscriptions({ categories }) {
  const [subs, setSubs] = useState(loadSubscriptions);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const handleSave = (sub) => {
    let next;
    if (editing) {
      next = subs.map((s) => (s.id === editing.id ? { ...editing, ...sub } : s));
    } else {
      const id = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      next = [...subs, { ...sub, id }];
    }
    setSubs(next);
    saveSubscriptions(next);
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (id) => {
    const next = subs.filter((s) => s.id !== id);
    setSubs(next);
    saveSubscriptions(next);
  };

  const total = projectMonthlyCost(subs);

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold">Langganan</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          Tambah
        </button>
      </div>
      <div className="card p-4 text-sm">
        Proyeksi biaya bulanan: {fmt.format(total)}
      </div>
      {showForm && (
        <SubscriptionForm
          categories={categories}
          initial={editing}
          onSave={handleSave}
          onCancel={() => {
            setEditing(null);
            setShowForm(false);
          }}
        />
      )}
      <SubscriptionList
        items={subs}
        onEdit={(s) => {
          setEditing(s);
          setShowForm(true);
        }}
        onDelete={handleDelete}
      />
    </main>
  );
}

