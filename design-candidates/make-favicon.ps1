# 48px favicon：环形图形缩绘
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(48, 48)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
$colors = @(
  @(255, 45, 120), @(255, 122, 69), @(255, 209, 102), @(61, 214, 140),
  @(0, 212, 255), @(77, 124, 255), @(138, 92, 255), @(217, 77, 255)
)
$cx = 24.0; $cy = 24.0; $R = 15.0; $thick = 5.0
for ($i = 0; $i -lt 8; $i++) {
  $c = $colors[$i]
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, $c[0], $c[1], $c[2]), [float]$thick)
  $start = -90 + $i * 45 + 1.0
  $g.DrawArc($pen, $cx - $R, $cy - $R, 2 * $R, 2 * $R, [float]$start, 38.0)
  $pen.Dispose()
}
$inner = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 20, 40))
$g.FillEllipse($inner, $cx - 11.5, $cy - 11.5, 23.0, 23.0)
$inner.Dispose()
$coreRect = New-Object System.Drawing.Rectangle(21, 21, 6, 6)
$core = New-Object System.Drawing.Drawing2D.LinearGradientBrush($coreRect, [System.Drawing.Color]::FromArgb(255, 255, 45, 120), [System.Drawing.Color]::FromArgb(255, 0, 212, 255), 45.0)
$g.FillEllipse($core, $coreRect)
$core.Dispose()
$g.Dispose()
$bmp.Save('assets\favicon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'assets/favicon.png'
