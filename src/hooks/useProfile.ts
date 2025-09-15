import { useEffect, useState, useCallback } from 'react';
import { useRepo } from '../context/DataContext.jsx';

interface Profile {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  email?: string;
  badges?: any[];
  stats?: Record<string, number>;
}

export default function useProfile(externalRepo?: any) {
  const repo = externalRepo || useRepo();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    repo.profile
      .get()
      .then((p: Profile) => {
        if (mounted) setProfile(p || {});
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [repo]);

  const updateProfile = useCallback(
    async (data: Partial<Profile>) => {
      try {
        await repo.profile.update(data);
        setProfile((prev) => ({ ...(prev || {}), ...data }));
        return true;
      } catch (e) {
        return false;
      }
    },
    [repo]
  );

  return { profile, loading, updateProfile };
}

