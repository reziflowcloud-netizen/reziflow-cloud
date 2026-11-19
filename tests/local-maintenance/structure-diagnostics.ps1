# Test-only diagnostics: callers must use an owned synthetic loopback database.
function Get-SyntheticStructureState([object]$Config,[Uri]$Uri,[string]$Stage) {
  if($Config.targetKind -cne 'synthetic' -or $Uri.Host -cne '127.0.0.1' -or $Uri.AbsolutePath -notmatch '^/legalhub_runner_'){throw 'SYNTHETIC_DIAGNOSTICS_ONLY'}
  # Reuse the exact inventory CTE without its aggregate, including during an
  # intentionally rejected mutation. This never substitutes for the real guard.
  $body=(Get-Command Get-StructureFingerprint).Definition
  $cte=[regex]::Match($body,'(?s)WITH objects AS \(.*?(?=\r?\nSELECT json_build_object)')
  if(-not $cte.Success){throw 'SYNTHETIC_DIAGNOSTIC_INVENTORY_MISSING'}
  $inventory=Invoke-ReadOnlyQuery $Config $Uri ($cte.Value+"`nSELECT COALESCE(jsonb_agg(to_jsonb(objects) ORDER BY kind,name,definition),'[]'::jsonb)::text FROM objects") 'SYNTHETIC_DIAGNOSTIC_FAILED'|ConvertFrom-Json
  $proof=Invoke-ReadOnlyQuery $Config $Uri (Get-StructureProofSql $Config.applicationRole) 'SYNTHETIC_DIAGNOSTIC_FAILED'|ConvertFrom-Json
  $rows=@(@($inventory|ForEach-Object {[ordered]@{kind=('inventory.'+$_.kind);name=$_.name;definition=$_.definition.Replace("`r`n","`n")}})+@($proof.descriptors|ForEach-Object {
    [ordered]@{kind=('proof.'+$_.kind);name=$_.name;definition=$_.definition.Replace("`r`n","`n")}
  }))
  $state=[pscustomobject]@{count=$rows.Count;digest=(Get-Sha256Text (ConvertTo-Json -InputObject $rows -Depth 12 -Compress));rows=$rows}
  Write-Host "STRUCTURE_STATE stage=$Stage count=$($state.count) digest=$($state.digest)"
  return $state
}
function Write-SyntheticStructureDifference($Before,$After,[string]$Stage) {
  $keys=@($Before.rows|ForEach-Object {$_.kind+'|'+$_.name})+@($After.rows|ForEach-Object {$_.kind+'|'+$_.name})
  foreach($key in @($keys|Sort-Object -Unique -CaseSensitive)){
    $left=@($Before.rows|Where-Object {($_.kind+'|'+$_.name) -ceq $key})
    $right=@($After.rows|Where-Object {($_.kind+'|'+$_.name) -ceq $key})
    if($left.Count -ne 1 -or $right.Count -ne 1){Write-Host "STRUCTURE_FIRST_DIFF stage=$Stage object=$key property=presence before=$($left.Count) after=$($right.Count)";return}
    if($left[0].definition -cne $right[0].definition){
      try{
        $l=$left[0].definition|ConvertFrom-Json -AsHashtable;$r=$right[0].definition|ConvertFrom-Json -AsHashtable
        foreach($property in @(@($l.Keys)+@($r.Keys)|Sort-Object -Unique -CaseSensitive)){
          $lv=ConvertTo-Json -InputObject $l[$property] -Depth 12 -Compress;$rv=ConvertTo-Json -InputObject $r[$property] -Depth 12 -Compress
          if($lv -cne $rv){Write-Host "STRUCTURE_FIRST_DIFF stage=$Stage object=$key property=$property beforeDigest=$(Get-Sha256Text $lv) afterDigest=$(Get-Sha256Text $rv) before=$($lv.Substring(0,[Math]::Min(120,$lv.Length))) after=$($rv.Substring(0,[Math]::Min(120,$rv.Length)))";return}
        }
      }catch{}
      Write-Host "STRUCTURE_FIRST_DIFF stage=$Stage object=$key property=definition beforeDigest=$(Get-Sha256Text $left[0].definition) afterDigest=$(Get-Sha256Text $right[0].definition)";return
    }
  }
  Write-Host "STRUCTURE_FIRST_DIFF stage=$Stage object=none property=none"
}
function Assert-SyntheticStructureEqual($Before,$After,$BeforeState,$AfterState,[string]$Stage) {
  $caller=Get-PSCallStack|Select-Object -Skip 1 -First 1
  Write-Host "STRUCTURE_ASSERT stage=$Stage caller=structure-proof-tests.ps1:$($caller.ScriptLineNumber) beforeCount=$($Before.count) afterCount=$($After.count) beforeDigest=$($Before.digest) afterDigest=$($After.digest)"
  if($Before.count -ne $After.count -or $Before.digest -cne $After.digest){Write-SyntheticStructureDifference $BeforeState $AfterState $Stage}
  Assert-StructureEqual $Before $After
}
