# Go-Live Checklist — Razorpay Payment Integration

## 10 Steps to Production

### 1. Run SQL Migration
- Open Supabase Dashboard → SQL Editor
- Paste contents of `supabase-migration.sql`
- Click **Run** → verify 4 new columns appear in `orders` table

### 2. Create Razorpay Account
- Go to https://dashboard.razorpay.com
- Complete KYC (PAN, bank account, business proof)
- KYC approval takes 1-3 business days

### 3. Get API Keys
- Razorpay Dashboard → Settings → API Keys
- Copy `Key ID` (starts with `rzp_test_` or `rzp_live_`)
- Copy `Key Secret` (shown only once — save it)

### 4. Test with Test Keys First
- Use `rzp_test_XXXX` keys
- Test card: `4111 1111 1111 1111`, any future expiry, any CVV
- Test UPI: `success@razorpay` (success) or `failure@razorpay` (decline)

### 5. Add Environment Variables in Vercel
- Vercel Dashboard → Your Project → Settings → Environment Variables
- Add: `RAZORPAY_KEY_ID` = your key_id
- Add: `RAZORPAY_KEY_SECRET` = your key_secret
- Add: `VITE_RAZORPAY_KEY` = same key_id (public, for frontend)
- Add: `VITE_PAYMENT_ENABLED` = `true`

### 6. Install Razorpay Node.js SDK
```bash
npm install razorpay
```

### 7. Update vercel.json
Add API routes config if needed (Vercel auto-detects `/api` folder).

### 8. Deploy
```bash
git add .
git commit -m "Add Razorpay payment integration"
git push origin main
```

### 9. Switch to Live Keys
- Replace `rzp_test_` with `rzp_live_` in Vercel environment variables
- Set `VITE_PAYMENT_ENABLED=true`
- Redeploy

### 10. First Live Transaction
- Scan a table QR code on your phone
- Place a ₹1 test order (add a ₹1 test item to menu temporarily)
- Pay via UPI (0% MDR!) → verify:
  - Razorpay Dashboard shows the payment
  - Supabase `orders` table has `payment_status: "paid"`
  - Waiter dashboard shows green PAID badge
- Remove test item, you're live! 🎉
