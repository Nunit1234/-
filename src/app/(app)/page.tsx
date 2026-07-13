import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from '@/components/DashboardClient';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user!.id)
    .single();
  const role = profile?.role ?? 'delivery';

  // คนส่งไม่มีหน้าหลัก — เข้าไปที่ "งานส่งของฉัน" เลย
  if (role !== 'admin') {
    redirect('/delivery');
  }

  const { data: lowStock } = await supabase
    .from('products')
    .select('name, unit, stock')
    .eq('active', true)
    .lte('stock', 15)
    .order('stock');

  return <DashboardClient name={profile?.name || ''} lowStock={lowStock ?? []} />;
}
