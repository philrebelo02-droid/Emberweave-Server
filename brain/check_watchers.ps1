Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'heartbeat|helper_watch|watchdog' } | ForEach-Object { Write-Output ("pid=" + $_.ProcessId + " parent=" + $_.ParentProcessId + " :: " + $_.CommandLine.Substring(0, [Math]::Min(160, $_.CommandLine.Length))) }
Write-Output "--- lock ---"
if (Test-Path 'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\1. Emberweave Brain\_heartbeat.lock') { Get-Content 'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\1. Emberweave Brain\_heartbeat.lock' }
Write-Output "--- log tail ---"
Get-Content 'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\1. Emberweave Brain\_heartbeat.log' -Tail 15
