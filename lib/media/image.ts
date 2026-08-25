"use client";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

/**
 * Reduz a foto antes de subir. A foto crua de um celular moderno passa de
 * 5 MB; nesse tamanho o upload trava numa conexao ruim e a foto acaba nao
 * sendo enviada.
 *
 * Se qualquer etapa falhar, devolve o arquivo original - melhor subir grande
 * do que perder o envio.
 */
export async function shrinkImage(file: File | Blob, mimeType?: string): Promise<Blob> {
  const type = mimeType ?? (file instanceof File ? file.type : "");
  if (!type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    if (scale >= 1) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", JPEG_QUALITY),
    );

    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * Mesma reducao, mas insiste ate caber no teto de tamanho (ex.: o limite do
 * WhatsApp para imagem). Depois do primeiro corte de dimensao, baixa a
 * qualidade do JPEG em passos ate caber ou bater no piso de qualidade -
 * cobre a foto que ainda fica grande so por ser muito detalhada (ex.: uma
 * captura em RAW/HEIC convertida com muito ruido).
 */
export async function shrinkImageUnderSize(file: File, maxBytes: number): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxBytes) return file;

  let current: Blob = await shrinkImage(file);
  if (current.size <= maxBytes) return current;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return current;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    for (const quality of [0.6, 0.45, 0.3]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/jpeg", quality),
      );
      if (!blob) break;
      current = blob;
      if (blob.size <= maxBytes) break;
    }
  } catch {
    // fica com o que ja tinha reduzido no primeiro passo
  }

  return current;
}
