Get-ScheduledTask | Where-Object { $_.TaskName -match 'ember|brain' -or $_.TaskPath -match 'ember|brain' } | ForEach-Object { Write-Output ($_.TaskPath + $_.TaskName + " [" + $_.State + "]") }
Write-Output "--- schtasks ---"
schtasks /query /fo csv | Select-String -Pattern 'ember|brain'
