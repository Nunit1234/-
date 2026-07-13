'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  name: string;
  role: string;
  phone: string;
  active: boolean;
};

export default function TeamClient({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'delivery' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function updateProfile(id: string, patch: Partial<Profile>) {
    await supabase.from('profiles').update(patch).eq('id', id);
    router.refresh();
  }

  async function createUser() {
    setErr('');
    setMsg('');
    if (!form.email || !form.password) {
      setErr('กรอกอีเมลและรหัสผ่าน');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErr(json.error || 'สร้างไม่สำเร็จ');
      return;
    }
    setOpen(false);
    setForm({ email: '', password: '', name: '', role: 'delivery' });
    setMsg('สร้างผู้ใช้แล้ว ✔');
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-green-900">จัดการผู้ใช้</h1>
        <button
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          onClick={() => {
            setErr('');
            setOpen(true);
          }}
        >
          + เพิ่มผู้ใช้
        </button>
      </div>
      {msg && <p className="text-green-700 text-sm mb-2">{msg}</p>}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left p-3">ชื่อ</th>
              <th className="text-left p-3">บทบาท</th>
              <th className="text-left p-3">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <input
                    className="border rounded px-2 py-1 w-40"
                    defaultValue={p.name}
                    onBlur={(e) =>
                      e.target.value !== p.name &&
                      updateProfile(p.id, { name: e.target.value })
                    }
                  />
                </td>
                <td className="p-3">
                  <select
                    className="border rounded px-2 py-1"
                    value={p.role}
                    onChange={(e) => updateProfile(p.id, { role: e.target.value })}
                  >
                    <option value="admin">แอดมิน</option>
                    <option value="delivery">คนส่ง</option>
                  </select>
                </td>
                <td className="p-3">
                  <button
                    className={`px-3 py-1 rounded text-xs ${
                      p.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}
                    onClick={() => updateProfile(p.id, { active: !p.active })}
                  >
                    {p.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        * การสร้างผู้ใช้ใหม่ในแอปต้องตั้งค่า SUPABASE_SERVICE_ROLE_KEY (ดู SETUP.md)
        หรือสร้างผ่าน Supabase → Authentication → Add user ก็ได้
      </p>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">เพิ่มผู้ใช้ใหม่</h2>
            <input
              className="w-full border rounded-lg px-3 py-2 mb-2"
              placeholder="อีเมล"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 mb-2"
              placeholder="รหัสผ่าน"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 mb-2"
              placeholder="ชื่อ"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="w-full border rounded-lg px-3 py-2 mb-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="delivery">คนส่ง</option>
              <option value="admin">แอดมิน</option>
            </select>
            {err && <p className="text-red-600 text-sm">{err}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <button
                className="px-4 py-2 rounded-lg bg-gray-100"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-green-700 text-white"
                onClick={createUser}
                disabled={saving}
              >
                {saving ? 'กำลังสร้าง…' : 'สร้างผู้ใช้'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
