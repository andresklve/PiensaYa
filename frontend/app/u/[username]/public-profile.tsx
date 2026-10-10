'use client';

import { useParams } from 'next/navigation';
import { ProfileView } from '@/components/profile-view';

export default function PublicProfile() {
  const params = useParams<{ username: string }>();
  return <ProfileView profileKey={decodeURIComponent(params.username)} />;
}
