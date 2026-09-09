import os
import re

TDDEPLOY_DIR = r"c:\Users\pgdeb\dev\TruSaaS\TruDealerMaster\trudealer\tddeploy"

PAGES = [
    "packages.html",
    "faq.html",
    "how-much-does-trudealer-cost.html",
    "start-car-dealership-sa.html",
    "what-is-trudealer.html",
    "trudealer-vs-vmg.html",
    "trudealer-vs-autoxloo.html",
    "trudealer-vs-dms.html",
    "uk.html",
    "lead-demo.html",
    "leaddemo.html",
    os.path.join("guides", "index.html"),
    os.path.join("guides", "trulens-field-guide.html"),
    os.path.join("guides", "truflow-premium-field-guide.html"),
    os.path.join("guides", "truinspect-field-guide.html"),
    os.path.join("guides", "truflow-mobile-field-guide.html"),
    os.path.join("guides", "trudealer-moto-field-guide.html"),
]

DARK_MODE_VARS = """[data-theme="dark"]{
  --ink:#090D14;
  --ink-subtle:#0F1724;
  --ink-2:#152232;
  --white:#F1F5F9;
  --white-dim:rgba(241,245,249,.75);
  --muted:rgba(148,163,184,.85);
  --faint:rgba(148,163,184,.5);
  --surface-card:#0F1724;
  --surface-dark:#05080E;
  --surface-dark-card:#0D1520;
  --cyan:#00f2fe;
  --cyan-hover:#4facfe;
  --cyan-soft:rgba(0,242,254,0.12);
  --cyan-glow:rgba(0,242,254,0.25);
  --amber:#F59E0B;
  --amber-soft:rgba(245,158,11,0.15);
  --amber-glow:rgba(245,158,11,0.25);
  --border:rgba(255,255,255,.08);
  --border-glow:rgba(0,242,254,.25);
  --glass:rgba(15,23,36,.85);
  --glass-line:rgba(255,255,255,.08);
  --glass-bg:rgba(15,23,36,0.85);
  --glass-border:rgba(255,255,255,0.08);
  --glass-shadow:0 12px 36px -4px rgba(0,0,0,0.4), 0 4px 12px -2px rgba(0,0,0,0.3);
  --glass-shadow-hover:0 20px 48px -6px rgba(0,0,0,0.6), 0 8px 20px -4px rgba(0,242,254,0.15);
}"""

MOBILE_BOTTOM_BAR_HTML = """<!-- STICKY MOBILE BOTTOM BAR -->
<div class="mobile-bottom-bar" id="mobileBottomBar">
  <button type="button" class="bar-btn chat" id="chatBtn" aria-label="AI Chat">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    <span>AI Chat</span>
  </button>
  <button type="button" class="bar-btn enquire" id="enquireBtn" aria-label="Enquire now">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    <span>Enquire</span>
  </button>
  <a href="https://wa.me/27620502091" class="bar-btn whatsapp" aria-label="WhatsApp">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24-1.42 0-2.82-.37-4.05-1.08l-.29-.17-3.01.79.8-2.93-.19-.3a8.21 8.21 0 0 1-1.26-4.37c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.59c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.07-.39-2.03-1.25-.75-.67-1.26-1.5-1.41-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.76-1.85-.2-.48-.4-.42-.56-.42h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.77 2.7 4.28 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29z"/></svg>
    <span>WhatsApp</span>
  </a>
</div>

<!-- CHAT POPOUT PANEL -->
<div class="popout-panel" id="chatPanel">
  <div class="popout-header">
    <h3>TruChat AI Assistant</h3>
    <button type="button" class="popout-close" id="chatClose" aria-label="Close chat">✕</button>
  </div>
  <div class="popout-body">
    <p>Hi! I'm TruChat, your AI assistant. Ask me about:</p>
    <ul style="margin: 12px 0; padding-left: 20px;">
      <li>Pricing & packages</li>
      <li>Features & modules</li>
      <li>Setup & deployment</li>
      <li>Integrations</li>
    </ul>
    <p style="margin-top: 16px;"><a href="https://wa.me/27620502091" style="color: #0D9488; font-weight: 600;">Chat on WhatsApp →</a></p>
  </div>
</div>

<!-- ENQUIRE POPOUT PANEL -->
<div class="popout-panel" id="enquirePanel">
  <div class="popout-header">
    <h3>Enquire Now</h3>
    <button type="button" class="popout-close" id="enquireClose" aria-label="Close enquiry">✕</button>
  </div>
  <div class="popout-body">
    <p>Ready to get started? Choose your preferred contact method:</p>
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
      <a href="https://cal.com/pgdebeer" target="_blank" rel="noopener" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(13,148,136,0.1); border-radius: 10px; color: #0D9488; text-decoration: none; font-weight: 600;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Book a walkthrough
      </a>
      <a href="https://wa.me/27620502091" style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(37,211,102,0.1); border-radius: 10px; color: #25D366; text-decoration: none; font-weight: 600;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2z"/></svg>
        WhatsApp us
      </a>
    </div>
  </div>
</div>"""

