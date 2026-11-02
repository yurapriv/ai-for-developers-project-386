$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = '2026.10.25'
$arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
if ($arch -notin @('x64', 'arm64')) { throw "Unsupported architecture: $arch" }
$destination = Join-Path $HOME '.local\bin'
$executable = Join-Path $destination 'mise.exe'
if (Test-Path $executable) {
    & $executable --version
    if ($LASTEXITCODE -ne 0) { throw 'Existing mise could not be executed' }
    Write-Output 'mise already exists; it has not been overwritten. Check its version before continuing.'
    exit 0
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    $name = "mise-v$version-windows-$arch.zip"
    $base = "https://github.com/jdx/mise/releases/download/v$version"
    $zip = Join-Path $temp $name
    Invoke-WebRequest -UseBasicParsing "$base/$name" -OutFile $zip
    $checksums = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content
    if ($checksums -is [byte[]]) { $checksums = [Text.Encoding]::UTF8.GetString($checksums) }
    $line = ($checksums -split "`n" | Where-Object { $_.TrimEnd().EndsWith("./$name") })
    if (@($line).Count -ne 1) { throw 'Expected exactly one release checksum' }
    $expected = ($line -split '\s+')[0]
    if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $expected) { throw 'Checksum mismatch' }
    Expand-Archive $zip -DestinationPath $temp
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Copy-Item (Join-Path $temp 'mise\bin\mise.exe') $destination
    Copy-Item (Join-Path $temp 'mise\bin\mise-shim.exe') $destination
    & $executable --version
    if ($LASTEXITCODE -ne 0) { throw 'mise verification failed' }
    Write-Output "Installed to $destination. PATH and shell profiles were not changed."
} finally {
    Remove-Item -LiteralPath $temp -Recurse -Force
}
