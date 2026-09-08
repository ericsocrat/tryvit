$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'qa-result-accounting.ps1')
$cases = 0
function Assert-Counts($result, $passed, $failed, $untested, $status) {
    if ($result.passed -ne $passed -or $result.failed -ne $failed -or $result.untested_checks -ne $untested -or $result.status -ne $status) { throw 'QA_RESULT_COUNTS_MISMATCH' }
}
# Four errored suites must contribute all declared checks, never fabricated passes.
$results = foreach ($declared in @(8,6,28,10)) { Get-QaCheckAccounting -Text 'ERROR: failed before a check result' -DeclaredChecks $declared -ExitCode 3 }
if (($results.total_checks | Measure-Object -Sum).Sum -ne 52 -or ($results.untested_checks | Measure-Object -Sum).Sum -ne 52 -or ($results.passed | Measure-Object -Sum).Sum -ne 0) { throw 'ERRORED_SUITES_DISAPPEARED' }
$cases++
Assert-Counts (Get-QaCheckAccounting -Text "1. executed | 0`n2. failed | 2`nERROR: later SQL error" -DeclaredChecks 6 -ExitCode 3) 1 1 4 'error'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text "NOTICE: T01 PASS - complete`nERROR: T02 FAIL: bad assertion" -DeclaredChecks 4 -ExitCode 3) 1 1 2 'error'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text '' -DeclaredChecks 6 -ExitCode 0) 0 0 6 'incomplete'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text "1. one | 0`n2. two | 0`n3. three | 0" -DeclaredChecks 2 -ExitCode 0) 3 0 0 'pass'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text "1. one | 0`nERROR: teardown failed" -DeclaredChecks 1 -ExitCode 3) 1 0 0 'error'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text "PASS`nFAIL`nPASS" -DeclaredChecks 3 -ExitCode 0) 2 1 0 'fail'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text "status|named-check|FAIL - denied" -DeclaredChecks 1 -ExitCode 0) 0 1 0 'fail'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text "4. retained | 0" -DeclaredChecks 4 -ExpectedChecks 1 -ExitCode 0) 1 0 0 'pass'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text 'BROKEN|fixture' -DeclaredChecks 2 -ExitCode 0 -ViolationChecks @('BROKEN','MISSING')) 1 1 0 'fail'; $cases++
Assert-Counts (Get-QaCheckAccounting -Text 'BROKEN|fixture' -DeclaredChecks 2 -ExitCode 3 -ViolationChecks @('BROKEN','MISSING')) 0 1 1 'error'; $cases++
Write-Output "PASS: $cases QA accounting checks"
