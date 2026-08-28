# 方向 B v2：8 色分段环旋转 22.5°，接缝落在 12/6 点竖直线上（左右各 4 分区，模拟真机）
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

$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.PixelOffsetMode = 'HighQuality'

$bgPath = New-RoundedRectPath 1024 1024 224
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)),
  [System.Drawing.Color]::FromArgb(255, 27, 27, 51),
  [System.Drawing.Color]::FromArgb(255, 12, 12, 24),
  35.0)
$g.FillPath($bgBrush, $bgPath)
$bgBrush.Dispose()
$bgPath.Dispose()

# 8 色分段：v1 的相位 +22.5 改为 -22.5 → 分段边界（接缝）落在 -90(12点)、-45、0(3点)、45、90(6点)… 每 45° 一道，
# 正上/正下为竖直分缝，左半 4 段、右半 4 段。
$colors = @(
  @(255, 45, 120), @(255, 122, 69), @(255, 209, 102), @(61, 214, 140),
  @(0, 212, 255), @(77, 124, 255), @(138, 92, 255), @(217, 77, 255)
)
$cx = 512.0; $cy = 512.0; $R = 300.0; $thick = 88.0; $gap = 7.0
for ($i = 0; $i -lt 8; $i++) {
  $c = $colors[$i]
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, $c[0], $c[1], $c[2]), [float]$thick)
  $start = -90 + $i * 45 + $gap / 2
  $g.DrawArc($pen, [float]($cx - $R), [float]($cy - $R), [float](2 * $R), [float](2 * $R), [float]$start, [float](45 - $gap))
  $pen.Dispose()
}

$inner = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 20, 40))
$g.FillEllipse($inner, [float]($cx - 250), [float]($cy - 250), 500.0, 500.0)
$inner.Dispose()

$coreRect = New-Object System.Drawing.Rectangle(448, 448, 128, 128)
$core = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $coreRect,
  [System.Drawing.Color]::FromArgb(255, 255, 45, 120),
  [System.Drawing.Color]::FromArgb(255, 0, 212, 255),
  45.0)
$g.FillEllipse($core, $coreRect)
$core.Dispose()

$g.Dispose()
$bmp.Save("design-candidates\icon-b-ring-v2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "saved design-candidates\icon-b-ring-v2.png"
