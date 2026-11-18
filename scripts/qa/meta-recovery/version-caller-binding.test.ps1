$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
# Pure public fixtures: extract declarations only; never execute the probe entry point.
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'version-caller-pair.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'PURE_SOURCE_SYNTAX'}
foreach($name in @('Get-CallerEnvironmentMetadata','Test-ObservedCallerBinding')){$function=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(-not $function){throw 'PURE_SOURCE_MISSING'};. ([scriptblock]::Create($function.Extent.Text))}
$scratch='C:\fixture\empty';$hostDirectory='C:\fixture\approved-pwsh';$path='C:\Windows\System32;C:\Program Files\nodejs;C:\Program Files\Git\cmd';$checks=0
foreach($alias in @($false,$true)){
 $expectedPath=$path;if($alias){$expectedPath+=';C:\Users\fixture\AppData\Local\Microsoft\WindowsApps'}
 foreach($variant in (@('observed','producer','extra_path','wrong_order','missing_cpl','extra_extension')+@('SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'|ForEach-Object {'bad_'+$_}))){
  $actual=@{SystemRoot='C:\Windows';WINDIR='C:\Windows';PATH=($hostDirectory+';'+$expectedPath);PATHEXT='.EXE;.CPL';TEMP=$scratch;TMP=$scratch;USERPROFILE=$scratch;APPDATA=$scratch;LOCALAPPDATA=$scratch}
  switch($variant){'producer'{$actual.PATH=$expectedPath;$actual.PATHEXT='.EXE'}'extra_path'{$actual.PATH+=';C:\fixture\foreign'}'wrong_order'{$actual.PATHEXT='.CPL;.EXE'}'missing_cpl'{$actual.PATHEXT='.EXE'}'extra_extension'{$actual.PATHEXT+=';.PS1'}default{if($variant.StartsWith('bad_')){$actual[$variant.Substring(4)]='C:\fixture\foreign'}}}
  $before=$actual|ConvertTo-Json -Compress;$metadata=Get-CallerEnvironmentMetadata $actual $scratch $hostDirectory $expectedPath;$accepted=Test-ObservedCallerBinding $metadata
  if($accepted -ne ($variant -eq 'observed') -or ($actual|ConvertTo-Json -Compress) -cne $before){throw 'PURE_BINDING_FAILED'};$checks++
 }
}
[pscustomobject]@{status='PASS';publicFixtureChecks=$checks;nativeCalls=0;environmentMutated=$false}|ConvertTo-Json -Compress
