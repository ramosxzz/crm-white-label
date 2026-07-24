export function isStaleDeploymentError(error: Error): boolean {
  const message = error.message ?? "";
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("was not found on the server")
  );
}
