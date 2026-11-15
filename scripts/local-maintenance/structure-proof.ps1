# Closed proof for the public-only dump, not a general PL/pgSQL analyser.
# A name match is never an authorization. Unknown code/object kinds fail closed.
function Get-StructureProofSql([string]$ApplicationRole = '') {
  if ($ApplicationRole -and $ApplicationRole -cnotmatch '^[A-Za-z_][A-Za-z0-9_.-]*$') {
    Stop-Maintenance 'STRUCTURE_EXECUTION_ROLE_INVALID'
  }
  $roleSql = if ($ApplicationRole) { "'$ApplicationRole'" } else { 'current_user' }
  $sql = @'
WITH RECURSIVE roots AS (
 SELECT DISTINCT d.classid,d.objid,d.objsubid FROM pg_depend d
 CROSS JOIN LATERAL pg_identify_object(d.classid,d.objid,d.objsubid) i
 WHERE i.schema='public'
 UNION SELECT 'pg_class'::regclass,c.oid,0 FROM pg_class c WHERE c.relnamespace='public'::regnamespace
 UNION SELECT 'pg_proc'::regclass,p.oid,0 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
 UNION SELECT 'pg_type'::regclass,t.oid,0 FROM pg_type t WHERE t.typnamespace='public'::regnamespace
 UNION SELECT 'pg_namespace'::regclass,n.oid,0 FROM pg_namespace n WHERE n.nspname='public'
 UNION SELECT 'pg_attrdef'::regclass,a.oid,0 FROM pg_attrdef a JOIN pg_class c ON c.oid=a.adrelid WHERE c.relnamespace='public'::regnamespace
 UNION SELECT 'pg_trigger'::regclass,t.oid,0 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace
 UNION SELECT 'pg_rewrite'::regclass,r.oid,0 FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class WHERE c.relnamespace='public'::regnamespace
 UNION SELECT 'pg_policy'::regclass,p.oid,0 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace
 UNION SELECT 'pg_constraint'::regclass,x.oid,0 FROM pg_constraint x WHERE x.connamespace='public'::regnamespace OR x.conrelid IN(SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace)
 UNION SELECT 'pg_cast'::regclass,c.oid,0 FROM pg_cast c JOIN pg_type a ON a.oid=c.castsource JOIN pg_type b ON b.oid=c.casttarget
   WHERE a.typnamespace='public'::regnamespace OR b.typnamespace='public'::regnamespace
), walk AS (
 SELECT classid,objid,objsubid FROM roots
 UNION SELECT d.refclassid,d.refobjid,d.refobjsubid FROM walk w JOIN pg_depend d
   ON d.classid=w.classid AND d.objid=w.objid AND (w.objsubid=0 OR w.objsubid=d.objsubid)
), unsafe_dependencies AS (
 SELECT 1 FROM walk w CROSS JOIN LATERAL pg_identify_object(w.classid,w.objid,w.objsubid) i
 LEFT JOIN pg_depend m ON m.classid=w.classid AND m.objid=w.objid AND m.objsubid=0 AND m.deptype='e' AND m.refclassid='pg_extension'::regclass
 LEFT JOIN pg_extension e ON e.oid=m.refobjid
 WHERE (i.schema IS NOT NULL AND i.schema NOT IN('public','pg_catalog'))
   OR (i.schema='pg_catalog' AND w.objid>=16384)
   OR (e.extname IS NOT NULL AND NOT(e.extname='plpgsql' AND e.extversion='1.0'))
   OR (w.classid='pg_extension'::regclass AND NOT EXISTS(SELECT 1 FROM pg_extension x WHERE x.oid=w.objid AND x.extname='plpgsql' AND x.extversion='1.0'))
   OR (i.schema IS NULL AND NOT(
     w.classid IN('pg_class'::regclass,'pg_attrdef'::regclass,'pg_constraint'::regclass,'pg_trigger'::regclass,'pg_rewrite'::regclass,'pg_policy'::regclass)
     OR (w.classid='pg_namespace'::regclass AND w.objid IN('public'::regnamespace,'pg_catalog'::regnamespace))
     OR (w.classid='pg_extension'::regclass AND EXISTS(SELECT 1 FROM pg_extension x WHERE x.oid=w.objid AND x.extname='plpgsql' AND x.extversion='1.0'))
     OR (w.classid='pg_language'::regclass AND EXISTS(SELECT 1 FROM pg_language l WHERE l.oid=w.objid AND l.lanname='plpgsql' AND l.lanpltrusted AND l.oid<16384))
     OR (w.classid='pg_am'::regclass AND w.objid<16384)))
), routines AS (
 SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS arguments,
   pg_get_function_result(p.oid) AS result,l.lanname AS language,p.prokind AS kind,
   p.prosecdef AS "securityDefiner",p.proisstrict AS strict,p.proleakproof AS leakproof,
   p.provolatile AS volatility,p.proparallel AS parallel,p.proretset AS "returnsSet",
   p.procost AS cost,p.prorows AS rows,p.proconfig AS config,p.prosupport::regproc::text AS support,
   p.probin AS binary,p.provariadic=0 AS "notVariadic",p.proargmodes IS NULL AS "noArgModes",
   p.proallargtypes IS NULL AS "noAllArgTypes",p.proargnames IS NULL AS "noArgNames",
   p.protrftypes IS NULL AS "noTransforms",p.prosqlbody IS NULL AS "noSqlBody",
   p.prosrc AS source,CASE WHEN p.prokind<>'a' THEN pg_get_functiondef(p.oid) END AS definition,
   (t.typnamespace='pg_catalog'::regnamespace AND t.typname='trigger') AS "builtinTriggerResult"
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang JOIN pg_type t ON t.oid=p.prorettype
 WHERE p.pronamespace='public'::regnamespace
), triggers AS (
 SELECT t.tgname AS name,c.relname AS "table",p.proname AS function,n.nspname AS "functionSchema",
   pg_get_function_identity_arguments(p.oid) AS arguments,t.tgtype AS type,t.tgenabled AS enabled,
   t.tgnargs AS "argumentCount",encode(t.tgargs,'hex') AS args,t.tgattr::text AS columns,
   pg_get_expr(t.tgqual,t.tgrelid) AS qual,t.tgoldtable AS "oldTable",t.tgnewtable AS "newTable",
   t.tgconstraint=0 AS "notConstraint",t.tgparentid=0 AS "notChild",t.tgdeferrable AS deferrable,
   t.tginitdeferred AS deferred,pg_get_triggerdef(t.oid) AS definition
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal
), descriptors AS (
 SELECT 'routine' kind,name, row_to_json(r)::text definition FROM routines r
 UNION ALL SELECT 'trigger',"table"||'.'||name,row_to_json(t)::text FROM triggers t
 UNION ALL SELECT 'table_flags',c.relname,json_build_object('persistence',c.relpersistence,'rls',c.relrowsecurity,
   'forceRls',c.relforcerowsecurity,'replicaIdentity',c.relreplident,'options',c.reloptions)::text
 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
 UNION ALL SELECT 'column_flags',c.relname||'.'||a.attname,json_build_object(
   'collation',cn.nspname||'.'||co.collname,'identity',a.attidentity,'generated',a.attgenerated,
   'storage',a.attstorage,'compression',a.attcompression,'options',a.attoptions)::text
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_collation co ON co.oid=a.attcollation
 LEFT JOIN pg_namespace cn ON cn.oid=co.collnamespace
 WHERE c.relnamespace='public'::regnamespace AND a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'type',t.typname,json_build_object('kind',t.typtype,'category',t.typcategory,
   'relation',c.relname,'elementSchema',en.nspname,'element',et.typname,
   'input',t.typinput::regproc::text,'output',t.typoutput::regproc::text)::text
 FROM pg_type t LEFT JOIN pg_class c ON c.oid=t.typrelid LEFT JOIN pg_type et ON et.oid=t.typelem
 LEFT JOIN pg_namespace en ON en.oid=et.typnamespace WHERE t.typnamespace='public'::regnamespace
 UNION ALL SELECT 'sequence',c.relname,json_build_object('type',format_type(s.seqtypid,NULL),'start',s.seqstart,
   'increment',s.seqincrement,'max',s.seqmax,'min',s.seqmin,'cache',s.seqcache,'cycle',s.seqcycle)::text
 FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid WHERE c.relnamespace='public'::regnamespace
 UNION ALL SELECT 'rule',c.relname||'.'||r.rulename,pg_get_ruledef(r.oid)
 FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class WHERE c.relnamespace='public'::regnamespace
)
SELECT json_build_object(
 'version',1,'serverMajor',current_setting('server_version_num')::integer/10000,
 'serverUtf8',current_setting('server_encoding')='UTF8',
 'contractExpected',EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN('LeadChannelRoute','LeadChannelRouteMember')),
 'unknownRoots',(SELECT count(*) FROM roots WHERE classid NOT IN('pg_class'::regclass,'pg_proc'::regclass,'pg_type'::regclass,'pg_attrdef'::regclass,'pg_constraint'::regclass,'pg_trigger'::regclass,'pg_rewrite'::regclass,'pg_policy'::regclass,'pg_namespace'::regclass)),
 'unsafeDependencies',(SELECT count(*) FROM unsafe_dependencies),
 'publicExtensions',(SELECT count(*) FROM pg_extension WHERE extnamespace='public'::regnamespace),
 'inheritance',(SELECT count(*) FROM pg_inherits h JOIN pg_class c ON c.oid=h.inhrelid JOIN pg_class p ON p.oid=h.inhparent WHERE c.relnamespace='public'::regnamespace OR p.relnamespace='public'::regnamespace),
 'abnormalInternalTriggers',(SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid
   LEFT JOIN pg_constraint x ON x.oid=t.tgconstraint WHERE c.relnamespace='public'::regnamespace AND t.tgisinternal AND NOT COALESCE(
    t.tgenabled='O' AND x.contype='f' AND t.tgconstraint<>0 AND t.tgnargs=0 AND t.tgargs=''::bytea AND t.tgqual IS NULL AND
    p.pronamespace='pg_catalog'::regnamespace AND p.oid<16384 AND p.proname LIKE 'RI_FKey_%',false)),
 'unsupportedRelations',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind NOT IN('r','i','S')),
 'unsupportedTypes',(SELECT count(*) FROM pg_type t LEFT JOIN pg_class c ON c.oid=t.typrelid LEFT JOIN pg_type et ON et.oid=t.typelem
   LEFT JOIN pg_class ec ON ec.oid=et.typrelid WHERE t.typnamespace='public'::regnamespace AND NOT COALESCE((
    (t.typtype='c' AND c.relnamespace='public'::regnamespace AND c.relkind='r') OR
    (t.typtype='b' AND t.typcategory='A' AND et.typnamespace='public'::regnamespace AND et.typtype='c' AND ec.relkind='r' AND et.typarray=t.oid)),false)),
 'policies',(SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'routines',COALESCE((SELECT json_agg(r ORDER BY r.name COLLATE "C",r.arguments COLLATE "C") FROM routines r),'[]'::json),
 'triggers',COALESCE((SELECT json_agg(t ORDER BY t."table" COLLATE "C",t.name COLLATE "C") FROM triggers t),'[]'::json),
 'searchPaths',jsonb_build_array((SELECT reset_val FROM pg_settings WHERE name='search_path')) ||
   COALESCE((SELECT jsonb_agg(substr(v.setting,13) ORDER BY v.setting COLLATE "C") FROM pg_db_role_setting z CROSS JOIN LATERAL unnest(z.setconfig) v(setting)
    WHERE v.setting LIKE 'search_path=%' AND z.setdatabase IN(0,(SELECT oid FROM pg_database WHERE datname=current_database()))
      AND z.setrole IN(0,(SELECT oid FROM pg_roles WHERE rolname=current_user),(SELECT oid FROM pg_roles WHERE rolname=__APPLICATION_ROLE__))),'[]'::jsonb),
 'userSchemaAbsent',NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN(current_user,__APPLICATION_ROLE__,chr(92)||'$user')),
 'targetColumns',(SELECT json_agg(json_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull) ORDER BY c.relname COLLATE "C",a.attname COLLATE "C")
   FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='public'::regnamespace AND c.relname IN('LeadChannelRoute','LeadChannelRouteMember') AND a.attnum>0 AND NOT a.attisdropped),
 'targetBinding',to_regclass('"LeadChannelRouteMember"')=to_regclass('public."LeadChannelRouteMember"'),
 'builtinBindings',
   (SELECT count(*)=4 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid<16384 AND p.pronamespace='pg_catalog'::regnamespace AND l.lanname='internal'
    AND (NOT p.prosecdef) AND p.prokind='f' AND p.proconfig IS NULL AND
    ((p.oid='pg_catalog.md5(text)'::regprocedure AND p.prosrc='md5_text') OR
     (p.oid='pg_catalog.textcat(text,text)'::regprocedure AND p.prosrc='textcat') OR
     (p.oid='pg_catalog.int4out(integer)'::regprocedure AND p.prosrc='int4out') OR
     (p.oid='pg_catalog.textin(cstring)'::regprocedure AND p.prosrc='textin'))) AND
   'md5(text)'::regprocedure='pg_catalog.md5(text)'::regprocedure AND
   (SELECT o.oid<16384 AND o.oprcode='pg_catalog.textcat(text,text)'::regprocedure FROM pg_operator o WHERE o.oid='pg_catalog.||(text,text)'::regoperator) AND
   NOT EXISTS(SELECT 1 FROM pg_cast WHERE castsource='int4'::regtype AND casttarget='text'::regtype),
 'descriptors',COALESCE((SELECT json_agg(d ORDER BY kind COLLATE "C",name COLLATE "C") FROM descriptors d),'[]'::json)
)::jsonb::text
'@
  return $sql.Replace('__APPLICATION_ROLE__',$roleSql)
}

