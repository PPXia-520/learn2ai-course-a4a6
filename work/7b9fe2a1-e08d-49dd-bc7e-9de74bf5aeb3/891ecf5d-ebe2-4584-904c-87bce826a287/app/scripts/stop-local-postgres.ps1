param(
  [string]$DataDirectory = (Join-Path $PSScriptRoot '..\\.local\\postgres')
)

$ErrorActionPreference = 'Stop'
$dataPath = [System.IO.Path]::GetFullPath($DataDirectory)
if (Test-Path (Join-Path $dataPath 'PG_VERSION')) {
  & 'D:\\PostgreSQL\\bin\\pg_ctl.exe' -D $dataPath stop -m fast
}
