'use client';

import { Protected } from '@/components/protected';
import { ProfileView } from '@/components/profile-view';

export default function PerfilPage() {
  return <Protected>{(session) => <ProfileView profileKey={session.username} />}</Protected>;
}
