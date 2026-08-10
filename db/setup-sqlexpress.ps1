#Requires -RunAsAdministrator
<#
  India Mind League - Local SQL Server Express setup (RUN AS ADMINISTRATOR)
  ------------------------------------------------------------------------
  One-time dev setup. Installs SQL Server 2022 Express (default instance
  SQLEXPRESS), then enables TCP + mixed authentication, applies the IML
  schema, and creates a dedicated app login.

  How to run (in an ADMIN PowerShell):
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
    & "D:\INDIA MIND LEAGUE\db\setup-sqlexpress.ps1"

  Credentials below are LOCAL DEV ONLY. The real company server will use
  different, secret credentials supplied at deployment.
#>
param(
    [int]   $Port        = 1433,
    [string]$AppLogin    = 'iml_app',
    [string]$AppPassword = 'Iml_App_Local_2026'
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# ---------------------------------------------------------------------------
Step "1/6  Install SQL Server 2022 Express (if not already present)"
$svc = Get-Service -Name 'MSSQL$*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($svc) {
    Write-Host "An instance service already exists: $($svc.Name) - skipping install." -ForegroundColor Yellow
} else {
    Write-Host "Installing via winget (downloads a few hundred MB - several minutes)..."
    winget install --id Microsoft.SQLServer.2022.Express --exact --source winget --silent `
        --accept-package-agreements --accept-source-agreements --disable-interactivity
    if ($LASTEXITCODE -ne 0) { throw "winget install failed (exit $LASTEXITCODE)" }
}

# ---------------------------------------------------------------------------
Step "2/6  Detect installed instance"
$names = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL' -ErrorAction Stop
$instance =
    if ($names.PSObject.Properties.Name -contains 'SQLEXPRESS') { 'SQLEXPRESS' }
    else { ($names.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' } | Select-Object -First 1).Name }
if (-not $instance) { throw "No SQL Server instance found after install." }
$instKey = $names.$instance
$svcName = "MSSQL`$$instance"
$base    = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$instKey"
Write-Host "Instance: $instance   (registry key $instKey)"

# ---------------------------------------------------------------------------
Step "3/6  Enable mixed-mode auth + TCP on port $Port, then restart"
Set-ItemProperty "$base\MSSQLServer" -Name 'LoginMode' -Value 2          # 2 = SQL + Windows
$tcp = "$base\MSSQLServer\SuperSocketNetLib\Tcp"
Set-ItemProperty $tcp -Name 'Enabled' -Value 1
Set-ItemProperty "$tcp\IPAll" -Name 'TcpDynamicPorts' -Value ''
Set-ItemProperty "$tcp\IPAll" -Name 'TcpPort' -Value "$Port"
Restart-Service -Name $svcName -Force
Start-Sleep -Seconds 4
Write-Host "Mixed auth + TCP $Port configured; service '$svcName' restarted."

# ---------------------------------------------------------------------------
Step "4/6  Apply IML schema + seed (Windows auth)"
& (Join-Path $root 'apply.ps1') -Server "localhost,$Port"
if ($LASTEXITCODE -ne 0) { throw "Schema apply failed." }

# ---------------------------------------------------------------------------
Step "5/6  Create application login '$AppLogin'"
$adminArgs = @('-S', "localhost,$Port", '-E', '-I', '-b')
& sqlcmd @adminArgs -Q "IF SUSER_ID('$AppLogin') IS NULL CREATE LOGIN [$AppLogin] WITH PASSWORD='$AppPassword', CHECK_POLICY=OFF;"
if ($LASTEXITCODE -ne 0) { throw "Login creation failed." }
& sqlcmd @adminArgs -d IndiaMindLeague -Q "IF USER_ID('$AppLogin') IS NULL CREATE USER [$AppLogin] FOR LOGIN [$AppLogin]; ALTER ROLE db_owner ADD MEMBER [$AppLogin];"
if ($LASTEXITCODE -ne 0) { throw "User mapping failed." }
Write-Host "Login '$AppLogin' created and granted db_owner on IndiaMindLeague."

# ---------------------------------------------------------------------------
Step "6/6  Verify app login can connect over TCP"
& sqlcmd -S "localhost,$Port" -U $AppLogin -P $AppPassword -d IndiaMindLeague -I -b `
    -Q "SELECT COUNT(*) AS Roles FROM dbo.Roles;"
if ($LASTEXITCODE -ne 0) { throw "App login verification failed." }

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " SQL Server Express is ready for India Mind League." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host " Server   : localhost,$Port"
Write-Host " Instance : $instance"
Write-Host " Database : IndiaMindLeague"
Write-Host " App user : $AppLogin"
Write-Host " Password : $AppPassword   (local dev only)"
Write-Host " SSMS     : connect to  localhost\$instance  or  localhost,$Port"
