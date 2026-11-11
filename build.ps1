# Alex's Mobs 2 - build, validate and package.
#   .\build.ps1            regenerate addon/ from the Java jar, validate, write dist\alexsmobs2-v<version>.mcaddon
#   .\build.ps1 -NoConvert only validate + package what is in addon/
#   .\build.ps1 -Sync      also copy the packs into Minecraft's development folders (update.bat)
param([switch]$NoConvert, [switch]$Sync)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not $NoConvert) {
  node tools/converter/build.js
  if ($LASTEXITCODE -ne 0) { throw "converter failed" }
}
node tools/converter/validate.js
if ($LASTEXITCODE -ne 0) { throw "validation failed - not packaging" }

$version = (Get-Content addon/BP/manifest.json -Raw | ConvertFrom-Json).header.version -join '.'
New-Item -ItemType Directory -Force dist | Out-Null
$out = Join-Path $PSScriptRoot "dist/alexsmobs2-v$version.mcaddon"

# Spec-compliant zip: forward-slash entry names, BP/ and RP/ at the top level.
# (Compress-Archive on PowerShell 5.1 writes backslashes, which Minecraft rejects on some platforms.)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
$fs = [System.IO.File]::Open($out, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($pack in @(@('addon/BP', 'BP'), @('addon/RP', 'RP'))) {
    $src = (Resolve-Path -LiteralPath $pack[0]).Path.TrimEnd('\')
    Get-ChildItem -LiteralPath $src -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($src.Length + 1).Replace('\', '/')
      $e = $zip.CreateEntry("$($pack[1])/$rel", [System.IO.Compression.CompressionLevel]::Optimal)
      $in = [System.IO.File]::OpenRead($_.FullName)
      $o = $e.Open()
      try { $in.CopyTo($o) } finally { $o.Dispose(); $in.Dispose() }
    }
  }
} finally { $zip.Dispose(); $fs.Dispose() }
Write-Host ("packaged {0} ({1:N1} MB)" -f $out, ((Get-Item $out).Length / 1MB))

if ($Sync) { & cmd /c "`"$PSScriptRoot\update.bat`"" }
