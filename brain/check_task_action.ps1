$t = Get-ScheduledTask -TaskName 'Emberweave helper rebuild'
$t.Actions | ForEach-Object { Write-Output ("EXEC: " + $_.Execute + " ARGS: " + $_.Arguments) }
$t.Triggers | ForEach-Object { Write-Output ("TRIGGER: " + $_.CimClass.CimClassName + " " + $_.ToString()) }
