import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TeamClient from '@/components/TeamClient';

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  if (profile?.role !== 'admin') redirect('/');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, role, phone, active')
    .order('role');

  return <TeamClient profiles={profiles ?? []} />;
}
