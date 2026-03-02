<#
.SYNOPSIS
  Captures polished app screenshots for documentation and marketing.

.DESCRIPTION
  Runs Playwright screenshot capture tests that save PNG files to
  docs/screenshots/{desktop,mobile,dark-mode}/.

  Requires:
  - Dev server running at http://localhost:3000
  - SUPABASE_SERVICE_ROLE_KEY set (for auth)

  Issues: #404 (Epic), #430 (Desktop), #431 (Mobile + Dark Mode)

.EXAMPLE
  .\RUN_SCREENSHOTS.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "`n════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Screenshot Capture (#404, #430, #431)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════`n" -ForegroundColor Cyan

# ── Pre-flight checks ───────────────────────────────────────────────────────

if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "ERROR: SUPABASE_SERVICE_ROLE_KEY not set." -ForegroundColor Red
    Write-Host "  Set it via: `$env:SUPABASE_SERVICE_ROLE_KEY = 'your-key'" -ForegroundColor Yellow
    exit 1
}

# Check dev server
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Dev server running at http://localhost:3000" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Dev server not running at http://localhost:3000" -ForegroundColor Red
    Write-Host "  Start it via: cd frontend && npm run dev" -ForegroundColor Yellow
    exit 1
}

# ── Run screenshot capture ──────────────────────────────────────────────────

Write-Host "`n📸 Capturing screenshots...`n" -ForegroundColor Cyan

Push-Location "$PSScriptRoot\frontend"

$env:CAPTURE_SCREENSHOTS = "true"

try {
    npx playwright test --project=screenshots --reporter=list
    $exitCode = $LASTEXITCODE
}
finally {
    Remove-Item Env:\CAPTURE_SCREENSHOTS -ErrorAction SilentlyContinue
    Pop-Location
}

# ── Report results ──────────────────────────────────────────────────────────

Write-Host "`n════════════════════════════════════════" -ForegroundColor Cyan

if ($exitCode -eq 0) {
    Write-Host "✅ All screenshots captured successfully!" -ForegroundColor Green

    # Count output files
    $desktopCount = (Get-ChildItem "docs\screenshots\desktop\*.png" -ErrorAction SilentlyContinue).Count
    $mobileCount = (Get-ChildItem "docs\screenshots\mobile\*.png" -ErrorAction SilentlyContinue).Count
    $darkCount = (Get-ChildItem "docs\screenshots\dark-mode\*.png" -ErrorAction SilentlyContinue).Count
    $total = $desktopCount + $mobileCount + $darkCount

    Write-Host "`n  Desktop:   $desktopCount / 12" -ForegroundColor White
    Write-Host "  Mobile:    $mobileCount / 4" -ForegroundColor White
    Write-Host "  Dark Mode: $darkCount / 3" -ForegroundColor White
    Write-Host "  Total:     $total / 19`n" -ForegroundColor Cyan
}
else {
    Write-Host "⚠️  Some screenshots failed (exit code: $exitCode)" -ForegroundColor Yellow
    Write-Host "  Check Playwright HTML report: npx playwright show-report" -ForegroundColor Yellow
}

Write-Host "════════════════════════════════════════`n" -ForegroundColor Cyan

exit $exitCode
