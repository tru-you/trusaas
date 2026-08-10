/**
 * TruChat qualifier engine — shared by web bot + future WhatsApp webhook.
 * Pure logic: no DOM. Configure via createQualifier(config).
 */
(function (root) {
  "use strict";

  function createSession() {
    return {
      name: "Prospect",
      phone: "",
      email: "",
      propertyInterest: "Browsing",
      budgetNotes: "",
      viewingDate: "",
      inspectionDate: "",
      bondInterest: false,
      pathway: [],
      stage: "idle",
      qualified: false,
      score: 0,
      idlePinged: false,
    };
  }

  function createQualifier(config) {
    const cfg = Object.assign(
      {
        assistantName: "Assistant",
        dealerName: "Showroom",
        address: "",
        hoursText: "",
        afterHoursText: "",
        salesWhatsApp: "",
        catalog: [],
        brandMap: {},
        workingDays: 6,
        skipSunday: true,
        weekdaySlots: ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"],
        saturdaySlots: ["08:30 AM", "10:00 AM", "11:30 AM"],
      },
      config || {}
    );

    let session = createSession();

    function log(action) {
      const t = new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
      session.pathway.push({ action: action, time: t });
    }

    function addScore(points, reason) {
      session.score = Math.min(100, session.score + points);
      log("Score +" + points + " (" + reason + ") → " + session.score);
    }

    function getWorkingDays() {
      const days = [];
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const d = new Date();
      while (days.length < cfg.workingDays) {
        d.setDate(d.getDate() + 1);
        if (cfg.skipSunday && d.getDay() === 0) continue;
        days.push({
          label: dayNames[d.getDay()] + " " + d.getDate() + " " + monthNames[d.getMonth()],
          isSaturday: d.getDay() === 6,
          iso: d.toISOString().slice(0, 10),
        });
      }
      return days;
    }

    function slotsFor(isSaturday) {
      return isSaturday ? cfg.saturdaySlots : cfg.weekdaySlots;
    }

    function matchCatalog(text) {
      const lower = String(text || "").toLowerCase();
      const map = cfg.brandMap || {};
      for (const key of Object.keys(map)) {
        if (lower.includes(key)) {
          const brand = map[key];
          return cfg.catalog.filter(function (c) {
            return String(c.brand).toUpperCase() === String(brand).toUpperCase();
          });
        }
      }
      return cfg.catalog.filter(function (c) {
        const blob = (c.brand + " " + c.model).toLowerCase();
        return lower.split(/\s+/).some(function (w) {
          return w.length > 3 && blob.includes(w);
        });
      });
    }

    function isQualified() {
      const hasPhone = !!session.phone;
      const hasIntent =
        (session.propertyInterest && session.propertyInterest !== "Browsing") ||
        !!session.budgetNotes ||
        !!session.viewingDate ||
        !!session.inspectionDate;
      return hasPhone && hasIntent;
    }

    function recomputeQualified() {
      session.qualified = isQualified();
      return session.qualified;
    }

    function computeDigitalScore() {
      var s = 0;
      if (session.phone) s += 25;
      if (session.email) s += 10;
      if (session.name && session.name !== "Prospect") s += 5;
      if (session.propertyInterest && session.propertyInterest !== "Browsing") s += 15;
      if (session.bondInterest) s += 15;
      if (session.budgetNotes && session.budgetNotes !== "Awaiting input...") s += 15;
      if (session.viewingDate) s += 20;
      if (session.inspectionDate) s += 15;
      s += Math.min(20, (session.pathway || []).length * 2);
      return Math.min(100, s);
    }

    function process(text) {
      const raw = String(text || "").trim();
      const lower = raw.toLowerCase();
      const replies = [];

      function say(t, suggestions) {
        replies.push({ type: "text", text: t, suggestions: suggestions || [] });
      }

      log('Client: "' + raw + '"');
      addScore(2, "message");

      // Email
      var emailMatch = raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        session.email = emailMatch[0];
        log("Saved email: " + session.email);
        addScore(10, "email");
        recomputeQualified();
        say(
          "Got it — **" + session.email + "** saved." +
          (!session.phone ? "\n\nCould you also share your **phone number** so the team can WhatsApp you?" : " Thanks!"),
          session.phone ? ["Browse stock", "Budget", "Hours"] : []
        );
        return { replies: replies, session: session, handoffReady: session.qualified };
      }

      // Phone
      const phoneMatched = raw.match(/(?:\+27|0)\d{9}/);
      if (phoneMatched) {
        session.phone = phoneMatched[0];
        log("Saved phone: " + session.phone);
        addScore(25, "phone");
        recomputeQualified();
        say(
          "Thanks — I've logged **" +
            session.phone +
            "**." +
            (!session.email ? " If you'd like email updates too, drop your **email address** anytime." : "") +
            (session.qualified
              ? "\n\n✅ *Lead qualified* — our team will follow up on WhatsApp shortly."
              : "\n\nOne of the team will follow up on WhatsApp."),
          ["Browse stock", "Budget", "Hours"]
        );
        return { replies: replies, session: session, handoffReady: session.qualified };
      }

      // Name
      const nameMatched = raw.match(/(?:my name is|i am|i'm|call me)\s+([a-zA-Z\s]{2,20})/i);
      if (nameMatched) {
        session.name = nameMatched[1].trim();
        log("Name: " + session.name);
        addScore(5, "name");
        say("Nice to meet you, **" + session.name + "**. How can I help?", [
          "Browse stock",
          "I have a budget",
          "Book viewing",
        ]);
        return { replies: replies, session: session };
      }

      // Greeting
      if (/^\s*(hi+|hey+|hello|howzit|hallo|yo|greetings|good\s+(morning|afternoon|evening|day))[\s!.,]*$/i.test(raw)) {
        say(
          "Hi there! 👋 I'm **" +
            (cfg.assistantName || "your assistant") +
            "** at **" +
            cfg.dealerName +
            "**. I can help with **stock**, **viewings**, **budget valuations**, **finance**, or **hours**. What are you after?",
          ["Browse stock", "Budget valuation", "Book viewing", "Finance help"]
        );
        return { replies: replies, session: session };
      }

      // Thanks
      if (/^\s*(thanks?|thank\s+you|thank\s+u|cheers|much\s+appreciated|dankie|lekker)[\s!.,]*$/i.test(raw)) {
        say("Pleasure! 🙌 Anything else I can sort — stock, finance, or a viewing?", [
          "Browse stock",
          "Finance help",
          "Book viewing",
        ]);
        return { replies: replies, session: session };
      }

      // Hours / address
      if (
        lower.includes("address") ||
        lower.includes("location") ||
        lower.includes("where") ||
        lower.includes("hours") ||
        lower.includes("open")
      ) {
        say(
          (cfg.address ? "📍 **" + cfg.address + "**\n\n" : "") + (cfg.hoursText || "Please ask the team for hours."),
          ["Browse stock", "Budget"]
        );
        return { replies: replies, session: session };
      }

      // Catalog
      if (
        lower.includes("catalog") ||
        lower.includes("stock") ||
        lower.includes("inventory") ||
        lower.includes("cars") ||
        lower.includes("browse")
      ) {
        addScore(10, "viewed stock");
        say("Here's a selection from the floor right now:");
        replies.push({ type: "catalog", propertys: cfg.catalog.slice() });
        return { replies: replies, session: session };
      }

      // Budget start
      if (
        lower.includes("budget") ||
        lower.includes("trade in") ||
        lower.includes("sell my car") ||
        lower.includes("valuation")
      ) {
        session.stage = "trade_await_specs";
        session.budgetNotes = "Awaiting input...";
        addScore(10, "budget interest");
        say("We buy pre-owned daily.\n\nPlease send: **Year, Make, Model, Mileage & condition**.");
        return { replies: replies, session: session };
      }

      if (session.stage === "trade_await_specs" || session.budgetNotes === "Awaiting input...") {
        session.budgetNotes = raw;
        session.stage = "idle";
        log("Budget specs: " + raw);
        addScore(15, "budget details");
        say("Thanks — got those details. Pick a showroom valuation slot:");
        replies.push({ type: "schedule", scheduleType: "inspection", days: getWorkingDays() });
        return { replies: replies, session: session };
      }

      // Finance yes
      if (lower.includes("yes") && (lower.includes("finance") || session.bondInterest)) {
        session.bondInterest = true;
        log("Finance interest confirmed");
        addScore(15, "finance confirmed");
        say(
          "Great — finance can run a soft assessment. Please share your **mobile number** so we can continue on WhatsApp.",
          []
        );
        return { replies: replies, session: session };
      }

      // Finance interest
      if (
        lower.includes("finance") ||
        lower.includes("financ") ||
        lower.includes("afford") ||
        lower.includes("instal") ||
        lower.includes("repayment") ||
        lower.includes("deposit") ||
        lower.includes("credit")
      ) {
        session.bondInterest = true;
        log("Finance interest");
        addScore(10, "finance interest");
        say(
          "We arrange **property finance** through the major banks on our approved pre-owned stock.\n\nShare your **mobile number** and I'll have the finance desk start a soft, no-obligation assessment on WhatsApp.",
          ["Browse stock", "Book viewing"]
        );
        return { replies: replies, session: session };
      }

      // Brand / model match
      const matches = matchCatalog(raw);
      if (matches.length) {
        session.propertyInterest = matches[0].brand + " " + matches[0].model;
        log("Matched: " + session.propertyInterest);
        addScore(15, "property interest");
        say("I found these on the floor:");
        replies.push({ type: "catalog", propertys: matches });
        return { replies: replies, session: session };
      }

      // Alternatives not in stock
      const alts = ["mercedes", "merc", "benz", "bmw", "isuzu", "nissan", "kia", "hyundai"];
      const alt = alts.find(function (b) {
        return lower.includes(b);
      });
      if (alt) {
        addScore(5, "brand mention");
        say(
          "No **" +
            alt.toUpperCase() +
            "** units showing right now — interested in these instead?"
        );
        replies.push({ type: "catalog", propertys: cfg.catalog.slice(0, 2) });
        return { replies: replies, session: session };
      }

      say(
        "I can help with **stock**, **viewings**, **budget valuations**, **finance**, or **showroom hours**.\n\nWhat would you like?",
        ["Browse stock", "Budget valuation", "Finance help", "Showroom hours"]
      );
      return { replies: replies, session: session };
    }

    function selectVehicleAction(propertyLabel, action) {
      const replies = [];
      session.propertyInterest = propertyLabel;
      if (action === "finance") {
        session.bondInterest = true;
        log("Finance query: " + propertyLabel);
        addScore(15, "finance on property");
        replies.push({
          type: "text",
          text:
            "Estimating terms for **" +
            propertyLabel +
            "**…\n\nTypical terms are 60–72 months. Want our finance desk to start a preliminary assessment?",
          suggestions: ["Yes, help with finance", "Book viewing instead"],
        });
      } else {
        log("Test drive: " + propertyLabel);
        addScore(15, "viewing request");
        replies.push({
          type: "text",
          text: "Let's book a viewing for the **" + propertyLabel + "**.\n\nPick a date:",
          suggestions: [],
        });
        replies.push({ type: "schedule", scheduleType: "test_drive", days: getWorkingDays() });
      }
      return { replies: replies, session: session };
    }

    function confirmSlot(scheduleType, dateLabel, timeLabel) {
      const replies = [];
      const stamp = dateLabel + " @ " + timeLabel;
      if (scheduleType === "test_drive") {
        session.viewingDate = stamp;
        log("Test drive: " + stamp);
        addScore(20, "viewing booked");
        replies.push({
          type: "text",
          text:
            "Booked **viewing** for **" +
            stamp +
            "**" +
            (cfg.address ? " at " + cfg.address : "") +
            ".\n\nPlease send your **phone number** to complete.",
          suggestions: [],
        });
      } else {
        session.inspectionDate = stamp;
        log("Inspection: " + stamp);
        addScore(15, "inspection booked");
        replies.push({
          type: "text",
          text:
            "Valuation slot confirmed for **" +
            stamp +
            "**.\n\nDrop your **phone number** to finalise.",
          suggestions: [],
        });
      }
      recomputeQualified();
      return { replies: replies, session: session };
    }

    function buildTicket() {
      let msg = "🚗 *" + cfg.dealerName.toUpperCase() + " — LIVE TICKET* 🚗\n\n";
      msg += "👤 *Client:* " + session.name + "\n";
      msg += "📞 *Phone:* " + (session.phone || "Not provided") + "\n";
      if (session.email) msg += "✉️ *Email:* " + session.email + "\n";
      msg += "⭐ *Interest:* " + session.propertyInterest + "\n";
      if (session.bondInterest) msg += "💰 *Finance:* Interested\n";
      msg += "🔥 *Lead score:* " + computeDigitalScore() + "/100\n";
      msg += "\n";
      if (session.viewingDate) msg += "🗓️ *Test drive:*\n👉 " + session.viewingDate + "\n\n";
      if (session.budgetNotes) {
        msg += "🔄 *Budget:*\n👉 " + session.budgetNotes + "\n";
        if (session.inspectionDate) msg += "🗓️ *Valuation:* " + session.inspectionDate + "\n\n";
      }
      msg += "👣 *Pathway:*\n";
      session.pathway.forEach(function (step, idx) {
        msg += idx + 1 + ". [" + step.time + "] " + step.action + "\n";
      });
      msg += "\n✅ Qualified: " + (session.qualified ? "YES" : "pending phone/intent");
      msg += "\n\n— sent via *TruChat* by TruSaaS";
      return msg;
    }

    function whatsappHandoffUrl() {
      const phone = String(cfg.salesWhatsApp || "").replace(/\D/g, "");
      const text = encodeURIComponent(buildTicket());
      return "https://api.whatsapp.com/send?phone=" + phone + "&text=" + text;
    }

    function getIdleNudge() {
      if (session.idlePinged) return null;
      session.idlePinged = true;
      if (session.propertyInterest && session.propertyInterest !== "Browsing") {
        return {
          text: "Still thinking about the **" + session.propertyInterest + "**? I can check finance options or book a viewing — just say the word.",
          suggestions: ["Finance help", "Book viewing", "Browse other stock"]
        };
      }
      if (session.bondInterest) {
        return {
          text: "Still here if you need finance help — share your **phone number** and the finance desk can start a soft assessment.",
          suggestions: ["Browse stock", "Budget"]
        };
      }
      return {
        text: "Still around! Anything I can help with — **stock**, **viewings**, **budgets**, or **finance**?",
        suggestions: ["Browse stock", "Budget valuation", "Finance help"]
      };
    }

    function reset() {
      session = createSession();
      return session;
    }

    function getSession() {
      return session;
    }

    function setSession(s) {
      session = Object.assign(createSession(), s || {});
    }

    function setCatalog(list) {
      cfg.catalog = list || [];
    }

    return {
      process: process,
      selectVehicleAction: selectVehicleAction,
      confirmSlot: confirmSlot,
      getWorkingDays: getWorkingDays,
      slotsFor: slotsFor,
      buildTicket: buildTicket,
      whatsappHandoffUrl: whatsappHandoffUrl,
      getSession: getSession,
      setSession: setSession,
      reset: reset,
      setCatalog: setCatalog,
      recomputeQualified: recomputeQualified,
      computeDigitalScore: computeDigitalScore,
      getIdleNudge: getIdleNudge,
      config: cfg,
    };
  }

  root.TruChatQualifier = { createQualifier: createQualifier, createSession: createSession };
})(typeof window !== "undefined" ? window : globalThis);
