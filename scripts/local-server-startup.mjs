export async function selectedStartupPort(preferred, { strict, canListen, isReserved, findFree }) {
  if (!strict) return findFree(preferred);
  if (isReserved(preferred) || !(await canListen(preferred)))
    throw new Error(`Selected port ${preferred} is unavailable; strict startup will not move the server`);
  return preferred;
}
export function startupFailure({ error, exitCode, signalCode }) {
  if (error) return `Server launcher failed: ${error.message}`;
  if (exitCode !== null && exitCode !== undefined) return `Server launcher exited ${exitCode} before readiness`;
  if (signalCode) return `Server launcher stopped (${signalCode}) before readiness`;
  return null;
}
