const CFG = window.RAY_TRUCHAT_CONFIG;
    const bot = TruChatWaBusiness.createWaBusinessBot(CFG);
    const log = document.getElementById("log");
    const input = document.getElementById("input");
    const SIM_KEY = "sim-buyer";

    function digits(n) {
      return String(n || "").replace(/\D/g, "");
    }

    const biz = digits(CFG.waBusinessNumber);
    const personal = digits(CFG.personalWhatsApp || CFG.salesWhatsApp);
    const bizEl = document.getElementById("bizNum");
    const perEl = document.getElementById("personalNum");
    if (biz) {
      bizEl.textContent = "+" + biz;
      bizEl.className = "v ok";
    } else {
      bizEl.textContent = "Not set — add waBusinessNumber in config.js";
      bizEl.className = "v miss";
    }
    if (personal) {
      perEl.textContent = "+" + personal;
      perEl.className = "v ok";
    } else {
      perEl.textContent = "Missing personalWhatsApp";
      perEl.className = "v miss";
    }

    function append(role, text) {
      const prefix = role === "buyer" ? "👤 Buyer: " : role === "bot" ? "🤖 Bot: " : "➡️ Forward: ";
      log.textContent += (log.textContent === "Simulate inbound…" ? "" : "\n\n") + prefix + text;
      if (log.textContent.startsWith("Simulate inbound…\n") || log.textContent === "Simulate inbound…") {
        if (log.textContent === "Simulate inbound…") log.textContent = prefix + text;
      }
      log.scrollTop = log.scrollHeight;
    }

    // clear placeholder on first message
    let started = false;
    function ensureStart() {
      if (!started) {
        log.textContent = "";
        started = true;
      }
    }

    function send() {
      const t = input.value.trim();
      if (!t) return;
      ensureStart();
      append("buyer", t);
      input.value = "";
      const out = bot.handleInbound(SIM_KEY, t);
      (out.outboundTexts || []).forEach((line) => append("bot", line));
      if (out.personalForward) {
        append("fwd", "QUALIFIED → personal +" + out.personalForward.phone + "\n" + out.personalForward.text);
      }
    }

    document.getElementById("send").onclick = send;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });