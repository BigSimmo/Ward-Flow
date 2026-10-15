// @ts-check
/** Portable PostgreSQL deliberately has no provider-specific host allowlist. */
export function validatePostgresConnectionString(connectionString, { runtime = true } = {}) {
  try {
    if (typeof connectionString !== "string" || /[\u0000-\u0020\u007f]/.test(connectionString)) throw new Error();
    const url = new URL(connectionString);
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !username ||
      /[\u0000-\u001f\u007f]/.test(username) ||
      (runtime && ["postgres", "administrator"].includes(username.toLowerCase())) ||
      !password ||
      /[\u0000-\u001f\u007f]/.test(password) ||
      !database ||
      /[\/\u0000-\u001f\u007f]/.test(database) ||
      url.search ||
      url.hash ||
      connectionString.includes("?") ||
      connectionString.includes("#")
    )
      throw new Error();
    return connectionString;
  } catch {
    // Never include a URL, credential, parser message or upstream error in diagnostics.
    throw new Error("Invalid portable PostgreSQL configuration");
  }
}

export function validatePortablePostgresUrl(connectionString) {
  return validatePostgresConnectionString(connectionString);
}

export function readPortablePostgresConfig(env) {
  return {
    connectionString: validatePortablePostgresUrl(env.WARD_POSTGRES_DATABASE_URL),
    ...(env.WARD_POSTGRES_CA_CERT_FILE?.trim() ? { caCertificateFile: env.WARD_POSTGRES_CA_CERT_FILE.trim() } : {}),
  };
}
