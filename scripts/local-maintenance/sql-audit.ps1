function Split-MigrationSql([string]$Sql) {
  $statements = @()
  $text = [Text.StringBuilder]::new()
  $shape = [Text.StringBuilder]::new()
  $state = 'normal'
  $depth = 0
  for ($i = 0; $i -lt $Sql.Length; $i++) {
    $c = $Sql[$i]
    $next = if ($i + 1 -lt $Sql.Length) { $Sql[$i + 1] } else { [char]0 }
    if ($state -eq 'line') {
      if ($c -eq "`n") { $state = 'normal'; [void]$text.Append($c); [void]$shape.Append($c) }
      else { [void]$text.Append(' '); [void]$shape.Append(' ') }
      continue
    }
    if ($state -eq 'block') {
      if ($c -eq '/' -and $next -eq '*') { $depth++; $i++ }
      elseif ($c -eq '*' -and $next -eq '/') { $depth--; $i++; if ($depth -eq 0) { $state = 'normal' } }
      [void]$text.Append(' '); [void]$shape.Append(' ')
      continue
    }
    if ($state -eq 'single') {
      [void]$text.Append($c)
      if ($c -eq "'") {
        if ($next -eq "'") {
          [void]$text.Append($next); [void]$shape.Append(' '); [void]$shape.Append(' '); $i++
        } else { [void]$shape.Append($c); $state = 'normal' }
      } else { [void]$shape.Append(' ') }
      continue
    }
    if ($state -eq 'double') {
      [void]$text.Append($c)
      if ($c -eq '"') {
        if ($next -eq '"') {
          [void]$text.Append($next); [void]$shape.Append(' '); [void]$shape.Append(' '); $i++
        } else { [void]$shape.Append($c); $state = 'normal' }
      } else { [void]$shape.Append(' ') }
      continue
    }
    if ($c -eq '-' -and $next -eq '-') {
      $state = 'line'; $i++; [void]$text.Append('  '); [void]$shape.Append('  '); continue
    }
    if ($c -eq '/' -and $next -eq '*') {
      $state = 'block'; $depth = 1; $i++
      [void]$text.Append('  '); [void]$shape.Append('  '); continue
    }
    if ($c -eq "'") { $state = 'single' }
    if ($c -eq '"') { $state = 'double' }
    if ($c -eq '$' -and $Sql.Substring($i) -match '^\$[A-Za-z0-9_]*\$') {
      Stop-Maintenance 'SQL_DOLLAR_QUOTE_UNSUPPORTED'
    }
    if ($c -eq ';') {
      if ($text.ToString().Trim()) {
        $statements += [pscustomobject]@{ Text = $text.ToString().Trim(); Shape = $shape.ToString().Trim() }
      }
      [void]$text.Clear(); [void]$shape.Clear(); continue
    }
    [void]$text.Append($c); [void]$shape.Append($c)
  }
  if ($state -notin @('normal', 'line') -or $text.ToString().Trim()) {
    Stop-Maintenance 'SQL_UNTERMINATED_OR_MISSING_SEMICOLON'
  }
  if ($statements.Count -eq 0 -or $statements.Count -gt 100) {
    Stop-Maintenance 'SQL_STATEMENT_COUNT_UNSAFE'
  }
  return $statements
}

