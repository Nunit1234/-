'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/types';

const NAV: Record<Role, [string, string][]> = {
  admin: [
    ['/', '📊 แดชบอร์ด'],
    ['/pos', '🧾 ขายสินค้า'],
    ['/orders', '📋 ออเดอร์'],
    ['/schedule', '🗓️ ตารางจัดส่ง'],
    ['/products', '🥚 สินค้า & สต๊อก'],
    ['/vanstock', '📦 สต๊อกคนส่ง'],
    ['/claims', '♻️ เคลมสินค้า'],
    ['/customers', '👥 ลูกค้า & ราคา'],
    ['/commission', '🧮 ค่าคอมมิชชั่น'],
    ['/expenses', '📒 บัญชี & งบกำไรขาดทุน'],
    ['/daily', '💵 ปิดยอดรายวัน'],
    ['/team', '👤 จัดการผู้ใช้'],
    ['/settings', '⚙️ ตั้งค่าร้าน'],
  ],
  delivery: [
    ['/', '📊 หน้าหลัก'],
    ['/pos', '🧾 ขายสินค้า'],
    ['/mystock', '📦 สต๊อกของฉัน'],
    ['/schedule', '🗓️ ตารางงานของฉัน'],
    ['/delivery', '🚚 งานส่งของฉัน'],
    ['/claims', '♻️ เคลมสินค้า'],
    ['/orders', '📋 ออเดอร์ของฉัน'],
    ['/daily', '💵 ปิดยอดวันนี้'],
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  admin: 'แอดมิน (เจ้าของ)',
  delivery: 'คนส่ง',
};

export default function Sidebar({
  role,
  name,
  badges = {},
}: {
  role: Role;
  name: string;
  badges?: Record<string, number>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = NAV[role] || [];

  return (
    <>
      {/* Top bar (มือถือ) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-green-800 text-white flex items-center gap-3 px-4 h-14">
        <button onClick={() => setOpen(true)} className="text-2xl leading-none">
          ☰
        </button>
        <span className="font-bold">🦆 เจ้านายฟาร์มเป็ด</span>
      </div>

      {/* Scrim (มือถือ) */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky z-40 top-0 left-0 h-screen w-64 flex-shrink-0 bg-green-900 text-green-50 flex flex-col
        transform transition-transform md:transform-none ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-4 py-4 font-bold text-lg border-b border-white/10">
          🦆 เจ้านายฟาร์มเป็ด
        </div>
        <nav className="flex-1 p-2 overflow-auto">
          {links.map(([href, label]) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-lg my-0.5 text-sm ${
                  active ? 'bg-green-600 text-white' : 'hover:bg-white/10'
                }`}
              >
                <span>{label}</span>
                {badges[href] > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                    {badges[href] > 99 ? '99+' : badges[href]}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 text-sm">
          <div className="font-semibold text-white">{name}</div>
          <div className="text-green-300 text-xs mb-2">{ROLE_LABEL[role]}</div>
          <form action="/auth/signout" method="post">
            <button className="w-full bg-white/10 hover:bg-white/20 rounded-lg py-1.5 text-sm">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
