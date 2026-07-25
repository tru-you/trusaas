import express from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = Number(process.env.PORT) || 3000;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  app.use(express.json({ limit: "10mb" }));

  // Helper to initialize Gemini SDK safely
  function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // API Health Endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "TruSaaS Backend" });
  });

  // AI Endpoint: Automated Receipt & Invoice Scanner
  app.post("/api/ai/scan-receipt", async (req, res) => {
    try {
      const { imageBase64, textContent, mimeType = "image/jpeg" } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // Fallback demo response if no key is configured
        return res.json({
          vendor: "PE Panel & Paint",
          amount: 1450.00,
          currency: "ZAR",
          date: new Date().toISOString().split("T")[0],
          category: "Reconditioning",
          taxAmount: 189.13,
          paymentMethod: "Corporate Visa ****4242",
          description: "Front bumper replacement & respray — VW Polo",
          confidence: 0.95,
          suggestedAccount: "5200 - Reconditioning",
          isDeductible: true,
          isMockFallback: true,
        });
      }

      const prompt = `Analyze this financial receipt or invoice document. Extract structured transaction data.
Return JSON with the following schema:
{
  "vendor": "String name of vendor/merchant",
  "amount": Number total amount paid,
  "currency": "USD, EUR, GBP, etc.",
  "date": "YYYY-MM-DD date of receipt",
  "category": "One of: Software & Subscriptions, Marketing & Ads, Office Supplies, Travel & Meals, Professional Services, Utilities, Hardware & Equipment, Miscellaneous",
  "taxAmount": Number sales tax or VAT if found, otherwise 0,
  "paymentMethod": "Credit Card, Bank Transfer, PayPal, etc.",
  "description": "Short line item summary",
  "confidence": Number between 0.0 and 1.0,
  "suggestedAccount": "General ledger category string like '6100 - Software & IT Subscriptions'",
  "isDeductible": Boolean true/false
}
Respond strictly with valid JSON only.`;

      let contents: any = prompt;

      if (imageBase64) {
        // strip prefix if included
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        contents = {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        };
      } else if (textContent) {
        contents = `${prompt}\n\nDocument text content:\n${textContent}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);
      res.json({ ...parsed, isMockFallback: false });
    } catch (error: any) {
      console.error("Error in /api/ai/scan-receipt:", error);
      res.status(500).json({
        error: "Failed to parse receipt with AI",
        message: error.message,
      });
    }
  });

  // AI Endpoint: Dealer Assist (sales, stock, workshop and cash assistant)
  app.post("/api/ai/copilot", async (req, res) => {
    try {
      const { message, contextData } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          reply: "I'm Dealer Assist running offline. From today's state:\n\n- **Pipeline**: 5 deals worth about **R3.46m** in play, including a fleet order and a rent-to-own.\n- **Workshop**: a D-Max in delivery prep and a 4x Hilux fleet fit-out underway.\n- **Money**: one overdue rent-to-own instalment (R8,500) to chase.\n\n*Tip: add a Gemini API key in Settings to switch me to live AI.*",
          suggestedActions: [
            { label: "Chase the Haval Jolion website lead", type: "crm", targetId: "deal-105" },
            { label: "Send the fleet deposit invoice", type: "accounting", targetId: "inv-2002" },
            { label: "Check the Hilux fleet fit-out job", type: "project", targetId: "proj-2" }
          ]
        });
      }

      const systemInstruction = `You are Dealer Assist, the assistant for a South African used-car dealership running on TruSaaS (sales, workshop/service, stock and accounting in one).
You can see the dealer's live state in contextData (deals and vehicles in the pipeline, reconditioning jobs, stock, invoices, cash).
Give direct, practical dealer advice: which deals to chase, what to price a unit at, aged stock to move, follow-ups to make, and draft customer messages. Talk like a sales manager, not a SaaS consultant. Amounts are in Rand (R).

Formatting guidelines:
- Use clear markdown formatting with bolding, lists, and headings.
- Be crisp, accurate, professional, and encouraging.
- When relevant, recommend concrete next steps.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Business Context Data:\n${JSON.stringify(contextData, null, 2)}\n\nUser Question/Request:\n${message}`,
        config: {
          systemInstruction,
        },
      });

      res.json({ reply: response.text || "I was unable to analyze that request." });
    } catch (error: any) {
      console.error("Error in /api/ai/copilot:", error);
      res.status(500).json({ error: "Failed to run AI Copilot", message: error.message });
    }
  });

  // AI Endpoint: Deal Health & Follow-up Generator
  app.post("/api/ai/deal-health", async (req, res) => {
    try {
      const { deal } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          score: 88,
          healthStatus: "Strong",
          riskFactors: ["Decision maker absent on last call", "Contract review taking >7 days"],
          recommendedActions: ["Send executive ROI summary", "Offer complimentary onboarding trial"],
          draftEmail: `Hi ${deal.contactName || "there"},\n\nJust following up on the ${deal.title || "vehicle"} you were looking at — it's still available and priced to move. I'd love to get you behind the wheel.\n\nWould a test drive this Thursday suit you?\n\nBest regards,\nRidgeway Auto`
        });
      }

      const prompt = `Analyze this CRM deal and generate a deal health score (0-100), health status, key risk factors, recommended actions, and a personalized follow-up email draft.

Deal Data:
${JSON.stringify(deal, null, 2)}

Respond with valid JSON:
{
  "score": Number 0 to 100,
  "healthStatus": "Critical" | "At Risk" | "Healthy" | "Strong",
  "riskFactors": ["String factor 1", "String factor 2"],
  "recommendedActions": ["Action 1", "Action 2"],
  "draftEmail": "String email draft ready to send"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to evaluate deal health", message: error.message });
    }
  });

  // AI Endpoint: AI Task & Project Breakdown
  app.post("/api/ai/generate-tasks", async (req, res) => {
    try {
      const { projectGoal, scope } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          suggestedTasks: [
            { title: "Define technical requirements & architecture scope", priority: "High", estimatedHours: 8, category: "Discovery" },
            { title: "Design high-fidelity UI wireframes & user flows", priority: "High", estimatedHours: 16, category: "Design" },
            { title: "Setup API endpoints & database models", priority: "Medium", estimatedHours: 12, category: "Development" },
            { title: "Perform QA testing & security audit", priority: "High", estimatedHours: 10, category: "Testing" },
            { title: "Client sign-off & production deployment", priority: "Low", estimatedHours: 4, category: "Deployment" }
          ]
        });
      }

      const prompt = `Given the project goal "${projectGoal}" and scope "${scope || "Standard implementation"}", generate 4 to 6 actionable project tasks with priorities and estimated hours.
Return JSON:
{
  "suggestedTasks": [
    {
      "title": "Task title",
      "priority": "High" | "Medium" | "Low",
      "estimatedHours": Number,
      "category": "Design" | "Development" | "Operations" | "Marketing" | "Testing"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to generate project tasks", message: error.message });
    }
  });

  // AI Endpoint: Dealership Prospect Search (Search Grounding)
  app.post("/api/cardealer/search-prospects", async (req, res) => {
    try {
      const { query } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          prospects: [],
          message: "API Key not configured. Please add GEMINI_API_KEY to secrets."
        });
      }

      const prompt = `Find 10 real car dealerships in or near ${query}. 
For each dealership, provide:
1. Name
2. Full Address
3. Phone number
4. Website URL
5. Brand focus (e.g., Luxury, Toyota, Used Cars)
6. Estimated inventory size (if available)

Return the data strictly as a JSON array of objects with these keys: 
name, address, phone, website, brands, inventorySize, location (city name).`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prospects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    address: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    website: { type: Type.STRING },
                    brands: { type: Type.ARRAY, items: { type: Type.STRING } },
                    inventorySize: { type: Type.INTEGER },
                    location: { type: Type.STRING }
                  },
                  required: ["name", "address", "website"]
                }
              }
            }
          }
        }
      });

      const responseText = response.text || "{\"prospects\":[]}";
      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (error: any) {
      console.error("Error in /api/cardealer/search-prospects:", error);
      res.status(500).json({ error: "Failed to search prospects", message: error.message });
    }
  });

  // AI Endpoint: Advanced Dealership Strategy Analysis (Thinking Mode)
  app.post("/api/cardealer/analyze-dealership", async (req, res) => {
    try {
      const { dealershipData } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        return res.json({
          analysis: "Thinking Mode requires a configured Gemini API Key (gemini-3.1-pro-preview).",
          thought: "Config check failed."
        });
      }

      const prompt = `Perform a deep strategic sales analysis for this car dealership prospect.
Dealership Data:
${JSON.stringify(dealershipData, null, 2)}

Provide a comprehensive report covering:
1. Market Positioning & Competitor Context
2. Potential Pain Points in their current digital presence
3. Specific Sales Angles for our SaaS (CRM, Project Management, Accounting integration)
4. A 30-60-90 day engagement plan

Format the output in clear Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH
          }
        }
      });

      res.json({
        analysis: response.text,
        thought: response.candidates?.[0]?.content?.parts?.find(p => 'thought' in p)?.thought || ""
      });
    } catch (error: any) {
      console.error("Error in /api/cardealer/analyze-dealership:", error);
      res.status(500).json({ error: "Failed to analyze dealership", message: error.message });
    }
  });

  // Serve Vite in development mode or Static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`TruSaaS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
