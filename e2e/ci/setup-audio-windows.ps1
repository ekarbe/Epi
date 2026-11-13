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

# Sets up a virtual audio environment for the end-to-end tests on a headless
# Windows machine (GitHub-hosted windows-latest runner, i.e. Windows Server):
#
#   CABLE Input   playback endpoint of VB-Audio Virtual Cable (the "speaker");
#                 recent Windows versions name it "Speakers (VB-Audio Virtual
#                 Cable)", so it is matched as any cable endpoint that is not
#                 CABLE Output
#   CABLE Output  capture endpoint of the same cable (the "microphone"); it
#                 carries everything played into CABLE Input
#   ffplay        plays a continuous test tone (EPI_E2E_TONE_HZ, default
#                 440 Hz) into the default playback device, CABLE Input
#
# GitHub's Windows runners have no audio hardware, so without a virtual
# device WASAPI reports no endpoints at all.
#
# Why this exact driver: current VB-CABLE packs (e.g. pack 45) ship a Windows
# 10 driver that is only attestation-signed by Microsoft, which Windows Server
# does not load. Pack 43 also ships the older "win7" driver, signed by the
# author (Vincent Burel) with a cross-signed code signing certificate from
# before 2015, which 64-bit Windows Server still accepts when Secure Boot is
# off (as on GitHub's runners). Installing it silently needs two things the
# VB-CABLE setup program does not do non-interactively:
#   * its signing certificate in the machine's TrustedPublisher store, so
#     Windows does not show the "Would you like to install this device
#     software?" dialog (which would block forever on a runner), and
#   * a root-enumerated device node for the driver (hardware id
#     VBAudioVACWDM), created with devcon.exe (pnputil cannot create one).
# This is the approach of LABSN/sound-ci-helpers, which tests it on
# windows-2022 and windows-2025 runners.
#
# Run from an elevated Windows PowerShell 5.1 (GitHub's `shell: powershell`).
# Writes the tone player's log and PID to $env:EPI_E2E_WORK_DIR (default:
# a folder in the temp directory). Stop the tone with:
#   Stop-Process -Id (Get-Content "$env:EPI_E2E_WORK_DIR\tone.pid")
#
# Sources:
#   VB-CABLE:         https://vb-audio.com/Cable/ (driver pack 43)
#   CI approach:      https://github.com/LABSN/sound-ci-helpers (windows/)
#   Untrusted publisher dialog:
#     https://support.microsoft.com/help/2921916
#   devcon:           https://learn.microsoft.com/windows-hardware/drivers/devtest/devcon
#   Driver signing on Server:
#     https://learn.microsoft.com/windows-hardware/drivers/dashboard/code-signing-attestation
#   AudioDeviceCmdlets: https://github.com/frgnca/AudioDeviceCmdlets

$ErrorActionPreference = 'Stop'
# Invoke-WebRequest is very slow with its progress bar in Windows PowerShell.
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Pinned downloads. Update URL and hash together; compute a new hash with
#   curl -L -o f <url> && sha256sum f
$VbCableUrl = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip'
$VbCableSha256 = '66FD0A4D9F4896FF41632B7E3D53892C085C4561F53E8AE8D0F0BC10EEDD1CDD'
# SHA-1 thumbprint of the certificate that signs vbaudio_cable64_win7.cat.
# Only this certificate is added to TrustedPublisher.
$VbCableSignerThumbprint = '00859AAC6A54B8C1B3C139DE67846E64E7B82DB2'
# devcon.exe (x64, from the Windows Driver Kit) as redistributed by
# LABSN/sound-ci-helpers, pinned to a commit.
$DevconUrl = 'https://raw.githubusercontent.com/LABSN/sound-ci-helpers/e9d6ba52163a3283714a68412036ddf33f78d49c/windows/devcon.exe'
$DevconSha256 = '97CFF42F8C0FE4FBDF991273159516BF78090625A933C3983EBD6F62284E329A'

$ToneHz = if ($env:EPI_E2E_TONE_HZ) { $env:EPI_E2E_TONE_HZ } else { '440' }
$WorkDir = if ($env:EPI_E2E_WORK_DIR) { $env:EPI_E2E_WORK_DIR } else { Join-Path $env:TEMP 'epi-e2e-audio' }
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

