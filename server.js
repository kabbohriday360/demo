import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";

const app = express();
app.use(bodyParser.json());
app.use(express.static("."));

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "MY_DEMO_SECRET";

app.post("/create-payment", (req, res) => {
  const { amount, coin } = req.body;
  const fakeWallet = "0xDemoWalletAddress123456789";
  console.log(`💳 Payment created: ${amount} ${coin}`);
  res.json({ wallet: fakeWallet });
});

app.post("/webhook/payment", (req, res) => {
  const receivedData = req.body;
  const signature = req.headers["x-signature"];

  const expected = crypto
    .createHmac("sha512", WEBHOOK_SECRET)
    .update(JSON.stringify(receivedData))
    .digest("hex");

  if (signature !== expected) {
    console.log("❌ Invalid webhook signature!");
    return res.status(400).send("Invalid signature");
  }

  if (receivedData.status === "success") {
    console.log(`✅ Payment confirmed: ${receivedData.amount} ${receivedData.coin}`);
  } else {
    console.log("⚠️ Payment pending or failed");
  }

  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
