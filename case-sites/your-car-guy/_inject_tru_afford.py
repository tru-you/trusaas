"""Inject TruAfford widget into all showroom HTML pages."""
from pathlib import Path
import re

ROOT = Path(r"C:\Users\pgdeb\OneDrive\Documents\Desktop\Paulie_Hub\projects")

# (path, dealer, wa, script_src relative to page)
CONFIGS = [
    (ROOT / "TruSaaS/Current Projects/Cars at caledon/cars-on-caledon.html", "Cars on Caledon", "27618759389", "tru-afford.js"),
    (ROOT / "TruSaaS/Current Projects/MKR/index.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TruSaaS/Current Projects/MKR/premium-select.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TruSaaS/Current Projects/MKR/premium-performance.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TruSaaS/Current Projects/Your car guy/YCG CB.html", "Your Car Guy", "27834659921", "tru-afford.js"),
    (ROOT / "TruSaaS/Current Projects/Your car guy/truchat-your-car-guy.html", "Your Car Guy", "27834659921", "tru-afford.js"),
    (ROOT / "TrueCar-SA/demos/cars-on-caledon/index.html", "Cars on Caledon", "27618759389", "tru-afford.js"),
    (ROOT / "TrueCar-SA/demos/cars-on-caledon/cars-on-caledon.html", "Cars on Caledon", "27618759389", "tru-afford.js"),
    (ROOT / "TrueCar-SA/demos/mkr/index.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TrueCar-SA/demos/mkr/premium-select.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TrueCar-SA/demos/mkr/premium-performance.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TrueCar-SA/demos/hv-motors/index.html", "HV Motors", "27614878054", "tru-afford.js"),
    (ROOT / "TruSaaS/truweb/mkr-autosales/index.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TruSaaS/truweb/mkr-autosales/premium-select.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
    (ROOT / "TruSaaS/truweb/mkr-autosales/premium-performance.html", "MKR Auto Sales", "27662912809", "tru-afford.js"),
]

SNIP = """
<!-- TruAfford · soft affordability (TrueSaas) — all showrooms -->
<script
  src="{src}"
  data-dealer="{dealer}"
  data-wa="{wa}"
  data-brand="trusaas"
  data-position="left"
  data-bottom="20px"
  data-z="999990"
  defer></script>
"""


def strip_existing(html: str) -> str:
    html = re.sub(
        r"\s*<!--\s*TruAfford[\s\S]*?</script>\s*",
        "\n",
        html,
        flags=re.I,
    )
    html = re.sub(
        r"\s*<script[^>]*tru-afford\.js[^>]*>\s*</script>\s*",
        "\n",
        html,
        flags=re.I,
    )
    return html


def inject(path: Path, dealer: str, wa: str, src: str) -> None:
    text = path.read_text(encoding="utf-8")
    text = strip_existing(text)
    snip = SNIP.format(src=src, dealer=dealer, wa=wa)
    if re.search(r"</body\s*>", text, re.I):
        text = re.sub(r"</body\s*>", snip + "</body>", text, count=1, flags=re.I)
    else:
        text = text.rstrip() + snip + "\n"
    path.write_text(text, encoding="utf-8")


def main():
    done = 0
    for path, dealer, wa, src in CONFIGS:
        if not path.exists():
            print("MISSING", path)
            continue
        inject(path, dealer, wa, src)
        print("OK", path.relative_to(ROOT), "→", dealer)
        done += 1
    print("injected", done)


if __name__ == "__main__":
    main()
