<#
.SYNOPSIS
    Runs all QA test suites against the LOCAL Supabase database.

.DESCRIPTION
    Executes:
        1. QA__null_checks.sql (29 data integrity checks)
        2. QA__scoring_formula_tests.sql (40 algorithm validation checks)
        3. QA__source_coverage.sql (8 source provenance checks — informational)
        4. validate_eans.py (EAN-8/EAN-13 checksum validation — blocking)
        5. QA__api_surfaces.sql (18 API contract validation checks — blocking)
        6. QA__confidence_scoring.sql (14 confidence scoring checks — blocking)
        7. QA__data_quality.sql (30 data quality & plausibility checks — blocking)
        8. QA__referential_integrity.sql (18 referential integrity checks — blocking)
        9. QA__view_consistency.sql (13 view & function consistency checks — blocking)
       10. QA__naming_conventions.sql (12 naming/formatting convention checks — blocking)
       11. QA__nutrition_ranges.sql (20 nutrition range & plausibility checks — blocking)
       12. QA__data_consistency.sql (26 data consistency & domain checks — blocking)
       13. QA__allergen_integrity.sql (15 allergen & trace integrity checks — blocking)
       14. QA__serving_source_validation.sql (16 serving & source checks — blocking)
       15. QA__ingredient_quality.sql (17 ingredient quality checks — blocking)
       16. QA__security_posture.sql (43 security posture checks — blocking)
       17. QA__api_contract.sql (33 API contract checks — blocking)
       18. QA__scale_guardrails.sql (23 scale guardrails checks — blocking)
       19. QA__country_isolation.sql (11 country isolation checks — blocking)
       20. QA__diet_filtering.sql (6 diet filtering checks — blocking)
       21. QA__allergen_filtering.sql (6 allergen filtering checks — blocking)
       22. QA__barcode_lookup.sql (9 barcode scanner checks — blocking)
       23. QA__auth_onboarding.sql (8 auth & onboarding checks — blocking)
       24. QA__confidence_reporting.sql (7 confidence reporting checks — blocking)
       25. QA__health_profiles.sql (14 health profile checks — blocking)
       26. QA__lists_comparisons.sql (15 lists & comparisons checks — blocking)
       27. QA__scanner_submissions.sql (15 scanner & submissions checks — blocking)
       28. QA__index_temporal.sql (19 index coverage & temporal checks — blocking)
       29. QA__attribute_contradiction.sql (5 attribute contradiction checks — blocking)
       30. QA__monitoring.sql (14 monitoring & health checks — blocking)
       31. QA__scoring_determinism.sql (25 scoring determinism checks — blocking)
       32. QA__multi_country_consistency.sql (16 multi-country consistency checks — blocking)
       33. QA__performance_regression.sql (6 performance regression checks — informational)
       34. QA__event_intelligence.sql (18 event intelligence checks — blocking)
       35. QA__store_integrity.sql (12 store architecture checks — blocking)
       36. QA__data_provenance.sql (28 data provenance checks — blocking)
       37. QA__scoring_engine.sql (27 scoring engine checks — blocking)
       38. QA__search_architecture.sql (26 search architecture checks — blocking)
       39. QA__gdpr_compliance.sql (15 GDPR compliance checks — blocking)
       40. QA__push_notifications.sql (17 push notification checks — blocking)
       41. QA__index_verification.sql (13 index verification checks — informational)
       42. QA__slow_queries.sql (12 slow query detection checks — informational)
       43. QA__explain_analysis.sql (10 explain analysis checks — informational)
       44. QA__mv_refresh_cost.sql (10 MV refresh cost checks — informational)
       45. QA__governance_drift.sql (8 governance drift checks — blocking)
       46. QA__rls_audit.sql (7 RLS audit checks — blocking)
       47. QA__function_security_audit.sql (6 function security audit checks — blocking)
       48. QA__recipe_integrity.sql (6 recipe data integrity checks — blocking)
       50. QA__allergen_evidence_semantics.sql (7 allergen evidence semantics checks — blocking)

    Returns exit code 0 if all tests pass, 1 if any violations found.
    Test Suites 3, 33, 41, 42, 43, and 44 are informational and do not affect the exit code.

.PARAMETER Json
    Output results as machine-readable JSON instead of colored text.
    JSON includes: timestamp, suites (name, checks, status, violations, runtime_ms),
    inventory, and overall pass/fail.

.PARAMETER OutFile
    Write JSON output to this file path (implies -Json).

.PARAMETER FailOnWarn
    Treat source warnings, diagnostic findings and unassessed inventories as failures.
    When set, an overall warning causes a non-zero exit code.

.NOTES
    Prerequisites:
        - Docker Desktop running with local Supabase containers
        - Database populated with scored products
        - Python 3.12+ with validate_eans.py script

    Exit codes:
        0  All critical checks pass (and no warnings if -FailOnWarn)
        1  One or more critical checks failed
        2  Informational warnings present (only with -FailOnWarn)

    Usage:
        .\RUN_QA.ps1                        # Human-readable output
        .\RUN_QA.ps1 -Json                  # Machine-readable JSON to stdout
        .\RUN_QA.ps1 -OutFile qa-results.json  # JSON to file
        .\RUN_QA.ps1 -FailOnWarn            # Fail on informational warnings too
#>

param(
    [switch]$Json,
    [string]$OutFile,
    [switch]$FailOnWarn
)

if ($OutFile) { $Json = $true }

$script:JsonMode = [bool]$Json

