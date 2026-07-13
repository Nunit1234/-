# เจ้านายฟาร์มเป็ด — คู่มือติดตั้งเวอร์ชันจริง (Next.js + Supabase)

เอกสารนี้เป็นขั้นตอนสำหรับนำระบบขึ้นออนไลน์ใช้จริงในองค์กร

---

## 1) สร้างฐานข้อมูลที่ Supabase (ฟรี)

1. ไปที่ https://supabase.com → Sign up (ใช้ GitHub ล็อกอินได้)
2. **New project**
   - Name: `farm-duck`
   - Database Password: ตั้งรหัสแล้ว **จดเก็บไว้**
   - Region: **Southeast Asia (Singapore)** ← ใกล้ไทยสุด
3. รอสร้างเสร็จ (~2 นาที)

## 2) รันสคีมาฐานข้อมูล

1. ในโปรเจกต์ Supabase → เมนู **SQL Editor** → **New query**
2. เปิดไฟล์ `supabase/schema.sql` ในโปรเจกต์นี้ คัดลอกทั้งหมดไปวาง → กด **Run**
3. ควรขึ้น Success (สร้างตารางทั้งหมด + ระบบความปลอดภัย RLS)

## 3) สร้างที่เก็บรูป (Storage)

1. เมนู **Storage** → **New bucket**
2. ชื่อ `images` → เปิด **Public bucket** → Save
   (ใช้เก็บ รูปสินค้า / สลิป / หลักฐานส่ง / รูปเคลม / QR / โลโก้)

## 4) เชื่อมโปรเจกต์กับ Supabase

1. เมนู **Project Settings → API** คัดลอก 2 ค่า:
   - **Project URL**
   - **anon public key**
2. ในโฟลเดอร์โปรเจกต์ คัดลอกไฟล์ `.env.local.example` เป็น `.env.local`
   แล้วใส่ค่าทั้งสองลงไป

## 5) สร้างบัญชีแอดมินคนแรก

1. Supabase → เมนู **Authentication → Users → Add user**
   - ใส่ Email + Password (นี่คือบัญชีเจ้าของ/แอดมิน)
   - ✅ ติ๊ก Auto Confirm User
2. กลับไป **SQL Editor** รันคำสั่งนี้เพื่อตั้งให้เป็นแอดมิน (แก้อีเมลให้ตรง):
   ```sql
   update profiles set role='admin', name='เจ้าของร้าน'
   where id = (select id from auth.users where email='อีเมลที่สร้าง');
   ```

## 6) รันในเครื่อง (ทดสอบ)

```
npm install
npm run dev
```
เปิด http://localhost:3000 → ล็อกอินด้วยอีเมล/รหัสแอดมิน

## 7) นำขึ้นออนไลน์ (Deploy)

**แนะนำ: Cloudflare Pages** (ฟรี ใช้เชิงพาณิชย์ได้) หรือ **Vercel**
1. push โค้ดขึ้น GitHub
2. เชื่อม repo กับ Cloudflare Pages / Vercel
3. ใส่ Environment Variables 2 ตัว (เหมือนใน `.env.local`)
4. Deploy → ได้ลิงก์เว็บใช้งานจริง

---

## หมายเหตุความปลอดภัย
- ระบบใช้ **Row Level Security** ของ Supabase — แอดมินเห็นทุกอย่าง, คนส่งเห็นเฉพาะงาน/สต๊อกของตัวเอง
- ห้ามเปิดเผย Database Password / service_role key (ใช้แค่ anon key ในเว็บ)
- Supabase มีระบบสำรองข้อมูลอัตโนมัติ (แนะนำเปิด/ตรวจสอบใน Settings)
