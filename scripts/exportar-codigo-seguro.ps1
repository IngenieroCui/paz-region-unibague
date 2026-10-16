# Exporta HEAD limpio y examina contenido/rutas, incluyendo ZIP anidados.
param([Parameter(Mandatory = $true)][string]$Destino)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repo = (git rev-parse --show-toplevel 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $repo) { throw 'Ejecuta desde un repositorio Git.' }
$dirty = git -C $repo status --porcelain
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Se requiere árbol Git limpio y confirmado.' }
$dest = [IO.Path]::GetFullPath($Destino)
if (Test-Path -LiteralPath $dest) { throw 'El destino ya existe. Elige un nombre nuevo.' }
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('pyr-export-' + [guid]::NewGuid() + '.zip')
function Assert-SafeZip([IO.Compression.ZipArchive]$Archive, [int]$Depth = 0) {
  if ($Depth -gt 3) { throw 'Archivo anidado demasiado profundo.' }
  foreach ($entry in $Archive.Entries) {
    $name = $entry.FullName.Replace('\', '/')
    if ($name -match '(^|/)(work|node_modules|\.git|logs|test-results|playwright-report)/' -or
        $name -match '(^|/)(admin\.env|\.env(?!\.example$)[^/]*|[^/]*\.local\.[^/]+|[^/]*credenciales[^/]*|[^/]*credentials[^/]*|[^/]*\.log)$') {
      throw "Ruta local o sensible en el paquete: $name"
    }
    if (-not $entry.Length) { continue }
    if ($entry.Length -gt 16MB) { throw "Archivo demasiado grande para inspección segura: $name" }
    $memory = [IO.MemoryStream]::new()
    $stream = $entry.Open()
    try { $stream.CopyTo($memory) } finally { $stream.Dispose() }
    try {
      if ($name -match '\.zip$') {
        $memory.Position = 0
        $nested = [IO.Compression.ZipArchive]::new($memory, [IO.Compression.ZipArchiveMode]::Read, $true)
        try { Assert-SafeZip $nested ($Depth + 1) } finally { $nested.Dispose() }
      } elseif ($name -match '\.(7z|rar|gz|tar|env|pfx|p12|pem|key)$') {
        throw "Formato privado/no inspeccionable rechazado: $name"
      } else {
        $content = [Text.Encoding]::UTF8.GetString($memory.ToArray())
        if ($content -match '(?i)sb_secret_[a-z0-9_-]{15,}|sbp_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,}|gh[pousr]_[a-z0-9]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' -or
            $content -match 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{15,}' -or
            $content -match '(?i)"(?:password|access_token|refresh_token|service_role_key)"\s*:\s*"[^"\s]{20,}"') {
          throw "Posible secreto detectado en $name; no se exporta su valor."
        }
      }
    } finally { $memory.Dispose() }
  }
}
try {
  & git -C $repo archive --format=zip "--output=$temporary" HEAD
  if ($LASTEXITCODE -ne 0) { throw 'git archive falló.' }
  $archive = [IO.Compression.ZipFile]::OpenRead($temporary)
  try { Assert-SafeZip $archive } finally { $archive.Dispose() }
  $parent = Split-Path -Parent $dest
  if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Move-Item -LiteralPath $temporary -Destination $dest
  Write-Host "PASS: HEAD exportado y examinado, sin archivos locales ni patrones de secretos: $dest"
} finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
}