function Test-StructureSearchPath([string]$Path) {
  $parts = @(($Path -split ',') | ForEach-Object { $_.Trim() })
  if ($parts.Count -and $parts[0] -ceq 'pg_catalog') { $parts = @($parts | Select-Object -Skip 1) }
  if ($parts.Count -and $parts[0] -cin @('"$user"','"\$user"')) { $parts = @($parts | Select-Object -Skip 1) }
  return (($parts -join ',') -cin @('public','public,extensions','public,pg_temp','public,extensions,pg_temp'))
}

function Assert-StructureProof([object]$Proof) {
  $code = 'STRUCTURE_EXTENSION_DEPENDENCY_UNPROVEN'
  foreach ($name in @('version','serverMajor','serverUtf8','contractExpected','unknownRoots','unsafeDependencies','publicExtensions','inheritance','abnormalInternalTriggers',
      'unsupportedRelations','unsupportedTypes','policies','routines','triggers','descriptors')) {
    if (-not $Proof -or -not $Proof.PSObject.Properties[$name]) { Stop-Maintenance $code }
  }
  if ($Proof.version -isnot [int] -and $Proof.version -isnot [long]) { Stop-Maintenance $code }
  if ($Proof.serverMajor -isnot [int] -and $Proof.serverMajor -isnot [long]) { Stop-Maintenance $code }
  if ($Proof.version -ne 1 -or $Proof.serverMajor -notin @(17,18) -or $Proof.contractExpected -isnot [bool] -or
      $Proof.serverUtf8 -isnot [bool] -or -not $Proof.serverUtf8) { Stop-Maintenance $code }
  foreach ($name in @('unknownRoots','unsafeDependencies','publicExtensions','inheritance','abnormalInternalTriggers','unsupportedRelations','unsupportedTypes','policies')) {
    if (($Proof.$name -isnot [int] -and $Proof.$name -isnot [long]) -or $Proof.$name -ne 0) { Stop-Maintenance $code }
  }
  $routines = @($Proof.routines)
  $triggers = @($Proof.triggers)
  foreach ($descriptor in @($Proof.descriptors)) {
    if (-not $descriptor -or -not $descriptor.PSObject.Properties['kind'] -or
        -not $descriptor.PSObject.Properties['name'] -or -not $descriptor.PSObject.Properties['definition'] -or
        $descriptor.definition -isnot [string] -or
        $descriptor.kind -cnotin @('routine','trigger','table_flags','column_flags','type','sequence','rule')) { Stop-Maintenance $code }
  }
  if (@($Proof.descriptors | Where-Object kind -CEQ 'routine').Count -ne $routines.Count -or
      @($Proof.descriptors | Where-Object kind -CEQ 'trigger').Count -ne $triggers.Count) { Stop-Maintenance $code }
  if ($routines.Count -eq 0 -and $triggers.Count -eq 0 -and -not $Proof.contractExpected) { return }
  if (-not $Proof.contractExpected) { Stop-Maintenance $code }
  if ($routines.Count -ne 1 -or $triggers.Count -ne 1) { Stop-Maintenance $code }
  $r = $routines[0]; $t = $triggers[0]
  foreach ($name in @('name','arguments','result','language','kind','volatility','parallel','cost','rows','config','binary','support','source',
      'securityDefiner','strict','leakproof','returnsSet','notVariadic','noArgModes','noAllArgTypes','noArgNames','noTransforms','noSqlBody','builtinTriggerResult')) {
    if (-not $r.PSObject.Properties[$name]) { Stop-Maintenance $code }
  }
  foreach ($name in @('name','table','functionSchema','function','arguments','type','enabled','argumentCount','args','columns','qual','oldTable','newTable','notConstraint','notChild','deferrable','deferred')) {
    if (-not $t.PSObject.Properties[$name]) { Stop-Maintenance $code }
  }
  # SHA256 of exact prosrc in the existing 20260922140000 migration; only EOL
  # conversion is accepted. No SQL stripping, body parsing or name-only allowlist.
  if ($r.name -cne 'staff_routing_v2_seed_legacy_member' -or $r.arguments -cne '' -or
      $r.result -cne 'trigger' -or $r.language -cne 'plpgsql' -or $r.kind -cne 'f' -or
      $r.volatility -cne 'v' -or $r.parallel -cne 'u' -or $r.cost -ne 100 -or $r.rows -ne 0 -or
      $null -ne $r.config -or $null -ne $r.binary -or $r.support -cne '-' -or $r.source -isnot [string] -or
      (Get-Sha256Text $r.source.Replace("`r`n","`n")) -cne 'ebd9cfe0a81cc6d326a4ea987ab62c9262a90daabcb51c7c841030798b2e1b94') { Stop-Maintenance $code }
  foreach ($name in @('securityDefiner','strict','leakproof','returnsSet')) {
    if ($r.$name -isnot [bool] -or $r.$name) { Stop-Maintenance $code }
  }
  foreach ($name in @('notVariadic','noArgModes','noAllArgTypes','noArgNames','noTransforms','noSqlBody','builtinTriggerResult')) {
    if ($r.$name -isnot [bool] -or -not $r.$name) { Stop-Maintenance $code }
  }
  if ($t.name -cne 'LeadChannelRoute_seed_legacy_member' -or $t.table -cne 'LeadChannelRoute' -or
      $t.functionSchema -cne 'public' -or $t.function -cne $r.name -or $t.arguments -cne '' -or
      $t.type -ne 5 -or $t.enabled -cne 'O' -or $t.argumentCount -ne 0 -or $t.args -cne '' -or
      $t.columns -cne '' -or $null -ne $t.qual -or $null -ne $t.oldTable -or $null -ne $t.newTable) { Stop-Maintenance $code }
  foreach ($name in @('notConstraint','notChild')) {
    if ($t.$name -isnot [bool] -or -not $t.$name) { Stop-Maintenance $code }
  }
  foreach ($name in @('deferrable','deferred')) {
    if ($t.$name -isnot [bool] -or $t.$name) { Stop-Maintenance $code }
  }
  foreach ($name in @('targetBinding','builtinBindings','userSchemaAbsent')) {
    if (-not $Proof.PSObject.Properties[$name] -or $Proof.$name -isnot [bool] -or -not $Proof.$name) { Stop-Maintenance $code }
  }
  if (-not $Proof.PSObject.Properties['searchPaths'] -or @($Proof.searchPaths).Count -eq 0) { Stop-Maintenance $code }
  foreach ($path in @($Proof.searchPaths)) { if (-not (Test-StructureSearchPath $path)) { Stop-Maintenance $code } }
  foreach ($required in @(
      @('LeadChannelRoute','id','text'),@('LeadChannelRoute','organizationId','text'),
      @('LeadChannelRoute','employeeId','integer'),@('LeadChannelRouteMember','id','text'),
      @('LeadChannelRouteMember','organizationId','text'),@('LeadChannelRouteMember','routeId','text'),
      @('LeadChannelRouteMember','employeeId','integer'),@('LeadChannelRouteMember','position','integer'))) {
    $columns = @($Proof.targetColumns | Where-Object { $_.table -ceq $required[0] -and $_.column -ceq $required[1] })
    if ($columns.Count -ne 1 -or $columns[0].type -cne $required[2] -or
        $columns[0].notNull -isnot [bool] -or -not $columns[0].notNull) { Stop-Maintenance $code }
  }
}