function Write-Host {
    [CmdletBinding()]
    param(
        [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
        [object[]]$Object,
        [ConsoleColor]$ForegroundColor,
        [ConsoleColor]$BackgroundColor,
        [switch]$NoNewline,
        [object]$Separator
    )

    if (-not $script:JsonMode) {
        Microsoft.PowerShell.Utility\Write-Host @PSBoundParameters
    }
}

# JSON result accumulator
$jsonResult = @{
    timestamp = (Get-Date -Format "o")
    version   = "2.0"
    check_profile = "evidence-first-v2"
    suites    = @()
    summary   = @{ total_checks = 0; passed = 0; failed = 0; warnings = 0 }
    inventory = @{}
    overall   = "unknown"
}

# Track warning state for -FailOnWarn
$hasWarnings = $false

$CONTAINER = "supabase_db_tryvit"
$DB_USER = "postgres"
$DB_NAME = "postgres"
$SCRIPT_ROOT = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$QA_DIR = Join-Path (Join-Path $SCRIPT_ROOT "db") "qa"

# QA now includes rollback fixture/DDL tests. Never route them to hosted data.
. (Join-Path $SCRIPT_ROOT 'scripts/qa/qa-local-target.ps1')
. (Join-Path $SCRIPT_ROOT 'scripts/qa/qa-result-accounting.ps1')
$qaTargetMode = Assert-QaLocalEnvironment @{
    PGHOST=$env:PGHOST; PGHOSTADDR=$env:PGHOSTADDR; PGDATABASE=$env:PGDATABASE
    PGSERVICE=$env:PGSERVICE; PGSERVICEFILE=$env:PGSERVICEFILE; DOCKER_HOST=$env:DOCKER_HOST; DOCKER_CONTEXT=$env:DOCKER_CONTEXT
}
if ($qaTargetMode -eq 'docker') {
    if ($env:DOCKER_HOST) { $qaDockerEndpoint = $env:DOCKER_HOST } else {
        $qaDockerEndpoint = docker context inspect --format '{{.Endpoints.docker.Host}}'
        if ($LASTEXITCODE -ne 0) { throw 'QA_DOCKER_CONTEXT_UNPROVEN' }
    }
    Assert-QaLocalDockerEndpoint (($qaDockerEndpoint | Out-String).Trim())
    $qaDockerProject = docker inspect --format '{{ index .Config.Labels "com.supabase.cli.project" }}' $CONTAINER
    if ($LASTEXITCODE -ne 0) { throw 'QA_DOCKER_OWNERSHIP_UNPROVEN' }
    Assert-QaOwnedDockerProject (($qaDockerProject | Out-String).Trim())
}

# Single source of truth for suite metadata (names, counts, blocking behavior)
$suiteCatalog = @(
    @{ Num = 1; Name = "Data Integrity"; Short = "Integrity"; Id = "integrity"; Checks = 25; Blocking = $true; Kind = "sql-special"; File = "QA__null_checks.sql" },
    @{ Num = 2; Name = "Scoring Formula"; Short = "Scoring"; Id = "scoring"; Checks = 40; Blocking = $true; Kind = "sql-special"; File = "QA__scoring_formula_tests.sql" },
    @{ Num = 3; Name = "Source Coverage"; Short = "Source"; Id = "source_coverage"; Checks = 8; Blocking = $false; Kind = "sql-special"; File = "QA__source_coverage.sql" },
    @{ Num = 4; Name = "EAN Checksum Validation"; Short = "EAN"; Id = "ean"; Checks = 1; Blocking = $true; Kind = "python"; File = "validate_eans.py" },
    @{ Num = 5; Name = "API Surface Validation"; Short = "API"; Id = "api"; Checks = 18; Blocking = $true; Kind = "sql"; File = "QA__api_surfaces.sql" },
    @{ Num = 6; Name = "Confidence Scoring"; Short = "Confidence"; Id = "confidence"; Checks = 14; Blocking = $true; Kind = "sql"; File = "QA__confidence_scoring.sql" },
    @{ Num = 7; Name = "Data Quality & Plausibility"; Short = "DataQuality"; Id = "data_quality"; Checks = 31; Blocking = $true; Kind = "sql"; File = "QA__data_quality.sql" },
    @{ Num = 8; Name = "Referential Integrity"; Short = "RefInteg"; Id = "referential"; Checks = 18; Blocking = $true; Kind = "sql"; File = "QA__referential_integrity.sql" },
    @{ Num = 9; Name = "View & Function Consistency"; Short = "Views"; Id = "views"; Checks = 16; Blocking = $true; Kind = "sql"; File = "QA__view_consistency.sql" },
    @{ Num = 10; Name = "Naming Conventions"; Short = "Naming"; Id = "naming"; Checks = 12; Blocking = $true; Kind = "sql"; File = "QA__naming_conventions.sql" },
    @{ Num = 11; Name = "Nutrition Ranges & Plausibility"; Short = "NutriRange"; Id = "nutrition_ranges"; Checks = 13; Blocking = $true; Kind = "sql"; File = "QA__nutrition_ranges.sql" },
    @{ Num = 12; Name = "Data Consistency"; Short = "DataConsist"; Id = "data_consistency"; Checks = 24; Blocking = $true; Kind = "sql"; File = "QA__data_consistency.sql" },
    @{ Num = 13; Name = "Allergen & Trace Integrity"; Short = "Allergen"; Id = "allergen_integrity"; Checks = 15; Blocking = $true; Kind = "sql"; File = "QA__allergen_integrity.sql" },
    @{ Num = 14; Name = "Serving & Source Validation"; Short = "ServSource"; Id = "serving_source"; Checks = 16; Blocking = $true; Kind = "sql"; File = "QA__serving_source_validation.sql" },
    @{ Num = 15; Name = "Ingredient Data Quality"; Short = "IngredQual"; Id = "ingredient_quality"; Checks = 17; Blocking = $true; Kind = "sql"; File = "QA__ingredient_quality.sql" },
    @{ Num = 16; Name = "Security Posture"; Short = "Security"; Id = "security_posture"; Checks = 43; Blocking = $true; Kind = "sql"; File = "QA__security_posture.sql" },
    @{ Num = 17; Name = "API Contract"; Short = "Contract"; Id = "api_contract"; Checks = 36; Blocking = $true; Kind = "sql"; File = "QA__api_contract.sql" },
    @{ Num = 18; Name = "Scale Guardrails"; Short = "Scale"; Id = "scale_guardrails"; Checks = 23; Blocking = $true; Kind = "sql"; File = "QA__scale_guardrails.sql" },
    @{ Num = 19; Name = "Country Isolation"; Short = "Country"; Id = "country_isolation"; Checks = 11; Blocking = $true; Kind = "sql"; File = "QA__country_isolation.sql" },
    @{ Num = 20; Name = "Diet Filtering"; Short = "Diet"; Id = "diet_filtering"; Checks = 6; Blocking = $true; Kind = "sql"; File = "QA__diet_filtering.sql" },
    @{ Num = 21; Name = "Allergen Filtering"; Short = "Allergen"; Id = "allergen_filtering"; Checks = 6; Blocking = $true; Kind = "sql"; File = "QA__allergen_filtering.sql" },
    @{ Num = 22; Name = "Barcode Lookup"; Short = "Barcode"; Id = "barcode_lookup"; Checks = 9; Blocking = $true; Kind = "sql"; File = "QA__barcode_lookup.sql" },
    @{ Num = 23; Name = "Auth & Onboarding"; Short = "AuthOnboard"; Id = "auth_onboarding"; Checks = 8; Blocking = $true; Kind = "sql"; File = "QA__auth_onboarding.sql" },
    @{ Num = 24; Name = "Confidence Reporting"; Short = "ConfReport"; Id = "confidence_reporting"; Checks = 7; Blocking = $true; Kind = "sql"; File = "QA__confidence_reporting.sql" },
    @{ Num = 25; Name = "Health Profiles"; Short = "Health"; Id = "health_profiles"; Checks = 14; Blocking = $true; Kind = "sql"; File = "QA__health_profiles.sql" },
    @{ Num = 26; Name = "Lists & Comparisons"; Short = "ListsComp"; Id = "lists_comparisons"; Checks = 15; Blocking = $true; Kind = "sql"; File = "QA__lists_comparisons.sql" },
    @{ Num = 27; Name = "Scanner & Submissions"; Short = "Scanner"; Id = "scanner_submissions"; Checks = 15; Blocking = $true; Kind = "sql"; File = "QA__scanner_submissions.sql" },
    @{ Num = 28; Name = "Index & Temporal Integrity"; Short = "IdxTemporal"; Id = "index_temporal"; Checks = 19; Blocking = $true; Kind = "sql"; File = "QA__index_temporal.sql" },
    @{ Num = 29; Name = "Attribute Contradictions"; Short = "AttrContra"; Id = "attribute_contradiction"; Checks = 5; Blocking = $true; Kind = "sql"; File = "QA__attribute_contradiction.sql" },
    @{ Num = 30; Name = "Monitoring & Health Check"; Short = "Monitoring"; Id = "monitoring"; Checks = 14; Blocking = $true; Kind = "sql"; File = "QA__monitoring.sql" },
    @{ Num = 31; Name = "Scoring Determinism"; Short = "Determinism"; Id = "scoring_determinism"; Checks = 25; Blocking = $true; Kind = "sql"; File = "QA__scoring_determinism.sql" },

    @{ Num = 32; Name = "Multi-Country Consistency"; Short = "MultiCountry"; Id = "multi_country_consistency"; Checks = 16; Blocking = $true; Kind = "sql"; File = "QA__multi_country_consistency.sql" },
    @{ Num = 33; Name = "Performance Regression"; Short = "PerfRegress"; Id = "performance_regression"; Checks = 6; Blocking = $false; Kind = "sql"; File = "QA__performance_regression.sql" },
    @{ Num = 34; Name = "Event Intelligence"; Short = "EventIntel"; Id = "event_intelligence"; Checks = 18; Blocking = $true; Kind = "sql"; File = "QA__event_intelligence.sql" },
    @{ Num = 35; Name = "Store Architecture"; Short = "StoreArch"; Id = "store_integrity"; Checks = 12; Blocking = $true; Kind = "sql"; File = "QA__store_integrity.sql" },
    @{ Num = 36; Name = "Data Provenance"; Short = "Provenance"; Id = "data_provenance"; Checks = 28; Blocking = $true; Kind = "sql"; File = "QA__data_provenance.sql" },
    @{ Num = 37; Name = "Scoring Engine"; Short = "ScoreEngine"; Id = "scoring_engine"; Checks = 27; Blocking = $true; Kind = "sql"; File = "QA__scoring_engine.sql" },
    @{ Num = 38; Name = "Search Architecture"; Short = "SearchArch"; Id = "search_architecture"; Checks = 26; Blocking = $true; Kind = "sql"; File = "QA__search_architecture.sql" },
    @{ Num = 39; Name = "GDPR Compliance"; Short = "GDPR"; Id = "gdpr_compliance"; Checks = 15; Blocking = $true; Kind = "sql"; File = "QA__gdpr_compliance.sql" },
    @{ Num = 40; Name = "Push Notifications"; Short = "PushNotif"; Id = "push_notifications"; Checks = 17; Blocking = $true; Kind = "sql"; File = "QA__push_notifications.sql" },
    @{ Num = 41; Name = "Index Verification"; Short = "IdxVerify"; Id = "index_verification"; Checks = 13; Blocking = $false; Kind = "sql"; File = "QA__index_verification.sql" },
    @{ Num = 42; Name = "Slow Query Detection"; Short = "SlowQuery"; Id = "slow_queries"; Checks = 12; Blocking = $false; Kind = "sql"; File = "QA__slow_queries.sql" },
    @{ Num = 43; Name = "Explain Analysis"; Short = "Explain"; Id = "explain_analysis"; Checks = 10; Blocking = $false; Kind = "sql"; File = "QA__explain_analysis.sql" },
    @{ Num = 44; Name = "MV Refresh Cost"; Short = "MVRefresh"; Id = "mv_refresh_cost"; Checks = 10; Blocking = $false; Kind = "sql"; File = "QA__mv_refresh_cost.sql" },
    @{ Num = 45; Name = "Governance Drift"; Short = "GovDrift"; Id = "governance_drift"; Checks = 8; Blocking = $true; Kind = "sql"; File = "QA__governance_drift.sql" },
    @{ Num = 46; Name = "RLS Audit"; Short = "RLSAudit"; Id = "rls_audit"; Checks = 7; Blocking = $false; Kind = "sql"; File = "QA__rls_audit.sql" },
    @{ Num = 47; Name = "Function Security Audit"; Short = "FuncSecAudit"; Id = "function_security_audit"; Checks = 6; Blocking = $false; Kind = "sql"; File = "QA__function_security_audit.sql" },
    @{ Num = 48; Name = "Recipe Integrity"; Short = "RecipeInteg"; Id = "recipe_integrity"; Checks = 6; Blocking = $true; Kind = "sql"; File = "QA__recipe_integrity.sql" },
    @{ Num = 49; Name = "Scoring Band Distribution"; Short = "ScoringDist"; Id = "scoring_distribution"; Checks = 12; Blocking = $false; Kind = "sql"; File = "QA__scoring_distribution.sql" },
    @{ Num = 50; Name = "Allergen Evidence Semantics"; Short = "AllergenEvidence"; Id = "allergen_evidence_semantics"; Checks = 7; Blocking = $true; Kind = "sql"; File = "QA__allergen_evidence_semantics.sql" }
)

$suiteByNum = @{}
foreach ($suite in $suiteCatalog) {
    $suiteByNum[$suite.Num] = $suite
}

$suitePass = @{}

# ─── Database Connection Abstraction ───────────────────────────────────────
# CI mode  (PGHOST set): uses psql directly — PGHOST/PGPORT/PGUSER/PGPASSWORD env vars
# Local mode (default) : uses docker exec into the Supabase container
function Invoke-Psql {
    param(
        [string]$InputSql,
        [switch]$TuplesOnly
    )
    if ($env:PGHOST) {
        $psqlArgs = @('-X', '--set=ON_ERROR_STOP=1')
        if ($TuplesOnly) { $psqlArgs += "--tuples-only" }
        return ($InputSql | psql @psqlArgs 2>&1)
    }
    else {
        $psqlArgs = @('-X', '--set=ON_ERROR_STOP=1', "-U", $DB_USER, "-d", $DB_NAME)
        if ($TuplesOnly) { $psqlArgs += "--tuples-only" }
        return ($InputSql | docker exec -i $CONTAINER psql @psqlArgs 2>&1)
    }
}

# Coverage is reported separately and cannot create a blocking verification quota.
$qaCoverageSql = (Get-Content (Join-Path $QA_DIR 'contracts/evidence_data.sql') -Raw -ErrorAction Stop) +
    "`n" + (Get-Content (Join-Path $QA_DIR 'contracts/evidence_coverage.sql') -Raw -ErrorAction Stop)
$qaCoverageOutput = Invoke-Psql -InputSql $qaCoverageSql -TuplesOnly
if ($LASTEXITCODE -ne 0) { throw 'QA_EVIDENCE_COVERAGE_FAILED' }
$jsonResult.evidence_coverage = (($qaCoverageOutput | Out-String).Trim() | ConvertFrom-Json)

function Get-NonEmptyLines {
    param([string]$Text)
    return @($Text -split "`n" | ForEach-Object { $_.TrimEnd() } | Where-Object { $_ -match '\S' })
}

function Get-FailedCheckLines {
    param([string]$Text)
    $allLines = Get-NonEmptyLines -Text $Text
    return @($allLines | Where-Object { $_ -match '^\s*\d+\.\s+.+\|\s*[1-9]\d*\s*$' })
}

function Write-TrimmedViolationOutput {
    param(
        [string]$Text,
        [int]$MaxLines = 40
    )

    $lines = @(Get-NonEmptyLines -Text $Text)
    if ($lines.Count -le $MaxLines) {
        Write-Host $Text -ForegroundColor DarkRed
        return
    }

    $head = @($lines | Select-Object -First $MaxLines)
    Write-Host ($head -join "`n") -ForegroundColor DarkRed
    Write-Host "  ... ($($lines.Count - $MaxLines) additional lines omitted; use individual QA SQL for full details)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  TryVit — QA Test Suite" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $Json) {
    # Header already printed above
}

# ─── Test 1: Data Integrity Checks ─────────────────────────────────────────

$test1File = Join-Path $QA_DIR "QA__null_checks.sql"
if (-not (Test-Path $test1File)) {
    Write-Host "ERROR: QA__null_checks.sql not found at: $test1File" -ForegroundColor Red
    exit 1
}

$suite1Checks = $suiteByNum[1].Checks
Write-Host "Running Test Suite 1: Data Integrity ($suite1Checks checks)..." -ForegroundColor Yellow

$sw1 = [System.Diagnostics.Stopwatch]::StartNew()

# Informational summaries are separate; execute all25 violation queries, including image guards.
$test1Content = Get-Content $test1File -Raw
$test1ChecksOnly = $test1Content
$test1ChecksOnly = "\set QUIET on`nBEGIN;`n" + (Get-Content (Join-Path $QA_DIR 'contracts/evidence_data.sql') -Raw -ErrorAction Stop) + "`n" + $test1ChecksOnly + "`n\set QUIET on`nROLLBACK;"

$test1Output = Invoke-Psql -InputSql $test1ChecksOnly -TuplesOnly

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ FAILED TO EXECUTE" -ForegroundColor Red
    Write-Host "  $test1Output" -ForegroundColor DarkRed
    exit 1
}

