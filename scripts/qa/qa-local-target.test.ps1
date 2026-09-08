$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'qa-local-target.ps1')
$checks = 0
foreach ($address in @('127.0.0.1','localhost','::1')) {
    if ((Assert-QaLocalEnvironment @{PGHOST=$address;PGDATABASE='postgres'}) -ne 'direct') { throw 'Local CI rejected' }
    $checks++
}
foreach ($settings in @(@{PGHOST='db.production.supabase.co'},@{PGHOST='localhost,remote'},
    @{PGHOST='localhost';PGHOSTADDR='1.1.1.1'},@{PGHOST='localhost';PGSERVICE='private'},
    @{PGHOST='localhost';PGSERVICEFILE='private.conf'},@{PGHOST='localhost';PGDATABASE='postgresql://remote/db'},
    @{PGHOST='localhost';PGDATABASE='host=remote'},@{PGHOSTADDR='127.0.0.1'},@{DOCKER_HOST='tcp://remote:2376'},
    @{DOCKER_HOST='npipe:////./pipe/docker_engine';DOCKER_CONTEXT='other'})) {
    $rejected=$false
    try { Assert-QaLocalEnvironment $settings | Out-Null } catch { $rejected=$true }
    if (-not $rejected) { throw 'Unsafe target accepted' }
    $checks++
}
if ((Assert-QaLocalEnvironment @{}) -ne 'docker') { throw 'Local Docker mode rejected' }
Assert-QaLocalDockerEndpoint 'npipe:////./pipe/docker_engine'
Assert-QaLocalDockerEndpoint 'unix:///var/run/docker.sock'
Assert-QaOwnedDockerProject 'tryvit'
foreach ($endpoint in @('tcp://remote:2376','ssh://remote','npipe:////remote/pipe/docker_engine')) {
    $rejected=$false
    try { Assert-QaLocalDockerEndpoint $endpoint } catch { $rejected=$true }
    if (-not $rejected) { throw 'Remote Docker accepted' }
    $checks++
}
$rejected=$false
try { Assert-QaOwnedDockerProject 'other' } catch { $rejected=$true }
if (-not $rejected) { throw 'Unowned Docker accepted' }
Write-Output "PASS: $($checks+5) local QA target checks"
