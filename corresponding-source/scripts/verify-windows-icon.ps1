# Read-only checks of icon exports and icons actually embedded in the built EXEs.
param([string]$AppExecutable='dist/a14-pomodoro/win-unpacked/A14Pomodoro.exe',[string]$SetupExecutable='dist/a14-pomodoro/A14-Pomodoro-0.1.5-beta.2-setup.exe')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$iconFile=(Resolve-Path resources/a14-pomodoro.ico).Path
$source=[Drawing.Bitmap]::FromFile((Resolve-Path resources/a14-pomodoro-icon.png).Path)
try {
 if($source.Width -ne $source.Height){throw 'Square icon master required.'}
 foreach($point in @(@(0,0),@(($source.Width-1),0),@(0,($source.Height-1)),@(($source.Width-1),($source.Height-1)))){
  if($source.GetPixel($point[0],$point[1]).A -ne 0){throw 'Rounded icon must have transparent outer corners.'}
 }
}finally{$source.Dispose()}
$bytes=[IO.File]::ReadAllBytes($iconFile)
if([BitConverter]::ToUInt16($bytes,2) -ne 1){throw 'Expected an ICO file.'}
$count=[BitConverter]::ToUInt16($bytes,4)
$sizes=@();for($i=0;$i -lt $count;$i++){ $size=[int]$bytes[6+$i*16];if($size -eq 0){$size=256};$sizes+=$size }
if(($sizes -join ',') -ne '16,20,24,32,40,48,64,128,256'){throw 'Missing Windows icon sizes.'}
$rows=@()
foreach($name in @($AppExecutable,$SetupExecutable)){
 $actual=[Drawing.Icon]::ExtractAssociatedIcon((Resolve-Path -LiteralPath $name).Path)
 $expected=New-Object Drawing.Icon $iconFile,$actual.Width,$actual.Height
 $a=$actual.ToBitmap();$e=$expected.ToBitmap()
 try {
  $different=0
  for($y=0;$y -lt $a.Height;$y++){for($x=0;$x -lt $a.Width;$x++){
   if($a.GetPixel($x,$y).ToArgb() -ne $e.GetPixel($x,$y).ToArgb()){$different++}
  }}
  $rows+=[pscustomobject]@{File=$name;Width=$a.Width;Height=$a.Height;DifferentPixels=$different;MatchesExport=($different -eq 0)}
 }finally{$a.Dispose();$e.Dispose();$actual.Dispose();$expected.Dispose()}
}
$rows | ConvertTo-Json
if(@($rows | Where-Object {-not $_.MatchesExport}).Count){throw 'Embedded Windows icon differs from the export.'}
