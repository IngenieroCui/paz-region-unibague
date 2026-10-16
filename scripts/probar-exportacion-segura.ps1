$ErrorActionPreference = 'Stop'
$source = (Resolve-Path 'scripts/exportar-codigo-seguro.ps1').Path
$root = Join-Path (Get-Location) ('work/export-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $root -Force | Out-Null
function New-TestRepo([string]$Name) {
  $path = Join-Path $root $Name
  New-Item -ItemType Directory -Path $path | Out-Null
  git -C $path init -q
  git -C $path config user.name 'TEST export'
  git -C $path config user.email 'export@example.test'
  Set-Content -LiteralPath (Join-Path $path '.gitignore') -Value ".env.local`nwork/`n*.zip"
  Set-Content -LiteralPath (Join-Path $path 'README.md') -Value 'TEST codigo sin secretos'
  git -C $path add .
  git -C $path commit -qm 'TEST base'
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear repositorio TEST aislado.' }
  return $path
}
function Expect-Rejected([string]$Path) {
  Push-Location $Path
  try {
    $rejected = $false
    try { & $source -Destino (Join-Path $Path 'rejected.zip') } catch { $rejected = $true }
    if (-not $rejected -or (Test-Path -LiteralPath 'rejected.zip')) { throw 'Exportacion sensible no fue bloqueada.' }
  } finally { Pop-Location }
}
$positive = New-TestRepo 'positive'
Set-Content -LiteralPath (Join-Path $positive '.env.local') -Value 'TEST-LOCAL-NO-DISTRIBUIR'
New-Item -ItemType Directory -Path (Join-Path $positive 'work/p9') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $positive 'work/p9/cuentas-institucionales.local.json') -Value 'TEST-LOCAL-NO-DISTRIBUIR'
Push-Location $positive
try {
  & $source -Destino (Join-Path $root 'positive.zip')
  $zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $root 'positive.zip'))
  try { if (@($zip.Entries | Where-Object { $_.FullName -match '^work/|\.env\.local' }).Count) { throw 'Paquete incluye archivos ignorados.' } } finally { $zip.Dispose() }
} finally { Pop-Location }
$tracked = New-TestRepo 'tracked'
Set-Content -LiteralPath (Join-Path $tracked '.env.local') -Value 'TEST-LOCAL-NO-DISTRIBUIR'
git -C $tracked add -f .env.local
git -C $tracked commit -qm 'TEST ruta prohibida'
Expect-Rejected $tracked
$content = New-TestRepo 'content'
Set-Content -LiteralPath (Join-Path $content 'accidental.txt') -Value ('sb_secret_' + ('x' * 40))
git -C $content add accidental.txt
git -C $content commit -qm 'TEST secreto sintetico'
Expect-Rejected $content
$nested = New-TestRepo 'nested'
$nestedZip = [IO.Compression.ZipFile]::Open((Join-Path $nested 'unsafe.zip'), [IO.Compression.ZipArchiveMode]::Create)
try {
  $entry = $nestedZip.CreateEntry('work/p9/cuentas-institucionales.local.json')
  $writer = [IO.StreamWriter]::new($entry.Open())
  try { $writer.Write('TEST-LOCAL-NO-DISTRIBUIR') } finally { $writer.Dispose() }
} finally { $nestedZip.Dispose() }
git -C $nested add -f unsafe.zip
git -C $nested commit -qm 'TEST ZIP con ruta privada'
Expect-Rejected $nested
Write-Host 'PASS: ignorados excluidos; ruta versionada, secreto sintetico y ZIP anidado sensible bloqueados.'
