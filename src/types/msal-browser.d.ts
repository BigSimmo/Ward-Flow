declare module "@azure/msal-browser" {
  export class PublicClientApplication {
    constructor(configuration: unknown);
    initialize(): Promise<void>;
    handleRedirectPromise(): Promise<AuthenticationResult | null>;
    getAllAccounts(): AccountInfo[];
    getActiveAccount(): AccountInfo | null;
    setActiveAccount(account: AccountInfo | null): void;
    loginRedirect(request?: unknown): Promise<void>;
    logoutRedirect(request?: unknown): Promise<void>;
    acquireTokenSilent(request: unknown): Promise<AuthenticationResult>;
    acquireTokenRedirect(request: unknown): Promise<void>;
  }

  export interface AccountInfo {
    homeAccountId: string;
    environment: string;
    tenantId: string;
    username: string;
    localAccountId: string;
    name?: string;
    idTokenClaims?: Record<string, unknown>;
  }

  export interface AuthenticationResult {
    account: AccountInfo | null;
    accessToken: string;
    idToken: string;
    scopes: string[];
    expiresOn: Date | null;
  }
}
