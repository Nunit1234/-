import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user!.id)
    .single();

  // นับข้อมูลคร่าว ๆ
  const [{ count: productCount }, { count: customerCount }] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
  ]);

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="p-5 max-w-4xl">
      <h1 className="text-2xl font-bold text-green-900 mb-1">
        สวัสดี {profile?.name || user?.email}
      </h1>
      <p className="text-gray-500 mb-5">
        {isAdmin ? 'แดชบอร์ดผู้ดูแลระบบ' : 'หน้าหลักคนส่ง'}
      </p>

      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-gray-500 text-sm">สินค้าทั้งหมด</div>
            <div className="text-2xl font-bold text-green-800">
              {productCount ?? 0}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-gray-500 text-sm">ลูกค้าทั้งหมด</div>
            <div className="text-2xl font-bold text-green-800">
              {customerCount ?? 0}
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-400 text-sm mt-6">
        (แดชบอร์ดสรุปยอดขาย/กำไร แบบเต็มจะเพิ่มในเฟสถัดไป)
      </p>
    </div>
  );
}
