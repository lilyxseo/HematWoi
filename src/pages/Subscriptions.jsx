import { useState } from 'react';
import SubscriptionForm from '../components/SubscriptionForm';
import SubscriptionList from '../components/SubscriptionList';
import { loadSubscriptions, saveSubscriptions, projectMonthlyCost } from '../lib/subscriptions';
import { Page } from '../components/ui/Page';
import { Card, CardHeader, CardBody } from '../components/ui/Card';

const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' });

export default function Subscriptions({ categories }) {
  const [subs, setSubs] = useState(loadSubscriptions);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const total = projectMonthlyCost(subs);

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

  return (
    <Page title="Langganan">
      <Card>
        <CardHeader
          title="Proyeksi"
          extra={<span>{fmt.format(total)}</span>}
        />
        <CardBody>
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
        </CardBody>
      </Card>
    </Page>
  );
}
