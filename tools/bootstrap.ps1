# ==============================================================================
# THE TRADING FLOOR CHAMPIONSHIP — AUTOMATED FRESH-PC BOOTSTRAPPER
# File: tools/bootstrap.ps1
# Pure PowerShell • Zero Dependencies • Offline-First Portable Node Support
# ==============================================================================

[CmdletBinding()]
param (
    [switch]$SkipBrowserLaunch,
    [string]$Mode = "live"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "       THE TRADING FLOOR CHAMPIONSHIP — FRESH-PC BOOTSTRAPPER" -ForegroundColor White
Write-Host "                 Zero-Prerequisite Setup Engine" -ForegroundColor Gray
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Locate or Provision Node.js Engine
$NodePath = "node"
$NodeFound = $false

try {
    $null = Get-Command node -ErrorAction Stop
    $NodeFound = $true
    $NodeVersion = (& node -v)
    Write-Host " [OK] System Node.js engine detected: $NodeVersion" -ForegroundColor Green
} catch {
    $PortableToolsNode = Join-Path $ProjectRoot "tools\node.exe"
    $PortableBinNode = Join-Path $ProjectRoot "bin\node.exe"
    
    if (Test-Path $PortableToolsNode) {
        $NodePath = $PortableToolsNode
        $NodeFound = $true
        Write-Host " [OK] Portable Node.js engine found in tools\node.exe" -ForegroundColor Green
    } elseif (Test-Path $PortableBinNode) {
        $NodePath = $PortableBinNode
        $NodeFound = $true
        Write-Host " [OK] Portable Node.js engine found in bin\node.exe" -ForegroundColor Green
    } else {
        Write-Host " [!] Node.js not detected in System PATH or local directory." -ForegroundColor Yellow
        Write-Host "     Attempting automatic download of standalone portable Node.js LTS..." -ForegroundColor Yellow
        
        $ToolsFolder = Join-Path $ProjectRoot "tools"
        if (-not (Test-Path $ToolsFolder)) {
            New-Item -ItemType Directory -Path $ToolsFolder -Force | Out-Null
        }
        
        $NodeDownloadUrl = "https://nodejs.org/dist/v20.18.0/win-x64/node.exe"
        $DestinationNode = Join-Path $ToolsFolder "node.exe"
        
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $NodeDownloadUrl -OutFile $DestinationNode -UseBasicParsing
            if (Test-Path $DestinationNode) {
                $NodePath = $DestinationNode
                $NodeFound = $true
                Write-Host " [OK] Portable Node.js downloaded successfully into tools\node.exe" -ForegroundColor Green
            }
        } catch {
            Write-Host " [ERROR] Could not automatically download Node.js: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host " To resolve:" -ForegroundColor Yellow
            Write-Host " 1. Install Node.js LTS from: https://nodejs.org/" -ForegroundColor White
            Write-Host " 2. Or place node.exe into '$ToolsFolder'" -ForegroundColor White
            Read-Host " Press Enter to exit..."
            exit 1
        }
    }
}

# 2. Verify or Install npm dependencies
$NodeModulesPath = Join-Path $ProjectRoot "node_modules"
if (-not (Test-Path $NodeModulesPath)) {
    Write-Host " [!] node_modules not found. Installing production dependencies..." -ForegroundColor Yellow
    try {
        & npm install --silent --no-audit --no-fund
        Write-Host " [OK] Production dependencies installed cleanly." -ForegroundColor Green
    } catch {
        Write-Host " [ERROR] Dependency installation failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host " [OK] Production dependencies verified." -ForegroundColor Green
}

# 3. Detect LAN IP
$LanIp = "localhost"
$NetworkInterfaces = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
    $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"
}
if ($NetworkInterfaces) {
    $LanIp = $NetworkInterfaces[0].IPAddress
}

Write-Host " [OK] Local LAN IP determined: $LanIp" -ForegroundColor Green
Write-Host ""

# 4. Open Host Browser
if (-not $SkipBrowserLaunch) {
    Write-Host " [OK] Opening Host Operations Desk in default browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000/?role=host"
}

# 5. Launch Engine
Write-Host " [OK] Starting Trading Floor simulation engine..." -ForegroundColor Cyan
Write-Host ""
& $NodePath server.js $Mode
