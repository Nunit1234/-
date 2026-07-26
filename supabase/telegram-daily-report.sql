-- ============================================================
--  แจ้งสรุปประจำวันเข้า Telegram ทุกเที่ยงคืน (เวลาไทย)
--  รันใน Supabase → SQL Editor  (แก้ BOT_TOKEN และ CHAT_ID ก่อน)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function send_daily_report() returns void
language plpgsql security definer set search_path = public as $$
declare
  -- ▼▼▼ แก้ 2 บรรทัดนี้ ▼▼▼
  bot_token text := 'ใส่_BOT_TOKEN_ที่นี่';
  chat_id   text := 'ใส่_CHAT_ID_ที่นี่';
  -- ▲▲▲ แก้ 2 บรรทัดนี้ ▲▲▲

  rpt_date date := (now() at time zone 'Asia/Bangkok')::date - 1;
  v_sales numeric; v_cost numeric; v_bills int;
  v_cash numeric; v_transfer numeric; v_credit numeric; v_unpaid numeric;
  v_types int; v_stock numeric; v_low int;
  v_claim_cnt int; v_claim_qty numeric;
  stock_detail text; claim_detail text;
  msg text;
begin
  -- ยอดขายของวันที่รายงาน
  select coalesce(sum(total_sell),0), coalesce(sum(total_cost),0), count(*),
         coalesce(sum(total_sell) filter (where pay_method='CASH'),0),
         coalesce(sum(total_sell) filter (where pay_method='TRANSFER'),0),
         coalesce(sum(total_sell) filter (where pay_method='CREDIT'),0),
         coalesce(sum(total_sell) filter (where pay_status='UNPAID'),0)
    into v_sales, v_cost, v_bills, v_cash, v_transfer, v_credit, v_unpaid
    from orders
    where status <> 'CANCELLED'
      and (created_at at time zone 'Asia/Bangkok')::date = rpt_date;

  -- สต๊อกคงเหลือ / ชนิดสินค้า
  select count(*), coalesce(sum(stock),0), count(*) filter (where stock <= 15)
    into v_types, v_stock, v_low
    from products where active;

  -- รายการสต๊อกแยกแต่ละชนิด (ชื่อ + คงเหลือกี่หน่วย)
  select string_agg(
           '• ' || name
             || case when coalesce(size,'-') <> '-' then ' ' || size else '' end
             || ': ' || to_char(stock,'FM999,999,990.##') || ' ' || unit
             || case when stock <= 15 then ' ⚠️' else '' end,
           E'\n' order by type, name, size)
    into stock_detail
    from products where active;

  -- เคลมของวันที่รายงาน
  select count(distinct c.id), coalesce(sum(ci.qty),0)
    into v_claim_cnt, v_claim_qty
    from claims c
    left join claim_items ci on ci.claim_id = c.id
    where (c.created_at at time zone 'Asia/Bangkok')::date = rpt_date;

  -- รายการสินค้าเคลมแยกแต่ละชนิด (ชื่อ + รวมกี่หน่วย)
  select string_agg(line, E'\n' order by line)
    into claim_detail
    from (
      select '• ' || coalesce(ci.name, p.name, 'สินค้า')
               || case when coalesce(p.size,'-') <> '-' then ' ' || p.size else '' end
               || ': ' || to_char(sum(ci.qty),'FM999,999,990.##')
               || ' ' || coalesce(ci.unit, p.unit, '') as line
        from claims c
        join claim_items ci on ci.claim_id = c.id
        left join products p on p.id = ci.product_id
       where (c.created_at at time zone 'Asia/Bangkok')::date = rpt_date
       group by coalesce(ci.name, p.name, 'สินค้า'), p.size, coalesce(ci.unit, p.unit, '')
    ) t;

  msg := '📊 สรุปประจำวัน ' || to_char(rpt_date,'DD/MM/YYYY') || E'\n'
      || '━━━━━━━━━━━━' || E'\n'
      || '💰 ยอดขาย: ' || to_char(v_sales,'FM999,999,990.00') || ' ฿' || E'\n'
      || '📈 กำไร: ' || to_char(v_sales - v_cost,'FM999,999,990.00') || ' ฿' || E'\n'
      || '🧾 จำนวนบิล: ' || v_bills || E'\n'
      || '💵 สด ' || to_char(v_cash,'FM999,990') || '  📲 โอน ' || to_char(v_transfer,'FM999,990') || '  📝 เชื่อ ' || to_char(v_credit,'FM999,990') || E'\n'
      || '⚠️ ค้างชำระ: ' || to_char(v_unpaid,'FM999,999,990.00') || ' ฿' || E'\n'
      || '━━━━━━━━━━━━' || E'\n'
      || '📦 สต๊อกคงเหลือ (' || v_types || ' ชนิด · ใกล้หมด ' || v_low || ')' || E'\n'
      || coalesce(stock_detail, '• (ยังไม่มีสินค้า)') || E'\n'
      || '• รวมทั้งหมด: ' || to_char(v_stock,'FM999,999,990.##') || ' หน่วย' || E'\n'
      || '━━━━━━━━━━━━' || E'\n'
      || '♻️ สินค้าเคลมวันนี้: ' || v_claim_cnt || ' ครั้ง (รวม ' || to_char(v_claim_qty,'FM999,990.##') || ' หน่วย)'
      || case when claim_detail is not null then E'\n' || claim_detail else E'\n' || '• ไม่มีการเคลม' end;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('chat_id', chat_id, 'text', msg)
  );
end $$;

-- ให้ปุ่ม "ทดสอบ" ในแอปเรียกได้
grant execute on function send_daily_report() to authenticated;

-- ตั้งเวลายิงทุกวัน เที่ยงคืนเวลาไทย (= 17:00 UTC)
select cron.unschedule('daily-telegram-report')
  where exists (select 1 from cron.job where jobname = 'daily-telegram-report');
select cron.schedule('daily-telegram-report', '0 17 * * *', $$ select send_daily_report(); $$);

-- ทดสอบทันที:  select send_daily_report();
-- ยกเลิก:      select cron.unschedule('daily-telegram-report');
