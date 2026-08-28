# 从定稿 v2 环形图标生成全套 app 图标资产
# - icon.png: 1024 主图标（含圆角背景，iOS/通用）
# - android-icon-foreground.png: 1024 自适应前景（图形缩至 66% 安全区，透明背景）
# - android-icon-background.png: 1024 自适应背景（纯渐变底）
# - adaptive-icon.png: 1024 兼容入口
# - splash-icon.png: 512 透明底图形（用于启动屏）
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath([float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc(0, 0, $d, $d, 180, 90)
  $p.AddArc($w - $d, 0, $d, $d, 270, 90)
  $p.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
  $p.AddArc(0, $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Draw-Ring([System.Drawing.Graphics]$g, [float]$scale, [float]$offsetX, [float]$offsetY) {
  # scale=1 全幅（icon 用）；前景层用 0.62 缩放居中
  $colors = @(
    @(255, 45, 120), @(255, 122, 69), @(255, 209, 102), @(61, 214, 140),
    @(0, 212, 255), @(77, 124, 255), @(138, 92, 255), @(217, 77, 255)
  )
  $cx = 512 * $scale + $offsetX
  $cy = 512 * $scale + $offsetY
  $R = 300 * $scale
  $thick = 88 * $scale
  $gap = 7.0
  for ($i = 0; $i -lt 8; $i++) {
    $c = $colors[$i]
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, $c[0], $c[1], $c[2]), [float]$thick)
    $start = -90 + $i * 45 + $gap / 2
    $g.DrawArc($pen, $cx - $R, $cy - $R, 2 * $R, 2 * $R, [float]$start, [float](45 - $gap))
    $pen.Dispose()
  }
  $inner = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 20, 40))
  $g.FillEllipse($inner, $cx - 250 * $scale, $cy - 250 * $scale, 500 * $scale, 500 * $scale)
  $inner.Dispose()
  $coreRect = New-Object System.Drawing.Rectangle(
    [int]($cx - 64 * $scale), [int]($cy - 64 * $scale),
    [int](128 * $scale), [int](128 * $scale))
  $core = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $coreRect,
    [System.Drawing.Color]::FromArgb(255, 255, 45, 120),
    [System.Drawing.Color]::FromArgb(255, 0, 212, 255),
    45.0)
  $g.FillEllipse($core, $coreRect)
  $core.Dispose()
}

# 1) icon.png 全幅
$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
$bgPath = New-RoundedRectPath 1024 1024 224
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)),
  [System.Drawing.Color]::FromArgb(255, 27, 27, 51),
  [System.Drawing.Color]::FromArgb(255, 12, 12, 24), 35.0)
$g.FillPath($bgBrush, $bgPath)
Draw-Ring $g 1.0 0 0
$g.Dispose()
$bmp.Save('assets\icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'assets/icon.png'

# 2) android-icon-foreground.png 透明底 + 66% 环
$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
$s = 0.66
$off = (1 - $s) * 512
Draw-Ring $g $s $off $off
$g.Dispose()
$bmp.Save('assets\android-icon-foreground.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'assets/android-icon-foreground.png'

# 3) android-icon-background.png 渐变底（方形，无圆角）
$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$bgBrush2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)),
  [System.Drawing.Color]::FromArgb(255, 27, 27, 51),
  [System.Drawing.Color]::FromArgb(255, 12, 12, 24), 35.0)
$g.FillRectangle($bgBrush2, 0, 0, 1024, 1024)
$bgBrush2.Dispose()
$g.Dispose()
$bmp.Save('assets\android-icon-background.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'assets/android-icon-background.png'

# 4) splash-icon.png 512 透明底环
$bmp = New-Object System.Drawing.Bitmap(512, 512)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.PixelOffsetMode = 'HighQuality'
$gs = $g.ScaleTransform
$g.ScaleTransform(0.5, 0.5)
Draw-Ring $g 1.0 0 0
$g.ResetTransform()
$g.Dispose()
$bmp.Save('assets\splash-icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host 'assets/splash-icon.png'
