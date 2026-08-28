# 生成方向 B 图标候选：8 色街机环（maimai 机台意象）
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

# 背景：深紫黑圆角矩形 + 对角微渐变
$bgPath = New-RoundedRectPath 1024 1024 224
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)),
  [System.Drawing.Color]::FromArgb(255, 27, 27, 51),
  [System.Drawing.Color]::FromArgb(255, 12, 12, 24),
  35.0)
$g.FillPath($bgBrush, $bgPath)
$bgBrush.Dispose()
$bgPath.Dispose()

# 8 色分段环（maimai 机台 8 分区意象），留 3 度缝隙
$colors = @(
  @(255, 45, 120), @(255, 122, 69), @(255, 209, 102), @(61, 214, 140),
  @(0, 212, 255), @(77, 124, 255), @(138, 92, 255), @(217, 77, 255)
)
$cx = 512.0; $cy = 512.0; $R = 300.0; $thick = 88.0; $gap = 7.0
for ($i = 0; $i -lt 8; $i++) {
  $c = $colors[$i]
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, $c[0], $c[1], $c[2]), [float]$thick)
  $start = -90 + 22.5 + $i * 45 + $gap / 2
  $g.DrawArc($pen, [float]($cx - $R), [float]($cy - $R), [float](2 * $R), [float](2 * $R), [float]$start, [float](45 - $gap))
  $pen.Dispose()
}

# 环心：深色内圆 + 粉青渐变核心圆点
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
$bmp.Save("design-candidates\icon-b-ring.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "saved design-candidates\icon-b-ring.png"
