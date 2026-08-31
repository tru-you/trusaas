/**
 * TruChat AI proxy — True-Cars demo showroom.
 * Keeps the DeepSeek API key server-side; the widget POSTs the conversation here.
 *
 * Netlify env var required: DEEPSEEK_API_KEY
 * Dependency-free (drag-and-drop deploys don't run npm install) — uses Node 18+ global fetch.
 *
 * POST body: { messages: [{role:'user'|'assistant', content:string}], vehicle?: string, stock?: string[] }
 * Response:  { reply: string, handoff: boolean }
 */

const MODEL = "deepseek-chat";
const HANDOFF_TOKEN = "[[HANDOFF]]";

const TONE_RULES = `TONE RULES (follow strictly):
- NEVER use markdown headers (# ## ### ####). Not once. Not ever. Plain text only.
- NEVER use multiple exclamation marks (!! or !!!). Maximum one per message. Prefer full stops.
- No emoji spam — one emoji per message at most, and only if natural.
- No marketing speak, no hype, no "amazing", "incredible", "game-changer".
- Write like a calm, knowledgeable colleague — not a brand account.
- Short paragraphs. 1-3 sentences each. No walls of text.
- Use **bold** sparingly — for vehicle names, prices, or key actions only.`;

const SYSTEM_STATIC = `You are **True**, the AI showroom assistant for **True-Cars** (true-cars.co.za), a South African online dealership demo built on the **TruSaaS** dealer platform.

${TONE_RULES}

Personality: warm, direct, helpful — a sharp salesperson who respects people's time. Keep replies SHORT: 1-4 sentences. Prices in Rand, formatted like R464 900. Never invent stock — only reference vehicles from the CURRENT STOCK list. If asked about a car not in stock, say so and suggest the closest match from stock.

Dealership facts:
- Hours: Mon-Fri 08:00-17:00, Sat 08:00-13:00, Sun closed. Virtual showroom — nationwide, based in Cape Town.
- Delivery: FREE nationwide anywhere in South Africa, most metro deliveries within 48 hours of paperwork.
- Finance: arranged across all major banks (WesBank, MFC, Absa, Standard Bank), terms 12-72 months, pre-approval in ~2 minutes. There is a "Check Affordability" (TruAfford) button bottom-right of the site for a soft estimate with no credit check.
- Inspections: every car has a TruVIR condition report (AI-graded from a guided TruLens photo capture) and a TruOrbit 360-degree orbit view on its vehicle page.
- Trade-ins: we buy cars even if the customer doesn't buy ours; instant online estimate on the Sell/Trade-in page, valuation slots at the showroom.
- Test drives / viewings: bookable Mon-Sat; suggest the customer shares a mobile number so the team confirms on WhatsApp.
- For dealers: this whole showroom runs on TruSaaS dealer software (the search, TruOrbit, pricing badges, this chat). Dealers can book a live walkthrough at www.tru-saas.com.

Lead capture: when a customer shows real intent (test drive, trade-in, finance, specific car), naturally ask for their mobile number so the team can WhatsApp them. Don't be pushy; ask once.

Human handoff: if the customer asks for a human/agent/salesperson, wants to phone or WhatsApp someone, is frustrated, or has a request you cannot handle — end your reply with the exact token ${HANDOFF_TOKEN} on its own. The site then shows a WhatsApp button that transfers them, with the chat transcript, to the True-Cars team. Tell them you're connecting them before the token.

Stay on dealership topics. If asked something unrelated (politics, coding, homework), politely steer back to cars in one sentence.`;

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "POST only" }) };

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "DEEPSEEK_API_KEY not configured" }) };

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "invalid JSON" }) };
  }

  // Validate + clamp untrusted client input
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-24)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "messages must end with a user turn" }) };
  }

  const stock = (Array.isArray(body.stock) ? body.stock : [])
    .slice(0, 24)
    .map((s) => String(s).slice(0, 200));
  const vehicle = typeof body.vehicle === "string" ? body.vehicle.slice(0, 120) : null;

  let context = "CURRENT STOCK (live from the site):\n" + (stock.length ? stock.map((s) => "- " + s).join("\n") : "(stock list unavailable — direct the customer to the Browse Stock page)");
  if (vehicle) context += `\n\nThe customer is currently viewing this vehicle: ${vehicle}`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_STATIC + "\n\n" + context },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("DeepSeek API error", res.status, detail.slice(0, 500));
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: "upstream " + res.status }) };
    }

    const data = await res.json();
    let reply = (data.choices?.[0]?.message?.content || "").trim();

    const handoff = reply.includes(HANDOFF_TOKEN);
    reply = reply.split(HANDOFF_TOKEN).join("").trim();
    if (!reply) reply = handoff
      ? "Let me connect you with the True-Cars team on WhatsApp — tap the button below."
      : "Sorry, I lost my train of thought — could you say that again?";

    return { statusCode: 200, headers: cors, body: JSON.stringify({ reply, handoff }) };
  } catch (err) {
    console.error("truchat function error", err && err.message);
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: "ai unavailable" }) };
  }
};
