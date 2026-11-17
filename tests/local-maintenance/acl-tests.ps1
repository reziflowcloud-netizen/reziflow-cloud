#requires -Version 7
param([string]$PrivateTestRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
$passed = 0
function Assert-Test([bool]$Value, [string]$Name) {
  if (-not $Value) { throw "ACL_TEST_FAILED:$Name" }
  $script:passed++
  Write-Output "PASS $Name"
}
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
function New-Fixture([string]$Owner = $sid, [bool]$Directory = $true,
    [string]$Flags = 'OICI', [string]$Control = 'P', [string]$Extra = '',
    [string]$UserRights = 'FA') {
  $acl = if ($Directory) { [Security.AccessControl.DirectorySecurity]::new() }
    else { [Security.AccessControl.FileSecurity]::new() }
  $sddl = 'O:'+$Owner+'G:SYD:'+$Control+'(A;'+$Flags+';'+$UserRights+';;;'+$sid+
    ')(A;'+$Flags+';FA;;;SY)(A;'+$Flags+';FA;;;BA)'+$Extra
  $acl.SetSecurityDescriptorSddlForm($sddl)
  return $acl
}
Assert-Test (Test-ExactPrivateAcl (New-Fixture) $true) 'exact protected directory'
Assert-Test (Test-ExactPrivateAcl (New-Fixture -Directory $false -Flags '') $false) 'exact protected file'
Assert-Test (Test-ExactPrivateAcl (New-Fixture -Owner 'SY') $true) 'known SYSTEM owner'
Assert-Test (Test-ExactPrivateAcl (New-Fixture -Owner 'BA') $true) 'known Administrators owner'
foreach ($case in @(
    @{Name='unknown owner'; Args=@{Owner='S-1-1-0'}},
    @{Name='unprotected inheritance'; Args=@{Control=''}},
    @{Name='inherited ACEs'; Args=@{Flags='OICIID'}},
    @{Name='extra outsider allow'; Args=@{Extra='(A;OICI;FR;;;WD)'}},
    @{Name='extra outsider deny'; Args=@{Extra='(D;OICI;FR;;;WD)'}},
    @{Name='duplicate SID with different propagation'; Args=@{Extra='(A;;FR;;;SY)'}},
    @{Name='partial user rights'; Args=@{UserRights='FR'}},
    @{Name='inherit only'; Args=@{Flags='OICIIO'}},
    @{Name='no propagate'; Args=@{Flags='OICINP'}},
    @{Name='missing directory inheritance'; Args=@{Flags=''}},
    @{Name='only object inheritance'; Args=@{Flags='OI'}})) {
  $argsForFixture = $case.Args
  Assert-Test (-not (Test-ExactPrivateAcl (New-Fixture @argsForFixture) $true)) $case.Name
}
Assert-Test (-not (Test-ExactPrivateAcl (New-Fixture) $false)) 'directory propagation is not file configuration'
$empty = [Security.AccessControl.DirectorySecurity]::new()
$empty.SetOwner([Security.Principal.SecurityIdentifier]$sid)
$empty.SetAccessRuleProtection($true,$false)
Assert-Test (-not (Test-ExactPrivateAcl $empty $true)) 'empty DACL is not exact'
$nullAcl = [Security.AccessControl.DirectorySecurity]::new()
$nullAcl.SetSecurityDescriptorSddlForm(('O:'+$sid+'G:SYD:NO_ACCESS_CONTROL'))
Assert-Test (-not (Test-ExactPrivateAcl $nullAcl $true)) 'null DACL is not exact'
Assert-Test (-not (Test-ExactPrivateAcl $null $true)) 'missing descriptor fails closed'
$baseRaw = [Security.AccessControl.RawSecurityDescriptor]::new((New-Fixture).GetSecurityDescriptorBinaryForm(),0)
$rawAcl = [Security.AccessControl.RawAcl]::new(4,4)
foreach ($ace in $baseRaw.DiscretionaryAcl) { $rawAcl.InsertAce($rawAcl.Count,$ace) }
$objectAce = [Security.AccessControl.ObjectAce]::new(
  [Security.AccessControl.AceFlags]3,[Security.AccessControl.AceQualifier]::AccessAllowed,
  1,[Security.Principal.SecurityIdentifier]'S-1-1-0',
  [Security.AccessControl.ObjectAceFlags]::None,[Guid]::Empty,[Guid]::Empty,$false,$null)
$rawAcl.InsertAce($rawAcl.Count,$objectAce)
$rawDescriptor = [Security.AccessControl.RawSecurityDescriptor]::new(
  [Security.AccessControl.ControlFlags]0x9004,$baseRaw.Owner,$baseRaw.Group,$null,$rawAcl)
$bytes = [byte[]]::new($rawDescriptor.BinaryLength)
$rawDescriptor.GetBinaryForm($bytes,0)
$hiddenAce = [Security.AccessControl.DirectorySecurity]::new()
$hiddenAce.SetSecurityDescriptorBinaryForm($bytes)
Assert-Test ($hiddenAce.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]).Count -eq 3 -and
  ([Security.AccessControl.RawSecurityDescriptor]::new($hiddenAce.GetSecurityDescriptorBinaryForm(),0)).DiscretionaryAcl.Count -eq 4) 'fixture demonstrates hidden ObjectAce projection'
Assert-Test (-not (Test-ExactPrivateAcl $hiddenAce $true)) 'raw ObjectAce cannot bypass exactness'

