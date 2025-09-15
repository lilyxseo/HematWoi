import ProfileHeader from '../components/profile/ProfileHeader';
import ProfileAboutCard from '../components/profile/ProfileAboutCard';
import ProfileLevelCard from '../components/profile/ProfileLevelCard';
import ProfileBadgesCard from '../components/profile/ProfileBadgesCard';
import ProfileStatsCard from '../components/profile/ProfileStatsCard';
import useProfile from '../hooks/useProfile';

export default function ProfilePage() {
  const { profile, loading, updateProfile } = useProfile();

  return (
    <div className="p-4 space-y-4">
      <ProfileHeader />
      <ProfileAboutCard profile={profile} loading={loading} onSave={updateProfile} />
      <ProfileLevelCard />
      <ProfileBadgesCard badges={profile?.badges || []} />
      <ProfileStatsCard stats={profile?.stats || {}} />
    </div>
  );
}
