# monochrome：白色环形剪影（透明底），Android 13+ 主题图标遮罩用
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
$cx = 512.0; $cy = 512.0; $R = 300.0; $thick = 88.0
for ($i = 0; $i -lt 8; $i++) {
  $pen = New-Object System.Drawing.Pen($white, [float]$thick)
  $start = -90 + $i * 45 + 3.5
  $g.DrawArc($pen, $cx - $R, $cy - $R, 2 * $R, 2 * $R, [float]$start, 38.0)
  $pen.Dispose()
}
$inner = New-Object System.Drawing.SolidBrush($white)
$g.FillEllipse($inner, $cx - 250, $cy - 250, 500.0, 500.0)
# 打孔：内盘中心挖空成环（主题图标只留描边形状更干净）
$transparent = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.FillEllipse($transparent, $cx - 190, $cy - 190, 380.0, 380.0)
$g.Dispose()
$bmp.Save('assets\android-icon-monochrome.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'assets/android-icon-monochrome.png'
