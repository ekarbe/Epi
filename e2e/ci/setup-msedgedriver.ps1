# Epi - Local-first Meeting Intelligence
# Copyright (C) 2026  Eike Christian Karbe
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

# Provides the Microsoft Edge WebDriver (msedgedriver.exe) that tauri-driver
# needs on Windows to drive the app's WebView2.
#
# msedgedriver only accepts a browser of its own major version, and the
# "browser" here is the WebView2 Runtime the app runs on, which updates
# independently of the Edge browser (and of the driver GitHub preinstalls
# for Edge in C:\SeleniumWebDrivers\EdgeDriver). So the script:
#
#   1. reads the installed WebView2 Runtime version from the registry (falls
#      back to the Edge browser's version, with a warning, if there is none),
#   2. downloads the driver of exactly that version from Microsoft's driver
#      host, or else the newest driver of the same major version,
#   3. if both downloads fail, uses the runner's preinstalled driver
#      ($env:EDGEWEBDRIVER) when its major version matches,
#   4. checks that the driver is signed by Microsoft and prints its version,
#   5. writes its path to EPI_E2E_NATIVE_DRIVER in $env:GITHUB_ENV (read by
#      e2e/ui/wdio.conf.mjs, which passes it to tauri-driver --native-driver)
#      and prints it.
#
# The Tauri docs install a matching driver with msedgedriver-tool (built from
# an unpinned git repository); this script does the same version match
# without building a tool, matches the WebView2 Runtime instead of the
# browser, and verifies the driver's signature.
#
# Runs in Windows PowerShell 5.1 and PowerShell 7. The driver is stored in
# $env:EPI_E2E_WORK_DIR (default: a folder in the temp directory).
#
# Sources:
#   Tauri WebDriver on Windows: https://v2.tauri.app/develop/tests/webdriver/
#   WebView2 Runtime detection (registry key and "pv" value):
#     https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution#detect-if-a-webview2-runtime-is-already-installed
#   Driver downloads (https://msedgedriver.microsoft.com/<version>/edgedriver_win64.zip,
#     LATEST_RELEASE_<major>_WINDOWS):
#     https://developer.microsoft.com/microsoft-edge/tools/webdriver/
#   Preinstalled drivers on GitHub runners (EDGEWEBDRIVER):
#     https://github.com/actions/runner-images (Windows image readme, "Browsers and Drivers")

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$DriverHost = 'https://msedgedriver.microsoft.com'
$WorkDir = if ($env:EPI_E2E_WORK_DIR) { $env:EPI_E2E_WORK_DIR } else { Join-Path $env:TEMP 'epi-e2e-audio' }
$DriverDir = Join-Path $WorkDir 'msedgedriver'
New-Item -ItemType Directory -Force -Path $DriverDir | Out-Null

function Log([string]$Message) { Write-Host "[setup-msedgedriver] $Message" }

# Returns the version ("pv") of the WebView2 Runtime, or $null. The key is
# under WOW6432Node for a per-machine install on 64-bit Windows, under
# HKCU for a per-user install. "0.0.0.0" or an empty value means removed.
function Get-WebView2Version {
    $client = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    $keys = @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$client",
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$client",
        "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$client"
    )
    foreach ($key in $keys) {
        $pv = (Get-ItemProperty -Path $key -Name pv -ErrorAction SilentlyContinue).pv
        if ($pv -and $pv -ne '0.0.0.0') { return $pv }
    }
    return $null
}

# Returns the Edge browser's version, or $null.
function Get-EdgeVersion {
    foreach ($dir in ${env:ProgramFiles(x86)}, $env:ProgramFiles) {
        if (-not $dir) { continue }
        $exe = Join-Path $dir 'Microsoft\Edge\Application\msedge.exe'
        if (Test-Path $exe) { return (Get-Item $exe).VersionInfo.ProductVersion }
    }
    return $null
}

# Returns the version printed by `msedgedriver.exe --version`
# ("Microsoft Edge WebDriver 131.0.2903.70 (<hash>)"), or $null.
function Get-DriverVersion([string]$Exe) {
    try { $out = (& $Exe --version | Out-String) } catch { return $null }
    if ($out -match '(\d+\.\d+\.\d+\.\d+)') { return $Matches[1] }
    return $null
}

