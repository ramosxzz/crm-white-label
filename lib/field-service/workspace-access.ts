export function usesKomodusServiceOrderWorkspace(context: {
  osOnlyAccess: boolean;
}): boolean {
  return context.osOnlyAccess;
}
