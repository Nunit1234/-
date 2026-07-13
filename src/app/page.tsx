import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const ROLE_LABEL: Record<string, string> = {
  admin: 'แอดมิน (เจ้าของ)',
  delivery: 'คนส่ง',
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  const role = profile?.role ?? 'delivery';

  return (
    <div className="min-h-screen w-full bg-green-50">
      <header className="bg-green-800 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-lg">
          🦆 เจ้านายฟาร์มเป็ด
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-sm bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded-lg">
            ออกจากระบบ
          </button>
        </form>
      </header>

      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-xl font-bold text-green-900">
            สวัสดี {profile?.name || user.email}
          </h1>
          <p className="text-gray-600 mt-1">
            บทบาท: <b>{ROLE_LABEL[role] || role}</b>
          </p>
          <p className="text-gray-500 text-sm mt-4">
            ✅ เชื่อมต่อฐานข้อมูล Supabase สำเร็จ — พร้อมสร้างฟีเจอร์ต่อไป
            (สินค้า, ลูกค้า, ขาย/POS, สต๊อกคนส่ง ฯลฯ)
          </p>
        </div>
      </main>
    </div>
  );
}
