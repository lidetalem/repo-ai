PowerShell activation and project install instructions

Option A — Persistently allow running local scripts (recommended)
1. Open PowerShell (can be normal user):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```
2. Activate the venv (PowerShell):

```powershell
.\venv\Scripts\Activate.ps1
```

Option B — Temporary bypass (no policy change)

```powershell
powershell -ExecutionPolicy Bypass -File .\venv\Scripts\Activate.ps1
```

Option C — Use CMD to avoid PowerShell policy issues

```cmd
venv\Scripts\activate.bat
```

Install dependencies (after activation) or without activating:

```powershell
# After activation (PowerShell)
python -m pip install --upgrade pip
python -m pip install -r backend\requirements_clean.txt

# Or without activation (explicit venv python)
.\venv\Scripts\python -m pip install --upgrade pip
.\venv\Scripts\python -m pip install -r backend\requirements_clean.txt
```

If `Activate.ps1` still fails after setting `RemoteSigned`, run the CMD option above or use the `-ExecutionPolicy Bypass` temporary command. If `requirements_clean.txt` installs fail, open an issue with the install logs.