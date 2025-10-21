// server.js
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "MY_DEMO_SECRET";

function contentTypeByExt(ext) {
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      resolve(raw);
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    const url = req.url || "/";
    const method = (req.method || "GET").toUpperCase();

    // Serve index.html for root
    if (method === "GET" && (url === "/" || url === "/index.html")) {
      const file = await fs.readFile(path.join(process.cwd(), "index.html"), "utf8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.statusCode = 200;
      return res.end(file);
    }

    // Serve static files (very basic)
    if (method === "GET") {
      // prevent directory traversal
      const safePath = path.normalize(url).replace(/^(\.\.[\/\\])+/, "");
      const filePath = path.join(process.cwd(), safePath);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filePath);
          const data = await fs.readFile(filePath);
          res.setHeader("Content-Type", contentTypeByExt(ext));
          res.statusCode = 200;
          return res.end(data);
        }
      } catch (e) {
        // fallthrough to 404
      }
      res.statusCode = 404;
      return res.end("Not found");
    }

    // POST /create-payment
    if (method === "POST" && url.startsWith("/create-payment")) {
      const raw = await readRequestBody(req);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.end(JSON.stringify({ error: "Invalid JSON" }));
      }

      const { amount = "0", coin = "USDT" } = body;
      // Fake wallet generation for demo — replace with your real logic
      const fakeWallet = `0xDEMO${crypto.createHash("md5").update(String(Date.now())).digest("hex").slice(0, 20)}`;

      console.log(`💳 Payment created: ${amount} ${coin}`);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ wallet: fakeWallet }));
    }

    // POST /webhook/payment
    if (method === "POST" && url.startsWith("/webhook/payment")) {
      const raw = await readRequestBody(req);
      let receivedData;
      try {
        receivedData = raw ? JSON.parse(raw) : {};
      } catch (e) {
        res.statusCode = 400;
        return res.end("Invalid JSON");
      }

      const signature = (req.headers["x-signature"] || "").toString();

      const expected = crypto
        .createHmac("sha512", WEBHOOK_SECRET)
        .update(JSON.stringify(receivedData))
        .digest("hex");

      if (!signature || signature !== expected) {
        console.log("❌ Invalid webhook signature!");
        res.statusCode = 400;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        return res.end("Invalid signature");
      }

      if (receivedData.status === "success") {
        console.log(`✅ Payment confirmed: ${receivedData.amount} ${receivedData.coin}`);
      } else {
        console.log("⚠️ Payment pending or failed", receivedData);
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("OK");
    }

    // default 404
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Not found");
  } catch (err) {
    console.error("Server error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Internal Server Error");
  }
}
