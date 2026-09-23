$conns = Get-NetTCPConnection -LocalPort 7777 -State Listen -ErrorAction SilentlyContinue
if ($conns) { $conns | ForEach-Object { $p = Get-Process -Id $_.OwningProcess; Write-Output ("PORT 7777 held by pid=" + $_.OwningProcess + " name=" + $p.ProcessName) } } else { Write-Output "PORT 7777 FREE" }
Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'pythonw?' -and $_.CommandLine -match 'app\.py' } | ForEach-Object { Write-Output ("engine candidate pid=" + $_.ProcessId) }
