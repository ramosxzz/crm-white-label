"use client";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

/**
 * Reduz a foto antes de subir. A rede em campo e ruim e a foto crua de um
 * celular moderno passa de 5 MB; nesse tamanho o upload trava e a avaria
 * acaba nao sendo registrada, que e justamente o que precisa de prova.
 *
 * Se qualquer etapa falhar, devolve o arquivo original - melhor subir grande
 * do que perder o registro.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

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
