# Installs jAPAsp from the latest GitHub release, or updates it: run the same line again.
#   powershell -ExecutionPolicy ByPass -c "irm https://raw.githubusercontent.com/onetrickpony1/jAPAsp/main/install.ps1 | iex"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # the progress bar makes Invoke-WebRequest very slow

$repo = 'onetrickpony1/jAPAsp'
$dir = Join-Path $env:LOCALAPPDATA 'Programs\japasp'
$exe = Join-Path $dir 'japasp.exe'

if (Get-Process -Name japasp -ErrorAction SilentlyContinue) {
	Write-Host 'jAPAsp is open. Close it, then run this again.'
	return
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('japasp-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
	Write-Host 'Downloading jAPAsp'
	$zip = Join-Path $tmp 'japasp.zip'
	Invoke-WebRequest -UseBasicParsing "https://github.com/$repo/releases/latest/download/japasp-windows-x86_64.zip" -OutFile $zip
	Expand-Archive -Path $zip -DestinationPath $tmp -Force
	New-Item -ItemType Directory -Force -Path $dir | Out-Null
	Copy-Item (Join-Path $tmp 'japasp.exe') $exe -Force
} finally {
	Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

# Start menu shortcut
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'jAPAsp.lnk'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = $exe
$link.WorkingDirectory = $dir
$link.Description = 'Copy JASP tables as APA 7 tables'
$link.Save()

# Lets you type "japasp" in a new terminal
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (($path -split ';') -contains $dir)) {
	[Environment]::SetEnvironmentVariable('Path', ($(if ($path) { "$path;$dir" } else { $dir })), 'User')
}

Write-Host "Installed jAPAsp in $dir"
Write-Host 'Start it from the Start menu.'
