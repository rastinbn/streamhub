$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifestPath = Join-Path $PSScriptRoot 'media-manifest.json'
$manifest = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$catDir = Join-Path $root 'apps\web\public\media\categories'
$thumbsDir = Join-Path $root 'apps\web\public\media\thumbnails'
$avatarsDir = Join-Path $root 'apps\web\public\media\avatars'
New-Item -ItemType Directory -Force -Path $thumbsDir | Out-Null

$W = 1280; $H = 720

function RenderStreamThumbnail {
  param($stream)
  $src = Join-Path $catDir "$($stream.cat).jpg"
  if (-not (Test-Path -LiteralPath $src)) { Write-Host "SKIP $($stream.id): missing $src"; return }
  $out = Join-Path $thumbsDir "$($stream.id).jpg"
  $base = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap($W, $H)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Black)
    $bs = $base.Width / $base.Height
    $ts = $W / $H
    if ($bs -gt $ts) {
      $cw = [int]($base.Height * $ts); $ch = $base.Height; $cx = [int](($base.Width - $cw) / 2); $cy = 0
    } else {
      $ch = [int]($base.Width / $ts); $cw = $base.Width; $cx = 0; $cy = [int](($base.Height - $ch) / 2)
    }
    $srcRect = New-Object System.Drawing.Rectangle($cx, $cy, $cw, $ch)
    $dstRect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
    $g.DrawImage($base, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $barH = 140
    $gradRect = New-Object System.Drawing.Rectangle(0, ($H - $barH), $W, $barH)
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($gradRect, [System.Drawing.Color]::FromArgb(215, 8, 8, 10), [System.Drawing.Color]::FromArgb(15, 8, 8, 10), 90.0)
    try { $g.FillRectangle($grad, $gradRect) } finally { $grad.Dispose() }

    $fontSize = if ($stream.title.Length -gt 42) { 28 } else { 34 }
    $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    try {
      $g.DrawString($stream.title, $font, [System.Drawing.Brushes]::White, 40.0, ($H - 104))
    } finally { $font.Dispose() }

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]82)
    $bmp.Save($out, $codec, $params)
    $params.Dispose()
    Write-Host "thumbnail $($stream.id) -> $out"
  } finally {
    $g.Dispose(); $bmp.Dispose(); $base.Dispose()
  }
}

$avatarPalette = @{
  'art'        = [System.Drawing.ColorTranslator]::FromHtml('#d9455f')
  'sports'     = [System.Drawing.ColorTranslator]::FromHtml('#2fb380')
  'food-drink' = [System.Drawing.ColorTranslator]::FromHtml('#e07b2a')
  'movies-tv'  = [System.Drawing.ColorTranslator]::FromHtml('#7c5cff')
  'fitness'    = [System.Drawing.ColorTranslator]::FromHtml('#35b6c9')
}

function RenderAvatar {
  param($username, $cat)
  $out = Join-Path $avatarsDir "$username.png"
  if (Test-Path -LiteralPath $out) { Write-Host "skip avatar $username (exists)"; return }
  $size = 128
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $bg = New-Object System.Drawing.SolidBrush($avatarPalette[$cat])
    try {
      $g.FillEllipse($bg, 0, 0, $size, $size)
    } finally { $bg.Dispose() }
    $initial = $username.Substring(0, 1).ToUpperInvariant()
    $font = New-Object System.Drawing.Font('Segoe UI', 58, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    try {
      $fmt = New-Object System.Drawing.StringFormat
      $fmt.Alignment = [System.Drawing.StringAlignment]::Center
      $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
      $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
      $g.DrawString($initial, $font, [System.Drawing.Brushes]::White, $rect, $fmt)
      $fmt.Dispose()
    } finally { $font.Dispose() }
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "avatar $username -> $out"
  } finally {
    $g.Dispose(); $bmp.Dispose()
  }
}

foreach ($s in $manifest.streams) { RenderStreamThumbnail -stream $s }
foreach ($u in $manifest.avatars.PSObject.Properties) { RenderAvatar -username $u.Name -cat $u.Value }

Write-Host 'Done.'