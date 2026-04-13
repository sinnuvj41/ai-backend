require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

app.get("/", (req, res) => {
  res.json({ success: true, message: "Backend running" });
});

// 🔥 GENERATE
app.post("/generate", async (req, res) => {
  try {
    const prompt = req.body.prompt;

    if (!prompt) {
      return res.json({ success: false, message: "Prompt missing" });
    }

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// 💰 CREATE ORDER
app.post("/create-order", async (req, res) => {
  const { amount, plan } = req.body;

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " +
        Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64"),
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt: `receipt_${plan}_${Date.now()}`,
    }),
  });

  const data = await response.json();

  res.json({
    success: true,
    order_id: data.id,
    key_id: RAZORPAY_KEY_ID,
  });
});

// ✅ VERIFY
app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const generated = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});