def process_file(rel_path):
    full_path = os.path.join(TDDEPLOY_DIR, rel_path)
    if not os.path.exists(full_path):
        print(f"Skipping {rel_path} (not found)")
        return

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    orig = content

    # 1. Ensure <html lang="en" data-theme="dark">
    content = re.sub(r'<html([^>]*)>', lambda m: '<html lang="en" data-theme="dark">' if 'data-theme' not in m.group(0) else m.group(0), content)

    # 2. Ensure theme init script in <head>
    theme_script = "<script>(function(){var t=localStorage.getItem('td-theme')||'dark';document.documentElement.setAttribute('data-theme',t);})();</script>"
    if "localStorage.getItem('td-theme')" not in content:
        content = re.sub(r'(<head[^>]*>)', r'\1\n' + theme_script, content, count=1)

    # 3. Standardize hero padding in inline style: 140px/150px/130px -> 84px
    content = re.sub(r'(\.hero\s*\{\s*[^}]*padding:\s*)(1[3-5]0px)([^;]*;)', r'\g<1>84px\g<3>', content)

    # 4. Insert [data-theme="dark"] into <style> if missing
    if '[data-theme="dark"]' not in content:
        # Find closing brace of :root
        content = re.sub(r'(:root\s*\{[^}]*\})', r'\1\n' + DARK_MODE_VARS, content, count=1)

    # 5. Add theme toggle to nav-right if missing
    if 'themeToggle' not in content and 'id="navBurger"' in content:
        toggle_btn = '<button type="button" class="theme-toggle" id="themeToggle" aria-label="Toggle Dark Mode"></button>'
        content = content.replace('<button class="nav-burger"', f'{toggle_btn}\n    <button class="nav-burger"')

    # 6. Ensure site.css is linked
    if 'site.css' not in content and '</head>' in content:
        content = content.replace('</head>', '  <link rel="stylesheet" href="site.css">\n</head>')

    # 7. Replace old waFab with modern mobile bottom bar & popouts if present
    if '<div class="wa-fab"' in content and '<div class="mobile-bottom-bar"' not in content:
        # Replace wa-fab block
        content = re.sub(r'<div class="wa-fab".*?</div>\s*</div>', MOBILE_BOTTOM_BAR_HTML, content, flags=re.DOTALL)
    elif '<div class="mobile-bottom-bar"' not in content and '</body>' in content:
        content = content.replace('</body>', f'{MOBILE_BOTTOM_BAR_HTML}\n</body>')

    if content != orig:
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {rel_path}")
    else:
        print(f"No changes needed for {rel_path}")

def main():
    for p in PAGES:
        process_file(p)

if __name__ == "__main__":
    main()