function Get-StructureProof([object]$Config, [Uri]$Uri, [string]$SnapshotId = '') {
  try {
    $proof = Invoke-ReadOnlyQuery $Config $Uri (Get-StructureProofSql $Config.applicationRole) 'STRUCTURE_PROOF_QUERY_FAILED' $SnapshotId | ConvertFrom-Json
    Assert-StructureProof $proof
    return $proof
  } catch {
    if ($_.Exception.Message -like 'LMR:*') { throw }
    Stop-Maintenance 'STRUCTURE_EXTENSION_DEPENDENCY_UNPROVEN'
  }
}

function Get-StructureProofDigest([object]$Proof) {
  # JSON descriptors contain portable definitions, never OIDs/owners/ACLs.
  # Include bodies and trigger bindings, so a missing routine after restore
  # cannot pass merely because the remaining routines form an empty valid set.
  $descriptors = @($Proof.descriptors | ForEach-Object {
    $definition=$_.definition
    if ($_.kind -ceq 'routine') {
      $routine=$definition|ConvertFrom-Json
      $routine.source=$routine.source.Replace("`r`n","`n")
      $routine.definition=$routine.definition.Replace("`r`n","`n")
      $definition=ConvertTo-Json $routine -Depth 8 -Compress
    }
    [ordered]@{kind=$_.kind;name=$_.name;definition=$definition.Replace("`r`n","`n")}
  })
  return Get-Sha256Text (ConvertTo-Json -InputObject $descriptors -Depth 8 -Compress)
}
