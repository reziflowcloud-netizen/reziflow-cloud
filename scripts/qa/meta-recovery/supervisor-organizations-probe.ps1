param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop'
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $qa=Read-QaGuardedRuntime $PointerPath;$c=$qa.Runtime
 if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.appId -ne '2523488421395251' -or $c.organizationId -notmatch '^[a-zA-Z0-9_-]{1,100}$' -or $c.organizationId -eq 'org_default'){throw 'TARGET_REFUSED'}
 . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
 $models=[ordered]@{user='User';client='Client';case='Case';task='Task';lead='Lead';employee='Employee';metaLeadAdsBinding='MetaLeadAdsBinding';notification='Notification';metaLeadAdsDelivery='MetaLeadAdsDelivery';notificationPreference='NotificationPreference';notificationPushDelivery='NotificationPushDelivery';leadChannelRoute='LeadChannelRoute';leadChannelRouteMember='LeadChannelRouteMember'}
 $pairs=@();foreach($entry in $models.GetEnumerator()){$pairs+="'$($entry.Key)',(SELECT count(*)::int FROM public.`"$($entry.Value)`" WHERE `"organizationId`"='org_default')"}
 $sql="BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='15s'; SELECT json_build_object('organizationCount',(SELECT count(*)::int FROM public.`"Organization`"),'qaMatches',EXISTS(SELECT 1 FROM public.`"Organization`" WHERE id='$($c.organizationId)' AND name='LegalHub Internal QA'),'defaultMatches',EXISTS(SELECT 1 FROM public.`"Organization`" WHERE id='org_default' AND name='ReziFlow Cloud' AND slug='default'),'defaultCounts',json_build_object($($pairs -join ',')),'readOnly',current_setting('transaction_read_only')='on'); ROLLBACK;"
 $lines=@(Invoke-PostgresTool $qa.State.config ([Uri]$c.databaseUrl) 'psql.exe' @('-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',$sql) 'QA_ORGANIZATION_QUERY_BLOCKED')
 $data=@($lines|Where-Object{$_ -is [string] -and $_.Trim().StartsWith('{')})
 if($data.Count -ne 1){throw 'OUTPUT_REFUSED'}
 $result=$data[0]|ConvertFrom-Json
 if($result.readOnly -ne $true -or $result.organizationCount -isnot [long] -and $result.organizationCount -isnot [int]){throw 'OUTPUT_REFUSED'}
 $total=0
 foreach($entry in $models.GetEnumerator()){$value=$result.defaultCounts.($entry.Key);if($value -lt 0 -or $value -gt 100000000){throw 'OUTPUT_REFUSED'};$total+=$value}
 [pscustomobject]@{status=if($result.organizationCount -eq 2 -and $result.qaMatches -eq $true -and $result.defaultMatches -eq $true -and $total -eq 0){'PASS'}else{'BLOCKED'};organizations=$result.organizationCount;qaMetadataMatches=$result.qaMatches;migrationDefaultMatches=$result.defaultMatches;defaultOperationalRecords=$total;readOnly=$true}|ConvertTo-Json -Compress
}catch{Write-Output '{"status":"BLOCKED","code":"QA_ORGANIZATION_PROBE_REFUSED"}';exit 1}