$test1Lines = ($test1Output | Out-String).Trim()
$test1Rows = @(Get-NonEmptyLines -Text $test1Lines)
$test1CountRows = @($test1Rows | Where-Object { $_ -match '^\s*\d+\.\s+.+\|\s*\d+\s*$' })
$test1DistinctChecks = @($test1CountRows | ForEach-Object { ($_ -split '\|')[0].Trim() } | Select-Object -Unique)
if ($test1Rows.Count -eq $suite1Checks -and $test1CountRows.Count -eq $suite1Checks -and
    $test1DistinctChecks.Count -eq $suite1Checks -and @(Get-FailedCheckLines -Text $test1Lines).Count -eq 0) {
    $sw1.Stop()
    Write-Host "  ✓ PASS ($suite1Checks/$suite1Checks — zero violations) [$([math]::Round($sw1.Elapsed.TotalMilliseconds))ms]" -ForegroundColor Green
    $test1Pass = $true
    $jsonResult.suites += @{ name = $suiteByNum[1].Name; suite_id = $suiteByNum[1].Id; checks = $suite1Checks; status = "pass"; violations = @(); runtime_ms = [math]::Round($sw1.Elapsed.TotalMilliseconds) }
    $jsonResult.summary.total_checks += $suite1Checks; $jsonResult.summary.passed += $suite1Checks
}
else {
    $sw1.Stop()
    Write-Host "  ✗ FAILED — violations detected:" -ForegroundColor Red
    $test1Pass = $false
    $failedCheckLines = @(Get-FailedCheckLines -Text $test1Lines)
    $nonEmptyLines = @(Get-NonEmptyLines -Text $test1Lines)
    if ($failedCheckLines.Count -gt 0) {
        $violationList = $failedCheckLines
        $failedCount = $failedCheckLines.Count
        Write-Host ($violationList -join "`n") -ForegroundColor DarkRed
        if ($nonEmptyLines.Count -gt $failedCheckLines.Count) {
            Write-Host "  ... ($($nonEmptyLines.Count - $failedCheckLines.Count) zero-violation rows omitted)" -ForegroundColor DarkGray
        }
    }
    else {
        $violationList = @($nonEmptyLines | Select-Object -First 20)
        $failedCount = 1
        Write-TrimmedViolationOutput -Text $test1Lines -MaxLines 20
    }
    $jsonResult.suites += @{ name = $suiteByNum[1].Name; suite_id = $suiteByNum[1].Id; checks = $suite1Checks; status = "fail"; violations = @($violationList); runtime_ms = [math]::Round($sw1.Elapsed.TotalMilliseconds) }
    $jsonResult.summary.total_checks += $suite1Checks; $jsonResult.summary.failed += $failedCount; $jsonResult.summary.passed += ($suite1Checks - $failedCount)
}
$suitePass[1] = $test1Pass

