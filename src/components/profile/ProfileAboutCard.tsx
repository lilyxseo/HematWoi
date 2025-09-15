import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import Skeleton from '../Skeleton.jsx';

interface Props {
  profile: any;
  loading: boolean;
  onSave: (data: any) => Promise<boolean>;
}

export default function ProfileAboutCard({ profile, loading, onSave }: Props) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ name: '', bio: '', avatarUrl: '' });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
      });
    }
  }, [profile]);

  if (loading) return <Skeleton className="h-40" />;

  const save = async () => {
    if (!form.name.trim()) {
      addToast('Name required', 'error');
      return;
    }
    const ok = await onSave(form);
    if (ok) {
      addToast('Profile updated', 'success');
      setEditing(false);
    } else {
      addToast('Failed to update profile', 'error');
    }
  };

  const cancel = () => {
    setForm({
      name: profile?.name || '',
      bio: profile?.bio || '',
      avatarUrl: profile?.avatarUrl || '',
    });
    setEditing(false);
  };

  return (
    <section className="p-4 border rounded space-y-2">
      <h2 className="font-semibold">About You</h2>
      <div className="flex items-center space-x-4">
        <img
          src={form.avatarUrl || 'https://placehold.co/64'}
          alt="avatar"
          className="w-16 h-16 rounded-full"
        />
        <input
          className="flex-1 border rounded p-1"
          placeholder="Avatar URL"
          value={form.avatarUrl}
          onChange={(e) => {
            setForm({ ...form, avatarUrl: e.target.value });
            setEditing(true);
          }}
        />
      </div>
      <label className="block">
        <span className="text-sm">Name</span>
        <input
          className="w-full border rounded p-1"
          value={form.name}
          onChange={(e) => {
            setForm({ ...form, name: e.target.value });
            setEditing(true);
          }}
        />
      </label>
      <div>Email: {profile?.email || '-'}</div>
      <label className="block">
        <span className="text-sm">Bio</span>
        <textarea
          className="w-full border rounded p-1"
          value={form.bio}
          onChange={(e) => {
            setForm({ ...form, bio: e.target.value });
            setEditing(true);
          }}
        />
      </label>
      {editing && (
        <div className="space-x-2">
          <button
            onClick={save}
            className="px-3 py-1 bg-brand text-white rounded"
          >
            Save
          </button>
          <button onClick={cancel} className="px-3 py-1 border rounded">
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
