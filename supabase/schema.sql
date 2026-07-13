-- ============================================================
--  เจ้านายฟาร์มเป็ด (FARM DUCK) — Supabase Schema
--  รันไฟล์นี้ใน Supabase → SQL Editor → New query → วาง → Run
-- ============================================================

-- ---------- ENUM types ----------
do $$ begin
  create type user_role   as enum ('admin','delivery');
exception when duplicate_object then null; end $$;
do $$ begin
  create type order_status as enum ('PENDING','CONFIRMED','DELIVERING','DELIVERED','CANCELLED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pay_method   as enum ('CASH','TRANSFER','CREDIT');
exception when duplicate_object then null; end $$;
do $$ begin
  create type pay_status   as enum ('PAID','UNPAID');
exception when duplicate_object then null; end $$;
do $$ begin
  create type expense_cat  as enum ('WAGE','COMMISSION','FUEL','OTHER');
exception when duplicate_object then null; end $$;

-- ---------- profiles (ผู้ใช้ที่ล็อกอินได้: แอดมิน/คนส่ง) ----------
create table if not exists profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  name      text not null default '',
  role      user_role not null default 'delivery',
  phone     text default '',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- helper: ตรวจว่า user ปัจจุบันเป็นแอดมินไหม
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- สร้าง profile อัตโนมัติเมื่อมีผู้ใช้ใหม่ (role เริ่มต้น = delivery, แอดมินไปปรับทีหลัง)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name',''),
          coalesce((new.raw_user_meta_data->>'role')::user_role,'delivery'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- customers (ลูกค้า = ข้อมูลหลังบ้าน ไม่ล็อกอิน) ----------
create table if not exists customers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text default '',
  address      text default '',
  location_url text default '',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------- products (คลังหลัก) ----------
create table if not exists products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null,             -- DUCK/CHICKEN/SALTED/CENTURY
  size          text default '-',
  unit          text not null,             -- ฟอง/แผง/กล่อง
  per_unit      int  not null default 1,   -- จำนวนฟองต่อหน่วย
  cost          numeric(12,2) not null default 0,
  default_price numeric(12,2) not null default 0,
  stock         numeric(12,2) not null default 0,
  image_url     text default '',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- customer_prices (ราคาขายเฉพาะรายลูกค้า) ----------
create table if not exists customer_prices (
  customer_id uuid references customers(id) on delete cascade,
  product_id  uuid references products(id)  on delete cascade,
  price       numeric(12,2) not null,
  primary key (customer_id, product_id)
);

-- ---------- orders ----------
create table if not exists orders (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  customer_id  uuid references customers(id),
  delivery_id  uuid references profiles(id),
  created_by   uuid references profiles(id),
  status       order_status not null default 'CONFIRMED',
  pay_method   pay_method   not null default 'CASH',
  pay_status   pay_status   not null default 'UNPAID',
  slip_url     text default '',
  proof_url    text default '',
  receiver     text default '',
  note         text default '',
  deliver_date date,
  delivered_at timestamptz,
  total_sell   numeric(12,2) not null default 0,
  total_cost   numeric(12,2) not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists orders_created_at_idx on orders(created_at);
create index if not exists orders_delivery_idx   on orders(delivery_id);

create table if not exists order_items (
  id         bigint generated always as identity primary key,
  order_id   uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  name       text, unit text, qty numeric(12,2),
  sell_price numeric(12,2), cost numeric(12,2)
);

create table if not exists payments (
  id       bigint generated always as identity primary key,
  order_id uuid references orders(id) on delete cascade,
  amount   numeric(12,2) not null,
  date     date not null default current_date,
  method   text default 'TRANSFER',
  note     text default ''
);

-- ---------- driver stock (สต๊อกบนรถ) ----------
create table if not exists driver_stock (
  driver_id  uuid references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  qty        numeric(12,2) not null default 0,
  primary key (driver_id, product_id)
);

create table if not exists allocations (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid references profiles(id),
  created_by uuid references profiles(id),
  date       date not null default current_date,
  created_at timestamptz not null default now()
);
create table if not exists allocation_items (
  id            bigint generated always as identity primary key,
  allocation_id uuid references allocations(id) on delete cascade,
  product_id    uuid references products(id),
  name text, unit text, qty numeric(12,2)
);

-- ---------- claims (เคลม) ----------
create table if not exists claims (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid references profiles(id),
  customer_id uuid references customers(id),
  created_by  uuid references profiles(id),
  date        date not null default current_date,
  note        text default '',
  photo_url   text default '',
  created_at  timestamptz not null default now()
);
create table if not exists claim_items (
  id        bigint generated always as identity primary key,
  claim_id  uuid references claims(id) on delete cascade,
  product_id uuid references products(id),
  name text, unit text, qty numeric(12,2)
);

-- ---------- schedule (ตารางจัดคิวส่ง) ----------
create table if not exists schedule (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  customer_id uuid references customers(id) on delete cascade,
  driver_id   uuid references profiles(id),
  order_id    uuid references orders(id),
  sort        int default 0,
  created_at  timestamptz not null default now()
);

-- ---------- expenses / commissions ----------
create table if not exists expenses (
  id       uuid primary key default gen_random_uuid(),
  date     date not null default current_date,
  category expense_cat not null,
  amount   numeric(12,2) not null,
  note     text default ''
);
create table if not exists commissions (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid references profiles(id),
  date_key   date not null,
  panels     numeric(12,2) not null,
  rate       numeric(12,4) not null,
  amount     numeric(12,2) not null,
  proof_url  text default '',
  paid_date  date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- settings (แถวเดียว) ----------
create table if not exists settings (
  id              int primary key default 1,
  commission_rate numeric(12,4) not null default 0.30,
  shop_name       text default 'เจ้านายฟาร์มเป็ด',
  shop_phone      text default '',
  shop_address    text default '',
  receipt_note    text default 'ขอบคุณที่ใช้บริการ',
  receipt_width   text default '80mm',
  receipt_logo_url text default '',
  bank_name       text default '',
  account_name    text default '',
  account_no      text default '',
  qr_url          text default '',
  constraint settings_singleton check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table profiles        enable row level security;
alter table customers       enable row level security;
alter table products        enable row level security;
alter table customer_prices enable row level security;
alter table orders          enable row level security;
alter table order_items     enable row level security;
alter table payments        enable row level security;
alter table driver_stock    enable row level security;
alter table allocations     enable row level security;
alter table allocation_items enable row level security;
alter table claims          enable row level security;
alter table claim_items     enable row level security;
alter table schedule        enable row level security;
alter table expenses        enable row level security;
alter table commissions     enable row level security;
alter table settings        enable row level security;

-- profiles: อ่านของตัวเอง + แอดมินอ่าน/แก้ทั้งหมด
drop policy if exists p_prof_self  on profiles;
create policy p_prof_self  on profiles for select using (id = auth.uid() or is_admin());
drop policy if exists p_prof_admin on profiles;
create policy p_prof_admin on profiles for all using (is_admin()) with check (is_admin());

-- ตารางอ้างอิง: ผู้ล็อกอินทุกคนอ่านได้ / เขียนได้เฉพาะแอดมิน (รันซ้ำได้)
do $$
declare t text;
begin
  foreach t in array array['customers','products','customer_prices','settings','expenses','commissions','allocations','allocation_items'] loop
    execute format('drop policy if exists %I on %I;', t||'_ro', t);
    execute format('create policy %I on %I for select using (auth.role() = ''authenticated'');', t||'_ro', t);
    execute format('drop policy if exists %I on %I;', t||'_admin', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin());', t||'_admin', t);
  end loop;
end $$;

-- orders: แอดมินทั้งหมด / คนส่งเห็น+จัดการของตัวเอง
drop policy if exists p_ord_admin   on orders;
create policy p_ord_admin   on orders for all using (is_admin()) with check (is_admin());
drop policy if exists p_ord_drv_ro  on orders;
create policy p_ord_drv_ro  on orders for select using (delivery_id = auth.uid() or created_by = auth.uid());
drop policy if exists p_ord_drv_ins on orders;
create policy p_ord_drv_ins on orders for insert with check (created_by = auth.uid());
drop policy if exists p_ord_drv_upd on orders;
create policy p_ord_drv_upd on orders for update using (delivery_id = auth.uid() or created_by = auth.uid());

-- order_items: ตามสิทธิ์ของ order แม่
drop policy if exists p_oi_admin on order_items;
create policy p_oi_admin on order_items for all using (is_admin()) with check (is_admin());
drop policy if exists p_oi_drv on order_items;
create policy p_oi_drv on order_items for all
  using (exists(select 1 from orders o where o.id = order_id and (o.delivery_id = auth.uid() or o.created_by = auth.uid())))
  with check (exists(select 1 from orders o where o.id = order_id and (o.delivery_id = auth.uid() or o.created_by = auth.uid())));

-- payments: แอดมินเท่านั้น
drop policy if exists p_pay_admin on payments;
create policy p_pay_admin on payments for all using (is_admin()) with check (is_admin());

-- driver_stock: แอดมินทั้งหมด / คนส่งอ่าน+แก้ของตัวเอง
drop policy if exists p_ds_admin on driver_stock;
create policy p_ds_admin on driver_stock for all using (is_admin()) with check (is_admin());
drop policy if exists p_ds_drv on driver_stock;
create policy p_ds_drv on driver_stock for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- claims: แอดมินอ่านทั้งหมด / คนส่งสร้าง+อ่านของตัวเอง
drop policy if exists p_cl_admin on claims;
create policy p_cl_admin on claims for all using (is_admin()) with check (is_admin());
drop policy if exists p_cl_drv_ro on claims;
create policy p_cl_drv_ro on claims for select using (driver_id = auth.uid());
drop policy if exists p_cl_drv_ins on claims;
create policy p_cl_drv_ins on claims for insert with check (driver_id = auth.uid());
drop policy if exists p_cli_admin on claim_items;
create policy p_cli_admin on claim_items for all using (is_admin()) with check (is_admin());
drop policy if exists p_cli_drv on claim_items;
create policy p_cli_drv on claim_items for all
  using (exists(select 1 from claims c where c.id = claim_id and c.driver_id = auth.uid()))
  with check (exists(select 1 from claims c where c.id = claim_id and c.driver_id = auth.uid()));

-- schedule: แอดมินทั้งหมด / คนส่งเห็นของตัวเอง
drop policy if exists p_sc_admin on schedule;
create policy p_sc_admin on schedule for all using (is_admin()) with check (is_admin());
drop policy if exists p_sc_drv on schedule;
create policy p_sc_drv on schedule for select using (driver_id = auth.uid());

-- allocations / allocation_items: คนส่งอ่านของตัวเอง (นอกจากแอดมิน)
drop policy if exists p_ali_drv on allocation_items;
create policy p_ali_drv on allocation_items for select
  using (exists(select 1 from allocations a where a.id = allocation_id and a.driver_id = auth.uid()));
drop policy if exists p_al_drv on allocations;
create policy p_al_drv on allocations for select using (driver_id = auth.uid());

-- คนส่งเพิ่มลูกค้าใหม่ได้ (เหมือนเซลล์) — insert ได้ทั้งแอดมินและคนส่ง
drop policy if exists customers_ins on customers;
create policy customers_ins on customers for insert to authenticated with check (true);

-- ============================================================
--  RPC: สร้างออเดอร์ + ตัดสต๊อกแบบอะตอมมิก
--  (คนส่งตัดจากสต๊อกบนรถ / แอดมินตัดจากคลังหลัก)
-- ============================================================
create or replace function create_order(
  p_customer uuid,
  p_delivery uuid,
  p_pay_method pay_method,
  p_slip text,
  p_items jsonb   -- [{product_id, qty, sell_price, cost, name, unit}]
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_by_delivery boolean;
  v_status order_status;
  v_pay_status pay_status;
  v_delivery uuid;
  v_code text;
  v_total_sell numeric := 0;
  v_total_cost numeric := 0;
  v_order_id uuid;
  it jsonb;
  v_pid uuid; v_qty numeric; v_avail numeric;
begin
  select role into v_role from profiles where id = v_uid;
  if v_role is null then raise exception 'ไม่พบโปรไฟล์ผู้ใช้'; end if;
  v_by_delivery := (v_role = 'delivery');
  v_status := case when v_by_delivery then 'DELIVERED' else 'CONFIRMED' end;
  v_pay_status := case when p_pay_method = 'CREDIT' then 'UNPAID' else 'PAID' end;
  v_delivery := case when v_by_delivery then v_uid else p_delivery end;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'product_id')::uuid;
    v_qty := (it->>'qty')::numeric;
    if v_by_delivery then
      select qty into v_avail from driver_stock where driver_id = v_uid and product_id = v_pid;
    else
      select stock into v_avail from products where id = v_pid;
    end if;
    if coalesce(v_avail,0) < v_qty then
      raise exception 'สต๊อกไม่พอ: %', coalesce(it->>'name','สินค้า');
    end if;
    v_total_sell := v_total_sell + (it->>'sell_price')::numeric * v_qty;
    v_total_cost := v_total_cost + (it->>'cost')::numeric * v_qty;
  end loop;

  v_code := 'OD' || to_char(now(),'YYMMDD') || '-' || to_char(now(),'HH24MISS');

  insert into orders(code, customer_id, delivery_id, created_by, status, pay_method,
                     pay_status, slip_url, delivered_at, deliver_date, total_sell, total_cost)
  values (v_code, p_customer, v_delivery, v_uid, v_status, p_pay_method, v_pay_status,
          coalesce(p_slip,''), case when v_by_delivery then now() else null end,
          current_date, v_total_sell, v_total_cost)
  returning id into v_order_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'product_id')::uuid;
    v_qty := (it->>'qty')::numeric;
    insert into order_items(order_id, product_id, name, unit, qty, sell_price, cost)
    values (v_order_id, v_pid, it->>'name', it->>'unit', v_qty,
            (it->>'sell_price')::numeric, (it->>'cost')::numeric);
    if v_by_delivery then
      update driver_stock set qty = qty - v_qty where driver_id = v_uid and product_id = v_pid;
    else
      update products set stock = stock - v_qty where id = v_pid;
    end if;
  end loop;

  return json_build_object('id', v_order_id, 'code', v_code, 'total_sell', v_total_sell);
end $$;

grant execute on function create_order(uuid, uuid, pay_method, text, jsonb) to authenticated;

-- ============================================================
--  RPC: จ่ายสต๊อกให้คนส่ง (ตัดคลังหลัก + เพิ่มสต๊อกบนรถ + ใบคุม)
-- ============================================================
create or replace function allocate_stock(
  p_driver uuid,
  p_items jsonb   -- [{product_id, qty, name, unit}]
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_alloc uuid;
  it jsonb; v_pid uuid; v_qty numeric; v_avail numeric;
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'product_id')::uuid; v_qty := (it->>'qty')::numeric;
    select stock into v_avail from products where id = v_pid;
    if coalesce(v_avail,0) < v_qty then
      raise exception 'สต๊อกคลังไม่พอ: %', coalesce(it->>'name','สินค้า');
    end if;
  end loop;

  insert into allocations(driver_id, created_by) values (p_driver, auth.uid())
    returning id into v_alloc;

  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'product_id')::uuid; v_qty := (it->>'qty')::numeric;
    insert into allocation_items(allocation_id, product_id, name, unit, qty)
      values (v_alloc, v_pid, it->>'name', it->>'unit', v_qty);
    update products set stock = stock - v_qty where id = v_pid;
    insert into driver_stock(driver_id, product_id, qty)
      values (p_driver, v_pid, v_qty)
      on conflict (driver_id, product_id) do update set qty = driver_stock.qty + excluded.qty;
  end loop;

  return json_build_object('id', v_alloc);
end $$;
grant execute on function allocate_stock(uuid, jsonb) to authenticated;

-- ============================================================
--  RPC: เคลมสินค้า (คนส่งแจ้ง ตัดจากสต๊อกบนรถ)
-- ============================================================
create or replace function create_claim(
  p_customer uuid,
  p_note text,
  p_photo text,
  p_items jsonb   -- [{product_id, qty_pack, name, unit}]  (qty_pack = จำนวนแผง/กล่องที่ตัดจริง)
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_claim uuid;
  it jsonb; v_pid uuid; v_pack numeric; v_qty numeric; v_avail numeric;
begin
  insert into claims(driver_id, customer_id, created_by, note, photo_url)
    values (v_uid, p_customer, v_uid, coalesce(p_note,''), coalesce(p_photo,''))
    returning id into v_claim;
  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'product_id')::uuid;
    v_pack := (it->>'qty_pack')::numeric;   -- จำนวนหน่วยที่ตัดจากสต๊อก
    v_qty := coalesce((it->>'qty')::numeric, v_pack);  -- จำนวนที่บันทึก (อาจเป็นฟอง)
    select qty into v_avail from driver_stock where driver_id = v_uid and product_id = v_pid;
    if coalesce(v_avail,0) < v_pack then
      raise exception 'สต๊อกบนรถไม่พอ: %', coalesce(it->>'name','สินค้า');
    end if;
    insert into claim_items(claim_id, product_id, name, unit, qty)
      values (v_claim, v_pid, it->>'name', it->>'unit', v_qty);
    update driver_stock set qty = qty - v_pack where driver_id = v_uid and product_id = v_pid;
  end loop;
  return json_build_object('id', v_claim);
end $$;
grant execute on function create_claim(uuid, text, text, jsonb) to authenticated;
