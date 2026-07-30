(function () {
      var CFG = window.RAY_TRUCHAT_CONFIG;
      var phone = String(CFG.personalWhatsApp || CFG.salesWhatsApp || "").replace(/\D/g, "");
      var wa = document.getElementById("waLink");
      if (phone) {
        wa.href = "https://wa.me/" + phone;
        wa.textContent = "0" + phone.slice(2);
      }
      (function resolveLogo() {
        var p = CFG.logoUrl || CFG.fabIconUrl || "assets/ycg-icon.jpg";
        try {
          p = new URL(p, location.href).href;
        } catch (e) {}
        CFG.logoUrl = p;
        document.getElementById("logo").src = p;
      })();

      function updateHours() {
        var now = new Date();
        var day = now.getDay();
        var mins = now.getHours() * 60 + now.getMinutes();
        var open = false;
        if (day >= 1 && day <= 5) open = mins >= 450 && mins <= 1050;
        if (day === 6) open = mins >= 450 && mins <= 780;
        var el = document.getElementById("hoursBadge");
        el.textContent = open ? "Showroom open" : "After hours · online";
        el.style.color = open ? "#34d399" : "#fff";
      }
      updateHours();
      setInterval(updateHours, 30000);

      window.TruChatUI.mount(document.getElementById("chatMount"), {
        config: CFG,
        showFoot: false,
      });
    })();