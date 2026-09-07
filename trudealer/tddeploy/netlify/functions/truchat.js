/**
 * TruChat AI Proxy — TruDealer Platform (trudealer.tru-saas.com)
 * Serverless Netlify function backed by DeepSeek LLM (deepseek-chat).
 *
 * Netlify env var required: DEEPSEEK_API_KEY
 */

const MODEL = "deepseek-chat";
const HANDOFF_TOKEN = "[[HANDOFF]]";

const SYSTEM_PROMPT = `You are TruChat, the 24/7 AI Sales Assistant for TruDealer (trudealer.tru-saas.com), the vertical SaaS operating system for independent car dealerships in South Africa and the UK.

TONE & STYLE:
- Calm, direct, sharp, and helpful — like an experienced dealership director.
- Concise: 1-3 sentences per reply. No long essays.
- Prices in ZAR (R) or GBP (£) when asked.
- No excessive exclamation marks, no emoji spam (maximum 1 relevant emoji per message).
- Never use markdown headers (# ##). Use plain text or bold sparingly.

KEY PLATFORM KNOWLEDGE:
1. Pricing & Packages:
   - TruStart: R1,599/mo (single lot, unlimited listings, TruLens 28-shot photo studio, TruInspect 35-point VIR condition reports, TruFlow mobile stock app, 24/7 AI chat, branded website).
   - TruPro: R3,599/mo (full cloud DMS, bank F&I calculators, live market price scraper, deal jackets, OTPs, SARS tax invoicing, 13+ portal syndication).
2. Modules:
   - TruLens: 28-shot guided photo studio with on-screen ghost wireframes (takes <90s) & TruOrbit 360° spin generator.
   - TruInspect: 35-point digital VIR condition report, interactive damage pin tagger, TransUnion verification & dispute-proof PDF reports.
   - TruFlow DMS: Stock tracking, recon costs, bank interest & balloon calculations, OTP deal jackets, and SARS tax invoicing in 2 clicks.
   - TruShowroom: Custom 100 Web Vitals storefronts with finance sliders & instant WhatsApp lead triggers.
3. Go-Live Timeline:
   - 10 working days from scope call to live on your custom domain with your stock loaded.
4. Booking a Walkthrough / Demo:
   - Prospects can pick a 15-minute time on the live calendar (https://cal.com/pgdebeer) or WhatsApp support (+44 7476 995694).

When the prospect is ready to book or wants to speak to someone, warmly direct them to book on the calendar or WhatsApp.`;

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "POST only" }) };
  }

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        reply: "Hi! TruDealer gives you custom showroom websites, 28-shot photo studio, digital condition reports, full cloud DMS invoicing, and 24/7 AI chat. Would you like to book a 15-min live walkthrough?",
        source: "fallback-no-key"
      }),
    };
  }

  let body;
  try {
    if (typeof event.body === "object" && event.body !== null) {
      body = event.body;
    } else {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "{}");
      body = typeof raw === "string" ? JSON.parse(raw) : raw;
    }
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "invalid JSON" }) };
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages
    .slice(-12)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Messages must end with a user turn" }) };
  }

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 350,
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("DeepSeek API error:", res.status, detail.slice(0, 300));
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({
          reply: "I can help you with TruDealer packages (TruStart R1,599 / TruPro R3,599), TruLens 28-shot studio, TruInspect VIR reports, or booking a 15-min live demo on calendar.",
          source: "fallback-upstream-error"
        }),
      };
    }

    const data = await res.json();
    let reply = (data.choices?.[0]?.message?.content || "").trim();
    if (!reply) {
      reply = "TruDealer is the complete dealer OS — from 28-shot photo studio to full SARS DMS invoicing. Tap 'Book' to schedule a live walkthrough.";
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ reply, source: "deepseek" }),
    };
  } catch (err) {
    console.error("TruChat Netlify Function error:", err);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        reply: "You can book a 15-minute live TruDealer walkthrough directly on our calendar or chat with us on WhatsApp.",
        source: "fallback-error"
      }),
    };
  }
};
