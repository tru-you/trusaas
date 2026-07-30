/**
 * WhatsApp Business bot bridge — shared brain path for Ray.
 *
 * Flow:
 *  1. Buyer messages the WhatsApp Business number
 *  2. Cloud API webhook → handleInbound(sessionKey, text)
 *  3. Same TruChatQualifier as the web chatbot replies on Ray's behalf
 *  4. When session is legitimate / qualified → buildPersonalForward()
 *     so the ticket is sent to Ray's personal WhatsApp (not the business line)
 *
 * This module is channel logic only — no DOM. Wire Meta/Twilio webhook server to it.
 */
(function (root) {
  "use strict";

  /**
   * @param {object} config  RAY_TRUCHAT_CONFIG-shaped (or partial)
   * @param {object} [deps]  { createQualifier } — defaults to root.TruChatQualifier
   */
  function createWaBusinessBot(config, deps) {
    const cfg = Object.assign({}, config || {});
    const TQ = (deps && deps.createQualifier) || (root.TruChatQualifier && root.TruChatQualifier.createQualifier);
    if (!TQ) {
      throw new Error("TruChatQualifier required — load qualifier.js before wa-business.js");
    }

    /** sessionKey (WA from-number) → qualifier instance */
    const sessions = Object.create(null);

    function personalDigits() {
      return String(cfg.personalWhatsApp || cfg.salesWhatsApp || "").replace(/\D/g, "");
    }

    function businessDigits() {
      return String(cfg.waBusinessNumber || "").replace(/\D/g, "");
    }

    function getOrCreate(sessionKey) {
      const key = String(sessionKey || "default");
      if (!sessions[key]) {
        sessions[key] = TQ({
          dealerName: cfg.dealerName,
          address: cfg.address,
          hoursText: cfg.hoursText,
          salesWhatsApp: personalDigits(), // personal = final human handoff
          catalog: (cfg.catalog || []).slice(),
          brandMap: cfg.brandMap || {},
        });
      }
      return sessions[key];
    }

    /**
     * Process one inbound WhatsApp user message.
     * @returns {{
     *   replies: Array,
     *   session: object,
     *   handoffReady: boolean,
     *   outboundTexts: string[],  // plain text lines to send via Cloud API
     *   personalForward: null | { phone, text, url }
     * }}
     */
    function handleInbound(sessionKey, text, options) {
      const bot = getOrCreate(sessionKey);
      const out = bot.process(String(text || ""));
      const outboundTexts = [];

      (out.replies || []).forEach(function (r) {
        if (r.type === "text" && r.text) {
          let t = r.text.replace(/\*\*/g, "*"); // WA-friendly bold
          if (r.suggestions && r.suggestions.length) {
            t += "\n\n_Reply with:_\n• " + r.suggestions.join("\n• ");
          }
          outboundTexts.push(t);
        }
        if (r.type === "catalog" && r.vehicles && r.vehicles.length) {
          const lines = r.vehicles.slice(0, 6).map(function (v, i) {
            return (
              i +
              1 +
              ". " +
              v.year +
              " " +
              v.brand +
              " " +
              v.model +
              " — R " +
              Number(v.price || 0).toLocaleString("en-ZA")
            );
          });
          outboundTexts.push("Stock picks:\n" + lines.join("\n") + "\n\nReply with a model name, or *Finance* / *Test drive*.");
        }
        if (r.type === "schedule") {
          const days = (r.days || []).map(function (d) {
            return d.label;
          });
          outboundTexts.push(
            (r.scheduleType === "test_drive" ? "Test drive" : "Valuation") +
              " dates:\n• " +
              days.join("\n• ") +
              "\n\nReply with a date (e.g. Mon 12 Jan), then a time."
          );
        }
      });

      const session = bot.getSession();
      let personalForward = null;
      const force = options && options.forceForward;
      if ((out.handoffReady || session.qualified || force) && personalDigits()) {
        personalForward = buildPersonalForward(bot);
      }

      return {
        replies: out.replies || [],
        session: session,
        handoffReady: !!(out.handoffReady || session.qualified),
        outboundTexts: outboundTexts,
        personalForward: personalForward,
      };
    }

    /** Ticket → Ray's personal WhatsApp */
    function buildPersonalForward(botOrSessionKey) {
      const bot =
        typeof botOrSessionKey === "string" || botOrSessionKey == null
          ? getOrCreate(botOrSessionKey || "default")
          : botOrSessionKey;
      const phone = personalDigits();
      const text = bot.buildTicket();
      const header =
        "🤖 *TruChat WA Business → personal forward*\n" +
        "Qualified lead from the business line. Reply to the buyer on their thread or call them.\n\n";
      const body = header + text;
      return {
        phone: phone,
        text: body,
        url: "https://api.whatsapp.com/send?phone=" + phone + "&text=" + encodeURIComponent(body),
      };
    }

    function resetSession(sessionKey) {
      const key = String(sessionKey || "default");
      if (sessions[key]) sessions[key].reset();
      delete sessions[key];
    }

    function setCatalog(list) {
      Object.keys(sessions).forEach(function (k) {
        sessions[k].setCatalog(list);
      });
      cfg.catalog = list || [];
    }

    return {
      handleInbound: handleInbound,
      buildPersonalForward: buildPersonalForward,
      resetSession: resetSession,
      setCatalog: setCatalog,
      getSession: function (sessionKey) {
        return getOrCreate(sessionKey).getSession();
      },
      personalWhatsApp: personalDigits,
      waBusinessNumber: businessDigits,
      config: cfg,
    };
  }

  root.TruChatWaBusiness = { createWaBusinessBot: createWaBusinessBot };
})(typeof window !== "undefined" ? window : globalThis);
