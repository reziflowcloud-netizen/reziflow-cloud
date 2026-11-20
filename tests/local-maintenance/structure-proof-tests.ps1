#requires -Version 7
param([switch]$WithPostgres,[string]$PostgresBin,[string]$TargetPostgresBin,[string]$ToolsBin)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
$passed=0
function Assert-Test([bool]$Value,[string]$Name) {
  if(-not $Value){throw "STRUCTURE_TEST_FAILED:$Name"}
  $script:passed++;Write-Output "PASS $Name"
}
function Expect-Block([scriptblock]$Action,[string]$Name,[string[]]$Code=@('STRUCTURE_EXTENSION_DEPENDENCY_UNPROVEN')) {
  try{& $Action|Out-Null}catch{if($_.Exception.Message -cin @($Code|ForEach-Object {'LMR:'+$_})){Assert-Test $true $Name;return};throw}
  throw "STRUCTURE_EXPECTED_BLOCK:$Name"
}
$migration=Get-Content -LiteralPath (Join-Path $repo 'prisma/migrations/20260922140000_staff_routing_v2/migration.sql') -Raw
$match=[regex]::Match($migration,'(?s)CREATE FUNCTION "staff_routing_v2_seed_legacy_member"\(\) RETURNS trigger\s+LANGUAGE plpgsql AS \$\$(.*?)\$\$;')
if(-not $match.Success){throw 'ROUTING_FIXTURE_MISSING'}
$body=$match.Groups[1].Value.Replace("`r`n","`n")
$routineSql=$match.Value.Replace("`r`n","`n")
$triggerSql='CREATE TRIGGER "LeadChannelRoute_seed_legacy_member" AFTER INSERT ON "LeadChannelRoute" FOR EACH ROW EXECUTE FUNCTION "staff_routing_v2_seed_legacy_member"();'
function New-Model {
  $r=[pscustomobject]@{name='staff_routing_v2_seed_legacy_member';arguments='';result='trigger';language='plpgsql';kind='f';
    securityDefiner=$false;strict=$false;leakproof=$false;volatility='v';parallel='u';returnsSet=$false;cost=100;rows=0;
    config=$null;support='-';binary=$null;notVariadic=$true;noArgModes=$true;noAllArgTypes=$true;noArgNames=$true;
    noTransforms=$true;noSqlBody=$true;source=$body;definition=$routineSql;builtinTriggerResult=$true}
  $t=[pscustomobject]@{name='LeadChannelRoute_seed_legacy_member';table='LeadChannelRoute';function='staff_routing_v2_seed_legacy_member';functionSchema='public';
    arguments='';type=5;enabled='O';argumentCount=0;args='';columns='';qual=$null;oldTable=$null;newTable=$null;
    notConstraint=$true;notChild=$true;deferrable=$false;deferred=$false;definition=$triggerSql}
  $columns=@(foreach($table in @('LeadChannelRoute','LeadChannelRouteMember')){
    foreach($column in @('id','organizationId','employeeId')+$(if($table -eq 'LeadChannelRouteMember'){@('routeId','position')}else{@()})){
      [pscustomobject]@{table=$table;column=$column;type=$(if($column -in @('employeeId','position')){'integer'}else{'text'});notNull=$true}
    }
  })
  return [pscustomobject]@{version=1;serverMajor=17;serverVersionNum=170011;serverUtf8=$true;contractExpected=$true;unknownRoots=0;unsafeDependencies=0;publicExtensions=0;inheritance=0;abnormalInternalTriggers=0;unsupportedRelations=0;unsupportedTypes=0;policies=0;
    routines=@($r);triggers=@($t);searchPaths=@('"\$user", public, extensions');userSchemaAbsent=$true;targetColumns=$columns;
    targetBinding=$true;builtinBindings=$true;descriptors=@(
      [pscustomobject]@{kind='routine';name=$r.name;definition=($r|ConvertTo-Json -Depth 6 -Compress)},
      [pscustomobject]@{kind='trigger';name=($t.table+'.'+$t.name);definition=($t|ConvertTo-Json -Depth 6 -Compress)})}
}
$model=New-Model;Assert-StructureProof $model
Assert-Test ((Get-Sha256Text $body) -ceq 'ebd9cfe0a81cc6d326a4ea987ab62c9262a90daabcb51c7c841030798b2e1b94') 'exact original migration body contract'
Assert-Test $true 'approved routine and unrelated extensions are provable'
foreach($field in @('unknownRoots','unsafeDependencies','publicExtensions','inheritance','abnormalInternalTriggers','unsupportedRelations','unsupportedTypes','policies')){
  $bad=New-Model;$bad.$field=1;Expect-Block {Assert-StructureProof $bad} "reject $field"
}
foreach($field in @('securityDefiner','strict','leakproof','returnsSet')){
  $bad=New-Model;$bad.routines[0].$field=$true;Expect-Block {Assert-StructureProof $bad} "reject routine $field"
}
foreach($field in @('notVariadic','noArgModes','noAllArgTypes','noArgNames','noTransforms','noSqlBody','builtinTriggerResult')){
  $bad=New-Model;$bad.routines[0].$field=$false;Expect-Block {Assert-StructureProof $bad} "reject routine $field"
}
foreach($change in @(@('arguments','x integer'),@('language','sql'),@('result','event_trigger'),@('kind','p'),@('volatility','s'),@('parallel','s'),@('cost',101),@('rows',1),@('support','custom_support'),@('binary','library'))){
  $bad=New-Model;$bad.routines[0].($change[0])=$change[1];Expect-Block {Assert-StructureProof $bad} "reject changed $($change[0])"
}
foreach($changedBody in @(($body+'--changed'),"`nBEGIN EXECUTE 'SELECT 1'; RETURN NEW; END;`n","`nBEGIN PERFORM external.helper(); RETURN NEW; END;`n")){
  $bad=New-Model;$bad.routines[0].source=$changedBody;Expect-Block {Assert-StructureProof $bad} 'reject changed, dynamic or indirect routine body'
}
$bad=New-Model;$bad.routines[0].config=@('search_path=extensions, public');Expect-Block {Assert-StructureProof $bad} 'reject routine-local search_path'
$bad=New-Model;$bad.routines=@($bad.routines[0],$bad.routines[0]);Expect-Block {Assert-StructureProof $bad} 'reject overload or additional routine'
$bad=New-Model;$bad.routines[0].PSObject.Properties.Remove('source');Expect-Block {Assert-StructureProof $bad} 'reject missing routine metadata'
foreach($field in @('targetBinding','builtinBindings','userSchemaAbsent')){
  $bad=New-Model;$bad.$field=$false;Expect-Block {Assert-StructureProof $bad} "reject unproven $field"
}
foreach($path in @('extensions, pg_catalog, public','public, extensions, pg_catalog','external, public','pg_temp, public','')){
  $bad=New-Model;$bad.searchPaths=@($path);Expect-Block {Assert-StructureProof $bad} 'reject unreviewed caller search_path'
}
foreach($path in @('public','pg_catalog, public','"$user", public','"\$user", public, extensions','pg_catalog, public, extensions, pg_temp')){
  Assert-Test (Test-StructureSearchPath $path) "accept closed caller search_path $path"
}
foreach($change in @(@('enabled','D'),@('type',7),@('table','Other'),@('functionSchema','external'),@('args','00'),@('qual','true'),@('oldTable','old_rows'))){
  $bad=New-Model;$bad.triggers[0].($change[0])=$change[1];Expect-Block {Assert-StructureProof $bad} "reject trigger $($change[0])"
}
$bad=New-Model;$bad.targetColumns[0].type='uuid';Expect-Block {Assert-StructureProof $bad} 'reject changed operand type'
$bad=New-Model;$bad.serverMajor=19;Expect-Block {Assert-StructureProof $bad} 'reject unreviewed server major'
$bad=New-Model;$bad.serverUtf8=$false;Expect-Block {Assert-StructureProof $bad} 'reject unproven server UTF8 encoding'
$empty=New-Model;$empty.routines=@();$empty.triggers=@();$empty.descriptors=@()
Expect-Block {Assert-StructureProof $empty} 'routing tables require the routine and trigger'
$empty.contractExpected=$false;Assert-StructureProof $empty
Assert-Test ((Get-StructureProofDigest $empty) -cne (Get-StructureProofDigest $model)) 'fingerprint detects missing routine and trigger'
foreach($badCount in @('0',$false,$null)){$bad=New-Model;$bad.unsafeDependencies=$badCount;Expect-Block {Assert-StructureProof $bad} 'reject missing or wrong-type count'}
Expect-Block {Get-StructureProofSql "bad';select"} 'reject application-role SQL injection' 'STRUCTURE_EXECUTION_ROLE_INVALID'
Write-Output "STRUCTURE_MODEL_PASS count=$passed"
function Column-Definition($Options) {
  return ConvertTo-Json ([ordered]@{collation=$null;identity='';generated='';storage='p';compression='';options=$Options}) -Compress
}
$plain=Get-PortableColumnDefinition (Column-Definition $null) 170011
foreach($version in @(170012,180007)){
  Assert-Test ((Get-PortableColumnDefinition (Column-Definition @('pg_attver=123')) $version) -ceq $plain) "portable internal version $version"
  Assert-Test ((Get-PortableColumnDefinition (Column-Definition @('pg_attver=456')) $version) -ceq $plain) "different internal version $version"
  $user=Get-PortableColumnDefinition (Column-Definition @('n_distinct=0.5','n_distinct_inherited=-0.25')) $version
  Assert-Test ((Get-PortableColumnDefinition (Column-Definition @('pg_attver=123','n_distinct=0.5','n_distinct_inherited=-0.25')) $version) -ceq $user) 'preserve both user options and array shape'
  Assert-Test ((Get-PortableColumnDefinition (Column-Definition @('pg_attver=123','n_distinct=0.6','n_distinct_inherited=-0.25')) $version) -cne $user) 'real user option change changes portable definition'
}
foreach($options in @(
  ,@('pg_unknown=1'),,@('PG_attver=1'),,@('pg_attver=0'),,@('pg_attver=-1'),
  ,@('pg_attver=01'),,@('pg_attver=1x'),,@("pg_attver=1`n"),,@('pg_attver=18446744073709551616'),
  ,@('pg_attver=1','pg_attver=2'),,@('pg_attver=1','pg_future=2'),,@('pg_attver=1',$null))){
  Expect-Block {Get-PortableColumnDefinition (Column-Definition $options) 170012} 'reject unknown or malformed internal option' 'STRUCTURE_COLUMN_OPTIONS_UNMODELED'
}
foreach($version in @(170011,180006,190000)){
  Expect-Block {Get-PortableColumnDefinition (Column-Definition @('pg_attver=1')) $version} 'reject internal option outside reviewed versions' 'STRUCTURE_COLUMN_OPTIONS_UNMODELED'
}
$bad=New-Model;$bad.serverVersionNum=180007
Expect-Block {Assert-StructureProof $bad} 'reject inconsistent server version'
$bad=New-Model;$bad.serverVersionNum=170012
$bad.descriptors+= [pscustomobject]@{kind='column_flags';name='Probe.id';definition=(Column-Definition @('pg_unknown=1'))}
Expect-Block {Assert-StructureProof $bad} 'closed proof rejects unknown internal option' 'STRUCTURE_COLUMN_OPTIONS_UNMODELED'
Write-Output "STRUCTURE_OPTIONS_MODEL_PASS count=$passed"
if(-not $WithPostgres){exit 0}

