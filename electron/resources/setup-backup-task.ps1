# PowerShell Script to register automated SQL Server backups in Windows Task Scheduler
# Must be executed with Administrator privileges

$BackupDir = "C:\FeesTrackerBackup"
$BackupScriptPath = "$BackupDir\backup_runner.ps1"
$ConfigPath = "$env:APPDATA\Orient Fees Tracker\db-config.json"

# 1. Create the backup directory
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# 2. Write the backup runner script
# This script reads db-config.json dynamically to retrieve connection details
$BackupRunnerContent = @"
# Automated database backup script
# Reads connection configurations dynamically from AppData

`$ConfigPath = "$ConfigPath"
`$BackupFolder = "$BackupDir\Database_Backups"

if (!(Test-Path `$ConfigPath)) {
    Write-Error "Database configuration file not found at `$ConfigPath"
    exit 1
}

# Load database config details
`$Config = Get-Content `$ConfigPath | ConvertFrom-Json

`$Server = `$Config.server
`$Port = `$Config.port
`$Database = `$Config.database
`$User = `$Config.user
`$Password = `$Config.password

# Ensure backup destination folder exists
if (!(Test-Path `$BackupFolder)) {
    New-Item -ItemType Directory -Path `$BackupFolder -Force | Out-Null
}

# Date format for the filename
`$Date = Get-Date -Format "yyyy-MM-dd_HHmmss"
`$BackupFile = "`$BackupFolder\`$(`$Database)_`$Date.bak"

# SQL Backup Query
`$SqlQuery = "BACKUP DATABASE [`$Database] TO DISK = N'`$BackupFile' WITH INIT, COPY_ONLY, SKIP, NOREWIND, NOUNLOAD, STATS = 10"

# Execute native sqlcmd (common on SSMS server installations)
sqlcmd -S "`$Server,`$Port" -U "`$User" -P "`$Password" -Q "`$SqlQuery" -C

# Cleanup backups older than 7 days
Get-ChildItem -Path `$BackupFolder -Filter *.bak | 
    Where-Object { `$_.LastWriteTime -lt (Get-Date).AddDays(-7) } | 
    Remove-Item -Force
"@

Set-Content -Path $BackupScriptPath -Value $BackupRunnerContent -Encoding UTF8

# 3. Create and Register the Windows Scheduled Task (Runs Daily at 2:00 PM)
$TaskName = "Orient Fees Tracker Backup"
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$BackupScriptPath`""
$Trigger = New-ScheduledTaskTrigger -Daily -At "2:00 PM"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Check if task already exists, delete it if so
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Register the new task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -User "NT AUTHORITY\SYSTEM" -RunLevel Highest | Out-Null

Write-Host "Scheduled task '$TaskName' registered successfully."
