# Load only the real report functions; never execute runner dispatch or Apply.
$reportRunner = Join-Path $PSScriptRoot '../../scripts/local-maintenance/runner.ps1'
$parseErrors = $null
$reportAst = [Management.Automation.Language.Parser]::ParseFile(
  $reportRunner, [ref]$null, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'REPORT_TEST_RUNNER_PARSE_FAILED' }
foreach ($name in @('Get-ReportDirectory', 'Save-SafeReport', 'Write-Report')) {
  $definitions = @($reportAst.FindAll({ param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
      $node.Name -ceq $name
  }, $false))
  if ($definitions.Count -ne 1) { throw 'REPORT_TEST_FUNCTION_AMBIGUOUS' }
  . ([scriptblock]::Create($definitions[0].Extent.Text))
}
