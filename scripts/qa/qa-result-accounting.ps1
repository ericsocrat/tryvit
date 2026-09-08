function Get-QaCheckAccounting {
    param([string]$Text, [int]$DeclaredChecks, [int]$ExitCode, [int]$ExpectedChecks = -1, [string[]]$ViolationChecks = @())
    if ($ExpectedChecks -lt 0) { $ExpectedChecks = $DeclaredChecks }
    $observed = @{}
    # These reviewed suites consist only of named violation-returning SELECTs.
    # Zero rows prove success only when the entire script completed successfully.
    if ($ExitCode -eq 0) { foreach ($name in $ViolationChecks) { $observed["issue:$name"] = $false } }
    $scalar = 0
    foreach ($line in ($Text -split "`n")) {
        $issue = ($line -split '\|')[0].Trim()
        if ($ViolationChecks -contains $issue) { $observed["issue:$issue"] = $true; continue }
        if ($line -match '^\s*(\d+)\.\s+(.+?)\s*\|\s*(\d+)\s*$') {
            $key = "check:$($Matches[1])"
            $observed[$key] = [int]$Matches[3] -gt 0
        }
        elseif ($line -match '\bT(\d+)\s+(PASS|FAIL)\b') {
            $key = "check:$([int]$Matches[1])"
            $observed[$key] = $Matches[2] -eq 'FAIL'
        }
        elseif ($line -match '^\s*(PASS|FAIL)\b') {
            $scalar++
            $observed["scalar:$scalar"] = $Matches[1] -eq 'FAIL'
        }
        elseif ($line -match '^\s*([^|]+)\|\s*([^|]+)\|\s*(PASS|FAIL)\b') {
            $observed["named:$($Matches[2].Trim())"] = $Matches[3] -eq 'FAIL'
        }
    }
    $failed = @($observed.Values | Where-Object { $_ }).Count
    $executed = $observed.Count
    $untested = [Math]::Max(0, $ExpectedChecks - $executed)
    $status = if ($ExitCode -ne 0) { 'error' } elseif ($untested -gt 0) { 'incomplete' } elseif ($failed -gt 0) { 'fail' } else { 'pass' }
    return @{
        declared_checks = $DeclaredChecks
        expected_checks = $ExpectedChecks
        executed_checks = $executed
        passed = $executed - $failed
        failed = $failed
        untested_checks = $untested
        total_checks = $executed + $untested
        status = $status
        execution_error = $ExitCode -ne 0
        count_matches_declaration = $executed -eq $DeclaredChecks
        failed_check_ids = @($observed.Keys | Where-Object { $observed[$_] })
    }
}
