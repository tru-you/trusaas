from pathlib import Path

base = Path(__file__).resolve().parent
index = (base / "index.html").read_text(encoding="utf-8")
css_start = index.index("<style>")
css_end = index.index("</style>") + len("</style>")
core_css = index[css_start:css_end]

extra = r"""
<style>
.page-hero{position:relative;color:#fff;overflow:hidden;padding:48px 0 40px;min-height:auto;}
.page-hero .hero-bg{position:absolute;inset:0;}
.page-hero.theme-select .hero-bg{
  background:
    linear-gradient(115deg,rgba(10,22,38,.94) 0%,rgba(10,22,38,.6) 50%,rgba(10,22,38,.88) 100%),
    radial-gradient(ellipse 70% 80% at 90% 10%,rgba(200,162,75,.22),transparent 55%),
    url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=2000&q=80') center 40%/cover no-repeat;
}
.page-hero.theme-perf .hero-bg{
  background:
    linear-gradient(115deg,rgba(10,22,38,.94) 0%,rgba(10,22,38,.55) 50%,rgba(10,22,38,.9) 100%),
    radial-gradient(ellipse 70% 80% at 90% 10%,rgba(220,38,38,.22),transparent 55%),
    url('https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=2000&q=80') center 45%/cover no-repeat;
}
.page-hero .wrap{position:relative;z-index:1;}
.page-hero .crumb{font-size:12px;font-weight:600;color:rgba(255,255,255,.55);margin-bottom:14px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.page-hero .crumb a{color:rgba(255,255,255,.75);}
.page-hero .crumb a:hover{color:#fff;}
.page-hero .crumb span{opacity:.4;}
.page-hero h1{font-family:var(--serif);font-weight:600;font-size:clamp(32px,6vw,52px);letter-spacing:-.03em;line-height:1.08;max-width:16ch;margin-bottom:12px;}
.page-hero.theme-select h1 em{font-style:italic;color:var(--gold-light);}
.page-hero.theme-perf h1 em{font-style:italic;color:#ff6b6b;}
.page-hero .lede{color:rgba(255,255,255,.7);font-size:clamp(14px,2.2vw,16px);max-width:46ch;line-height:1.65;margin-bottom:18px;}
.page-hero .hero-pills{margin-bottom:0;}
.page-hero.theme-select .hero-pills span{border-color:rgba(200,162,75,.3);}
.page-hero.theme-perf .hero-pills span{border-color:rgba(255,107,107,.28);}
.cat-bar{padding:20px 0 0;}
.cat-bar-inner{
  display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;
  background:var(--glass-strong);backdrop-filter:blur(16px);border:1px solid var(--glass-border);
  border-radius:var(--radius-lg);padding:14px 16px;
  box-shadow:0 8px 28px -16px rgba(10,22,38,.12);
}
.cat-bar .results{font-size:14px;font-weight:700;}
.cat-bar .results b{color:var(--blue);}
body.page-perf .cat-bar .results b{color:#dc2626;}
.theme-select ~ * .cat-bar .results b, .page-hero.theme-select ~ .wrap .results b{color:var(--gold);}
.cat-bar .tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
.cat-bar select{
  padding:10px 12px;border-radius:12px;border:1.5px solid var(--line);
  background:#fff;font:600 13px var(--ff);color:var(--ink);min-height:42px;
}
.cat-links{display:flex;gap:8px;flex-wrap:wrap;padding:16px 0 8px;}
.cat-links a{
  font-size:12px;font-weight:800;padding:9px 14px;border-radius:100px;
  border:1px solid var(--glass-border);background:var(--glass);
  transition:transform .25s var(--spring),background .2s,color .2s,border-color .2s;
}
.cat-links a:hover{transform:translateY(-2px);color:var(--blue);border-color:rgba(11,91,215,.3);}
.cat-links a.on-select{background:linear-gradient(145deg,var(--gold-light),var(--gold));color:var(--ink);border-color:transparent;}
.cat-links a.on-perf{background:linear-gradient(145deg,#ef4444,#b91c1c);color:#fff;border-color:transparent;}
.inventory.cat-page{padding:12px 0 72px;}
.empty-msg{grid-column:1/-1;text-align:center;padding:48px 16px;font-size:14px;font-weight:600;color:var(--grey);}
.sister-card{
  display:flex;flex-direction:column;gap:10px;padding:22px 20px;border-radius:var(--radius-lg);
  background:var(--ink);color:#fff;margin-top:28px;
  border:1px solid rgba(255,255,255,.08);
}
.sister-card h3{font-family:var(--serif);font-size:22px;font-weight:600;}
.sister-card p{font-size:13px;color:rgba(255,255,255,.55);max-width:40ch;}
.sister-card .btn-row{margin-top:4px;}
.nav-links a.cat-nav{font-size:12.5px;}
</style>
"""


