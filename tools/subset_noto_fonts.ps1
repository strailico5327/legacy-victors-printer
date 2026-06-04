$ErrorActionPreference = "Stop"

# Always run from blog root

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "Blog root: $Root"
Write-Host ""

$Python = "py"
$PythonVersion = "-3.13"

$ExtractScript = "tools/extract_noto_chars.py"
$CharFile = "tools/noto-chars.txt"
$FontFaceFile = "themes/vivia/source/css/_fonts.styl"

$Fonts = @(
@{
Name = "Noto Serif JP"
Source = "fonts/noto_serif_jp/NotoSerifJP-VariableFont_wght.ttf"
OutDir = "themes/vivia/source/fonts/noto_serif_jp"
BaseName = "NotoSerifJP-subset"
CssDir = "/fonts/noto_serif_jp"
},
@{
Name = "Noto Serif KR"
Source = "fonts/noto_serif_kr/NotoSerifKR-VariableFont_wght.ttf"
OutDir = "themes/vivia/source/fonts/noto_serif_kr"
BaseName = "NotoSerifKR-subset"
CssDir = "/fonts/noto_serif_kr"
},
@{
Name = "Noto Serif SC"
Source = "fonts/noto_serif_sc/NotoSerifSC-VariableFont_wght.ttf"
OutDir = "themes/vivia/source/fonts/noto_serif_sc"
BaseName = "NotoSerifSC-subset"
CssDir = "/fonts/noto_serif_sc"
},
@{
Name = "Noto Serif TC"
Source = "fonts/noto_serif_tc/NotoSerifTC-VariableFont_wght.ttf"
OutDir = "themes/vivia/source/fonts/noto_serif_tc"
BaseName = "NotoSerifTC-subset"
CssDir = "/fonts/noto_serif_tc"
}
)

Write-Host "Checking required files..."

if (!(Test-Path "source")) {
throw "source/ not found."
}

if (!(Test-Path $ExtractScript)) {
throw "$ExtractScript not found."
}

if (!(Test-Path $FontFaceFile)) {
throw "$FontFaceFile not found."
}

foreach ($Font in $Fonts) {
if (!(Test-Path $Font["Source"])) {
throw "Source font not found: $($Font["Source"])"
}
}

Write-Host "OK."
Write-Host ""

Write-Host "Extracting CJK characters from source/..."
& $Python $PythonVersion $ExtractScript
if ($LASTEXITCODE -ne 0) {
throw "Character extraction failed."
}
Write-Host ""

if (!(Test-Path $CharFile)) {
throw "$CharFile was not generated."
}

Write-Host "Generating Noto Serif subset fonts..."
Write-Host ""

$Results = @()

foreach ($Font in $Fonts) {
Write-Host "Subsetting $($Font["Name"])..."

$OutDir = $Font["OutDir"]
if (!(Test-Path $OutDir)) {
New-Item -ItemType Directory -Force $OutDir | Out-Null
}

$RawOut = Join-Path $OutDir "$($Font["BaseName"]).woff2"

$SubsetArgs = @(
$Font["Source"],
"--text-file=$CharFile",
"--flavor=woff2",
"--output-file=$RawOut",
"--no-hinting",
"--no-recalc-timestamp"
)

& $Python $PythonVersion -m fontTools.subset @SubsetArgs
if ($LASTEXITCODE -ne 0) {
throw "Font subsetting failed: $($Font["Name"])"
}

if (!(Test-Path $RawOut)) {
throw "Failed to generate: $RawOut"
}

$Hash = ((Get-FileHash -Algorithm SHA256 -Path $RawOut).Hash.Substring(0, 8)).ToLowerInvariant()
$HashedFileName = "$($Font["BaseName"])-$Hash.woff2"
$HashedOut = Join-Path $OutDir $HashedFileName

$RawOutFull = (Resolve-Path $RawOut).Path
$HashedOutFull = Join-Path (Resolve-Path $OutDir).Path $HashedFileName
[System.IO.File]::Copy($RawOutFull, $HashedOutFull, $true)

$Results += @{
Name = $Font["Name"]
BaseName = $Font["BaseName"]
CssDir = $Font["CssDir"]
HashedFileName = $HashedFileName
Output = $HashedOut
}
}

Write-Host ""
Write-Host "Updating @font-face URLs..."

$FontFacePath = (Resolve-Path $FontFaceFile).Path
$FontFaceContent = [System.IO.File]::ReadAllText($FontFacePath, [System.Text.Encoding]::UTF8)
$UpdatedFontFaceContent = $FontFaceContent

foreach ($Result in $Results) {
$UrlPattern = 'url\("{0}/{1}(-[0-9a-fA-F]{{8}})?\.woff2"\)' -f `
[regex]::Escape($Result["CssDir"]), `
[regex]::Escape($Result["BaseName"])

$NewUrl = 'url("{0}/{1}")' -f $Result["CssDir"], $Result["HashedFileName"]

if (!([regex]::IsMatch($UpdatedFontFaceContent, $UrlPattern))) {
throw "Could not find @font-face URL for $($Result["Name"]) in $FontFaceFile"
}

$UpdatedFontFaceContent = [regex]::Replace($UpdatedFontFaceContent, $UrlPattern, $NewUrl)
}

if ($UpdatedFontFaceContent -ne $FontFaceContent) {
$Utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllText($FontFacePath, $UpdatedFontFaceContent, $Utf8NoBom)
}

Write-Host ""
Write-Host "Subset font outputs:"
Write-Host ""

foreach ($Result in $Results) {
$Item = Get-Item $Result["Output"]
$SizeKB = "{0:N2}" -f ($Item.Length / 1KB)
Write-Host "$($Result["Name"]): $SizeKB KB -> $($Result["Output"])"
}

Write-Host ""
Write-Host "Done. Now run: hexo clean; hexo generate"