if ($PrivateTestRoot) {
  if ((Get-ExecutionPolicy) -ne 'RemoteSigned') { throw 'ACL_TEST_REMOTESIGNED_REQUIRED' }
  $parent = [IO.Path]::GetFullPath($PrivateTestRoot).TrimEnd('\')
  Assert-PrivateAcl $parent
  Assert-Test (Test-ExactPrivateAcl (Get-Acl -LiteralPath $parent) $true) 'approved exact parent'
  $id = [Guid]::NewGuid().ToString('N')
  $root = Assert-ChildPath $parent (Join-Path $parent ('acl-test-'+$id))
  if (Test-Path -LiteralPath $root) { throw 'ACL_TEST_ROOT_EXISTS' }
  [void](New-Item -ItemType Directory -Path $root)
  $file = Join-Path $root 'empty.txt'
  $failureFile = Join-Path $root 'failure-empty.txt'
  $writer = (Get-Item Function:\Write-PrivateDacl).ScriptBlock
  try {
    $before = Get-Acl -LiteralPath $root
    Assert-Test (-not (Test-ExactPrivateAcl $before $true)) 'inherited directory needs hardening'
    Set-PrivateAcl $root
    $after = Get-Acl -LiteralPath $root
    Assert-Test (Test-ExactPrivateAcl $after $true) 'DACL-only directory persistence'
    Assert-Test ($before.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq
      $after.GetOwner([Security.Principal.SecurityIdentifier]).Value -and
      $before.GetGroup([Security.Principal.SecurityIdentifier]).Value -eq
      $after.GetGroup([Security.Principal.SecurityIdentifier]).Value) 'directory owner and group unchanged'
    [IO.File]::WriteAllBytes($file,[byte[]]@())
    $before = Get-Acl -LiteralPath $file
    Set-PrivateAcl $file
    $after = Get-Acl -LiteralPath $file
    Assert-Test (Test-ExactPrivateAcl $after $false) 'DACL-only file persistence'
    Assert-Test ($before.GetOwner([Security.Principal.SecurityIdentifier]).Value -eq
      $after.GetOwner([Security.Principal.SecurityIdentifier]).Value -and
      $before.GetGroup([Security.Principal.SecurityIdentifier]).Value -eq
      $after.GetGroup([Security.Principal.SecurityIdentifier]).Value) 'file owner and group unchanged'
    # Model unsupported/unknown metadata on our empty test file, without assigning it.
    $script:fixtureAcl = $hiddenAce
    function Get-Acl { param([string]$LiteralPath) return $script:fixtureAcl }
    try {
      $blocked = $false
      try { Assert-PrivateAcl $file } catch { $blocked = $_.Exception.Message -eq 'LMR:PRIVATE_ACL_UNSUPPORTED' }
      Assert-Test $blocked 'private assertion rejects hidden unsupported ACE'
      $script:fixtureAcl = New-Fixture -Owner 'S-1-1-0' -Directory $false -Flags ''
      $script:unexpectedWrites = 0
      function Write-PrivateDacl { $script:unexpectedWrites++; throw 'ACL_TEST_UNEXPECTED_WRITE' }
      $blocked = $false
      try { Set-PrivateAcl $file } catch { $blocked = $_.Exception.Message -eq 'LMR:PRIVATE_OWNER_UNVERIFIED' }
      Assert-Test ($blocked -and $script:unexpectedWrites -eq 0) 'unknown owner stops before any persistence'
    } finally {
      Remove-Item Function:\Get-Acl
      Set-Item Function:\Write-PrivateDacl -Value $writer
    }
    # Any unexpected persistence attempt on exact ACLs must fail this test.
    function Write-PrivateDacl { throw 'ACL_TEST_UNEXPECTED_WRITE' }
    Set-PrivateAcl $root
    Set-PrivateAcl $file
    Assert-Test $true 'exact file and directory skip persistence'
    Set-Item Function:\Write-PrivateDacl -Value $writer
    # An injected write failure must propagate; it cannot become a successful assert.
    [IO.File]::WriteAllBytes($failureFile,[byte[]]@())
    function Write-PrivateDacl { throw [UnauthorizedAccessException]::new('ACL_TEST_DENIED') }
    $blocked = $false
    try { Set-PrivateAcl $failureFile }
    catch { $blocked = $_.Exception.Message -eq 'ACL_TEST_DENIED' }
    Assert-Test $blocked 'persistence denial propagates with no fallback'
    Assert-Test (-not (Test-ExactPrivateAcl (Get-Acl -LiteralPath $failureFile) $false)) 'failed persistence does not claim protected ACL'
    Set-Item Function:\Write-PrivateDacl -Value $writer
  } finally {
    Set-Item Function:\Write-PrivateDacl -Value $writer
    # Only this test's empty known children and empty directory; never recursive.
    Assert-NotReparsePoint $root
    $entries = @(Get-ChildItem -LiteralPath $root -Force)
    foreach ($entry in $entries) {
      if ($entry.PSIsContainer -or $entry.FullName -notin @($file,$failureFile) -or
          $entry.Length -ne 0 -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'ACL_TEST_CLEANUP_BLOCKED'
      }
    }
    foreach ($entry in $entries) { Remove-Item -LiteralPath $entry.FullName -WhatIf; Remove-Item -LiteralPath $entry.FullName }
    if (@(Get-ChildItem -LiteralPath $root -Force).Count -ne 0) { throw 'ACL_TEST_ROOT_NOT_EMPTY' }
    Remove-Item -LiteralPath $root -WhatIf
    Remove-Item -LiteralPath $root
    Assert-Test (-not (Test-Path -LiteralPath $root)) 'owned empty test artifacts removed'
  }
}
Write-Output "ACL TESTS PASS: $passed"
