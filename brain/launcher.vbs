' EMBERWEAVE BRAIN - silent launcher (no console window)
' Starts Ollama, starts the Brain engine hidden, opens her native window.
Option Explicit
Dim shell, fso, pyw, ollama, here, electron
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

here = fso.GetParentFolderName(WScript.ScriptFullName)
pyw = "C:\Users\Home\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\python\.venv\Scripts\pythonw.exe"
ollama = "C:\Users\Home\AppData\Local\Programs\Ollama\ollama.exe"
electron = here & "\node_modules\electron\dist\electron.exe"

' 1. local model service (hidden)
If fso.FileExists(ollama) Then shell.Run """" & ollama & """", 0, False
WScript.Sleep 6000

' 2. brain engine (hidden)
shell.Run """" & pyw & """ """ & here & "\app.py""", 0, False
WScript.Sleep 5000

' 3. native app window - HER icon on the taskbar
If fso.FileExists(electron) Then
  shell.Run """" & electron & """ """ & here & """", 1, False
Else
  ' fallback: browser app-mode
  shell.Run "http://localhost:7777", 1, False
End If