def fab_chat(category_label, cat_key):
    return f"""
<div class="fab-rail" id="fabRail" aria-label="Quick actions">
  <button type="button" class="fab-btn fab-bot" id="fabBot" aria-label="Chat with MKR">
    <span class="ring" aria-hidden="true"></span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>
    <span class="fab-label">Chat · leads</span>
  </button>
  <a class="fab-btn fab-td" href="https://wa.me/27662912809?text=Hi%20MKR%2C%20I%27d%20like%20to%20book%20a%20test%20drive" target="_blank" rel="noopener" aria-label="Book a test drive">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l1.6-4.6A2.5 2.5 0 0 1 7 6.7h10a2.5 2.5 0 0 1 2.4 1.7L21 13v5a1 1 0 0 1-1 1h-1.2a1 1 0 0 1-1-1v-1H6.2v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3.5 13h17"/><circle cx="7.2" cy="16" r="1.1"/><circle cx="16.8" cy="16" r="1.1"/></svg>
    <span class="fab-label">Book a test drive</span>
  </a>
  <a class="fab-btn fab-lvs" href="https://wa.me/27662912809?text=Hi%20MKR%2C%20I%27d%20like%20a%20live%20video%20viewing" target="_blank" rel="noopener" aria-label="Live video viewing">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8.5V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1.5l5 3.5V5z"/></svg>
    <span class="fab-label">Live video viewing</span>
  </a>
  <a class="fab-btn fab-wa" href="https://wa.me/27662912809?text=Hi%20MKR%2C%20I%27m%20interested%20in%20{category_label.replace(' ', '%20')}" target="_blank" rel="noopener" aria-label="WhatsApp">
    <svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3.2C8.9 3.2 3.2 8.9 3.2 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.9 1 4 1.6 6.2 1.6h.01c7.1 0 12.8-5.7 12.8-12.8S23.1 3.2 16 3.2zm0 23.3c-2 0-3.9-.5-5.6-1.5l-.4-.2-4 1.1 1.1-3.9-.3-.4c-1.1-1.7-1.6-3.7-1.6-5.6C5.2 10 10 5.3 16 5.3c2.9 0 5.6 1.1 7.6 3.2 2 2 3.2 4.7 3.2 7.6 0 6-4.8 10.8-10.8 10.8zm5.9-8c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2s-.8 1-1 1.2c-.2.2-.4.2-.7.1-1.9-1-3.2-1.7-4.5-3.9-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>
    <span class="fab-label">WhatsApp us</span>
  </a>
</div>

<div class="mkr-chat" id="mkrChat" role="dialog" aria-label="MKR chat and leads" aria-hidden="true">
  <div class="chat-head">
    <div class="av">MKR</div>
    <div><b>MKR assistant</b><span>{category_label} · Lead portal</span></div>
    <button type="button" id="chatClose" aria-label="Close">×</button>
  </div>
  <div class="chat-tabs" role="tablist">
    <button type="button" class="on" data-tab="chat" role="tab" aria-selected="true">Chat</button>
    <button type="button" data-tab="lead" role="tab" aria-selected="false">Lead portal</button>
  </div>
  <div class="chat-body">
    <div class="chat-panel on" id="panelChat" role="tabpanel">
      <div class="msg bot">You're in <b>{category_label}</b>. Browse the grid, book a viewing, or leave a lead — same floating desk as the main site.</div>
      <div class="quick" id="chatQuick">
        <button type="button" data-q="{cat_key}">{category_label}</button>
        <button type="button" data-q="viewing">Book viewing</button>
        <button type="button" data-q="finance">VAF finance</button>
        <button type="button" data-q="lead">Leave my details</button>
      </div>
    </div>
    <div class="chat-panel" id="panelLead" role="tabpanel">
      <form class="lead-form" id="leadForm">
        <p class="lf-intro">Lead portal for {category_label}. We'll follow up on WhatsApp or phone.</p>
        <div><label for="leadName">Full name</label><input id="leadName" name="name" required autocomplete="name" placeholder="Your name"></div>
        <div class="lf-row">
          <div><label for="leadPhone">Mobile</label><input id="leadPhone" name="phone" type="tel" required autocomplete="tel" placeholder="06…"></div>
          <div><label for="leadEmail">Email</label><input id="leadEmail" name="email" type="email" autocomplete="email" placeholder="optional"></div>
        </div>
        <div>
          <label for="leadPortal">Interest</label>
          <select id="leadPortal" name="portal" required>
            <option value="{cat_key}" selected>{category_label}</option>
            <option value="buy">Buy a car</option>
            <option value="sell">Sell / trade-in</option>
            <option value="finance">VAF Bridge finance</option>
            <option value="general">General enquiry</option>
          </select>
        </div>
        <div><label for="leadMsg">Message</label><textarea id="leadMsg" name="message" placeholder="Vehicle, budget, timeline…"></textarea></div>
        <button type="submit" class="btn btn-blue lf-submit">Submit lead</button>
        <p class="lf-note">Opens WhatsApp to MKR with your details pre-filled.</p>
      </form>
      <div class="lead-success" id="leadSuccess" hidden><b>Lead ready ✓</b><p>WhatsApp is opening with your details.</p></div>
    </div>
  </div>
  <div class="chat-foot">
    <a class="btn btn-wa" id="chatWa" href="https://wa.me/27662912809?text=Hi%20MKR" target="_blank" rel="noopener">Continue on WhatsApp</a>
  </div>
</div>
"""


