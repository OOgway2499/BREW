// POST /api/verify-payment
// HMAC SHA256 signature verification for Razorpay payments.
// Must verify BEFORE marking order as paid in Supabase.
import crypto from "crypto";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ verified: false, error: "Missing payment fields" });
    }

    // Razorpay signature = HMAC SHA256 of "order_id|payment_id" with key_secret
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const verified = expectedSignature === razorpay_signature;

    if (!verified) {
      console.error("Payment signature mismatch — possible tampering");
    }

    return res.status(200).json({ verified });
  } catch (err) {
    console.error("Payment verification error:", err.message);
    return res.status(500).json({ verified: false, error: "Verification failed" });
  }
}
