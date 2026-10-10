// MSAL loads this route in a hidden iframe when silently renewing a token.
// It intentionally has no UI; MSAL reads the authorization response from the URL.
export default function SilentRenewPage() {
  return null;
}
