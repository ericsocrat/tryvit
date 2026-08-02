<#
.SYNOPSIS
  Captures changed-route screenshots through the owned safety harness.

.PARAMETER Mode
  Selects public or verified local-authenticated routes. The two classes never
  run in the same Playwright process.

.PARAMETER All
  Captures every mapped route in the selected safety mode.

.EXAMPLE
  .\RUN_PR_SCREENSHOTS.ps1 -Mode Public

.EXAMPLE
  .\RUN_PR_SCREENSHOTS.ps1 -Mode LocalAuthenticated -All
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Public", "LocalAuthenticated")]
    [string]$Mode,
    [switch]$All
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$frontendRoot = Join-Path $PSScriptRoot "frontend"
$resolvedFrontend = (Resolve-Path -LiteralPath $frontendRoot).Path
$outputDir = Join-Path $resolvedFrontend "pr-screenshots"

function Invoke-CheckedGitDiff {
    param([string[]]$DiffArgs)
    $lines = @(& git -C $PSScriptRoot @DiffArgs 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw "[VS_GIT_DIFF] changed-file-discovery-failed"
    }
    return $lines -join "`n"
}

if ($All) {
    $changedFiles = ""
}
else {
    $changedFiles = Invoke-CheckedGitDiff @("diff", "--name-only", "main...HEAD")
    if ([string]::IsNullOrWhiteSpace($changedFiles)) {
        $changedFiles = Invoke-CheckedGitDiff @("diff", "--name-only", "HEAD")
    }
    if ([string]::IsNullOrWhiteSpace($changedFiles)) {
        $changedFiles = Invoke-CheckedGitDiff @("diff", "--name-only", "--cached")
    }
}

if (-not $All -and [string]::IsNullOrWhiteSpace($changedFiles)) {
    Write-Host "No changed files detected. Nothing to capture." -ForegroundColor Yellow
    exit 0
}

$safetyMode = if ($Mode -eq "Public") { "public" } else { "local-authenticated" }
$scriptName = if ($Mode -eq "Public") { "visual-safety:public" } else { "visual-safety:local-authenticated" }

$previousMode = $env:VISUAL_SAFETY_MODE
$previousBaseUrl = $env:BASE_URL
$previousCapture = $env:PR_SCREENSHOTS
$previousCaptureAll = $env:PR_SCREENSHOTS_ALL
$previousChanged = $env:CHANGED_FILES
$removedSensitiveEnvironment = @{}
$blockedEnvironmentPattern = "(?i)(SUPABASE|POSTGRES|DATABASE|PASSWORD|TOKEN|SECRET|COOKIE|AUTHORIZATION|API_KEY|STAGING_(URL|SERVICE_KEY)|PRODUCTION_(URL|SERVICE_KEY)|^(ALL_PROXY|BROWSER|CHROME_PATH|DEBUG|DOCKER_(CERT_PATH|CONTEXT|HOST|TLS_VERIFY)|HTTP_PROXY|HTTPS_PROXY|LHCI_.*|LHCITEST_.*|LIGHTHOUSE_.*|NODE_DEBUG(_NATIVE)?|NODE_EXTRA_CA_CERTS|NODE_OPTIONS|NODE_PATH|NODE_REPL_EXTERNAL_MODULE|NODE_TLS_REJECT_UNAUTHORIZED|NODE_USE_ENV_PROXY|NO_PROXY|PLAYWRIGHT_.*|PUPPETEER_.*|PW(?!D$).*|SSLKEYLOGFILE|VISUAL_SAFETY_CONFIG_(RUNNER_PID|SEAL))$)"

foreach ($entry in Get-ChildItem Env:) {
    if ($entry.Name -notmatch $blockedEnvironmentPattern) {
        continue
    }
    $removedSensitiveEnvironment[$entry.Name] = $entry.Value
    Remove-Item -LiteralPath ("Env:" + $entry.Name)
}

Push-Location $resolvedFrontend
try {
    $env:VISUAL_SAFETY_MODE = $safetyMode
    $env:BASE_URL = "http://127.0.0.1:3000"
    $env:PR_SCREENSHOTS = "true"
    $env:PR_SCREENSHOTS_ALL = if ($All) { "true" } else { "false" }
    $env:CHANGED_FILES = $changedFiles
    npm run visual-safety:preflight
    if ($LASTEXITCODE -ne 0) {
        throw "[VS_PREFLIGHT] screenshot-runner-preflight-failed"
    }
    if (Test-Path -LiteralPath $outputDir) {
        $item = Get-Item -LiteralPath $outputDir -Force
        if ($item.FullName -ne $outputDir -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "[VS_OUTPUT_TARGET] screenshot-output-unproven"
        }
        Remove-Item -LiteralPath $outputDir -Recurse -Force
    }
    npm run $scriptName -- --project=pr-screenshots --reporter=list
    $exitCode = $LASTEXITCODE
}
finally {
    if ($null -eq $previousMode) { Remove-Item Env:\VISUAL_SAFETY_MODE -ErrorAction SilentlyContinue } else { $env:VISUAL_SAFETY_MODE = $previousMode }
    if ($null -eq $previousBaseUrl) { Remove-Item Env:\BASE_URL -ErrorAction SilentlyContinue } else { $env:BASE_URL = $previousBaseUrl }
    if ($null -eq $previousCapture) { Remove-Item Env:\PR_SCREENSHOTS -ErrorAction SilentlyContinue } else { $env:PR_SCREENSHOTS = $previousCapture }
    if ($null -eq $previousCaptureAll) { Remove-Item Env:\PR_SCREENSHOTS_ALL -ErrorAction SilentlyContinue } else { $env:PR_SCREENSHOTS_ALL = $previousCaptureAll }
    if ($null -eq $previousChanged) { Remove-Item Env:\CHANGED_FILES -ErrorAction SilentlyContinue } else { $env:CHANGED_FILES = $previousChanged }
    foreach ($name in $removedSensitiveEnvironment.Keys) {
        Set-Item -LiteralPath ("Env:" + $name) -Value $removedSensitiveEnvironment[$name]
    }
    Pop-Location
}

if ($exitCode -ne 0) {
    Write-Host "PR screenshot capture failed closed (exit code $exitCode)." -ForegroundColor Red
    exit $exitCode
}

Write-Host "PR screenshot capture completed with zero recorded safety violations." -ForegroundColor Green
exit 0
