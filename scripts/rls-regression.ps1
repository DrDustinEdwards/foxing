# RLS-recursion regression runner. Executes scripts/rls-regression.sql against
# the live Foxing DB via the Management API and exits 1 unless every flag is true.
# Token comes from Credential Manager ('Supabase CLI:supabase'), or pass it in
# CI via the SUPABASE_ACCESS_TOKEN env var.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

if ($env:SUPABASE_ACCESS_TOKEN) {
  $query = [System.IO.File]::ReadAllText((Join-Path $root 'scripts\rls-regression.sql'))
  $body = @{ query = $query } | ConvertTo-Json -Depth 5
  $tmpBody = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmpBody, $body, (New-Object System.Text.UTF8Encoding($false)))
  $url = 'https://api.supabase.com/v1/projects/ekjpsuewrkvqzbuteurc/database/query'
  $raw = curl.exe -s -X POST $url -H "Authorization: Bearer $env:SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data-binary "@$tmpBody"
  Remove-Item $tmpBody -Force
} else {
  $raw = & (Join-Path $root 'scripts\mgmt-query.ps1') -QueryFile (Join-Path $root 'scripts\rls-regression.sql')
}

Write-Output $raw

try {
  $parsed = $raw | ConvertFrom-Json
} catch {
  Write-Output 'FAIL: response was not JSON'
  exit 1
}

$result = $null
if ($parsed -is [System.Array] -and $parsed.Count -gt 0) { $result = $parsed[0].rls_regression }
if ($null -eq $result) {
  # A 42P17 (or any SQL error) comes back as an object with a message field
  Write-Output 'FAIL: no rls_regression row returned (query errored - possible RLS recursion)'
  exit 1
}

$flags = @('clubs_readable', 'club_members_readable', 'helpers_ok',
  'clubs_select_uses_helper', 'club_members_select_uses_helper',
  'clubs_update_uses_helper')
$failed = @()
foreach ($f in $flags) {
  if ($result.$f -ne $true) { $failed += $f }
}

if ($failed.Count -gt 0) {
  Write-Output "FAIL: $($failed -join ', ')"
  exit 1
}
Write-Output 'PASS: all RLS-recursion regression checks green'
exit 0