function Log([string]$Message) { Write-Host "[setup-audio-windows] $Message" }

# Downloads $Url to $Path and fails unless its SHA-256 equals $Sha256.
function Get-PinnedFile([string]$Url, [string]$Path, [string]$Sha256) {
    Log "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $Path -UseBasicParsing
    $actual = (Get-FileHash -Algorithm SHA256 -Path $Path).Hash
    if ($actual -ne $Sha256) {
        throw "SHA-256 mismatch for ${Url}: expected $Sha256, got $actual"
    }
}

# Prints the audio endpoints Windows knows about (PnP view).
function Show-Endpoints {
    Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue |
        Format-Table -AutoSize Status, FriendlyName, InstanceId | Out-String -Width 200 | Write-Host
}

# 0. Microphone privacy. WASAPI capture fails with "Access is denied"
#    (E_ACCESSDENIED) while Windows' microphone privacy setting blocks
#    desktop apps, which is the default on the runner image. Allow access
#    for the machine and the current user, for desktop (non-packaged) apps,
#    and through the group policy that would otherwise override both.
$consent = 'SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone'
foreach ($key in "HKLM:\$consent", "HKLM:\$consent\NonPackaged", "HKCU:\$consent", "HKCU:\$consent\NonPackaged") {
    New-Item -Path $key -Force | Out-Null
    Set-ItemProperty -Path $key -Name 'Value' -Value 'Allow' -Type String
}
$policy = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy'
New-Item -Path $policy -Force | Out-Null
# 1 = force allow
Set-ItemProperty -Path $policy -Name 'LetAppsAccessMicrophone' -Value 1 -Type DWord
Log 'Allowed microphone access for desktop apps'

# 1. Windows Audio service. On Server it may be disabled or stopped; WASAPI
#    has no endpoints without it. AudioEndpointBuilder is its dependency.
foreach ($name in 'AudioEndpointBuilder', 'Audiosrv') {
    Log "Enabling and starting service $name"
    Set-Service -Name $name -StartupType Automatic
    Start-Service -Name $name
}
Get-Service AudioEndpointBuilder, Audiosrv | Format-Table -AutoSize Name, Status, StartType | Out-String | Write-Host

# 2. Install VB-CABLE unless an earlier run already did.
$cable = Get-PnpDevice -Class AudioEndpoint -ErrorAction SilentlyContinue |
    Where-Object { $_.FriendlyName -like 'CABLE Output*' }
if ($cable) {
    Log 'VB-CABLE is already installed'
} else {
    $zip = Join-Path $WorkDir 'vbcable.zip'
    $driverDir = Join-Path $WorkDir 'vbcable'
    $devcon = Join-Path $WorkDir 'devcon.exe'
    Get-PinnedFile $VbCableUrl $zip $VbCableSha256
    Get-PinnedFile $DevconUrl $devcon $DevconSha256
    Expand-Archive -LiteralPath $zip -DestinationPath $driverDir -Force

    # 2a. Trust the driver's publisher: take the signing certificate out of
    #     the driver catalog itself (a PKCS#7 file), check that it is the
    #     expected one and add it to TrustedPublisher.
    Add-Type -AssemblyName System.Security
    $catalog = Join-Path $driverDir 'vbaudio_cable64_win7.cat'
    $cms = New-Object System.Security.Cryptography.Pkcs.SignedCms
    $cms.Decode([IO.File]::ReadAllBytes($catalog))
    $signer = $cms.Certificates | Where-Object { $_.Thumbprint -eq $VbCableSignerThumbprint } | Select-Object -First 1
    if (-not $signer) {
        throw "The certificate $VbCableSignerThumbprint was not found in $catalog"
    }
    $cer = Join-Path $WorkDir 'vbcable.cer'
    [IO.File]::WriteAllBytes($cer, $signer.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert))
    Log "Adding $($signer.Subject) to TrustedPublisher"
    & certutil.exe -addstore TrustedPublisher $cer | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "certutil failed with exit code $LASTEXITCODE" }

    # 2b. Create the device node and install the driver on it.
    #     devcon exit codes: 0 = success, 1 = success but reboot required
    #     (the virtual cable works without a reboot), anything else = failure.
    $inf = Join-Path $driverDir 'vbMmeCable64_win7.inf'
    Log "Installing $inf (hardware id VBAudioVACWDM)"
    & $devcon install $inf VBAudioVACWDM | Out-Host
    if ($LASTEXITCODE -gt 1) { throw "devcon install failed with exit code $LASTEXITCODE" }
}

