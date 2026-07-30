const CFG = window.TRUECARS_TRUCHAT_CONFIG || {};
    const LS_KEY = (CFG.leadStorageKey || "truecars_truchat_leads_v1");
    const PIN_OK = "truecars_portal_ok_v1";
    let leads = [];
    let selected = -1;

    function personalPhone() {
      return String(CFG.personalText || CFG.salesText || "").replace(/\D/g, "");
    }

    function unlock() {
      document.getElementById("gate").classList.add("hidden");
      document.getElementById("app").classList.remove("hidden");
      document.getElementById("waHint").textContent = "+" + personalPhone();
      render();
      setInterval(render, 8000);
    }

    const needPin = !!(CFG.portalPin && String(CFG.portalPin).length);
    if (!needPin || sessionStorage.getItem(PIN_OK) === "1") {
      unlock();
    } else {
      document.getElementById("pinGo").onclick = tryPin;
      document.getElementById("pinIn").addEventListener("keydown", function (e) {
        if (e.key === "Enter") tryPin();
      });
      document.getElementById("pinIn").focus();
    }

    function tryPin() {
      const v = document.getElementById("pinIn").value;
      if (v === String(CFG.portalPin)) {
        sessionStorage.setItem(PIN_OK, "1");
        unlock();
      } else {
        document.getElementById("pinErr").style.display = "block";
      }
    }

    function loadSaved() {
      try {
        return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      } catch (e) {
        return [];
      }
    }

    function esc(s) {
      return String(s || "").replace(/[&<>]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
      });
    }

    function isToday(iso) {
      if (!iso) return false;
      var d = new Date(iso);
      var n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    }

    function render() {
      leads = loadSaved().filter(function (r) {
        return !r.source || r.source === "chat";
      });
      document.getElementById("statTotal").textContent = String(leads.length);
      document.getElementById("statQ").textContent = String(leads.filter(function (l) { return l.qualified; }).length);
      document.getElementById("statToday").textContent = String(leads.filter(function (l) { return isToday(l.at); }).length);

      var tbody = document.getElementById("leadRows");
      var empty = document.getElementById("emptyState");
      if (!leads.length) {
        tbody.innerHTML = "";
        empty.hidden = false;
        document.getElementById("ticketPreview").textContent = "No chatbot leads yet.";
        selected = -1;
        return;
      }
      empty.hidden = true;
      tbody.innerHTML = leads
        .map(function (r, i) {
          return (
            '<tr class="' +
            (i === selected ? "selected" : "") +
            '" data-i="' +
            i +
            '">' +
            "<td>" +
            esc(new Date(r.at).toLocaleString()) +
            "</td>" +
            "<td><b>" +
            esc(r.name || "Prospect") +
            '</b><br/><span style="color:var(--muted)">' +
            esc(r.phone || "—") +
            (r.pageUrl ? '<br/><span style="font-size:10px">' + esc(r.pageUrl.slice(0, 48)) + "…</span>" : "") +
            "</span></td>" +
            "<td>" +
            esc(r.vehicleInterest || "—") +
            (r.financeInterest ? "<br/><span style='color:var(--gold)'>Finance</span>" : "") +
            "</td>" +
            '<td class="' +
            (r.qualified ? "q-yes" : "q-no") +
            '">' +
            (r.qualified ? "YES" : "—") +
            '</td>' +
            '<td class="row-acts">' +
            '<button type="button" class="btn btn-ghost" data-act="view" data-i="' +
            i +
            '">View</button>' +
            '<button type="button" class="btn btn-red" data-act="wa" data-i="' +
            i +
            '">WA</button>' +
            '<button type="button" class="btn btn-ghost" data-act="del" data-i="' +
            i +
            '">Del</button>' +
            "</td></tr>"
          );
        })
        .join("");

      tbody.querySelectorAll("tr").forEach(function (tr) {
        tr.addEventListener("click", function (e) {
          if (e.target.closest("button")) return;
          selectLead(Number(tr.getAttribute("data-i")));
        });
      });
      tbody.querySelectorAll("button[data-act]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var i = Number(btn.getAttribute("data-i"));
          var act = btn.getAttribute("data-act");
          if (act === "view") selectLead(i);
          if (act === "wa") {
            selectLead(i);
            openHandoff();
          }
          if (act === "del") deleteLead(i);
        });
      });

      if (selected < 0 || selected >= leads.length) selectLead(0);
      else selectLead(selected);
    }

    function selectLead(i) {
      selected = i;
      var r = leads[i];
      if (!r) return;
      document.getElementById("ticketPreview").textContent = r.ticket || "(no ticket)";
      document.querySelectorAll("#leadRows tr").forEach(function (tr, idx) {
        tr.classList.toggle("selected", idx === i);
      });
    }

    function deleteLead(i) {
      var target = leads[i];
      if (!target) return;
      var list = loadSaved().filter(function (r) {
        if (r.at === target.at && r.phone === target.phone && r.ticket === target.ticket) return false;
        return true;
      });
      localStorage.setItem(LS_KEY, JSON.stringify(list));
      selected = -1;
      render();
    }

    function openHandoff() {
      var r = leads[selected];
      if (!r || !r.ticket) {
        alert("Select a lead with a ticket first.");
        return;
      }
      var url =
        "https://api.whatsapp.com/send?phone=" +
        personalPhone() +
        "&text=" +
        encodeURIComponent(r.ticket);
      window.open(url, "_blank");
    }

    document.getElementById("btnRefresh").onclick = render;
    document.getElementById("btnClear").onclick = function () {
      if (!confirm("Clear all saved leads in this browser?")) return;
      localStorage.removeItem(LS_KEY);
      selected = -1;
      render();
    };
    document.getElementById("btnExport").onclick = function () {
      var blob = new Blob([JSON.stringify(leads, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "truecars-chatbot-leads.json";
      a.click();
    };
    document.getElementById("btnHandoff").onclick = openHandoff;
    document.getElementById("btnCopy").onclick = async function () {
      var r = leads[selected];
      var text = (r && r.ticket) || "";
      if (!text) {
        alert("Nothing to copy.");
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        alert("Ticket copied.");
      } catch (e) {
        prompt("Copy ticket:", text);
      }
    };