def build(p):
    cat = p["cat"]
    theme = p["theme"]
    title = p["title"]
    h1 = p["h1"]
    lede = p["lede"]
    pills = p["pills"]
    sister = p["sister"]
    body_class = p.get("body_class", "")
    active_select = "on-select" if cat == "select" else ""
    active_perf = "on-perf" if cat == "performance" else ""
    nav_select = "active" if cat == "select" else ""
    nav_perf = "active" if cat == "performance" else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{title} — MKR Auto Sales | Gqeberha</title>
<meta name="description" content="{lede}">
<meta name="theme-color" content="#0A1626">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=Archivo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
{core_css}
{extra}
</head>
<body class="{body_class}">
<div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>
<div class="topbar">
  <div class="wrap">
    <span>📍 <b>495 Cape Road, Westering · Gqeberha</b></span>
    <span class="hide-sm">Mon–Fri 08:00–17:30 · Sat 08:00–14:00</span>
    <a href="tel:+27662912809">📞 <b>+27 66 291 2809</b></a>
  </div>
</div>
<header class="site-header" id="siteHeader">
  <div class="wrap nav">
    <a class="logo" href="index.html"><img src="mkr-logo.png" alt="MKR Auto Sales" width="160" height="56"></a>
    <nav class="nav-links" aria-label="Primary">
      <a href="index.html">Home</a>
      <a class="cat-nav {nav_select}" href="premium-select.html">Premium Select</a>
      <a class="cat-nav {nav_perf}" href="premium-performance.html">Premium Performance</a>
      <a href="index.html#stock">All stock</a>
      <a href="index.html#finance">Finance</a>
      <a href="index.html#visit">Visit</a>
    </nav>
    <div class="nav-ctas">
      <a class="btn btn-ghost" href="index.html#finance">Apply for Finance</a>
      <a class="btn btn-wa" href="https://wa.me/27662912809" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.2c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.8 1.4 1.8 2.2 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2.1 1c.3.2.5.3.6.4.1.2.1.7-.1 1.3Z"/></svg>
        WhatsApp
      </a>
      <button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>
  </div>
  <div class="m-menu" id="mmenu">
    <a href="index.html">Home</a>
    <a href="premium-select.html">Premium Select</a>
    <a href="premium-performance.html">Premium Performance</a>
    <a href="index.html#stock">All stock</a>
    <a href="index.html#sell">Sell / Trade-In</a>
    <a href="index.html#finance">VAF Bridge Finance</a>
    <a href="index.html#visit">Visit Us</a>
  </div>
</header>

<section class="page-hero theme-{theme}">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="wrap">
    <div class="crumb"><a href="index.html">Home</a> <span>/</span> <a href="index.html#stock">Showroom</a> <span>/</span> <b style="color:#fff">{title}</b></div>
    <div class="hero-eyebrow"><i></i> MKR collections · Gqeberha</div>
    <h1 class="rv">{h1}</h1>
    <p class="lede rv d1">{lede}</p>
    <div class="hero-pills rv d2">{pills}</div>
  </div>
</section>

<div class="wrap">
  <div class="cat-links">
    <a href="premium-select.html" class="{active_select}">Premium Select</a>
    <a href="premium-performance.html" class="{active_perf}">Premium Performance</a>
    <a href="index.html#stock">All vehicles</a>
  </div>
  <div class="cat-bar">
    <div class="cat-bar-inner">
      <div class="results"><span id="countLabel">Loading…</span></div>
      <div class="tools">
        <select id="sort" aria-label="Sort">
          <option value="">Featured</option>
          <option value="lo">Price: low → high</option>
          <option value="hi">Price: high → low</option>
        </select>
        <select id="body" aria-label="Body type">
          <option value="">All body types</option>
          <option value="hatch">Hatchback</option>
          <option value="suv">SUV</option>
          <option value="bakkie">Bakkie</option>
          <option value="sedan">Sedan</option>
          <option value="coupe">Coupe</option>
        </select>
      </div>
    </div>
  </div>
