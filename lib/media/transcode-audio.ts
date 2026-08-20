import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Remuxa audio (webm/opus gravado no navegador, ou qualquer outro formato)
 * pra ogg/opus de verdade. O WhatsApp (via Baileys/Evolution) so calcula
 * duracao e mostra o player de nota de voz certo quando o audio chega
 * dentro de um container OGG - webm usa outro layout de metadata e o
 * WhatsApp mostra duracao aleatoria (ex: 10s vira "2:00") ou nem toca.
 */
export async function convertToOggOpus(input: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "audio-"));
  const inPath = join(dir, `${randomUUID()}.input`);
  const outPath = join(dir, `${randomUUID()}.ogg`);

  try {
    await writeFile(inPath, input);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-i", inPath,
        "-c:a", "libopus",
        "-b:a", "32k",
        "-vn",
        outPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg falhou (${code}): ${stderr.slice(-500)}`));
      });
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
