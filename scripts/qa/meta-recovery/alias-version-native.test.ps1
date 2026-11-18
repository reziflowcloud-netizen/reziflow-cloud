$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
# Compile and test only pure target-validation logic; no constructor/native call.
$source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'alias-version-native.cs')).Replace("`r`n","`n")
foreach($form in @($source,$source.Replace("`n","`r`n"))){$hash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($form.Replace("`r`n","`n")))).ToLowerInvariant();if($hash -cne 'ba98913512cc055a828870aa9044d5ce7e405acd972f6242136dfcd5892398c3'){throw 'ALIAS_CANONICAL_HASH_FAILED'}}
Add-Type -TypeDefinition $source -WarningAction SilentlyContinue
$alias='C:\Users\fixture\AppData\Local\Microsoft\WindowsApps\ngrok.exe';$raw='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe';$node='C:\Program Files\nodejs\node.exe';$checks=0
if(-not [QaAliasVersionJob]::ValidTarget('tunnel',$alias,$raw,[string[]]@('version'),$alias)){throw 'ALIAS_VALID_TARGET_FAILED'};$checks++
foreach($bad in @(@($raw,$raw,[string[]]@('version')),@($alias,$node,[string[]]@('version')),@($alias,$raw,[string[]]@('http','43127')),@($alias,$raw,[string[]]@('version','--config','public.yml')),@('C:\fixture\other.exe',$raw,[string[]]@('version')))){
 if([QaAliasVersionJob]::ValidTarget('tunnel',$bad[0],$bad[1],$bad[2],$alias)){throw 'ALIAS_INVALID_TARGET_ACCEPTED'};$checks++
}
if(-not [QaAliasVersionJob]::ValidTarget('app',$node,$node,[string[]]@('C:\fixture\supervisor-fake-child.mjs','--descendant'),$alias)){throw 'DUMMY_VALID_TARGET_FAILED'};$checks++
if([QaAliasVersionJob]::ValidTarget('app',$node,$raw,[string[]]@('C:\fixture\supervisor-fake-child.mjs','--descendant'),$alias)){throw 'DUMMY_IMAGE_MISMATCH_ACCEPTED'};$checks++
[pscustomobject]@{status='PASS';pureTargetChecks=$checks;canonicalLineEndingChecks=2;nativeCalls=0;versionAttempts=0}|ConvertTo-Json -Compress
