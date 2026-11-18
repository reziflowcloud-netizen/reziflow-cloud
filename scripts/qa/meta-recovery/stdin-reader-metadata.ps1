$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
# Inspect public runtime metadata only. Never read standard input or launch a child.
if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
$reader=[Console]::In
$method=$reader.GetType().GetMethod('ReadLineAsync',[Type[]]@())
[pscustomobject]@{
 readerIsSyncTextReader=($reader.GetType().FullName -ceq 'System.IO.SyncTextReader')
 parameterlessReadDeclaringSync=($method.DeclaringType.FullName -ceq 'System.IO.SyncTextReader')
 frameworkIsNet10=[Runtime.InteropServices.RuntimeInformation]::FrameworkDescription.StartsWith('.NET 10.',[StringComparison]::Ordinal)
 inputRedirected=[Console]::IsInputRedirected
 stdinRead=$false
 nativeCalls=0
}|ConvertTo-Json -Compress