if(-not $PostgresBin){
  $installed=@(Get-ChildItem -LiteralPath 'C:\Program Files\PostgreSQL' -Directory|Where-Object {$_.Name -in @('17','18')}|Sort-Object {[int]$_.Name} -Descending)
  if(-not $installed.Count){throw 'SYNTHETIC_POSTGRES_UNAVAILABLE'}
  $PostgresBin=Join-Path $installed[0].FullName 'bin'
}
$id=[Guid]::NewGuid().ToString('N').Substring(0,12)
$base=Join-Path $env:LOCALAPPDATA 'LegalHubMaintenanceStructureProofTests'
if(-not(Test-Path -LiteralPath $base)){[void](New-Item -ItemType Directory -Path $base);Set-PrivateAcl $base}
Assert-PrivateAcl $base;Assert-NotReparsePoint $base
$root=Assert-ChildPath $base (Join-Path $base $id)
[void](New-Item -ItemType Directory -Path $root);Set-PrivateAcl $root
$marker=Join-Path $root 'structure-test-owned.txt';[IO.File]::WriteAllText($marker,$id);Set-PrivateAcl $marker
foreach($folder in @('private','backups')){[void](New-Item -ItemType Directory -Path (Join-Path $root $folder));Set-PrivateAcl (Join-Path $root $folder)}
$config=[pscustomobject]@{targetKind='synthetic';environmentFile=(Join-Path $root 'unused.env');expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';
  privateDirectory=(Join-Path $root 'private');backupDirectory=(Join-Path $root 'backups');postgresBin=$PostgresBin;
  nodeBin=(Split-Path (Get-Command node.exe -ErrorAction Stop).Source);applicationRole='restore_admin'}
