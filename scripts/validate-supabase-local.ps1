param([switch]$ResetDisposableLocal)
$ErrorActionPreference = 'Stop'
# Explicitly opt in: reset destroys ONLY this repository's disposable LOCAL DB.
if (-not $ResetDisposableLocal) {
    throw 'SKIPPED: execute with -ResetDisposableLocal only for a disposable local Supabase stack.'
}
foreach ($tool in @('docker', 'supabase', 'node')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "SKIPPED: missing $tool" }
}
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Failed: $Executable $($Arguments -join ' ')" }
}
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    # Discover the installed CLI's supported syntax before any mutation.
    Invoke-Checked 'docker' @('info', '--format', '{{.ServerVersion}}')
    foreach ($arguments in @(@('--version'), @('--help'), @('start', '--help'), @('db', 'reset', '--help'), @('test', 'db', '--help'), @('db', 'lint', '--help'), @('gen', 'types', '--help'))) {
        Invoke-Checked 'supabase' $arguments
    }
    Invoke-Checked 'supabase' @('start')
    Invoke-Checked 'supabase' @('db', 'reset', '--local')
    Invoke-Checked 'supabase' @('migration', 'list', '--local')
    Invoke-Checked 'supabase' @('test', 'db')
    # P6-B retains its SQL test file in tests/p6b, outside default test discovery.
    Invoke-Checked 'supabase' @('test', 'db', 'tests/p6b/database.test.sql')
    Invoke-Checked 'supabase' @('db', 'lint', '--local')
    $types = & supabase gen types typescript --local
    if ($LASTEXITCODE -ne 0) { throw 'Official type generation failed' }
    New-Item -ItemType Directory -Path 'work' -Force | Out-Null
    $types | Set-Content -LiteralPath 'work/database.official.types.ts' -Encoding utf8
    Write-Output 'Generated official types in work/database.official.types.ts. Review against src/lib/supabase/database.types.ts before replacing.'
    Write-Output 'Remaining: db advisors (discover installed syntax with --help), real Auth/PostgREST/Storage and independent-session tests. See docs/P7_OPERATIONAL_HANDOFF.md.'
} finally { Pop-Location }
