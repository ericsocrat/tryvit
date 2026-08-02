<#
.SYNOPSIS
  Captures screenshots through the owned visual-safety harness.

.DESCRIPTION
  Public and local-authenticated capture are deliberately separate. The
  harness performs loopback preflight, a clean provenance-matched build,
  browser egress enforcement, and owned server cleanup. It never reuses an
  externally running server.

.PARAMETER Mode
  Public captures public visual-audit routes without Supabase credentials.
  LocalAuthenticated requires the checked-in local Supabase emulator and local
  fixture credentials; it never falls back to a hosted project.

.EXAMPLE
  .\RUN_SCREENSHOTS.ps1 -Mode Public

.EXAMPLE
  .\RUN_SCREENSHOTS.ps1 -Mode LocalAuthenticated
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Public", "LocalAuthenticated")]
    [string]$Mode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$frontendRoot = Join-Path $PSScriptRoot "frontend"
if (-not (Test-Path -LiteralPath $frontendRoot -PathType Container)) {
    throw "[VS_RUNNER_ROOT] frontend-directory-missing"
}

$safetyMode = if ($Mode -eq "Public") { "public" } else { "local-authenticated" }
$scriptName = if ($Mode -eq "Public") { "visual-safety:public" } else { "visual-safety:local-authenticated" }

Write-Host "`nTryVit screenshot capture — $safetyMode" -ForegroundColor Cyan
Write-Host "The harness owns the clean build and server lifecycle." -ForegroundColor Gray

$previousMode = $env:VISUAL_SAFETY_MODE
$previousBaseUrl = $env:BASE_URL
$previousCapture = $env:CAPTURE_SCREENSHOTS
$removedSensitiveEnvironment = @{}
$blockedEnvironmentPattern = "(?i)(SUPABASE|POSTGRES|DATABASE|PASSWORD|TOKEN|SECRET|COOKIE|AUTHORIZATION|API_KEY|STAGING_(URL|SERVICE_KEY)|PRODUCTION_(URL|SERVICE_KEY)|^(ALL_PROXY|BROWSER|CHROME_PATH|DEBUG|DOCKER_(CERT_PATH|CONTEXT|HOST|TLS_VERIFY)|HTTP_PROXY|HTTPS_PROXY|LHCI_.*|LHCITEST_.*|LIGHTHOUSE_.*|NODE_DEBUG(_NATIVE)?|NODE_EXTRA_CA_CERTS|NODE_OPTIONS|NODE_PATH|NODE_REPL_EXTERNAL_MODULE|NODE_TLS_REJECT_UNAUTHORIZED|NODE_USE_ENV_PROXY|NO_PROXY|PLAYWRIGHT_.*|PUPPETEER_.*|PW(?!D$).*|SSLKEYLOGFILE|VISUAL_SAFETY_CONFIG_(RUNNER_PID|SEAL))$)"

foreach ($entry in Get-ChildItem Env:) {
    if ($entry.Name -notmatch $blockedEnvironmentPattern) {
        continue
    }
    $removedSensitiveEnvironment[$entry.Name] = $entry.Value
    Remove-Item -LiteralPath ("Env:" + $entry.Name)
}

Push-Location $frontendRoot
try {
    $env:VISUAL_SAFETY_MODE = $safetyMode
    $env:BASE_URL = "http://127.0.0.1:3000"
    $env:CAPTURE_SCREENSHOTS = "true"
    npm run $scriptName -- --project=screenshots --reporter=list
    $exitCode = $LASTEXITCODE
}
finally {
    if ($null -eq $previousMode) { Remove-Item Env:\VISUAL_SAFETY_MODE -ErrorAction SilentlyContinue } else { $env:VISUAL_SAFETY_MODE = $previousMode }
    if ($null -eq $previousBaseUrl) { Remove-Item Env:\BASE_URL -ErrorAction SilentlyContinue } else { $env:BASE_URL = $previousBaseUrl }
    if ($null -eq $previousCapture) { Remove-Item Env:\CAPTURE_SCREENSHOTS -ErrorAction SilentlyContinue } else { $env:CAPTURE_SCREENSHOTS = $previousCapture }
    foreach ($name in $removedSensitiveEnvironment.Keys) {
        Set-Item -LiteralPath ("Env:" + $name) -Value $removedSensitiveEnvironment[$name]
    }
    Pop-Location
}

if ($exitCode -ne 0) {
    Write-Host "Screenshot capture failed closed (exit code $exitCode)." -ForegroundColor Red
    exit $exitCode
}

Write-Host "Screenshot capture completed with zero recorded safety violations." -ForegroundColor Green
exit 0
