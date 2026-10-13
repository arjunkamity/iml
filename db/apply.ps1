# Applies all India Mind League migrations + seed to the target SQL Server, in order.
# Usage:  .\apply.ps1                 (defaults to LocalDB)
#         .\apply.ps1 -Server "myserver\INSTANCE"
param(
    [string]$Server = '(localdb)\MSSQLLocalDB'
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$files = @(
    'migrations\001_create_database.sql',
    'migrations\002_core_identity.sql',
    'migrations\003_quiz_content.sql',
    'migrations\004_attempts_scoring.sql',
    'migrations\005_views.sql',
    'migrations\006_payments.sql',
    'seed\010_seed_reference.sql'
)
foreach ($f in $files) {
    $path = Join-Path $root $f
    Write-Host "Applying $f ..." -ForegroundColor Cyan
    sqlcmd -S $Server -E -b -I -i $path
    if ($LASTEXITCODE -ne 0) { throw "Failed on $f (exit $LASTEXITCODE)" }
}
Write-Host "All migrations applied successfully." -ForegroundColor Green
