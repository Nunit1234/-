import { createClient } from '@/lib/supabase/server';
import DailyClient from '@/components/DailyClient';
import type { Role } from '@/lib/types';

export default async function DailyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const role = (profile?.role ?? 'delivery') as Role;

  const { data: settings } = await supabase
    .from('settings')
    .select('commission_rate, shop_name, shop_phone')
    .eq('id', 1)
    .single();

  let drivers: { id: string; name: string }[] = [];
  if (role === 'admin') {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'delivery')
      .eq('active', true);
    drivers = data ?? [];
  }

  const { data: profs } = await supabase.from('profiles').select('id, name');
  const profMap: Record<string, string> = {};
  (profs ?? []).forEach((p: { id: string; name: string }) => {
    profMap[p.id] = p.name;
  });

  return (
    <DailyClient
      role={role}
      myId={user!.id}
      drivers={drivers}
      profMap={profMap}
      settings={settings ?? {}}
    />
  );
}
