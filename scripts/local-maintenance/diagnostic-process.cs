using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;
namespace LegalHubMaintenanceDiagnostics {
    public sealed class Capture {
        public string Text = "";
        public bool Truncated;
    }
    public sealed class Result {
        public int? ExitCode;
        public long DurationMs;
        public string Failure = "";
        public string Output = "";
        public string Errors = "";
        public bool ErrorTruncated;
        public bool CleanupFailed;
    }
    public static class ProcessCapture {
        static async Task<Capture> Drain(StreamReader reader, int limit) {
            var value = new Capture();
            var text = new StringBuilder();
            var buffer = new char[4096];
            int read;
            while ((read = await reader.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false)) != 0) {
                int keep = Math.Min(read, limit - text.Length);
                if (keep > 0) text.Append(buffer, 0, keep);
                if (keep < read) value.Truncated = true;
            }
            value.Text = text.ToString();
            return value;
        }
        static bool Stop(Process process) {
            try {
                if (!process.HasExited) process.Kill(true);
                return process.WaitForExit(10000);
            } catch { return false; }
        }
        public static Result Run(string binary, string[] args, int deadlineMs) {
            return RunIsolated(binary, args, deadlineMs, null, null);
        }
        // Child-only isolation: never mutate the operator's environment/PATH.
        public static Result RunIsolated(string binary, string[] args, int deadlineMs,
                IDictionary<string, string> environment, string workingDirectory) {
            var result = new Result();
            var timer = Stopwatch.StartNew();
            var info = new ProcessStartInfo(binary) {
                UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true,
                StandardOutputEncoding = new UTF8Encoding(false),
                StandardErrorEncoding = new UTF8Encoding(false)
            };
            foreach (var arg in args) info.ArgumentList.Add(arg);
            if (environment != null) {
                info.Environment.Clear();
                foreach (var pair in environment) info.Environment[pair.Key] = pair.Value;
            }
            if (workingDirectory != null) info.WorkingDirectory = workingDirectory;
            // Client formatting only; no database GUC/timeout/transport changes.
            info.Environment["LC_ALL"] = "C";
            info.Environment["LANG"] = "C";
            info.Environment["PG_COLOR"] = "never";
            using (var process = new Process { StartInfo = info }) {
                bool started = false;
                try {
                    try { started = process.Start(); }
                    catch { result.Failure = "START"; return result; }
                    if (!started) { result.Failure = "START"; return result; }
                    var output = Drain(process.StandardOutput, 4 * 1024 * 1024);
                    var errors = Drain(process.StandardError, 8192);
                    if (!process.WaitForExit(deadlineMs)) {
                        result.Failure = "DEADLINE";
                        result.CleanupFailed = !Stop(process);
                    }
                    if (process.HasExited) result.ExitCode = process.ExitCode;
                    try {
                        if (!Task.WhenAll(output, errors).Wait(10000)) {
                            if (result.Failure.Length == 0) result.Failure = "DRAIN";
                        } else {
                            result.Output = output.Result.Text;
                            result.Errors = errors.Result.Text;
                            result.ErrorTruncated = errors.Result.Truncated;
                            if (output.Result.Truncated && result.Failure.Length == 0)
                                result.Failure = "OUTPUT";
                        }
                    } catch { if (result.Failure.Length == 0) result.Failure = "DRAIN"; }
                } finally {
                    if (started && !Stop(process)) {
                        result.CleanupFailed = true;
                        if (result.Failure.Length == 0) result.Failure = "CLEANUP";
                    }
                    timer.Stop();
                    result.DurationMs = timer.ElapsedMilliseconds;
                }
            }
            return result;
        }
    }
}
