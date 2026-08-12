const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

export function preferredAudioRecorderMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string | undefined {
  return AUDIO_MIME_CANDIDATES.find((mimeType) => isTypeSupported(mimeType));
}

export function createAudioMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = preferredAudioRecorderMimeType((candidate) =>
    MediaRecorder.isTypeSupported(candidate),
  );
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function recordedAudioMimeType(
  recorder: Pick<MediaRecorder, "mimeType">,
  chunks: Blob[],
): string {
  return recorder.mimeType || chunks.find((chunk) => chunk.type)?.type || "audio/webm";
}

export function audioFileExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  return "webm";
}

export function buildRecordedAudio(
  recorder: Pick<MediaRecorder, "mimeType">,
  chunks: Blob[],
  timestamp = Date.now(),
): { blob: Blob; mimeType: string; fileName: string } {
  const mimeType = recordedAudioMimeType(recorder, chunks);
  return {
    blob: new Blob(chunks, { type: mimeType }),
    mimeType,
    fileName: `audio-${timestamp}.${audioFileExtension(mimeType)}`,
  };
}