</div>

<section class="inventory cat-page">
  <div class="wrap">
    <div class="grid" id="invgrid"></div>
    <div class="sister-card rv">
      <h3>{sister['title']}</h3>
      <p>{sister['text']}</p>
      <div class="btn-row">
        <a class="btn btn-blue" href="{sister['href']}">{sister['cta']}</a>
        <a class="btn btn-ghost" href="index.html#stock">Full showroom</a>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="f-grid">
      <div class="f-about">
        <img src="mkr-logo.png" alt="MKR Auto Sales">
        <p>Premium pre-owned in Gqeberha. Premium Select · Premium Performance · VAF Bridge · Free nationwide delivery.</p>
      </div>
      <div>
        <h4>Collections</h4>
        <a href="premium-select.html">Premium Select</a>
        <a href="premium-performance.html">Premium Performance</a>
        <a href="index.html#stock">All stock</a>
      </div>
      <div>
        <h4>Portals</h4>
        <a href="index.html#stock">Buy</a>
        <a href="index.html#sell">Sell / trade-in</a>
        <a href="index.html#finance">VAF finance</a>
      </div>
      <div>
        <h4>Contact</h4>
        <a href="tel:+27662912809">+27 66 291 2809</a>
        <a href="https://wa.me/27662912809" target="_blank" rel="noopener">WhatsApp</a>
        <a href="index.html#visit">495 Cape Road, Westering</a>
      </div>
    </div>
    <div class="f-bottom">
      <span>© 2026 MKR Auto Sales · VAT incl. · E&amp;OE</span>
      <span class="ax">Powered by <a href="https://true-cars.co.za/truesaas.html" style="color:inherit"><b>TrueSaas</b></a></span>
    </div>
  </div>
</footer>

{fab_chat(title, cat)}

<script src="mkr-shared.js"></script>
<script>
(async function(){{
  const CAT = "{cat}";
  const TITLE = "{title}";
  MKR.initChrome();
  MKR.initChat({{ category: CAT }});
  const grid = document.getElementById("invgrid");
  const countLabel = document.getElementById("countLabel");
  let stock = await MKR.loadStock(CAT);
  function apply(){{
    let list = stock.slice();
    const body = document.getElementById("body").value;
    const sort = document.getElementById("sort").value;
    if(body) list = list.filter(c => c.body === body);
    if(sort === "lo") list.sort((a,b)=>a.price-b.price);
    if(sort === "hi") list.sort((a,b)=>b.price-a.price);
    const n = list.length;
    countLabel.innerHTML = n ? ("<b>" + n + "</b> vehicle" + (n===1?"":"s") + " in " + TITLE) : ("No matches in " + TITLE);
    MKR.renderCards(list, grid);
  }}
  document.getElementById("sort").addEventListener("change", apply);
  document.getElementById("body").addEventListener("change", apply);
  apply();
  MKR.observeAll();
}})();
</script>
</body>
</html>
"""


pages = [
    dict(
        cat="select",
        theme="select",
        body_class="",
        title="Premium Select",
        h1="Hand-curated.<br><em>Everyday excellence.</em>",
        lede="Premium Select is MKR’s lane for polished, low-km daily drivers and family cars — VIR-minded, finance-ready, free delivery SA-wide.",
        pills="<span>✦ Low-km curated</span><span>✦ VIR graded</span><span>✦ Free SA delivery</span>",
        sister=dict(
            title="Looking for thrills?",
            text="GTI, AMG, RS, M-cars and enthusiast metal live in Premium Performance.",
            href="premium-performance.html",
            cta="Open Premium Performance →",
        ),
    ),
    dict(
        cat="performance",
        theme="perf",
        body_class="page-perf",
        title="Premium Performance",
        h1="Engineered for<br><em>adrenaline.</em>",
        lede="Premium Performance is the enthusiast lane — GTI, AMG, RS, M-cars and high-spec bakkies. Same MKR standards, more heart rate.",
        pills="<span>🏁 Enthusiast grade</span><span>🔍 VIR graded</span><span>🚚 Free SA delivery</span>",
        sister=dict(
            title="Prefer polished daily drivers?",
            text="Low-km SUVs, hatches and family cars live in Premium Select.",
            href="premium-select.html",
            cta="Open Premium Select →",
        ),
    ),
]

for p in pages:
    name = "premium-select.html" if p["cat"] == "select" else "premium-performance.html"
    html = build(p)
    (base / name).write_text(html, encoding="utf-8")
    print("wrote", name, len(html))
print("ok")
