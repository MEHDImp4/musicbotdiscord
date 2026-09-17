import { spawn } from "node:child_process";

export interface RunProcessOptions {
  timeoutMs: number;
  maxOutputBytes?: number;
}

export async function runProcess(
  executable: string,
  args: string[],
  options: RunProcessOptions,
): Promise<{ stdout: string; stderr: string }> {
  const maxOutputBytes = options.maxOutputBytes ?? 2_000_000;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${executable} timed out after ${options.timeoutMs} ms`));
    }, options.timeoutMs);

    const append = (current: string, chunk: Buffer): string => {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > maxOutputBytes) {
        child.kill("SIGKILL");
        throw new Error(`${executable} produced too much output`);
      }
      return next;
    };

    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      try {
        stdout = append(stdout, chunk);
      } catch (error) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (settled) return;
      try {
        stderr = append(stderr, chunk);
      } catch (error) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`${executable} exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