function Test-MigrationSql([string]$Path) {
  try {
    $utf8 = [Text.UTF8Encoding]::new($false, $true)
    $sql = $utf8.GetString([IO.File]::ReadAllBytes($Path))
  } catch { Stop-Maintenance 'SQL_INVALID_UTF8' }
  if ($sql.Contains([char]0)) { Stop-Maintenance 'SQL_NUL_BYTE' }
  $statements = @(Split-MigrationSql $sql)
  $addedColumns = @{}
  $blockingIndexes = @()
  $kinds = @()
  foreach ($statement in $statements) {
    $text = ($statement.Text -replace '\s+', ' ').Trim()
    $shape = ($statement.Shape -replace '\s+', ' ').Trim()
    $safeShape = $shape -replace '\bON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)\b', ''
    if ($safeShape -match '\b(DROP|TRUNCATE|RENAME|INSERT|UPDATE|DELETE|MERGE|COPY|CALL|DO|EXECUTE|GRANT|REVOKE|VACUUM|ANALYZE)\b' -or
        $safeShape -match '\b(CREATE\s+OR\s+REPLACE|ALTER\s+COLUMN|USING|SELECT|GENERATED|CHECK)\b') {
      Stop-Maintenance 'SQL_DESTRUCTIVE_OR_UNSUPPORTED'
    }
    if ($text -match '(?i)^ALTER\s+TABLE\s+"?(?<table>[A-Za-z_][A-Za-z0-9_]*)"?\s+ADD\s+COLUMN\s+"?(?<column>[A-Za-z_][A-Za-z0-9_]*)"?\s+(?<tail>.+)$') {
      $table = $Matches.table; $column = $Matches.column; $tail = $Matches.tail
      if ($tail -notmatch '(?i)^(BOOLEAN|INTEGER|BIGINT|TEXT|TIMESTAMP\s*\(\s*\d+\s*\)|TIMESTAMP|TIMESTAMPTZ)(?:\s+NOT\s+NULL)?(?:\s+DEFAULT\s+(?:false|true|[0-9]+|CURRENT_TIMESTAMP|''[^'']*''))?$') {
        Stop-Maintenance 'SQL_ADD_COLUMN_UNSUPPORTED'
      }
      if ($tail -match '(?i)\bNOT\s+NULL\b' -and $tail -notmatch '(?i)\bDEFAULT\b') {
        Stop-Maintenance 'SQL_NOT_NULL_WITHOUT_DEFAULT'
      }
      if (-not $addedColumns.ContainsKey($table)) { $addedColumns[$table] = @() }
      $addedColumns[$table] += $column
      $kinds += 'ADD_COLUMN'; continue
    }
    if ($text -match '(?i)^CREATE\s+SEQUENCE\s+"?[A-Za-z_][A-Za-z0-9_]*"?(?:\s+AS\s+(?:INTEGER|BIGINT))?$') {
      $kinds += 'CREATE_SEQUENCE'; continue
    }
    if ($text -match '(?i)^CREATE\s+(?:UNIQUE\s+)?INDEX\s+"?[A-Za-z_][A-Za-z0-9_]*"?\s+ON\s+"?(?<table>[A-Za-z_][A-Za-z0-9_]*)"?\s*\(\s*"?[A-Za-z_][A-Za-z0-9_]*"?(?:\s*,\s*"?[A-Za-z_][A-Za-z0-9_]*"?)*\s*\)$') {
      $blockingIndexes += $Matches.table
      $kinds += 'CREATE_INDEX_BLOCKING'; continue
    }
    if ($text -match '(?i)^CREATE\s+TABLE\s+"?[A-Za-z_][A-Za-z0-9_]*"?\s*\(.+\)$') {
      if ($text -match '(?i)\bDEFAULT\s+(?!false\b|true\b|[0-9]+\b|CURRENT_TIMESTAMP\b|''[^'']*'')') {
        Stop-Maintenance 'SQL_TABLE_DEFAULT_UNSUPPORTED'
      }
      if ($safeShape -match '(?i)\b(AS\s+SELECT|REFERENCES\s+pg_catalog|FOREIGN\s+TABLE)\b') {
        Stop-Maintenance 'SQL_CREATE_TABLE_UNSUPPORTED'
      }
      $kinds += 'CREATE_TABLE'; continue
    }
    Stop-Maintenance 'SQL_STATEMENT_UNSUPPORTED'
  }
  return [pscustomobject]@{
    Sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    StatementCount = $statements.Count
    Kinds = @($kinds)
    AddedColumns = $addedColumns
    BlockingIndexTables = @($blockingIndexes | Select-Object -Unique)
    Risk = if ($blockingIndexes.Count) { 'MEDIUM' } else { 'LOW' }
  }
}
