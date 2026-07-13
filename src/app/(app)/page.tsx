import { createClient } from '@/lib/supabase/server';
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

  if (role !== 'admin') {
    return (
      <div className="p-5 max-w-2xl">
        <h1 className="text-2xl font-bold text-green-900 mb-1">
          สวัสดี {profile?.name || user?.email}
        </h1>
        <p className="text-gray-500">คนส่ง — ใช้เมนูซ้ายเพื่อดูสต๊อก งานส่ง และขายสินค้า</p>
      </div>
    );
  }

  const { data: lowStock } = await supabase
    .from('products')
    .select('name, unit, stock')
    .eq('active', true)
    .lte('stock', 15)
    .order('stock');

  return <DashboardClient name={profile?.name || ''} lowStock={lowStock ?? []} />;
}
