param([switch]$InstalledMetadataOnly)
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'ngrok-store-alias.ps1')
if($InstalledMetadataOnly){
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $target=Get-QaVerifiedNgrokStoreAlias 'C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe' '6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16' ([Environment]::ProcessPath)
 [pscustomobject]@{status='PASS';installedPackageVerified=$true;registeredAliasVerified=$true;ngrokCalls=0;credentialsRead=$false}|ConvertTo-Json -Compress
 return
}
$valid='<Package><Identity Name="ngrok.ngrok" Version="3.39.11.0" ProcessorArchitecture="x64"/><Applications><Application Id="ngrok" Executable="ngrok.exe" EntryPoint="Windows.FullTrustApplication"><Extensions><ExecutionAlias Alias="ngrok.exe"/></Extensions></Application></Applications></Package>'
$checks=0
if(-not(Test-QaNgrokStoreManifest ([xml]$valid))){throw 'MANIFEST_VALID_REFUSED'};$checks++
foreach($bad in @($valid.Replace('3.39.11.0','3.39.12.0'),$valid.Replace('x64','arm64'),$valid.Replace('Executable="ngrok.exe"','Executable="other.exe"'),$valid.Replace('Windows.FullTrustApplication','other'),$valid.Replace('<ExecutionAlias Alias="ngrok.exe"/>','<ExecutionAlias Alias="other.exe"/>'))){
 if(Test-QaNgrokStoreManifest ([xml]$bad)){throw 'MANIFEST_FOREIGN_ACCEPTED'};$checks++
}
$source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'supervisor-process.ps1'));$match=[regex]::Match($source,"(?s)Add-Type -WarningAction SilentlyContinue -TypeDefinition @'\r?\n(?<code>.*?)\r?\n'@")
if(-not $match.Success){throw 'NATIVE_LITERAL_MISSING'}
Add-Type -TypeDefinition $match.Groups['code'].Value -WarningAction SilentlyContinue
$alias='C:\Users\fixture\AppData\Local\Microsoft\WindowsApps\ngrok.exe';$raw='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe';$node='C:\Program Files\nodejs\node.exe'
if(-not[QaOwnedJob]::ValidRegisteredAlias($alias) -or -not[QaOwnedJob]::ValidStoreTarget('tunnel',$raw) -or -not[QaOwnedJob]::ValidNodeTarget('app',$node)){throw 'NATIVE_TARGET_VALID_REFUSED'};$checks+=3
foreach($bad in @('relative.exe','C:\fixture\ngrok.exe',$alias.Replace('fixture','fixture\..\other'),($alias+[char]0))){
 if([QaOwnedJob]::ValidRegisteredAlias($bad)){throw 'NATIVE_ALIAS_INVALID_ACCEPTED'};$checks++
}
if([QaOwnedJob]::ValidNodeTarget('tunnel',$raw) -or [QaOwnedJob]::ValidStoreTarget('app',$raw) -or [QaOwnedJob]::ValidStoreTarget('tunnel',$alias) -or [QaOwnedJob]::ValidStoreTarget('tunnel',$node)){throw 'NATIVE_IMAGE_BINDING_LOOSENED'};$checks+=4
[pscustomobject]@{status='PASS';publicFixtureChecks=$checks;nativeCalls=0;credentialsRead=$false}|ConvertTo-Json -Compress
