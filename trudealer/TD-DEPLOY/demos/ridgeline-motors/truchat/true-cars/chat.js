(function () {
      var CFG = window.TRUECARS_TRUCHAT_CONFIG;
      var phone = String(CFG.personalText || CFG.salesText || "").replace(/\D/g, "");
      var wa = document.getElementById("waLink");
      if (phone) {
        wa.href = "https://wa.me/" + phone;
        wa.textContent = "+" + phone.replace(/^(27)/, "27 ").replace(/(\d{2})(\d{3})(\d{4})$/, "$1 $2 $3");
      }
      (function () {
        var p = CFG.logoUrl || "assets/truecars-mark.jpg";
        try { p = new URL(p, location.href).href; } catch (e) {}
        CFG.logoUrl = p;
        document.getElementById("logo").src = p;
      })();
      function updateHours() {
        var now = new Date(), day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
        var open = (day >= 1 && day <= 5 && mins >= 480 && mins <= 1020) || (day === 6 && mins >= 480 && mins <= 780);
        var el = document.getElementById("hoursBadge");
        el.textContent = open ? "Demo open" : "After hours · online";
        el.style.color = open ? "#34d399" : "#fff";
      }
      updateHours();
      setInterval(updateHours, 30000);
      window.TruChatUI.mount(document.getElementById("chatMount"), { config: CFG, showFoot: false });
    })();