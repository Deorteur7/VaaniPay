import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import fetch from "node-fetch";
import FormData from "form-data";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Local development reads the root .env file. On Vercel, secrets come from
// the project's Environment Variables and dotenv simply finds no local file.
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json({ limit: "4mb" }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ── Sarvam STT proxy ─────────────────────────────────────────────────────────
app.post("/api/stt", upload.single("audio"), async (req, res) => {
  try {
    const { SARVAM_API_KEY } = process.env;
    if (!SARVAM_API_KEY || SARVAM_API_KEY === "your_sarvam_api_key_here") {
      return res.status(400).json({ error: "SARVAM_API_KEY not configured in .env" });
    }
    if (!req.file) return res.status(400).json({ error: "No audio file received" });

    const mimeType = (req.file.mimetype || "audio/webm").split(";")[0];
    const ext = mimeType.split("/")[1] || "webm";

    const fd = new FormData();
    fd.append("file", req.file.buffer, { filename: `recording.${ext}`, contentType: mimeType });
    fd.append("language_code", req.body.language_code || "hi-IN");
    fd.append("model", "saaras:v3");
    fd.append("mode", "transcribe");

    const sarvamRes = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": SARVAM_API_KEY, ...fd.getHeaders() },
      body: fd,
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      return res.status(502).json({ error: "Speech-to-text service rejected the recording", detail: errText });
    }

    const data = await sarvamRes.json();
    res.json({ transcript: data.transcript || "", language_code: data.language_code || "hi-IN" });
  } catch (err) {
    console.error("STT handler error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Sarvam Vision OCR ─────────────────────────────────────────────────────────
// POST /api/ocr  — receives image, returns extracted bill text
app.post("/api/ocr", upload.single("image"), async (req, res) => {
  try {
    const { SARVAM_API_KEY } = process.env;
    if (!SARVAM_API_KEY || SARVAM_API_KEY === "your_sarvam_api_key_here") {
      return res.status(400).json({ error: "SARVAM_API_KEY not configured in .env" });
    }
    if (!req.file) return res.status(400).json({ error: "No image received" });

    // Convert image buffer to base64
    const base64Image = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";

    // Call Sarvam Vision API (optical character recognition endpoint)
    const sarvamRes = await fetch("https://api.sarvam.ai/vision/ocr", {
      method: "POST",
      headers: {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: base64Image,
        image_format: mimeType.split("/")[1] || "jpeg",
        mode: "document",
      }),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      console.error("Sarvam OCR error:", errText);
      // Fallback: use Gemini Vision if Sarvam OCR fails
      return await fallbackGeminiOcr(req.file.buffer, mimeType, req, res);
    }

    const data = await sarvamRes.json();
    const extractedText = data.text || data.extracted_text || "";

    if (!extractedText.trim()) {
      return await fallbackGeminiOcr(req.file.buffer, mimeType, req, res);
    }

    res.json({ text: extractedText });
  } catch (err) {
    console.error("OCR error:", err);
    // Try Gemini fallback
    try {
      await fallbackGeminiOcr(req.file.buffer, req.file.mimetype, req, res);
    } catch (e) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Gemini Vision fallback for OCR
async function fallbackGeminiOcr(imageBuffer, mimeType, req, res) {
  const { GEMINI_API_KEY } = process.env;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
    return res.status(400).json({ error: "Neither Sarvam OCR nor Gemini API key is configured" });
  }

  const base64Image = imageBuffer.toString("base64");

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
            {
              text: `This is a handwritten or printed bill/receipt from an Indian shop. 
Extract ALL text you can see — item names, quantities, prices, units. 
Return ONLY the raw extracted text, exactly as written. 
Do not format or interpret — just transcribe what you see on the paper.`,
            },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return res.status(502).json({ error: "OCR failed", detail: errText });
  }

  const geminiData = await geminiRes.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
  res.json({ text });
}

// ── Gemini bill parser ────────────────────────────────────────────────────────
app.post("/api/parse-bill", async (req, res) => {
  try {
    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
      return res.status(400).json({ error: "GEMINI_API_KEY not configured in .env" });
    }

    const { transcript, catalog } = req.body;
    if (!transcript?.trim()) return res.status(400).json({ error: "Transcript is empty" });

    const catalogContext =
      catalog && Object.keys(catalog).length > 0
        ? `Known products from previous bills (reference only — current bill price ALWAYS wins): ${JSON.stringify(catalog)}`
        : "No product catalog yet.";

    const prompt = `You are a billing assistant for small Indian shops (kirana stores).
Parse the merchant's transcript (could be voice or OCR from handwritten paper) into a structured bill.
${catalogContext}

Rules:
- Extract item name, quantity, unit, and price
- If quantity is missing, assume 1
- If unit is unclear, use "pcs"
- Price stated in the transcript ALWAYS takes priority over the catalog
- Translate item names to English
- Items where price is ambiguous go in "unclear"
- Return ONLY valid JSON — no markdown, no explanation

Parse this bill: "${transcript}"

Respond with ONLY this JSON structure:
{
  "items": [
    {
      "name": "English item name",
      "quantity": <number>,
      "unit": "kg | litre | pcs | dozen | packet | bottle",
      "pricePerUnit": <number>,
      "total": <quantity * pricePerUnit>
    }
  ],
  "subtotal": <sum of all totals>,
  "unclear": ["description of anything unclear or missing"]
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: "Gemini API failed", detail: errText });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) return res.status(502).json({ error: "Could not parse Gemini response" });

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.subtotal) {
      parsed.subtotal = (parsed.items || []).reduce((s, i) => s + (i.total || 0), 0);
    }

    res.json(parsed);
  } catch (err) {
    console.error("Parse-bill error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── AI Business Chat ──────────────────────────────────────────────────────────
// POST /api/chat — business advisor chat using invoice + catalog data
app.post("/api/chat", async (req, res) => {
  try {
    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
      return res.status(400).json({ error: "GEMINI_API_KEY not configured in .env" });
    }

    const { message, businessContext, history } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message is empty" });

    const salesComparison = businessContext?.salesAnalysis?.comparison;
    const asksWhySalesDown = /\b(sales|revenue|business)\b[\s\S]{0,40}\b(down|dropped|drop|declin|fall)|\b(down|dropped|drop|declin|fall)[\s\S]{0,40}\b(sales|revenue|business)\b/i.test(message);

    // This common question gets a deterministic response from the merchant's own
    // aggregates, rather than asking the model to perform arithmetic from raw bills.
    if (asksWhySalesDown && salesComparison) {
      const money = (value) => `₹${Math.abs(Number(value) || 0).toFixed(0)}`;
      const { currentRevenue, previousRevenue, revenueChange, revenueChangePercent, currentBills, previousBills, billChange } = salesComparison;
      const calculation = `₹${Number(currentRevenue || 0).toFixed(0)} − ₹${Number(previousRevenue || 0).toFixed(0)} = ${revenueChange < 0 ? '−' : ''}${money(revenueChange)}`;

      if (!previousRevenue) {
        return res.json({ reply: `There is no paid-sales data in the previous 7-day period, so I cannot honestly say that sales are down yet.\n\nThis week: ₹${Number(currentRevenue || 0).toFixed(0)} from ${currentBills} paid bill${currentBills === 1 ? '' : 's'}. Keep adding bills for a few more days and I can compare the periods.` });
      }

      if (revenueChange >= 0) {
        return res.json({ reply: `Your sales are not down in the last 7 days.\n\nCalculation: ${calculation}\nThat is ${Math.abs(revenueChangePercent || 0)}% higher than the previous 7 days.\n\nPaid bills: ${currentBills} now vs ${previousBills} before (${billChange >= 0 ? '+' : ''}${billChange}).` });
      }

      const billNote = billChange < 0
        ? `You also had ${Math.abs(billChange)} fewer paid bill${Math.abs(billChange) === 1 ? '' : 's'}, which is the clearest signal in the data.`
        : billChange === 0
          ? 'Your number of paid bills is unchanged, so the drop is likely from lower value per bill.'
          : `You had ${billChange} more paid bills, but their average value was lower.`;
      return res.json({ reply: `Yes — paid sales are lower in the last 7 days.\n\nCalculation: ${calculation}\nThat is a ${Math.abs(revenueChangePercent || 0)}% decrease.\n\nPaid sales: ₹${Number(currentRevenue || 0).toFixed(0)} from ${currentBills} bills\nPrevious 7 days: ₹${Number(previousRevenue || 0).toFixed(0)} from ${previousBills} bills\n\n${billNote}\n\nI only have sales records, so I cannot prove the exact cause (such as footfall or stock) from this data alone. Ask me about your top products or daily sales next and I’ll continue the analysis.` });
    }

    const contextBlock = businessContext
      ? `
=== MERCHANT BUSINESS DATA ===
${JSON.stringify(businessContext, null, 2)}
=== END DATA ===
`
      : "";

    const systemPrompt = `You are VaaniPay's AI business advisor for small Indian shop owners (kirana stores, general stores, etc.).
${contextBlock}

Your role:
- Analyze the merchant's actual invoice and sales data provided above
- Answer business questions: revenue trends, pricing advice, top products, growth suggestions
- Be specific — refer to actual numbers from their data
- The salesAnalysis.comparison block is pre-calculated and is the source of truth for 7-day comparisons. Never invent a number or do a different calculation.
- When discussing a sales increase or decrease, show the calculation: current period revenue − previous period revenue = change, plus the percentage. If the prior period is zero, say a comparison is not possible.
- Keep answers short, practical, and in simple English (they may not be business experts)
- If asked about price increases, give a specific recommendation with reasoning
- If asked about business performance, cite specific numbers from the data
- Be encouraging but honest
- You can also understand Hindi/Telugu/Tamil/Kannada queries and respond in English

Remember: This is a small shop owner, not a corporate. Keep advice grounded and practical.`;

    // Build conversation history for Gemini
    const contents = [];
    
    // Add history
    if (history && history.length > 0) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }
    
    // Add current message
    contents.push({ role: "user", parts: [{ text: message }] });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: "AI service failed", detail: errText });
    }

    const geminiData = await geminiRes.json();
    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
// Start a server only when this file is run directly. Vercel imports the app
// as a serverless function, so it must not call app.listen there.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n✅  VaaniPay backend running → http://localhost:${PORT}`);
    console.log(`   Gemini key:  ${process.env.GEMINI_API_KEY ? "✓ set" : "✗ missing"}`);
    console.log(`   Sarvam key:  ${process.env.SARVAM_API_KEY ? "✓ set" : "✗ missing"}\n`);
  });
}

export default app;
