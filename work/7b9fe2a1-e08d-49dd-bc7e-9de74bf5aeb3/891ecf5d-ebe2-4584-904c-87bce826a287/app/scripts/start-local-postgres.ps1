param(
  [string]$DataDirectory = (Join-Path $PSScriptRoot '..\\.local\\postgres'),
  [int]$Port = 55432
)

$ErrorActionPreference = 'Stop'
$pgBin = 'D:\\PostgreSQL\\bin'
$dataPath = [System.IO.Path]::GetFullPath($DataDirectory)
$logPath = Join-Path $dataPath 'server.log'

New-Item -ItemType Directory -Force $dataPath | Out-Null
if (-not (Test-Path (Join-Path $dataPath 'PG_VERSION'))) {
  & (Join-Path $pgBin 'initdb.exe') -D $dataPath -U campus_app -A trust --encoding=UTF8 --locale=C
}

$status = & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath status 2>&1
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgBin 'pg_ctl.exe') -D $dataPath -o "-p $Port" -l $logPath start
} else {
  Write-Host "Local PostgreSQL is already running at port $Port."
}
