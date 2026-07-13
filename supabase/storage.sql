-- ============================================================
--  นโยบายการเข้าถึงที่เก็บรูป (bucket: images)
--  รันไฟล์นี้ใน Supabase → SQL Editor หลังสร้าง bucket ชื่อ images แล้ว
--  (ทุกคนดูรูปได้ / เฉพาะผู้ล็อกอินอัปโหลด-แก้ไข-ลบได้)
-- ============================================================
do $$ begin
  create policy "images read" on storage.objects
    for select using (bucket_id = 'images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "images insert" on storage.objects
    for insert to authenticated with check (bucket_id = 'images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "images update" on storage.objects
    for update to authenticated using (bucket_id = 'images');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "images delete" on storage.objects
    for delete to authenticated using (bucket_id = 'images');
exception when duplicate_object then null; end $$;
