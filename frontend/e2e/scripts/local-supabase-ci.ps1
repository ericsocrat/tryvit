param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("start", "stop")]
  [string]$Action
)

$ErrorActionPreference = "Stop"

# Windows equivalent of local-supabase-ci.sh for guarded developer evidence.
# Supabase CLI output can include local JWTs, so it is never replayed or kept.
$repositoryRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\..\..")
)
$expectedConfig = Join-Path $repositoryRoot "supabase\config.toml"
if (-not (Test-Path -LiteralPath $expectedConfig -PathType Leaf)) {
  throw "[VS_LOCAL_RUNTIME] repository-config-missing"
}

$cloudControls = @(
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)
foreach ($name in $cloudControls) {
  [System.Environment]::SetEnvironmentVariable($name, $null, "Process")
}

$supabaseCommand = Get-Command supabase -CommandType Application -ErrorAction Stop |
  Select-Object -First 1
$stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) (
  "tryvit-supabase-{0}-{1}.out" -f $Action, [guid]::NewGuid().ToString("N")
)
$stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) (
  "tryvit-supabase-{0}-{1}.err" -f $Action, [guid]::NewGuid().ToString("N")
)

if ($Action -eq "start") {
  $arguments = @(
    "start",
    "--workdir", $repositoryRoot,
    "--exclude",
    "realtime,storage-api,imgproxy,postgres-meta,studio,mailpit,edge-runtime,logflare,vector,supavisor"
  )
} else {
  $arguments = @("stop", "--workdir", $repositoryRoot, "--no-backup")
}

try {
  $process = Start-Process `
    -FilePath $supabaseCommand.Source `
    -ArgumentList $arguments `
    -WindowStyle Hidden `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath
  if ($process.ExitCode -ne 0) {
    throw "[VS_LOCAL_RUNTIME] supabase-$Action-failed; credential-bearing CLI output withheld"
  }
  if ($Action -eq "start") {
    Write-Output "[VS_LOCAL_RUNTIME] started; guarded readiness is still required"
  } else {
    Write-Output "[VS_LOCAL_RUNTIME] stopped; local volumes removed without backup"
  }
} finally {
  Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
}
