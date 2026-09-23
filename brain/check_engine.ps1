$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'app\.py' }
if ($procs) { $procs | ForEach-Object { Write-Output ("RUNNING pid=" + $_.ProcessId + " name=" + $_.Name) } } else { Write-Output "NOT RUNNING" }
