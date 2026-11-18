# Console.In's synchronized reader blocks even for ReadLineAsync. Keep the read
# entirely on a managed worker, with no PowerShell callback or runspace involved.
if(-not ('QaAsyncConsoleInput' -as [type])){
 Add-Type -WarningAction SilentlyContinue -TypeDefinition @'
using System;using System.IO;using System.Threading.Tasks;
public static class QaAsyncConsoleInput {
 public static Task<string> ReadLine(){return ReadLine(Console.In);}
 public static Task<string> ReadLine(TextReader reader){if(reader==null)throw new ArgumentNullException(nameof(reader));return Task.Run(()=>reader.ReadLine());}
}
'@
}
