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
      vehicleInterest: "Browsing",
      tradeInDetails: "",
      testDriveDate: "",
      inspectionDate: "",
      financeInterest: false,
      pathway: [],
      stage: "idle",
      qualified: false,
    };
  }

  function createQualifier(config) {
    const cfg = Object.assign(
      {
        dealerName: "Showroom",
        address: "",
        hoursText: "",
        salesWhatsApp: "", // e.g. 2783… no +
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
      // free text against model names
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
        (session.vehicleInterest && session.vehicleInterest !== "Browsing") ||
        !!session.tradeInDetails ||
        !!session.testDriveDate ||
        !!session.inspectionDate;
      return hasPhone && hasIntent;
    }

    function recomputeQualified() {
      session.qualified = isQualified();
      return session.qualified;
    }

    /**
     * Process one user message.
     * Returns { replies: [{type, text?, suggestions?, catalog?, schedule?}], session }
     * schedule: { type: 'test_drive'|'inspection', days: [...] }
     */
    function process(text) {
      const raw = String(text || "").trim();
      const lower = raw.toLowerCase();
      const replies = [];

      function say(t, suggestions) {
        replies.push({ type: "text", text: t, suggestions: suggestions || [] });
      }

      log('Client: "' + raw + '"');

      // Phone
      const phoneMatched = raw.match(/(?:\+27|0)\d{9}/);
      if (phoneMatched) {
        session.phone = phoneMatched[0];
        log("Saved phone: " + session.phone);
        recomputeQualified();
        say(
          "Thanks — I've logged **" +
            session.phone +
            "**. " +
            (session.qualified
              ? "You're all set; our team will follow up on WhatsApp shortly."
              : "One of the team will follow up on WhatsApp.") +
            (session.qualified ? "\n\n✅ *Lead qualified*" : ""),
          ["Browse stock", "Trade-in", "Hours"]
        );
        return { replies: replies, session: session, handoffReady: session.qualified };
      }

      // Name
      const nameMatched = raw.match(/(?:my name is|i am|i'm|call me)\s+([a-zA-Z\s]{2,20})/i);
      if (nameMatched) {
        session.name = nameMatched[1].trim();
        log("Name: " + session.name);
        say("Nice to meet you, **" + session.name + "**. How can I help?", [
          "Browse stock",
          "I have a trade-in",
          "Book test drive",
        ]);
        return { replies: replies, session: session };
      }

      // Human handoff — highest priority after identity capture
      if (
        /\b(human|agent|real person|someone|consultant|sales\s?(person|man|lady|team)|manager|speak to|talk to|call me|phone me|whatsapp)\b/.test(lower)
      ) {
        log("Requested human handoff");
        say(
          "No problem — I'll connect you to the **" +
            cfg.dealerName +
            " team on WhatsApp** right now. Tap **Open WhatsApp** below and your full chat ticket goes with you, so you never repeat yourself.",
          ["Continue on WhatsApp"]
        );
        return { replies: replies, session: session, handoffReady: true };
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
          ["Browse stock", "Trade-in"]
        );
        return { replies: replies, session: session };
      }

      // Test drive
      if (lower.includes("test drive") || lower.includes("viewing") || lower.includes("view the car")) {
        say("Gladly — pick the car you'd like to drive and tap **Test drive** on its card:");
        replies.push({ type: "catalog", vehicles: cfg.catalog.slice() });
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
        say("Here's a selection from the floor right now:");
        replies.push({ type: "catalog", vehicles: cfg.catalog.slice() });
        return { replies: replies, session: session };
      }

      // Trade-in start
      if (
        lower.includes("trade-in") ||
        lower.includes("trade in") ||
        lower.includes("sell my car") ||
        lower.includes("valuation")
      ) {
        session.stage = "trade_await_specs";
        session.tradeInDetails = "Awaiting input...";
        say("We buy pre-owned daily.\n\nPlease send: **Year, Make, Model, Mileage & condition**.");
        return { replies: replies, session: session };
      }

      if (session.stage === "trade_await_specs" || session.tradeInDetails === "Awaiting input...") {
        session.tradeInDetails = raw;
        session.stage = "idle";
        log("Trade-in specs: " + raw);
        say("Thanks — got those details. Pick a showroom valuation slot:");
        replies.push({ type: "schedule", scheduleType: "inspection", days: getWorkingDays() });
        return { replies: replies, session: session };
      }

      // Finance yes
      if (lower.includes("yes") && (lower.includes("finance") || session.financeInterest)) {
        session.financeInterest = true;
        log("Finance interest confirmed");
        say(
          "Great — finance can run a soft assessment. Please share your **mobile number** so we can continue on WhatsApp.",
          []
        );
        return { replies: replies, session: session };
      }

      // Finance info
      if (
        lower.includes("finance") ||
        lower.includes("loan") ||
        lower.includes("pre-approv") ||
        lower.includes("preapprov") ||
        lower.includes("instalment") ||
        lower.includes("installment") ||
        lower.includes("monthly")
      ) {
        session.financeInterest = true;
        log("Finance info requested");
        say(
          "We arrange finance across **all major banks** — WesBank, MFC, Absa, Standard Bank — with typical terms of 12–72 months and pre-approval in about **2 minutes**.\n\nYou can also try the **Check Affordability** button (bottom-right) for a soft estimate with no credit check. Want the finance desk to call you? Just drop your **mobile number**.",
          ["Talk to a human", "Browse stock"]
        );
        return { replies: replies, session: session };
      }

      // Delivery
      if (lower.includes("deliver") || lower.includes("shipping") || lower.includes("transport")) {
        say(
          "We deliver **nationwide, free** — anywhere in South Africa. Most metro deliveries land within **48 hours** of paperwork, with the car arriving exactly as shown in its Tru3D + VIR report.",
          ["Browse stock", "Talk to a human"]
        );
        return { replies: replies, session: session };
      }

      // Inspection / VIR / Tru3D
      if (
        lower.includes("vir") ||
        lower.includes("inspect") ||
        lower.includes("condition") ||
        lower.includes("360") ||
        lower.includes("3d") ||
        lower.includes("damage")
      ) {
        say(
          "Every car here carries a **TruVIR condition report** — an AI-graded inspection built from a guided photo capture — plus a **Tru3D orbit view**, so you inspect the exact car from your couch. Open any vehicle page and you'll see the score ring and 3D viewer.",
          ["Browse stock", "Book test drive"]
        );
        return { replies: replies, session: session };
      }

      // Dealer / platform questions
      if (
        lower.includes("trusaas") ||
        lower.includes("software") ||
        lower.includes("platform") ||
        lower.includes("walkthrough") ||
        (lower.includes("dealer") && !lower.includes("dealership near"))
      ) {
        say(
          "Good eye — this whole showroom runs on **TruSaaS** dealer software: the search, the Tru3D views, the pricing badges, even me. If you run a dealership, the team will happily give you a **live walkthrough**.",
          ["Talk to a human", "Browse stock"]
        );
        return { replies: replies, session: session };
      }

      // Brand / model match
      const matches = matchCatalog(raw);
      if (matches.length) {
        session.vehicleInterest = matches[0].brand + " " + matches[0].model;
        log("Matched: " + session.vehicleInterest);
        say("I found these on the floor:");
        replies.push({ type: "catalog", vehicles: matches });
        return { replies: replies, session: session };
      }

      // Alternatives not in stock
      const alts = ["mercedes", "merc", "benz", "bmw", "isuzu", "nissan", "kia", "hyundai"];
      const alt = alts.find(function (b) {
        return lower.includes(b);
      });
      if (alt) {
        say(
          "No **" +
            alt.toUpperCase() +
            "** units showing right now — interested in these instead?"
        );
        replies.push({ type: "catalog", vehicles: cfg.catalog.slice(0, 2) });
        return { replies: replies, session: session };
      }

      say(
        "I can help with **stock**, **test drives**, **trade-in valuations**, **finance**, **delivery** or **showroom hours** — or hand you straight to a human.\n\nWhat would you like?",
        ["Browse stock", "Trade-in valuation", "Finance help", "Talk to a human"]
      );
      return { replies: replies, session: session };
    }

    function selectVehicleAction(vehicleLabel, action) {
      const replies = [];
      session.vehicleInterest = vehicleLabel;
      if (action === "finance") {
        session.financeInterest = true;
        log("Finance query: " + vehicleLabel);
        replies.push({
          type: "text",
          text:
            "Estimating terms for **" +
            vehicleLabel +
            "**…\n\nTypical terms are 60–72 months. Want our finance desk to start a preliminary assessment?",
          suggestions: ["Yes, help with finance", "Book test drive instead"],
        });
      } else {
        log("Test drive: " + vehicleLabel);
        replies.push({
          type: "text",
          text: "Let's book a viewing for the **" + vehicleLabel + "**.\n\nPick a date:",
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
        session.testDriveDate = stamp;
        log("Test drive: " + stamp);
        replies.push({
          type: "text",
          text:
            "Booked **test drive** for **" +
            stamp +
            "**" +
            (cfg.address ? " at " + cfg.address : "") +
            ".\n\nPlease send your **phone number** to complete.",
          suggestions: [],
        });
      } else {
        session.inspectionDate = stamp;
        log("Inspection: " + stamp);
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

    function recomputeQualified() {
      session.qualified = isQualified();
      return session.qualified;
    }

    function buildTicket() {
      let msg = "🚗 *" + cfg.dealerName.toUpperCase() + " — LIVE TICKET* 🚗\n\n";
      msg += "👤 *Client:* " + session.name + "\n";
      msg += "📞 *Phone:* " + (session.phone || "Not provided") + "\n";
      msg += "⭐ *Interest:* " + session.vehicleInterest + "\n";
      if (session.financeInterest) msg += "💰 *Finance:* Interested\n";
      msg += "\n";
      if (session.testDriveDate) msg += "🗓️ *Test drive:*\n👉 " + session.testDriveDate + "\n\n";
      if (session.tradeInDetails) {
        msg += "🔄 *Trade-in:*\n👉 " + session.tradeInDetails + "\n";
        if (session.inspectionDate) msg += "🗓️ *Valuation:* " + session.inspectionDate + "\n\n";
      }
      msg += "👣 *Pathway:*\n";
      session.pathway.forEach(function (step, idx) {
        msg += idx + 1 + ". [" + step.time + "] " + step.action + "\n";
      });
      msg += "\n✅ Qualified: " + (session.qualified ? "YES" : "pending phone/intent");
      return msg;
    }

    function whatsappHandoffUrl() {
      const phone = String(cfg.salesWhatsApp || "").replace(/\D/g, "");
      const text = encodeURIComponent(buildTicket());
      return "https://api.whatsapp.com/send?phone=" + phone + "&text=" + text;
    }

    function reset() {
      session = createSession();
      return session;
    }

    function getSession() {
      return session;
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
      reset: reset,
      setCatalog: setCatalog,
      recomputeQualified: recomputeQualified,
      config: cfg,
    };
  }

  root.TruChatQualifier = { createQualifier: createQualifier, createSession: createSession };
})(typeof window !== "undefined" ? window : globalThis);