# Downloads the driver zip of $Version and returns the path of the extracted
# msedgedriver.exe, or $null if there is no such download.
function Get-Driver([string]$Version) {
    $zip = Join-Path $DriverDir "edgedriver_win64_$Version.zip"
    $dest = Join-Path $DriverDir $Version
    try {
        Log "Downloading $DriverHost/$Version/edgedriver_win64.zip"
        Invoke-WebRequest -Uri "$DriverHost/$Version/edgedriver_win64.zip" -OutFile $zip -UseBasicParsing
    } catch {
        Log "No driver download for $Version ($($_.Exception.Message))"
        return $null
    }
    Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force
    $exe = Get-ChildItem -Path $dest -Recurse -Filter 'msedgedriver.exe' | Select-Object -First 1
    if (-not $exe) { throw "msedgedriver.exe is missing in the download of $Version" }
    return $exe.FullName
}

# Returns the newest driver version of major version $Major, or $null. The
# LATEST_RELEASE_* files are UTF-16 text with a byte order mark, which
# ReadAllText detects.
function Get-LatestDriverVersion([string]$Major) {
    $file = Join-Path $DriverDir "LATEST_RELEASE_$Major"
    try {
        Invoke-WebRequest -Uri "$DriverHost/LATEST_RELEASE_${Major}_WINDOWS" -OutFile $file -UseBasicParsing
    } catch {
        Log "No latest driver for major version $Major ($($_.Exception.Message))"
        return $null
    }
    $text = [IO.File]::ReadAllText($file).Trim()
    if ($text -match '^\d+\.\d+\.\d+\.\d+$') { return $text }
    return $null
}

# 1. Version to match.
$version = Get-WebView2Version
if ($version) {
    Log "WebView2 Runtime $version"
} else {
    $version = Get-EdgeVersion
    if (-not $version) { throw 'Neither the WebView2 Runtime nor Microsoft Edge is installed' }
    Write-Warning "No WebView2 Runtime found in the registry; matching the Edge browser ($version)"
}
$major = $version.Split('.')[0]

# 2. Exact version, else the newest of the same major version.
$driver = Get-Driver $version
if (-not $driver) {
    $latest = Get-LatestDriverVersion $major
    if ($latest) { $driver = Get-Driver $latest }
}

# 3. The runner's preinstalled driver, if it fits.
if (-not $driver -and $env:EDGEWEBDRIVER) {
    $pre = Join-Path $env:EDGEWEBDRIVER 'msedgedriver.exe'
    if (Test-Path $pre) {
        $preVersion = Get-DriverVersion $pre
        if ($preVersion -and $preVersion.Split('.')[0] -eq $major) {
            Log "Using the preinstalled driver $pre ($preVersion)"
            $driver = $pre
        } else {
            Log "The preinstalled driver $pre ($preVersion) does not match major version $major"
        }
    }
}
if (-not $driver) { throw "No msedgedriver for WebView2 $version could be found" }

# 4. Only run a driver that Microsoft signed.
$signature = Get-AuthenticodeSignature -FilePath $driver
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notlike '*O=Microsoft Corporation*') {
    throw "msedgedriver.exe is not validly signed by Microsoft (status $($signature.Status), signer $($signature.SignerCertificate.Subject))"
}
$driverVersion = Get-DriverVersion $driver
Log "msedgedriver $driverVersion at $driver"
if (-not $driverVersion -or $driverVersion.Split('.')[0] -ne $major) {
    throw "msedgedriver $driverVersion does not match WebView2 major version $major"
}

# 5. Hand the path to later CI steps. AppendAllText writes UTF-8 without a
#    byte order mark, which GITHUB_ENV needs (Out-File in Windows PowerShell
#    would write UTF-16).
if ($env:GITHUB_ENV) {
    [IO.File]::AppendAllText($env:GITHUB_ENV, "EPI_E2E_NATIVE_DRIVER=$driver`n")
    Log 'Set EPI_E2E_NATIVE_DRIVER for the following steps'
}
Write-Output $driver
