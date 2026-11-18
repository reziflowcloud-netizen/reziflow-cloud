param([Parameter(Mandatory=$true)][string]$SourcePath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$savedPath=$env:PATH
$savedPathExt=$env:PATHEXT
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'TEST_HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $gitExe='C:\Program Files\Git\cmd\git.exe'
 Assert-QaNoReparse $gitExe
 if(-not(Test-Path -LiteralPath $gitExe -PathType Leaf)){throw 'TEST_GIT_NOT_INSTALLED'}
 $env:PATH='C:\Windows\System32;C:\Program Files\nodejs'
 if(Get-Command git.exe -CommandType Application -ErrorAction SilentlyContinue){throw 'MINIMAL_PATH_UNEXPECTED_GIT'}
 $refused=$false
 try{$discard=Assert-QaSource $SourcePath}catch{$refused=$true}
 if(-not $refused){throw 'MISSING_GIT_NOT_REFUSED'}
 $env:PATH+=';C:\Program Files\Git\cmd'
 if((Get-Command git.exe -CommandType Application -ErrorAction Stop).Source -ne $gitExe){throw 'TEST_GIT_RESOLUTION_REFUSED'}
 $env:PATHEXT=$null
 if(Get-Command git -CommandType Application -ErrorAction SilentlyContinue){throw 'MISSING_PATHEXT_UNEXPECTED_BARE_GIT'}
 if((Get-Command git.exe -CommandType Application -ErrorAction Stop).Source -ne $gitExe){throw 'EXPLICIT_GIT_MISSING'}
 $refused=$false;try{$discard=Assert-QaSource $SourcePath}catch{$refused=$true}
 if(-not $refused){throw 'MISSING_PATHEXT_NOT_REFUSED'}
 $env:PATHEXT='.EXE'
 $discard=Assert-QaSource $SourcePath
 Write-Output 'QA_GIT_DEPENDENCY_TEST_PASS: minimal PATH lacks Git; without PATHEXT explicit git.exe resolves but bare git fails; guardian PATH plus PATHEXT .EXE passes exact preserved source guard; no services or credentials'
}catch{
 Write-Output 'QA_GIT_DEPENDENCY_TEST_BLOCKED'
 exit 1
}finally{$env:PATH=$savedPath;$env:PATHEXT=$savedPathExt}
