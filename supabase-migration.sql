-- ═══════════════════════════════════════════════════════════
--  PAYMENT COLUMNS — Run in Supabase SQL Editor
--  Adds payment tracking to existing orders table
-- ═══════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Index for payment status filtering (waiter dashboard filters)
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- UPI transactions are 0% MDR in India (RBI mandate).
-- Card/netbanking: ~2% fee charged by Razorpay to merchant.