# ─── Test 2: Scoring Formula Validation ────────────────────────────────────

$test2File = Join-Path $QA_DIR "QA__scoring_formula_tests.sql"
if (-not (Test-Path $test2File)) {
    Write-Host "ERROR: QA__scoring_formula_tests.sql not found at: $test2File" -ForegroundColor Red
    exit 1
}

Write-Host ""
$suite2Checks = $suiteByNum[2].Checks
Write-Host "Running Test Suite 2: Scoring Formula ($suite2Checks checks)..." -ForegroundColor Yellow

$sw2 = [System.Diagnostics.Stopwatch]::StartNew()

$test2Content = Get-Content $test2File -Raw
$test2Output = Invoke-Psql -InputSql $test2Content -TuplesOnly

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ FAILED TO EXECUTE" -ForegroundColor Red
    Write-Host "  $test2Output" -ForegroundColor DarkRed
    exit 1
}

$test2Lines = ($test2Output | Out-String).Trim()
if ($test2Lines -eq "" -or $test2Lines -match '^\s*$') {
    $sw2.Stop()
    Write-Host "  ✓ PASS ($suite2Checks/$suite2Checks — zero violations) [$([math]::Round($sw2.Elapsed.TotalMilliseconds))ms]" -ForegroundColor Green
    $test2Pass = $true
    $jsonResult.suites += @{ name = $suiteByNum[2].Name; suite_id = $suiteByNum[2].Id; checks = $suite2Checks; status = "pass"; violations = @(); runtime_ms = [math]::Round($sw2.Elapsed.TotalMilliseconds) }
    $jsonResult.summary.total_checks += $suite2Checks; $jsonResult.summary.passed += $suite2Checks
}
else {
    $sw2.Stop()
    Write-Host "  ✗ FAILED — violations detected:" -ForegroundColor Red
    $test2Pass = $false
    $failedCheckLines2 = @(Get-FailedCheckLines -Text $test2Lines)
    $nonEmptyLines2 = @(Get-NonEmptyLines -Text $test2Lines)
    if ($failedCheckLines2.Count -gt 0) {
        $violationList2 = $failedCheckLines2
        $failedCount2 = $failedCheckLines2.Count
        Write-Host ($violationList2 -join "`n") -ForegroundColor DarkRed
        if ($nonEmptyLines2.Count -gt $failedCheckLines2.Count) {
            Write-Host "  ... ($($nonEmptyLines2.Count - $failedCheckLines2.Count) zero-violation rows omitted)" -ForegroundColor DarkGray
        }
    }
    else {
        $violationList2 = @($nonEmptyLines2 | Select-Object -First 20)
        $failedCount2 = 1
        Write-TrimmedViolationOutput -Text $test2Lines -MaxLines 20
    }
    $jsonResult.suites += @{ name = $suiteByNum[2].Name; suite_id = $suiteByNum[2].Id; checks = $suite2Checks; status = "fail"; violations = @($violationList2); runtime_ms = [math]::Round($sw2.Elapsed.TotalMilliseconds) }
    $jsonResult.summary.total_checks += $suite2Checks; $jsonResult.summary.failed += $failedCount2; $jsonResult.summary.passed += ($suite2Checks - $failedCount2)
}
$suitePass[2] = $test2Pass

