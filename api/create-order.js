// POST /api/create-order
// Creates a Razorpay order for payment. Called before opening checkout.
import Razorpay from "razorpay";

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { amount, orderId } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({ error: "Minimum amount is ₹1 (100 paise)" });
    }

    const order = await rzp.orders.create({
      amount: Math.round(amount), // already in paise from frontend
      currency: "INR",
      receipt: orderId || `rcpt_${Date.now()}`,
      // UPI payments: 0% MDR (RBI mandate for UPI transactions)
    });

    return res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err.message);
    return res.status(500).json({ error: "Payment gateway error. Please try again." });
  }
}
