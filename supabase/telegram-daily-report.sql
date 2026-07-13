-- ============================================================
--  แจ้งสรุปยอดขายเข้า Telegram ทุกเที่ยงคืน (เวลาไทย)
--  รันใน Supabase → SQL Editor  (แก้ BOT_TOKEN และ CHAT_ID ก่อน)
-- ============================================================

-- 1) เปิด extension ที่ต้องใช้
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) ฟังก์ชันสร้าง+ส่งสรุปยอดขายของ "วันที่เพิ่งจบ" (เวลาไทย) เข้า Telegram
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
  msg text;
begin
  select coalesce(sum(total_sell),0), coalesce(sum(total_cost),0), count(*),
         coalesce(sum(total_sell) filter (where pay_method='CASH'),0),
         coalesce(sum(total_sell) filter (where pay_method='TRANSFER'),0),
         coalesce(sum(total_sell) filter (where pay_method='CREDIT'),0),
         coalesce(sum(total_sell) filter (where pay_status='UNPAID'),0)
    into v_sales, v_cost, v_bills, v_cash, v_transfer, v_credit, v_unpaid
    from orders
    where status <> 'CANCELLED'
      and (created_at at time zone 'Asia/Bangkok')::date = rpt_date;

  msg := '📊 สรุปยอดขาย ' || to_char(rpt_date,'DD/MM/YYYY') || E'\n'
      || '━━━━━━━━━━━━' || E'\n'
      || '💰 ยอดขาย: ' || to_char(v_sales,'FM999,999,990.00') || ' ฿' || E'\n'
      || '📈 กำไร: ' || to_char(v_sales - v_cost,'FM999,999,990.00') || ' ฿' || E'\n'
      || '🧾 จำนวนบิล: ' || v_bills || E'\n'
      || '━━━━━━━━━━━━' || E'\n'
      || '💵 เงินสด: ' || to_char(v_cash,'FM999,999,990.00') || E'\n'
      || '📲 โอน: ' || to_char(v_transfer,'FM999,999,990.00') || E'\n'
      || '📝 เครดิต: ' || to_char(v_credit,'FM999,999,990.00') || E'\n'
      || '⚠️ ค้างชำระ: ' || to_char(v_unpaid,'FM999,999,990.00') || ' ฿';

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('chat_id', chat_id, 'text', msg)
  );
end $$;

-- 3) ตั้งเวลายิงทุกวัน เที่ยงคืนเวลาไทย (= 17:00 UTC)
select cron.unschedule('daily-telegram-report')
  where exists (select 1 from cron.job where jobname = 'daily-telegram-report');
select cron.schedule('daily-telegram-report', '0 17 * * *', $$ select send_daily_report(); $$);

-- ============================================================
--  ทดสอบส่งทันที (รันบรรทัดล่างหลังแก้ token/chat_id แล้ว):
--    select send_daily_report();
--  ยกเลิกการแจ้งเตือน:
--    select cron.unschedule('daily-telegram-report');
-- ============================================================
