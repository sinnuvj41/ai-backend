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

    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Prompt missing"
      });
    }

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300
      }
    };

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    let output = "";

    if (
      data &&
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      output = data.candidates[0].content.parts[0].text || "";
    }

    if (!output.trim()) {
      return res.status(500).json({
        success: false,
        message: "No content generated"
      });
    }

    return res.json({
      success: true,
      output: output
    });

  } catch (e) {
    console.error("Generate error:", e);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// 💰 CREATE ORDER
app.post("/create-order", async (req, res) => {
  try {
    const { amount, plan } = req.body;

    if (!amount || !plan) {
      return res.status(400).json({
        success: false,
        message: "Invalid input"
      });
    }

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

    if (!data.id) {
      return res.status(500).json({
        success: false,
        message: "Order creation failed",
        response: data
      });
    }

    res.json({
      success: true,
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      key_id: RAZORPAY_KEY_ID,
      plan: plan
    });
  } catch (e) {
    console.error("Create order error:", e);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ✅ VERIFY
app.post("/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid input"
      });
    }

    const generated = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated === razorpay_signature) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (e) {
    console.error("Verify error:", e);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});