# ─── Test 3: Source Coverage (Informational) ───────────────────────────────

$test3File = Join-Path $QA_DIR "QA__source_coverage.sql"
if (Test-Path $test3File) {
    Write-Host ""
    $suite3Checks = $suiteByNum[3].Checks
    Write-Host "Running Test Suite 3: Source Coverage ($suite3Checks checks — informational)..." -ForegroundColor Yellow

    $sw3 = [System.Diagnostics.Stopwatch]::StartNew()

    # Run only checks 1-4 (actionable items); 5-7 are informational summaries
    $test3Content = Get-Content $test3File -Raw
    $test3Output = Invoke-Psql -InputSql $test3Content -TuplesOnly

    if ($LASTEXITCODE -ne 0) {
        $sw3.Stop()
        Write-Host "  ⚠ FAILED TO EXECUTE (non-blocking)" -ForegroundColor DarkYellow
        $jsonResult.suites += @{ name = $suiteByNum[3].Name; suite_id = $suiteByNum[3].Id; checks = $suite3Checks; status = "error"; blocking = $false; runtime_ms = [math]::Round($sw3.Elapsed.TotalMilliseconds) }
    }
    else {
        $actionableCountQuery = @"
SELECT COUNT(DISTINCT p.product_id)
FROM products p
WHERE p.is_deprecated IS NOT TRUE
  AND (
      p.source_type IS NULL
      OR p.source_type = 'off_api'
      OR (p.source_type IS NOT NULL AND p.source_type NOT IN ('label_scan', 'retailer_api'))
      OR p.confidence = 'estimated'
  );
"@

        $actionableOutput = Invoke-Psql -InputSql $actionableCountQuery -TuplesOnly
        $actionableCount = 0
        if ($LASTEXITCODE -eq 0) {
            $actionableText = ($actionableOutput | Out-String).Trim()
            if ($actionableText -match '(\d+)') {
                $actionableCount = [int]$Matches[1]
            }
        }

        $sw3.Stop()
        $test3Lines = ($test3Output | Out-String).Trim()
        $infoRowCount = if ($test3Lines -eq "" -or $test3Lines -match '^\s*$') { 0 } else { (Get-NonEmptyLines -Text $test3Lines).Count }
        if ($actionableCount -eq 0) {
            Write-Host "  ✓ All products have multi-source coverage [$([math]::Round($sw3.Elapsed.TotalMilliseconds))ms]" -ForegroundColor Green
            $jsonResult.suites += @{ name = $suiteByNum[3].Name; suite_id = $suiteByNum[3].Id; checks = $suite3Checks; status = "pass"; blocking = $false; flagged_actionable = 0; flagged_rows_total = $infoRowCount; runtime_ms = [math]::Round($sw3.Elapsed.TotalMilliseconds) }
            $suitePass[3] = $true
        }
        else {
            Write-Host "  ⚠ $actionableCount products flagged for cross-validation (non-blocking) [$([math]::Round($sw3.Elapsed.TotalMilliseconds))ms]" -ForegroundColor DarkYellow
            Write-Host "    Informational rows returned by suite query set: $infoRowCount" -ForegroundColor DarkGray
            Write-Host "    Run QA__source_coverage.sql directly for details." -ForegroundColor DarkGray
            $hasWarnings = $true
            $jsonResult.suites += @{ name = $suiteByNum[3].Name; suite_id = $suiteByNum[3].Id; checks = $suite3Checks; status = "warn"; blocking = $false; flagged_actionable = $actionableCount; flagged_rows_total = $infoRowCount; runtime_ms = [math]::Round($sw3.Elapsed.TotalMilliseconds) }
            $jsonResult.summary.warnings += $actionableCount
            $suitePass[3] = $false
        }
    }
}

