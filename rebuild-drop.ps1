# rebuild-drop.ps1
# Rebuilds the Netlify-drop folder for the tru-saas.com MARKETING site.
# Run this after editing index.html, then drag  _deploy\marketing-drop  onto https://app.netlify.com/drop
#
# Usage (from the TruSaaS folder):
#   .\rebuild-drop.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$out  = Join-Path $root '_deploy\marketing-drop'

Write-Host "Rebuilding marketing drop..." -ForegroundColor Cyan

# Clean
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $out 'case-sites') | Out-Null

# Core page + shared assets (the missing logo lived here)
Copy-Item (Join-Path $root 'index.html') $out -Force
Copy-Item (Join-Path $root 'assets') (Join-Path $out 'assets') -Recurse -Force

# Case-study sites referenced by the previews / card logos
$cases = 'cars-at-caledon','MKR','your-car-guy'
foreach ($c in $cases) {
    Copy-Item (Join-Path $root "case-sites\$c") (Join-Path $out "case-sites\$c") -Recurse -Force
}

# Local Ray (TruChat) demo — the TruChat module card previews this instead of the
# live yourcarguy site (which was unreachable). chat.html references ../shared/.
New-Item -ItemType Directory -Force -Path (Join-Path $out 'truchat') | Out-Null
Copy-Item (Join-Path $root 'truchat\shared') (Join-Path $out 'truchat\shared') -Recurse -Force
Copy-Item (Join-Path $root 'truchat\Truechat - YCG') (Join-Path $out 'truchat\ray') -Recurse -Force

# Verify the asset that was 404-ing is present
$logo = Join-Path $out 'assets\brand\trusaas-wordmark.png'
if (Test-Path $logo) {
    Write-Host "OK  - logo present: assets\brand\trusaas-wordmark.png" -ForegroundColor Green
} else {
    Write-Host "WARN - logo NOT found in drop! Check assets\brand\." -ForegroundColor Yellow
}

$size = "{0:N1} MB" -f ((Get-ChildItem $out -Recurse | Measure-Object Length -Sum).Sum / 1MB)
Write-Host "Done. Folder: $out  ($size)" -ForegroundColor Cyan
Write-Host "Now drag that folder onto https://app.netlify.com/drop" -ForegroundColor Cyan
