# Installs Coralline from the latest GitHub release, or updates it: run the same line again.
#   powershell -ExecutionPolicy ByPass -c "irm https://raw.githubusercontent.com/onetrickpony1/coralline/main/install.ps1 | iex"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # the progress bar makes Invoke-WebRequest very slow

$repo = 'onetrickpony1/coralline'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\coralline'
$exe = Join-Path $dir 'coralline.exe'

if (Get-Process -Name coralline, japasp -ErrorAction SilentlyContinue) {
	Write-Host "Coralline (or the old jAPAsp) is open. Close it, then run this again."
	return
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('coralline-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
	Write-Host 'Downloading Coralline'
	$zip = Join-Path $tmp 'coralline.zip'
	try {
		Invoke-WebRequest -UseBasicParsing "https://github.com/$repo/releases/latest/download/coralline-windows-x86_64.zip" -OutFile $zip
	} catch {
		Write-Host "Couldn't download Coralline. Check your internet connection. If it works, there may be no release yet: see https://github.com/$repo/releases"
		return
	}
	Expand-Archive -Path $zip -DestinationPath $tmp -Force
	New-Item -ItemType Directory -Force -Path $dir | Out-Null
	Copy-Item (Join-Path $tmp 'coralline.exe') $exe -Force
} finally {
	Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

# Up to 0.1.0 the app was called jAPAsp: remove that install, its shortcut and its PATH entry.
# Its settings move over when Coralline starts.
$oldDir = Join-Path $env:LOCALAPPDATA 'Programs\japasp'
if (Test-Path (Join-Path $oldDir 'japasp.exe')) {
	Remove-Item (Join-Path $oldDir 'japasp.exe') -Force -ErrorAction SilentlyContinue
	Remove-Item $oldDir -ErrorAction SilentlyContinue  # only if nothing else is in it
	Remove-Item (Join-Path ([Environment]::GetFolderPath('Programs')) 'jAPAsp.lnk') -Force -ErrorAction SilentlyContinue
	$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
	if ($userPath) {
		[Environment]::SetEnvironmentVariable('Path', (($userPath -split ';') | Where-Object { $_ -and $_ -ne $oldDir }) -join ';', 'User')
	}
	Write-Host 'Removed the old jAPAsp install'
}

# Start menu shortcut
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Coralline.lnk'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = $exe
$link.WorkingDirectory = $dir
$link.Description = 'Copy JASP tables as APA 7 tables'
$link.Save()

# Lets you type "coralline" in a new terminal
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (($path -split ';') -contains $dir)) {
	[Environment]::SetEnvironmentVariable('Path', ($(if ($path) { "$path;$dir" } else { $dir })), 'User')
}

Write-Host "Installed Coralline in $dir"
Write-Host 'Start it from the Start menu.'
