# Format export only: downsample the approved PNG, preserving its corner alpha.
param([string]$Source='resources/focusrecall-icon.png',[string]$Output='resources/focusrecall.ico')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$sourceFile=(Resolve-Path -LiteralPath $Source).Path
$image=[Drawing.Image]::FromFile($sourceFile)
$sizes=@(16,20,24,32,40,48,64,128,256)
$frames=@()
try {
 if($image.Width -ne $image.Height){throw 'Icon master must be square.'}
 foreach($size in $sizes){
  $bitmap=New-Object Drawing.Bitmap $size,$size
  $graphics=[Drawing.Graphics]::FromImage($bitmap)
  $stream=New-Object IO.MemoryStream
  try {
   $graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   $graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
   $graphics.DrawImage($image,0,0,$size,$size)
   $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
   $frames+=,@{Size=$size;Bytes=$stream.ToArray()}
  }finally{$stream.Dispose();$graphics.Dispose();$bitmap.Dispose()}
 }
 $result=New-Object IO.MemoryStream
 $writer=New-Object IO.BinaryWriter $result
 try {
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
  $offset=6+16*$frames.Count
  foreach($frame in $frames){
   $dimension=if($frame.Size -eq 256){0}else{$frame.Size}
   $writer.Write([byte]$dimension);$writer.Write([byte]$dimension);$writer.Write([byte]0);$writer.Write([byte]0)
   $writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$frame.Bytes.Length);$writer.Write([uint32]$offset)
   $offset+=$frame.Bytes.Length
  }
  foreach($frame in $frames){$writer.Write([byte[]]$frame.Bytes)}
  $writer.Flush();[IO.File]::WriteAllBytes([IO.Path]::GetFullPath($Output),$result.ToArray())
 }finally{$writer.Dispose();$result.Dispose()}
}finally{$image.Dispose()}
Write-Output ('Exported Windows icon sizes: '+($sizes -join ', '))
