// Retired diagnostic CLI. The earlier wrapper read unguarded bootstrap paths;
// disable it rather than permit an executable chosen from unchecked metadata.
process.stdout.write('{"status":"BLOCKED","code":"QA_DIAGNOSTIC_DISABLED"}\n')
process.exitCode=1
