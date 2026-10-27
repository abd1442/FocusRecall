# Run only INSIDE a disposable Windows VM. Never run on the development host.
param([switch]$DisposableMachine,[ValidateSet('Install','Upgrade','Reinstall')][string]$Phase='Install',[Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference='Stop'
if(-not $DisposableMachine){throw 'Requires explicit -DisposableMachine in a disposable VM.'}
$model=(Get-CimInstance Win32_ComputerSystem).Model
if($model -notmatch 'Virtual|VMware|KVM|HVM|QEMU'){throw 'Disposable virtual machine not detected. Do not run on the host.'}
$qaRoot='C:\FocusRecall-Install-QA'
$marker=Join-Path $qaRoot 'DISPOSABLE-FICTIONAL.txt'
if($Phase -eq 'Install'){
 if(Test-Path -LiteralPath $qaRoot){throw 'Use a fresh VM snapshot for Install.'}
 New-Item -ItemType Directory -Path $qaRoot | Out-Null
 Set-Content -LiteralPath $marker -Value 'FocusRecall disposable fictional install only'
 New-Item -ItemType Directory -Path (Join-Path $qaRoot 'data') | Out-Null
}else{
 if(-not(Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -ne 'FocusRecall disposable fictional install only'){throw 'Missing disposable fixture marker.'}
}
$env:FOCUSRECALL_DATA_DIR=Join-Path $qaRoot 'data'
$env:LEARNALYT_DATA_DIR=$env:FOCUSRECALL_DATA_DIR
$env:TRIFOCUS_DATA_DIR=$env:FOCUSRECALL_DATA_DIR
$installDir=Join-Path $qaRoot 'app'
$setup=(Resolve-Path -LiteralPath $Installer).Path
if([IO.Path]::GetExtension($setup) -ne '.exe'){throw 'Expected installer executable.'}
# Never kill any running application. Installer itself refuses active study processes.
if($Phase -ne 'Install'){
 Get-ChildItem -LiteralPath $env:FOCUSRECALL_DATA_DIR -Filter '*.db' | ForEach-Object {
  Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
 } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $qaRoot ($Phase+'-before-databases.json'))
}
$process=Start-Process -FilePath $setup -ArgumentList @('/S','/currentuser','/no-desktop-shortcut',"/D=$installDir") -WindowStyle Hidden -Wait -PassThru
if($process.ExitCode -ne 0){throw "Installer failed: $($process.ExitCode)"}
$executable=Join-Path $installDir 'FocusRecall.exe'
if(-not(Test-Path -LiteralPath $executable)){throw 'Installed executable missing.'}
# Normal production startup: no inspector/debugging switches.
$app=Start-Process -FilePath $executable -WindowStyle Hidden -PassThru
@{phase=$Phase;status='awaiting manual sentinel/workflow verification';installerSHA256=(Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash;pid=$app.Id} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $qaRoot ($Phase+'-stage.json'))
Write-Output 'No installation certification is inferred from exit code alone.'
Write-Output 'Create/check fictional sessions, notes, recall, settings, title rules and backup; quit through tray before continuing.'
Write-Output 'For upgrade: first Install an older installer, create sentinels, quit, then invoke Phase Upgrade with the candidate.'
Write-Output 'Uninstall manually using the registered uninstaller; never pass a delete-data switch. Check retained DB and removed shortcuts/binaries, then Phase Reinstall and compare sentinels.'
Write-Output 'Use the manual checklist for interactive installer languages, shortcuts, SmartScreen and default/legacy profiles. This override tests the isolated profile only.'