$targetConfig=$config.PSObject.Copy()
if($TargetPostgresBin){$targetConfig.postgresBin=$TargetPostgresBin}
$dumpConfig=$config.PSObject.Copy()
if($ToolsBin){$dumpConfig.postgresBin=$ToolsBin}
Write-Output ("STRUCTURE_ENV powershell="+$PSVersionTable.PSVersion+" source="+$PostgresBin+" target="+$targetConfig.postgresBin+" tools="+$dumpConfig.postgresBin)
$source=$null;$target=$null;$clean=$false
function Invoke-FixtureSql([Uri]$Uri,[string]$Sql){
  if($Uri.Host -cne '127.0.0.1' -or $Uri.AbsolutePath -notmatch '^/legalhub_runner_'){throw 'SYNTHETIC_TARGET_REQUIRED'}
  $path=Join-Path $config.privateDirectory ('fixture-'+[Guid]::NewGuid().ToString('N')+'.sql')
  [IO.File]::WriteAllText($path,$Sql,[Text.UTF8Encoding]::new($false));Set-PrivateAcl $path
  try{[void](Invoke-PostgresTool $config $Uri 'psql.exe' @('-X','-q','-v','ON_ERROR_STOP=1','-f',$path) 'SYNTHETIC_FIXTURE_FAILED')}
  finally{[IO.File]::Delete($path)}
}
function Test-TriggerInsert([Uri]$Uri,[string]$Suffix){
  $route='synthetic-route-'+$Suffix;$org='synthetic-org-'+$Suffix
  Invoke-FixtureSql $Uri ('INSERT INTO public."LeadChannelRoute"("id","organizationId","employeeId") VALUES('''+$route+''','''+$org+''',37);')
  $hash=[Security.Cryptography.MD5]::HashData([Text.Encoding]::UTF8.GetBytes($route+':37'))
  $expected='v2_'+[Convert]::ToHexString($hash).ToLowerInvariant()
  $value=Invoke-ReadOnlyQuery $config $Uri ('SELECT json_build_object(''id'',"id",''organizationId'',"organizationId",''routeId'',"routeId",''employeeId'',"employeeId",''position'',"position")::text FROM public."LeadChannelRouteMember" WHERE "routeId"='''+$route+'''') 'SYNTHETIC_TRIGGER_RESULT_FAILED'|ConvertFrom-Json
  Assert-Test ($value.id -ceq $expected -and $value.organizationId -ceq $org -and $value.routeId -ceq $route -and $value.employeeId -eq 37 -and $value.position -eq 0) "real trigger result $Suffix independently verified"
}
try{
  $source=New-DisposableCluster $config ('proofsource'+$id)
  $fixture=@'
CREATE SCHEMA extensions;
CREATE EXTENSION hstore SCHEMA extensions;
CREATE TABLE public."_prisma_migrations"(id integer);
CREATE TABLE public."LeadMessage"(id integer);
CREATE TABLE public."Lead"(id integer);
CREATE TABLE public."Organization"(id integer);
CREATE TABLE public."User"(id integer);
CREATE TABLE public."NotificationPreference"(id integer);
CREATE TABLE public."LeadChannelRoute"("id" text NOT NULL PRIMARY KEY,"organizationId" text NOT NULL,"employeeId" integer NOT NULL);
CREATE TABLE public."LeadChannelRouteMember"("id" text NOT NULL PRIMARY KEY,"organizationId" text NOT NULL,"routeId" text NOT NULL REFERENCES public."LeadChannelRoute"("id"),"employeeId" integer NOT NULL,"position" integer NOT NULL);
ALTER TABLE public."LeadChannelRouteMember" ENABLE ROW LEVEL SECURITY;
CREATE SEQUENCE public."QaSequence";
CREATE TABLE public."OptionProbe"("id" integer CONSTRAINT "OptionProbe_positive" CHECK ("id">0),"value" integer DEFAULT 7);
ALTER TABLE public."OptionProbe" ALTER COLUMN "id" SET (n_distinct=0.5,n_distinct_inherited=-0.25);
INSERT INTO public."OptionProbe" VALUES(1,7),(2,8);
CREATE INDEX "OptionProbe_value_idx" ON public."OptionProbe"("value");
'@
  Invoke-FixtureSql $source.Uri ($fixture+"`n"+$routineSql+"`n"+$triggerSql)
  $baseline=Get-StructureFingerprint $config $source.Uri
  Write-Output ('STRUCTURE_SERVER source='+(Invoke-ReadOnlyQuery $config $source.Uri 'SHOW server_version' 'SYNTHETIC_VERSION_FAILED'))
  Assert-Test $true 'real catalog closure accepts approved function with unrelated external hstore'
  Test-TriggerInsert $source.Uri 'source-Żółć-テスト'
  $cases=@(
    @('ALTER FUNCTION public.staff_routing_v2_seed_legacy_member() SECURITY DEFINER;','ALTER FUNCTION public.staff_routing_v2_seed_legacy_member() SECURITY INVOKER;','SECURITY DEFINER'),
    @('ALTER FUNCTION public.staff_routing_v2_seed_legacy_member() SET search_path=extensions,public;','ALTER FUNCTION public.staff_routing_v2_seed_legacy_member() RESET ALL;','function search_path'),
    @('ALTER TABLE public."LeadChannelRoute" DISABLE TRIGGER "LeadChannelRoute_seed_legacy_member";','ALTER TABLE public."LeadChannelRoute" ENABLE TRIGGER "LeadChannelRoute_seed_legacy_member";','disabled trigger'),
    @('CREATE FUNCTION public.qa_overload() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;','DROP FUNCTION public.qa_overload();','new routine'),
    @('CREATE FUNCTION public.staff_routing_v2_seed_legacy_member(integer) RETURNS integer LANGUAGE sql AS $$ SELECT $1 $$;','DROP FUNCTION public.staff_routing_v2_seed_legacy_member(integer);','same-name overload'),
    @('CREATE TABLE public."QaExternalType"(v extensions.hstore);','DROP TABLE public."QaExternalType";','column subobject external type'),
    @('CREATE TABLE public."QaExternalDefault"(v text DEFAULT extensions.hstore_to_json(extensions.hstore(''a'',''b''))::text);','DROP TABLE public."QaExternalDefault";','external default function'),
    @('CREATE SCHEMA qa_helper; CREATE FUNCTION qa_helper.indirect() RETURNS text LANGUAGE plpgsql AS $$ BEGIN RETURN extensions.hstore_to_json(extensions.hstore(''a'',''b''))::text; END $$; CREATE TABLE public."QaIndirect"(v text DEFAULT qa_helper.indirect());','DROP TABLE public."QaIndirect"; DROP FUNCTION qa_helper.indirect(); DROP SCHEMA qa_helper;','opaque indirect external helper'),
    @('CREATE VIEW public.qa_view AS SELECT extensions.hstore(''a'',''b'') AS v;','DROP VIEW public.qa_view;','external view'),
    @('CREATE DOMAIN public.qa_domain AS text;','DROP DOMAIN public.qa_domain;','unsupported domain'),
    @('CREATE POLICY qa_policy ON public."LeadChannelRouteMember" USING(true);','DROP POLICY qa_policy ON public."LeadChannelRouteMember";','unsupported policy'),
    @('CREATE TABLE public.qa_inherited() INHERITS(public."LeadChannelRoute");','DROP TABLE public.qa_inherited;','unmodelled inheritance',@('STRUCTURE_EXTENSION_DEPENDENCY_UNPROVEN','STRUCTURE_NOT_NULL_UNMODELED')),
    @('ALTER TABLE public."LeadChannelRouteMember" DISABLE TRIGGER ALL;','ALTER TABLE public."LeadChannelRouteMember" ENABLE TRIGGER ALL;','disabled internal FK trigger'),
    @('CREATE SCHEMA "\$user"; CREATE TABLE "\$user"."LeadChannelRouteMember"(v text);','DROP TABLE "\$user"."LeadChannelRouteMember"; DROP SCHEMA "\$user";','literal backslash-user namespace shadow'),
    @('CREATE FUNCTION pg_catalog.qa_opaque() RETURNS text LANGUAGE plpgsql AS $$ BEGIN RETURN ''x''; END $$; CREATE TABLE public.qa_opaque_default(v text DEFAULT pg_catalog.qa_opaque());','DROP TABLE public.qa_opaque_default; DROP FUNCTION pg_catalog.qa_opaque();','non-builtin pg_catalog helper'),
    @('CREATE SCHEMA qa_cast; CREATE FUNCTION qa_cast.fake_text(integer) RETURNS text LANGUAGE sql AS $$ SELECT ''fake''::text $$; CREATE CAST(integer AS text) WITH FUNCTION qa_cast.fake_text(integer) AS ASSIGNMENT;','DROP CAST(integer AS text); DROP FUNCTION qa_cast.fake_text(integer); DROP SCHEMA qa_cast;','custom integer-text cast')
  )
  foreach($case in $cases){
    Invoke-FixtureSql $source.Uri $case[0]
    $codes=if($case.Count -gt 3){@($case[3])}else{@('STRUCTURE_EXTENSION_DEPENDENCY_UNPROVEN')}
    Expect-Block {Get-StructureFingerprint $config $source.Uri} ('real '+$case[2]) $codes
    Invoke-FixtureSql $source.Uri $case[1]
  }
  foreach($replacement in @("BEGIN RETURN NEW; END;","BEGIN EXECUTE 'SELECT 1'; RETURN NEW; END;","BEGIN PERFORM extensions.hstore('a','b'); RETURN NEW; END;")){
    Invoke-FixtureSql $source.Uri ('CREATE OR REPLACE FUNCTION public.staff_routing_v2_seed_legacy_member() RETURNS trigger LANGUAGE plpgsql AS $$'+$replacement+'$$;')
    Expect-Block {Get-StructureFingerprint $config $source.Uri} 'real modified/dynamic/indirect same-name function'
    Invoke-FixtureSql $source.Uri ($routineSql.Replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'))
  }
  Assert-StructureEqual $baseline (Get-StructureFingerprint $config $source.Uri)
  $holder=Start-ExportedSnapshot $config $source.Uri
  try{
    $before=Get-StructureFingerprint $config $source.Uri $holder.Id
    $backup=New-PrivateBackup $dumpConfig $source.Uri $id $holder.Id
  }finally{Stop-ExportedSnapshot $holder}
  $target=New-DisposableCluster $targetConfig ('prooftarget'+$id)
  Restore-DisposableBackup $targetConfig $target $backup
  $after=Get-StructureFingerprint $targetConfig $target.Uri
  Assert-StructureEqual $before $after
  Assert-Test $true 'snapshot pg_dump/restore preserves routine, trigger, RLS, sequence and rowtype structure'
  $optionQuery='SELECT to_json(attoptions)::text FROM pg_attribute WHERE attrelid=''public."OptionProbe"''::regclass AND attname=''id'''
  $sourceOptions=Invoke-ReadOnlyQuery $config $source.Uri $optionQuery 'SYNTHETIC_OPTIONS_FAILED'
  $targetOptions=Invoke-ReadOnlyQuery $targetConfig $target.Uri $optionQuery 'SYNTHETIC_OPTIONS_FAILED'
  Write-Output ("STRUCTURE_RAW_OPTIONS source="+$sourceOptions+" target="+$targetOptions)
  Assert-Test ($sourceOptions.Contains('n_distinct=0.5') -and $targetOptions.Contains('n_distinct=0.5') -and
    $sourceOptions.Contains('n_distinct_inherited=-0.25') -and $targetOptions.Contains('n_distinct_inherited=-0.25')) 'user column options survive actual dump/restore'
  Write-Output ('STRUCTURE_SERVER target='+(Invoke-ReadOnlyQuery $targetConfig $target.Uri 'SHOW server_version' 'SYNTHETIC_VERSION_FAILED'))
  Test-TriggerInsert $target.Uri 'restored-Żółć-テスト'
  foreach($mutation in @(
    @('DROP TRIGGER "LeadChannelRoute_seed_legacy_member" ON public."LeadChannelRoute"; DROP FUNCTION public.staff_routing_v2_seed_legacy_member();',($routineSql+"`n"+$triggerSql),'missing restored routine and trigger','STRUCTURE_EXTENSION_DEPENDENCY_UNPROVEN'),
    @('ALTER TABLE public."LeadChannelRouteMember" DISABLE ROW LEVEL SECURITY;','ALTER TABLE public."LeadChannelRouteMember" ENABLE ROW LEVEL SECURITY;','lost RLS'),
    @('ALTER TABLE public."OptionProbe" ENABLE ROW LEVEL SECURITY;','ALTER TABLE public."OptionProbe" DISABLE ROW LEVEL SECURITY;','unexpected RLS on'),
    @('ALTER TABLE public."LeadChannelRouteMember" FORCE ROW LEVEL SECURITY;','ALTER TABLE public."LeadChannelRouteMember" NO FORCE ROW LEVEL SECURITY;','changed FORCE RLS'),
    @('ALTER SEQUENCE public."QaSequence" INCREMENT BY 2;','ALTER SEQUENCE public."QaSequence" INCREMENT BY 1;','changed sequence semantics'),
    @('ALTER TABLE public."OptionProbe" ALTER COLUMN "id" SET (n_distinct=0.6);','ALTER TABLE public."OptionProbe" ALTER COLUMN "id" RESET (n_distinct,n_distinct_inherited); ALTER TABLE public."OptionProbe" ALTER COLUMN "id" SET (n_distinct=0.5,n_distinct_inherited=-0.25);','changed user n_distinct'),
    @('ALTER TABLE public."OptionProbe" ALTER COLUMN "id" SET (n_distinct_inherited=-0.5);','ALTER TABLE public."OptionProbe" ALTER COLUMN "id" RESET (n_distinct,n_distinct_inherited); ALTER TABLE public."OptionProbe" ALTER COLUMN "id" SET (n_distinct=0.5,n_distinct_inherited=-0.25);','changed user inherited option'),
    @('ALTER TABLE public."OptionProbe" ALTER COLUMN "value" TYPE bigint;','ALTER TABLE public."OptionProbe" ALTER COLUMN "value" TYPE integer;','changed column type'),
    @('ALTER TABLE public."OptionProbe" ALTER COLUMN "value" SET DEFAULT 8;','ALTER TABLE public."OptionProbe" ALTER COLUMN "value" SET DEFAULT 7;','changed column default'),
    @('DROP INDEX public."OptionProbe_value_idx";','CREATE INDEX "OptionProbe_value_idx" ON public."OptionProbe"("value");','missing index'),
    @('ALTER TABLE public."OptionProbe" DROP CONSTRAINT "OptionProbe_positive";','ALTER TABLE public."OptionProbe" ADD CONSTRAINT "OptionProbe_positive" CHECK ("id">0);','removed named constraint'),
    @('ALTER TABLE public."OptionProbe" DROP CONSTRAINT "OptionProbe_positive"; ALTER TABLE public."OptionProbe" ADD CONSTRAINT "OptionProbe_positive" CHECK ("id">=0);','ALTER TABLE public."OptionProbe" DROP CONSTRAINT "OptionProbe_positive"; ALTER TABLE public."OptionProbe" ADD CONSTRAINT "OptionProbe_positive" CHECK ("id">0);','changed named constraint'))){
    Invoke-FixtureSql $target.Uri $mutation[0]
    $code=if($mutation.Count -gt 3){$mutation[3]}else{'RESTORED_STRUCTURE_MISMATCH'}
    Expect-Block {Assert-StructureEqual $before (Get-StructureFingerprint $config $target.Uri)} $mutation[2] $code
    Invoke-FixtureSql $target.Uri $mutation[1]
    Assert-StructureEqual $before (Get-StructureFingerprint $targetConfig $target.Uri)
  }
  $badArchive=Join-Path $config.backupDirectory 'corrupt-synthetic.dump'
  [IO.File]::WriteAllText($badArchive,'not a PostgreSQL archive');Set-PrivateAcl $badArchive
  $corrupt=[pscustomobject]@{Path=$badArchive;Sha256=(Get-FileHash $badArchive -Algorithm SHA256).Hash.ToLowerInvariant()}
  Expect-Block {Restore-DisposableBackup $targetConfig $target $corrupt} 'real pg_restore failure stays blocked' 'ISOLATED_RESTORE_FAILED'
  Invoke-FixtureSql $source.Uri 'ALTER EXTENSION hstore SET SCHEMA public;'
  Expect-Block {Get-StructureFingerprint $config $source.Uri} 'required/public extension has no closed restore contract'
  $versions=Invoke-ReadOnlyQuery $config $source.Uri "SELECT count(DISTINCT version) FROM pg_available_extension_versions WHERE name='hstore'" 'SYNTHETIC_EXTENSION_VERSIONS_FAILED'
  Assert-Test ([int]$versions -gt 1) 'extension version inventory remains available'
  Write-Output "STRUCTURE_POSTGRES_PASS count=$passed"
}finally{
  if($target){Stop-DisposableCluster $targetConfig $target}
  if($source){Stop-DisposableCluster $config $source}
  [void](Assert-ChildPath $base $root);Assert-NotReparsePoint $root;Assert-PrivateAcl $root
  if([IO.File]::ReadAllText($marker) -cne $id){throw 'STRUCTURE_CLEANUP_MARKER_MISMATCH'}
  $stack=[Collections.Generic.Stack[string]]::new();$stack.Push($root)
  while($stack.Count){foreach($entry in [IO.Directory]::EnumerateFileSystemEntries($stack.Pop())){
    $attrs=[IO.File]::GetAttributes($entry)
    if($attrs -band [IO.FileAttributes]::ReparsePoint){throw 'STRUCTURE_CLEANUP_REPARSE_FORBIDDEN'}
    if($attrs -band [IO.FileAttributes]::Directory){$stack.Push($entry)}
  }}
  Remove-Item -LiteralPath $root -Recurse -Force
  if(Test-Path -LiteralPath $root){throw 'STRUCTURE_CLEANUP_FAILED'}
  Write-Output 'STRUCTURE_SYNTHETIC_CLEANUP_VERIFIED'
}