# 3. Wait (bounded) until both cable endpoints are active.
$deadline = (Get-Date).AddSeconds(60)
do {
    $ok = @(Get-PnpDevice -Class AudioEndpoint -Status OK -ErrorAction SilentlyContinue |
        Where-Object { $_.FriendlyName -like '*(VB-Audio Virtual Cable)*' }).Count
    if ($ok -ge 2) { break }
    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)
Show-Endpoints
if ($ok -lt 2) {
    Get-PnpDevice -Class MEDIA -ErrorAction SilentlyContinue | Format-List * | Out-String | Write-Host
    throw 'The VB-CABLE endpoints did not appear (driver not loaded?)'
}

# 4. Make the cable the default playback and recording device. On a machine
#    without other audio devices Windows already does this; on any other it
#    makes the tone below go into the cable. Best effort: a failure only
#    warns, because the endpoints are usually the defaults anyway.
try {
    if (-not (Get-Module -ListAvailable -Name AudioDeviceCmdlets)) {
        Log 'Installing the AudioDeviceCmdlets module'
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
        Install-Module -Name AudioDeviceCmdlets -RequiredVersion 3.1.0.2 -Force -Scope CurrentUser -AllowClobber
    }
    Import-Module AudioDeviceCmdlets
    $devices = Get-AudioDevice -List
    $playback = $devices | Where-Object { $_.Type -eq 'Playback' -and $_.Name -like '*(VB-Audio Virtual Cable)*' } | Select-Object -First 1
    $recording = $devices | Where-Object { $_.Type -eq 'Recording' -and $_.Name -like 'CABLE Output*' } | Select-Object -First 1
    if ($playback) { Set-AudioDevice -ID $playback.ID | Out-Null }
    if ($recording) { Set-AudioDevice -ID $recording.ID | Out-Null }
    Get-AudioDevice -List | Format-Table -AutoSize Index, Default, Type, Name | Out-String -Width 200 | Write-Host
} catch {
    Write-Warning "Could not set the default audio devices: $_"
}

# 5. Play the tone. ffplay (shipped with the ffmpeg package) plays to the
#    default playback device through SDL and runs until stopped. Its log is
#    kept for debugging; the process outlives this script (and the CI step).
$ffplay = Get-Command ffplay.exe -ErrorAction SilentlyContinue
if (-not $ffplay) { throw 'ffplay.exe was not found on PATH (install ffmpeg first)' }
$existing = Join-Path $WorkDir 'tone.pid'
if ((Test-Path $existing) -and (Get-Process -Id (Get-Content $existing) -ErrorAction SilentlyContinue)) {
    Log 'Tone is already playing'
} else {
    Log "Playing a $ToneHz Hz tone into the default playback device"
    $toneArgs = @('-hide_banner', '-nodisp', '-nostats', '-loglevel', 'info', '-f', 'lavfi', "sine=frequency=${ToneHz}:sample_rate=48000")
    $player = Start-Process -FilePath $ffplay.Source -ArgumentList $toneArgs -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $WorkDir 'tone.out.log') `
        -RedirectStandardError (Join-Path $WorkDir 'tone.err.log')
    Set-Content -Path $existing -Value $player.Id
    # Reading the handle once keeps ExitCode available after the process ends.
    $null = $player.Handle

    # The player must still run after a few seconds (it exits at once if it
    # cannot open an audio device).
    $deadline = (Get-Date).AddSeconds(3)
    while ((Get-Date) -lt $deadline -and -not $player.HasExited) { Start-Sleep -Milliseconds 200 }
    Get-Content (Join-Path $WorkDir 'tone.err.log') -ErrorAction SilentlyContinue | Write-Host
    if ($player.HasExited) { throw "ffplay exited with code $($player.ExitCode); see the log above" }
}
Log 'Done'
