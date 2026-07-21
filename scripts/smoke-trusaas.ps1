# TruSaaS smoke test — Lens + Flow Lite + Premium
# Usage: pwsh -File scripts/smoke-trusaas.ps1
# Exit 0 = all healthy; non-zero = failures

$ErrorActionPreference = "Continue"
$targets = @(
  @{ Name = "Lens";     Url = "https://trusaas-lens.onrender.com/api/health" },
  @{ Name = "Lite";     Url = "https://trusaas-flow.onrender.com/api/health" },
  @{ Name = "Premium";  Url = "https://trusaas-premium.onrender.com/api/health" },
  @{ Name = "Stock";    Url = "https://trusaas-premium.onrender.com/api/public/stock?dealer=mkr-autosales" }
)

$failed = 0
Write-Host "TruSaaS smoke — $(Get-Date -Format o)" -ForegroundColor Cyan

foreach ($t in $targets) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $t.Url -UseBasicParsing -TimeoutSec 120
    $sw.Stop()
    $ms = $sw.ElapsedMilliseconds
    $body = $r.Content
    $ok = $r.StatusCode -eq 200 -and ($body -match '"ok"\s*:\s*true' -or $body -match '"success"\s*:\s*true')
    if ($ok) {
      Write-Host ("  OK  {0,-8} {1,6}ms  {2}" -f $t.Name, $ms, ($body.Substring(0, [Math]::Min(100, $body.Length)))) -ForegroundColor Green
      if ($ms -gt 15000) {
        Write-Host "       (slow — cold start or under-provisioned)" -ForegroundColor Yellow
      }
    } else {
      Write-Host ("  BAD {0,-8} {1,6}ms  HTTP {2}" -f $t.Name, $ms, $r.StatusCode) -ForegroundColor Red
      $failed++
    }
  } catch {
    $sw.Stop()
    Write-Host ("  FAIL {0,-8} {1,6}ms  {2}" -f $t.Name, $sw.ElapsedMilliseconds, $_.Exception.Message) -ForegroundColor Red
    $failed++
  }
}

if ($failed -gt 0) {
  Write-Host "`n$failed check(s) failed" -ForegroundColor Red
  exit 1
}
Write-Host "`nAll checks passed" -ForegroundColor Green
exit 0
