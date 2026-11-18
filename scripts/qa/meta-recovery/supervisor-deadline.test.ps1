$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'TEST_HOST_REFUSED'}
 $tokens=$null;$errors=$null
 $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'supervisor-process.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'TEST_SYNTAX_REFUSED'}
 $function=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Convert-QaDeadlineUtc'},$true)
 if(-not $function){throw 'TEST_FUNCTION_MISSING'}
 . ([scriptblock]::Create($function.Extent.Text))
 $expected=[DateTimeOffset]::Parse('2026-11-10T20:30:00Z',[Globalization.CultureInfo]::InvariantCulture)
 $fixture='{"deadlineAt":"2026-11-10T20:30:00Z"}'|ConvertFrom-Json
 if($fixture.deadlineAt -isnot [DateTime]){throw 'TEST_TYPED_JSON_NOT_REPRODUCED'}
 $legacy=[DateTimeOffset]::Parse($fixture.deadlineAt)
 $localOffset=[TimeZoneInfo]::Local.GetUtcOffset($expected.UtcDateTime)
 if($localOffset -ne [TimeSpan]::Zero -and $legacy.ToUnixTimeSeconds() -eq $expected.ToUnixTimeSeconds()){throw 'TEST_LEGACY_BUG_NOT_REPRODUCED'}
 $cases=@($fixture.deadlineAt,$expected,'2026-11-10T20:30:00Z','2026-11-10T21:30:00+01:00',('{"deadlineAt":"2026-11-10T21:30:00+01:00"}'|ConvertFrom-Json).deadlineAt)
 foreach($case in $cases){$actual=Convert-QaDeadlineUtc $case;if($actual.ToUnixTimeSeconds() -ne $expected.ToUnixTimeSeconds() -or $actual.Offset -ne [TimeSpan]::Zero){throw 'TEST_UTC_INSTANT_CHANGED'}}
 foreach($case in @($null,'10/11/2026 20:30:00','2026-11-10T20:30:00','2026-99-99T20:30:00Z',[DateTime]::SpecifyKind($expected.DateTime,[DateTimeKind]::Unspecified))){$refused=$false;try{$discard=Convert-QaDeadlineUtc $case}catch{$refused=$true};if(-not $refused){throw 'TEST_AMBIGUOUS_DEADLINE_ACCEPTED'}}
 Write-Output 'QA_DEADLINE_TEST_PASS: public JSON typed-date bug reproduced; UTC and offset instants preserved; ambiguous/invalid dates refused; no runtime or services'
}catch{
 Write-Output 'QA_DEADLINE_TEST_BLOCKED'
 exit 1
}
