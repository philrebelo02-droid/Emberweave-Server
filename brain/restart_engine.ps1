Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'app\.py' -and $_.Name -match 'python' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 2
Start-Process 'C:\Users\Home\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\python\.venv\Scripts\pythonw.exe' -ArgumentList 'app.py' -WorkingDirectory 'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\1. Emberweave Brain' -WindowStyle Hidden
