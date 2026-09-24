<#
.SYNOPSIS
    Generates Minecraft Bedrock .mcaddon and .mcpack packages for Alex's Mobs.
.DESCRIPTION
    Builds:
    1. Alexs_Mobs_v1.1_Animation_Update.mcaddon (Bundled Add-on containing AlexsMobs_BP and AlexsMobs_RP)
    2. AlexsMobs_BP_v1.1.mcpack (Standalone Behavior Pack)
    3. AlexsMobs_RP_v1.1.mcpack (Standalone Resource Pack)
#>

[CmdletBinding()]
param(
    [string]$OutputDir,
    [string]$Version = "1.1",
    [string]$UpdateName = "Animation Update"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = $PSScriptRoot
}
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = (Get-Location).Path
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = if (![string]::IsNullOrWhiteSpace($PSScriptRoot)) { $PSScriptRoot } else { (Get-Location).Path }
$bpDir = Join-Path $root "BP"
$rpDir = Join-Path $root "RP"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Alex's Mobs Bedrock Add-on Packager                    " -ForegroundColor Cyan
Write-Host "   Version: $Version | Update: $UpdateName               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Manifests
Write-Host "`n[1/4] Verifying manifests..." -ForegroundColor Yellow
$bpManifest = Get-Content (Join-Path $bpDir "manifest.json") -Raw | ConvertFrom-Json
$rpManifest = Get-Content (Join-Path $rpDir "manifest.json") -Raw | ConvertFrom-Json

Write-Host "  BP Header Name   : $($bpManifest.header.name)" -ForegroundColor Green
Write-Host "  BP Version       : $($bpManifest.header.version -join '.')" -ForegroundColor Green
Write-Host "  RP Header Name   : $($rpManifest.header.name)" -ForegroundColor Green
Write-Host "  RP Version       : $($rpManifest.header.version -join '.')" -ForegroundColor Green

# 2. Helper to zip folder contents into an archive
function Build-ZipFromFolder {
    param(
        [string]$SourceDir,
        [string]$ZipPath,
        [string]$RootPrefix = ""
    )

    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath -Force
    }

    $zipFile = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        $files = Get-ChildItem -Path $SourceDir -Recurse -File
        foreach ($file in $files) {
            $relPath = $file.FullName.Substring($SourceDir.Length).TrimStart('\', '/')
            $entryPath = if ([string]::IsNullOrEmpty($RootPrefix)) {
                $relPath.Replace('\', '/')
            } else {
                "$RootPrefix/$($relPath.Replace('\', '/'))"
            }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zipFile,
                $file.FullName,
                $entryPath,
                [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
    finally {
        $zipFile.Dispose()
    }
}

# 3. Build Standalone .mcpack Files
Write-Host "`n[2/4] Generating Standalone .mcpack files..." -ForegroundColor Yellow

$bpMcpackName = "AlexsMobs_BP_v$Version.mcpack"
$bpMcpackPath = Join-Path $OutputDir $bpMcpackName
Write-Host "  Packing $bpMcpackName..." -NoNewline
Build-ZipFromFolder -SourceDir $bpDir -ZipPath $bpMcpackPath
$bpSize = (Get-Item $bpMcpackPath).Length / 1MB
Write-Host " Done! ($([math]::Round($bpSize, 2)) MB)" -ForegroundColor Green

$rpMcpackName = "AlexsMobs_RP_v$Version.mcpack"
$rpMcpackPath = Join-Path $OutputDir $rpMcpackName
Write-Host "  Packing $rpMcpackName..." -NoNewline
Build-ZipFromFolder -SourceDir $rpDir -ZipPath $rpMcpackPath
$rpSize = (Get-Item $rpMcpackPath).Length / 1MB
Write-Host " Done! ($([math]::Round($rpSize, 2)) MB)" -ForegroundColor Green

# 4. Build Bundled .mcaddon File (containing AlexsMobs_BP and AlexsMobs_RP)
Write-Host "`n[3/4] Generating Unified .mcaddon bundle..." -ForegroundColor Yellow

$cleanUpdate = $UpdateName -replace '[^a-zA-Z0-9]', '_'
$mcaddonName = "Alexs_Mobs_v${Version}_${cleanUpdate}.mcaddon"
$mcaddonPath = Join-Path $OutputDir $mcaddonName
Write-Host "  Packing $mcaddonName..." -NoNewline

if (Test-Path $mcaddonPath) {
    Remove-Item $mcaddonPath -Force
}

$addonZip = [System.IO.Compression.ZipFile]::Open($mcaddonPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    # Add BP files under AlexsMobs_BP/
    $bpFiles = Get-ChildItem -Path $bpDir -Recurse -File
    foreach ($file in $bpFiles) {
        $relPath = $file.FullName.Substring($bpDir.Length).TrimStart('\', '/').Replace('\', '/')
        $entryPath = "AlexsMobs_BP/$relPath"
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $addonZip,
            $file.FullName,
            $entryPath,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }

    # Add RP files under AlexsMobs_RP/
    $rpFiles = Get-ChildItem -Path $rpDir -Recurse -File
    foreach ($file in $rpFiles) {
        $relPath = $file.FullName.Substring($rpDir.Length).TrimStart('\', '/').Replace('\', '/')
        $entryPath = "AlexsMobs_RP/$relPath"
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $addonZip,
            $file.FullName,
            $entryPath,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $addonZip.Dispose()
}

$mcaddonSize = (Get-Item $mcaddonPath).Length / 1MB
Write-Host " Done! ($([math]::Round($mcaddonSize, 2)) MB)" -ForegroundColor Green

# Also create an mcpack-container version of mcaddon for multi-client compatibility
$mcaddonContainerName = "Alexs_Mobs_v${Version}_${cleanUpdate}_packs.mcaddon"
$mcaddonContainerPath = Join-Path $OutputDir $mcaddonContainerName
Write-Host "  Packing container $mcaddonContainerName..." -NoNewline
if (Test-Path $mcaddonContainerPath) {
    Remove-Item $mcaddonContainerPath -Force
}
$containerZip = [System.IO.Compression.ZipFile]::Open($mcaddonContainerPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $containerZip,
        $bpMcpackPath,
        "AlexsMobs_BP.mcpack",
        [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $containerZip,
        $rpMcpackPath,
        "AlexsMobs_RP.mcpack",
        [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
}
finally {
    $containerZip.Dispose()
}
$containerSize = (Get-Item $mcaddonContainerPath).Length / 1MB
Write-Host " Done! ($([math]::Round($containerSize, 2)) MB)" -ForegroundColor Green

# 5. Output Summary & Hashes
Write-Host "`n[4/4] Package Verification & Hashes:" -ForegroundColor Yellow
$packages = @(
    $mcaddonPath,
    $mcaddonContainerPath,
    $bpMcpackPath,
    $rpMcpackPath
)

foreach ($pkg in $packages) {
    $item = Get-Item $pkg
    $hash = (Get-FileHash -Path $pkg -Algorithm SHA256).Hash
    $sizeMB = [math]::Round($item.Length / 1MB, 2)
    Write-Host "  File   : $($item.Name)" -ForegroundColor Cyan
    Write-Host "  Size   : $sizeMB MB ($($item.Length) bytes)"
    Write-Host "  SHA256 : $hash"
    Write-Host ""
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Generation Complete! All packages ready for import.    " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
