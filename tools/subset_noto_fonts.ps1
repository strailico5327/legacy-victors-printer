$ErrorActionPreference = "Stop"

# Always run from blog root

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "Blog root: $Root"
Write-Host ""

$Python = "py"
$PythonVersion = "-3.14"

$ExtractScript = "tools/extract_noto_chars.py"
$CharFile = "tools/noto-chars.txt"

$Fonts = @(
@{
Name = "Noto Serif JP"
Source = "fonts/noto_serif_jp/NotoSerifJP-VariableFont_wght.ttf"
ThemeOut = "themes/vivia/source/fonts/noto_serif_jp/NotoSerifJP-subset.woff2"
PublicOut = "public/fonts/noto_serif_jp/NotoSerifJP-subset.woff2"
},
@{
Name = "Noto Serif KR"
Source = "fonts/noto_serif_kr/NotoSerifKR-VariableFont_wght.ttf"
ThemeOut = "themes/vivia/source/fonts/noto_serif_kr/NotoSerifKR-subset.woff2"
PublicOut = "public/fonts/noto_serif_kr/NotoSerifKR-subset.woff2"
},
@{
Name = "Noto Serif SC"
Source = "fonts/noto_serif_sc/NotoSerifSC-VariableFont_wght.ttf"
ThemeOut = "themes/vivia/source/fonts/noto_serif_sc/NotoSerifSC-subset.woff2"
PublicOut = "public/fonts/noto_serif_sc/NotoSerifSC-subset.woff2"
},
@{
Name = "Noto Serif TC"
Source = "fonts/noto_serif_tc/NotoSerifTC-VariableFont_wght.ttf"
ThemeOut = "themes/vivia/source/fonts/noto_serif_tc/NotoSerifTC-subset.woff2"
PublicOut = "public/fonts/noto_serif_tc/NotoSerifTC-subset.woff2"
}
)

Write-Host "Checking required files..."

if (!(Test-Path "public")) {
throw "public/ not found. Run 'hexo clean && hexo g' first."
}

if (!(Test-Path $ExtractScript)) {
throw "$ExtractScript not found."
}

foreach ($Font in $Fonts) {
if (!(Test-Path $Font["Source"])) {
throw "Source font not found: $($Font["Source"])"
}
}

Write-Host "OK."
Write-Host ""

Write-Host "Extracting characters from public HTML..."
& $Python $PythonVersion $ExtractScript
Write-Host ""

if (!(Test-Path $CharFile)) {
throw "$CharFile was not generated."
}

Write-Host "Generating Noto Serif subset fonts..."
Write-Host ""

foreach ($Font in $Fonts) {
Write-Host "Subsetting $($Font["Name"])..."

$ThemeOutDir = Split-Path -Parent $Font["ThemeOut"]
if (!(Test-Path $ThemeOutDir)) {
New-Item -ItemType Directory -Force $ThemeOutDir | Out-Null
}

$SubsetArgs = @(
$Font["Source"],
"--text-file=$CharFile",
"--flavor=woff2",
"--output-file=$($Font["ThemeOut"])",
"--no-hinting"
)

& $Python $PythonVersion -m fontTools.subset @SubsetArgs

if (!(Test-Path $Font["ThemeOut"])) {
throw "Failed to generate: $($Font["ThemeOut"])"
}

$PublicOutDir = Split-Path -Parent $Font["PublicOut"]
if (!(Test-Path $PublicOutDir)) {
New-Item -ItemType Directory -Force $PublicOutDir | Out-Null
}

Copy-Item $Font["ThemeOut"] $Font["PublicOut"] -Force

if (!(Test-Path $Font["PublicOut"])) {
throw "Failed to copy to public: $($Font["PublicOut"])"
}
}

Write-Host ""
Write-Host "Subset font sizes:"
Write-Host ""

foreach ($Font in $Fonts) {
$ThemeItem = Get-Item $Font["ThemeOut"]
$PublicItem = Get-Item $Font["PublicOut"]

$ThemeSizeKB = "{0:N2}" -f ($ThemeItem.Length / 1KB)
$PublicSizeKB = "{0:N2}" -f ($PublicItem.Length / 1KB)

Write-Host "$($Font["Name"]):"
Write-Host "  theme:  $ThemeSizeKB KB -> $($Font["ThemeOut"])"
Write-Host "  public: $PublicSizeKB KB -> $($Font["PublicOut"])"
}

Write-Host ""
Write-Host "Done. public/ has been updated. You can now run: hexo d"
