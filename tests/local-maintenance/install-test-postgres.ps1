#requires -Version 7
param([Parameter(Mandatory)][ValidateSet('17.11','17.12','18.6','18.7')][string]$Version,
  [Parameter(Mandatory)][string]$Destination)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$hashes=@{
  '17.11'='6eabdf00d2893713b75db4336a23c3fdf505f056e217ec6e2e95d901750cfea3'
  '17.12'='a2cd8a774389347b70be7748ac4a37ef43cb6ee539c5fc3e85ae264b15e4a04c'
  '18.6'='fbe23da234ee31547bf8a36d29dfd81e82b849df2d2b78d2eecb43d360252f8c'
  '18.7'='ead0bbc27fb678fa24dcf86b738981323042abd073c744103bf7f3aed23f9a33'
}
$root=[IO.Path]::GetFullPath($Destination)
if(Test-Path -LiteralPath $root){throw 'TEST_POSTGRES_DESTINATION_EXISTS'}
[void](New-Item -ItemType Directory -Path $root)
$archive=Join-Path $root 'postgres.zip'
Invoke-WebRequest -Uri ("https://get.enterprisedb.com/postgresql/postgresql-"+$Version+"-1-windows-x64-binaries.zip") -OutFile $archive -TimeoutSec 180
if((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hashes[$Version]){throw 'TEST_POSTGRES_ARCHIVE_HASH_MISMATCH'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead($archive)
try{
  foreach($entry in $zip.Entries){
    if($entry.FullName -notmatch '^pgsql/(bin|lib|share)/'){continue}
    $target=[IO.Path]::GetFullPath((Join-Path $root $entry.FullName))
    if(-not $target.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'TEST_POSTGRES_ARCHIVE_PATH_UNSAFE'}
    if($entry.FullName.EndsWith('/')){[void](New-Item -ItemType Directory -Path $target -Force);continue}
    [void](New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force)
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$false)
  }
}finally{$zip.Dispose()}
$bin=Join-Path $root 'pgsql/bin'
$actual=(& (Join-Path $bin 'postgres.exe') --version) -join ' '
if($LASTEXITCODE -ne 0 -or $actual -notmatch ('PostgreSQL\) '+[regex]::Escape($Version)+'$')){throw 'TEST_POSTGRES_VERSION_MISMATCH'}
Write-Output ("TEST_POSTGRES_READY version="+$Version+" sha256="+$hashes[$Version]+" bin="+$bin)
