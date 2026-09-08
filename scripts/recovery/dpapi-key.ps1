param([Parameter(Mandatory=$true)][ValidateSet('protect','unprotect')][string]$Mode)
$ErrorActionPreference='Stop'
try {
    Add-Type -AssemblyName System.Security
    $taskBytes=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
    $taskEntropy=[Text.Encoding]::UTF8.GetBytes('TryVit opaque recovery key v1')
    if($Mode -eq 'protect') {
        $taskResult=[Security.Cryptography.ProtectedData]::Protect($taskBytes,$taskEntropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    } else {
        $taskResult=[Security.Cryptography.ProtectedData]::Unprotect($taskBytes,$taskEntropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
    }
    [Console]::Out.Write([Convert]::ToBase64String($taskResult))
    [Array]::Clear($taskBytes,0,$taskBytes.Length)
    [Array]::Clear($taskResult,0,$taskResult.Length)
} catch {
    [Console]::Error.Write('DPAPI_OPERATION_FAILED')
    exit 1
}