# ─── Test 4: EAN Checksum Validation (EAN-8/EAN-13) ───────────────────────

Write-Host ""
Write-Host "Running Test Suite 4: EAN Checksum Validation (EAN-8/EAN-13)..." -ForegroundColor Yellow

$suite4Checks = $suiteByNum[4].Checks

$validatorScript = Join-Path $SCRIPT_ROOT "validate_eans.py"
if (-not (Test-Path $validatorScript)) {
    Write-Host "  ⚠ SKIPPED (validate_eans.py not found)" -ForegroundColor DarkYellow
    $test4Pass = $false
    $jsonResult.suites += @{ name=$suiteByNum[4].Name; suite_id='ean'; checks=$suite4Checks; status='error'; diagnostic_code='validator_missing'; violations=@(); runtime_ms=0 }
}
else {
    # Run validator and capture output
    $sw4 = [System.Diagnostics.Stopwatch]::StartNew()
    $validatorOutput = & python $validatorScript 2>&1
    $validatorExitCode = $LASTEXITCODE
    $sw4.Stop()

    if ($validatorExitCode -eq 0) {
        Write-Host "  ✓ PASS — All EAN codes have valid checksums [$([math]::Round($sw4.Elapsed.TotalMilliseconds))ms]" -ForegroundColor Green
        $test4Pass = $true
        $jsonResult.suites += @{ name = $suiteByNum[4].Name; suite_id = $suiteByNum[4].Id; checks = $suite4Checks; status = "pass"; violations = @(); runtime_ms = [math]::Round($sw4.Elapsed.TotalMilliseconds) }
        $jsonResult.summary.total_checks += $suite4Checks; $jsonResult.summary.passed += $suite4Checks
    }
    else {
        # Extract count of invalid EANs from output
        $invalidMatch = $validatorOutput | Select-String -Pattern "Results: (\d+) valid, (\d+) invalid"
        if ($invalidMatch) {
            $validCount = $invalidMatch.Matches.Groups[1].Value
            $invalidCount = $invalidMatch.Matches.Groups[2].Value
            Write-Host "  ✗ FAILED — $invalidCount invalid EAN checksums detected (of $validCount total)" -ForegroundColor Red
            Write-Host "    Run 'python validate_eans.py' for details or see docs/EAN_VALIDATION_STATUS.md" -ForegroundColor DarkGray
        }
        else {
            Write-Host "  ✗ FAILED — EAN validation errors detected" -ForegroundColor Red
        }
        $test4Pass = $false
        $jsonResult.suites += @{ name = $suiteByNum[4].Name; suite_id = $suiteByNum[4].Id; checks = $suite4Checks; status = "fail"; violations = @($validatorOutput); runtime_ms = [math]::Round($sw4.Elapsed.TotalMilliseconds) }
        $jsonResult.summary.total_checks += $suite4Checks; $jsonResult.summary.failed += $suite4Checks
    }
}
$suitePass[4] = $test4Pass

# ─── Test 5–15: Generic SQL QA Suites ──────────────────────────────────────
# All remaining suites follow the same pattern: load SQL, run via Invoke-Psql,
# check for violation rows (| <non-zero count>), report pass/fail.

