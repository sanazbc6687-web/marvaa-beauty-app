import "server-only";

export type Principal = { userId: string; email?: string };
export type ProviderRequest = { path: string; init?: RequestInit; accessToken?: string };

export interface AuthProvider {
  authenticate(accessToken: string): Promise<Principal>;
  signIn(email: string, password: string): Promise<unknown>;
  refresh(refreshToken: string): Promise<unknown>;
  signOut(accessToken: string): Promise<void>;
}

export interface DatabaseProvider {
  request<T>(request: ProviderRequest): Promise<T>;
}

export interface ObjectStore {
  upload(bucket: string, key: string, body: Blob, accessToken?: string): Promise<void>;
  download(bucket: string, key: string, accessToken?: string): Promise<Blob>;
  delete(bucket: string, keys: string[], accessToken?: string): Promise<void>;
  createDownloadUrl(bucket: string, key: string, expiresIn?: number, accessToken?: string): Promise<string>;
  publicUrl(bucket: string, key: string): string;
}

export interface AIProvider<Input = unknown, Output = unknown> { generate(input: Input): Promise<Output> }
export interface MessageProvider { send(input: { tenantId: string; recipient: string; template: string; variables?: Record<string, string> }): Promise<{ messageId: string }> }
export interface PaymentProvider { create(input: { tenantId: string; amount: number; callbackUrl: string }): Promise<{ paymentId: string; redirectUrl: string }>; verify(input: { tenantId: string; paymentId: string }): Promise<{ verified: boolean }> }