function Invoke-SqlQASuite {
    param(
        [int]$SuiteNum,
        [string]$Name,
        [string]$SuiteId,
        [string]$FileName,
        [int]$Checks
    )
    $testFile = Join-Path $QA_DIR $FileName
    if (-not (Test-Path $testFile)) {
        Write-Host ""
        Write-Host "  ⚠ SKIPPED Test Suite ${SuiteNum}: $Name (file not found)" -ForegroundColor DarkYellow
        $script:jsonResult.suites += @{ name=$Name; suite_id=$SuiteId; checks=$Checks; declared_checks=$Checks; executed_checks=0; untested_checks=$Checks; passed_checks=0; failed_checks=0; status='error'; execution_error=$true; diagnostic_code='suite_file_missing'; violations=@(); runtime_ms=0 }
        $script:jsonResult.summary.total_checks += $Checks
        return $false
    }

    Write-Host ""
    Write-Host "Running Test Suite ${SuiteNum}: $Name ($Checks checks)..." -ForegroundColor Yellow

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $content = Get-Content $testFile -Raw
    $inventoryOnly = $SuiteId -in @('rls_audit','function_security_audit')
    # Explicit named assertions are the current source count; removed legacy
    # checks do not become phantom passes or untested checks from a stale catalog.
    $namedCheckCount = ([regex]::Matches($content, '(?i)\bAS\s+check_name\b')).Count
    $expectedChecks = if ($namedCheckCount -gt 0) { $namedCheckCount } else { $Checks }
    $violationChecks = @()
    if ($SuiteId -in @('event_intelligence','scoring_distribution')) {
        $violationChecks = @([regex]::Matches($content, "'([^']+)'\s+AS\s+issue\b", 'IgnoreCase') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
        $expectedChecks = $violationChecks.Count
        if ($expectedChecks -eq 0) { throw 'QA_VIOLATION_QUERY_CONTRACT_MISSING' }
    }
    if ($SuiteId -in @('security_posture', 'scale_guardrails', 'lists_comparisons', 'index_temporal', 'index_verification')) {
        $contract = Get-Content (Join-Path $QA_DIR 'contracts/evidence_security.sql') -Raw -ErrorAction Stop
        $content = $contract + "`n" + $content
    }
    if ($SuiteId -in @('data_consistency', 'data_quality', 'confidence', 'nutrition_ranges', 'multi_country_consistency')) {
        $contract = Get-Content (Join-Path $QA_DIR 'contracts/evidence_data.sql') -Raw -ErrorAction Stop
        $content = "\set QUIET on`nBEGIN;`n" + $contract + "`n" + $content + "`n\set QUIET on`nROLLBACK;"
    }
    if ($inventoryOnly) { $content = "\t off`n\pset footer on`n" + $content }
    $output = Invoke-Psql -InputSql $content -TuplesOnly
    $executionCode = $LASTEXITCODE
    $sw.Stop()
    $lines = ($output | Out-String).Trim()
    $account = Get-QaCheckAccounting -Text $lines -DeclaredChecks $Checks -ExpectedChecks $expectedChecks -ViolationChecks $violationChecks -ExitCode $executionCode
    $inventoryRows = @()
    if ($inventoryOnly) {
        # Server-emitted result footers count actual inventory rows/queries.
        # Inventory output contains no pass/fail predicate and is never a PASS.
        $inventoryRows = @([regex]::Matches($lines, '\((\d+) rows?\)') | ForEach-Object { [int]$_.Groups[1].Value })
        $account.status = Get-QaInventoryStatus -SuiteId $SuiteId -ExitCode $executionCode -QueryRowCounts $inventoryRows
        $account.declared_checks = 0; $account.total_checks = 0; $account.executed_checks = 0
        $account.passed = 0; $account.failed = 0; $account.untested_checks = 0
        $expectedChecks = 0
    }
    $violationList = @(Get-FailedCheckLines -Text $lines)
    if ($violationChecks.Count -gt 0) {
        $violationList += @($lines -split "`n" | Where-Object { $violationChecks -contains (($_ -split '\|')[0].Trim()) })
    }
    $script:jsonResult.suites += @{
        name=$Name; suite_id=$SuiteId; checks=$account.total_checks; declared_checks=$account.declared_checks
        expected_checks=$expectedChecks; failed_check_ids=$account.failed_check_ids
        inventory_only=$inventoryOnly; inventory_query_row_counts=$inventoryRows
        inventory_output=$(if ($inventoryOnly) { $lines -replace "'(?:''|[^'])*'", "'[redacted literal]'" } else { $null })
        executed_inventory_queries=$inventoryRows.Count
        declared_inventory_queries=$(if ($inventoryOnly) { $Checks } else { 0 })
        executed_checks=$account.executed_checks; passed_checks=$account.passed; failed_checks=$account.failed
        untested_checks=$account.untested_checks; count_matches_declaration=$account.count_matches_declaration
        status=$account.status; execution_error=$account.execution_error; exit_code=$executionCode
        violations=$violationList; runtime_ms=[math]::Round($sw.Elapsed.TotalMilliseconds)
    }
    $script:jsonResult.summary.total_checks += $account.total_checks
    $script:jsonResult.summary.passed += $account.passed
    $script:jsonResult.summary.failed += $account.failed
    if ($account.status -eq 'pass') {
        Write-Host "  ✓ PASS ($($account.passed) observed checks; $Checks declared)" -ForegroundColor Green
        return $true
    }
    Write-Host "  ✗ $($account.status): $($account.failed) failed, $($account.untested_checks) untested" -ForegroundColor Red
    if ($executionCode -ne 0) { Write-Host "  $output" -ForegroundColor DarkRed }
    elseif ($violationList.Count -gt 0) { Write-Host ($violationList -join "`n") -ForegroundColor DarkRed }
    return $false
}

$sqlSuites = $suiteCatalog | Where-Object { $_.Kind -eq 'sql' } | Sort-Object Num
foreach ($suite in $sqlSuites) {
    $suitePass[$suite.Num] = Invoke-SqlQASuite -SuiteNum $suite.Num -Name $suite.Name -SuiteId $suite.Id -FileName $suite.File -Checks $suite.Checks
}

# ─── Database Inventory ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "Database Inventory:" -ForegroundColor Cyan

$invQuery = @"
SELECT
    (SELECT COUNT(*) FROM products WHERE is_deprecated IS NOT TRUE) AS active_products,
    (SELECT COUNT(*) FROM products WHERE is_deprecated = true) AS deprecated,
    (SELECT COUNT(*) FROM nutrition_facts) AS nutrition_rows,
    (SELECT COUNT(*) FROM ingredient_ref) AS ingredient_refs,
    (SELECT COUNT(*) FROM product_ingredient) AS product_ingredients,
    (SELECT COUNT(*) FROM product_allergen_info WHERE type = 'contains') AS allergen_rows,
    (SELECT COUNT(*) FROM product_allergen_info WHERE type = 'traces') AS trace_rows,
    (SELECT COUNT(DISTINCT category) FROM products WHERE is_deprecated IS NOT TRUE) AS categories;
"@

$invOutput = Invoke-Psql -InputSql $invQuery
Write-Host ($invOutput | Out-String).Trim() -ForegroundColor DarkGray

# ─── Summary ────────────────────────────────────────────────────────────────

foreach ($result in $jsonResult.suites) {
    $catalogEntry = $suiteCatalog | Where-Object { $_.Id -eq $result.suite_id } | Select-Object -First 1
    $result.blocking = [bool]$catalogEntry.Blocking
    $result.assessment_role = if ($result.inventory_only) { 'unassessed_inventory' } elseif ($result.suite_id -eq 'scoring_distribution') { 'historical_score_diagnostic' } elseif ($result.blocking) { 'release_gate' } else { 'diagnostic' }
    if ($result.status -in @('error','incomplete') -and -not $result.ContainsKey('untested_checks')) {
        $result.declared_checks=$result.checks; $result.executed_checks=0
        $result.passed_checks=0; $result.failed_checks=0; $result.untested_checks=$result.checks
    }
}
$jsonResult.summary.declared_checks = ($jsonResult.suites | ForEach-Object { if ($_.ContainsKey('declared_checks')) { $_.declared_checks } else { $_.checks } } | Measure-Object -Sum).Sum
$jsonResult.summary.executed_checks = ($jsonResult.suites | ForEach-Object { if ($_.ContainsKey('executed_checks')) { $_.executed_checks } elseif ($_.status -notin @('error','incomplete')) { $_.checks } else { 0 } } | Measure-Object -Sum).Sum
$jsonResult.summary.untested = ($jsonResult.suites | ForEach-Object { if ($_.ContainsKey('untested_checks')) { $_.untested_checks } else { 0 } } | Measure-Object -Sum).Sum
$jsonResult.summary.execution_errors = @($jsonResult.suites | Where-Object { $_.status -eq 'error' }).Count
$jsonResult.summary.incomplete_suites = @($jsonResult.suites | Where-Object { $_.status -eq 'incomplete' }).Count
$jsonResult.summary.unassessed_suites = @($jsonResult.suites | Where-Object { $_.status -eq 'unassessed' }).Count
$jsonResult.summary.blocking_failed = ($jsonResult.suites | Where-Object { $_.blocking } | ForEach-Object { if ($_.ContainsKey('failed_checks')) { $_.failed_checks } elseif ($_.status -eq 'fail') { $_.checks } else { 0 } } | Measure-Object -Sum).Sum
$jsonResult.summary.diagnostic_failed = ($jsonResult.suites | Where-Object { -not $_.blocking } | ForEach-Object { if ($_.ContainsKey('failed_checks')) { $_.failed_checks } else { 0 } } | Measure-Object -Sum).Sum
$jsonResult.consumer_retirement = Get-QaConsumerRetirementAssessment -Suites $jsonResult.suites
$jsonResult.summary.informational_checks = @($jsonResult.suites | Where-Object { $_.suite_id -eq 'source_coverage' -and $_.status -in @('pass','warn') } | ForEach-Object { $_.checks } | Measure-Object -Sum)[0].Sum
$jsonResult.summary.total_checks = $jsonResult.summary.passed + $jsonResult.summary.failed + $jsonResult.summary.untested + $jsonResult.summary.informational_checks

$allPass = $true
foreach ($suite in $suiteCatalog | Where-Object { $_.Blocking }) {
    if (-not $suitePass[$suite.Num]) {
        $allPass = $false
        break
    }
}
$hasDiagnosticWarnings = $hasWarnings -or $jsonResult.summary.diagnostic_failed -gt 0 -or $jsonResult.summary.unassessed_suites -gt 0
$warnFail = $FailOnWarn -and $hasDiagnosticWarnings
if ($jsonResult.summary.execution_errors -gt 0 -or $jsonResult.summary.incomplete_suites -gt 0) { $allPass = $false }
if ($jsonResult.consumer_retirement.status -ne 'pass') { $allPass = $false }
$jsonResult.overall = if (-not $allPass) { "fail" } elseif ($hasDiagnosticWarnings) { "warn" } else { "pass" }

# Parse inventory into JSON-friendly structure
if ($invOutput) {
    $invText = ($invOutput | Out-String).Trim()
    # Extract numbers from the psql output
    if ($invText -match '(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)') {
        $jsonResult.inventory = @{
            active_products     = [int]$Matches[1]
            deprecated          = [int]$Matches[2]
            nutrition_rows      = [int]$Matches[3]
            ingredient_refs     = [int]$Matches[4]
            product_ingredients = [int]$Matches[5]
            allergen_rows       = [int]$Matches[6]
            trace_rows          = [int]$Matches[7]
            categories          = [int]$Matches[8]
        }
    }
}

# JSON output mode
if ($Json) {
    $jsonOutput = $jsonResult | ConvertTo-Json -Depth 4
    if ($OutFile) {
        $jsonOutput | Out-File -FilePath $OutFile -Encoding utf8
        Write-Host "QA results written to: $OutFile" -ForegroundColor Green
    }
    else {
        Write-Output $jsonOutput
    }
    if (-not $allPass) { exit 1 }
    if ($warnFail) { exit 2 }
    exit 0
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

if ($jsonResult.overall -eq 'pass') {
    Write-Host "  ✓ ALL TESTS PASSED ($($jsonResult.summary.passed)/$($jsonResult.summary.total_checks) checks)" -ForegroundColor Green
    Write-Host ""
    exit 0
}
else {
    if (-not $allPass) {
        Write-Host "  ✗ SOME TESTS FAILED" -ForegroundColor Red
    }
    else {
        Write-Host "  ⚠ RELEASE CHECKS PASSED WITH DIAGNOSTICS / UNASSESSED INVENTORIES" -ForegroundColor DarkYellow
    }
    foreach ($suite in $suiteCatalog | Sort-Object Num) {
        $label = "Suite $($suite.Num) ($($suite.Short))".PadRight(28)
        if ($suite.Num -eq 3) {
            $statusText = "$(if ($hasWarnings) { '⚠ WARN' } else { '✓ PASS' }) (informational$(if ($FailOnWarn) { ', -FailOnWarn active' }))"
            $statusColor = if ($hasWarnings) { "DarkYellow" } else { "Green" }
        }
        else {
            $observedSuite = $jsonResult.suites | Where-Object { $_.suite_id -eq $suite.Id } | Select-Object -First 1
            $statusText = "$($observedSuite.status) ($($observedSuite.assessment_role))"
            $statusColor = if ($suitePass[$suite.Num]) { "Green" } else { "Red" }
        }
        Write-Host "    $label $statusText" -ForegroundColor $statusColor
    }
    Write-Host ""
    if (-not $allPass) { exit 1 }
    if ($warnFail) { exit 2 }
    exit 0
}

