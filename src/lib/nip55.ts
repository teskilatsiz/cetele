type BaseParams = {
  callbackUrl?: string;
  returnType?: 'signature' | 'event';
  compressionType?: 'none' | 'gzip';
  id?: string;
  currentUser?: string;
};

type PermissionsParams = BaseParams & {
  permissions?: { type: string; kind?: number }[];
};

type EventUriParams = BaseParams & {
  eventJson: Record<string, unknown>;
};

type EncryptDecryptParams = BaseParams & {
  pubKey: string;
  content: string;
};

function compact(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

function buildUri({
  base,
  type,
  callbackUrl,
  returnType = 'signature',
  compressionType = 'none',
  id,
  currentUser,
  permissions,
  pubKey,
  plainText,
  encryptedText,
}: BaseParams & {
  base: string;
  type: string;
  permissions?: { type: string; kind?: number }[];
  pubKey?: string;
  plainText?: string;
  encryptedText?: string;
}): string {
  const query = new URLSearchParams(
    compact({
      type,
      compressionType,
      returnType,
      callbackUrl,
      id,
      current_user: currentUser,
      permissions: permissions?.length
        ? encodeURIComponent(JSON.stringify(permissions))
        : undefined,
      pubKey,
      plainText,
      encryptedText,
      appName: 'Çetele',
    })
  );
  return `${base}?${query.toString()}`;
}

export function getPublicKeyUri({ permissions = [], ...params }: PermissionsParams): string {
  return buildUri({ base: 'nostrsigner:', type: 'get_public_key', permissions, ...params });
}

export function signEventUri({ eventJson, ...params }: EventUriParams): string {
  return buildUri({
    base: `nostrsigner:${encodeURIComponent(JSON.stringify(eventJson))}`,
    type: 'sign_event',
    ...params,
  });
}

export function encryptNip04Uri(params: EncryptDecryptParams): string {
  return buildUri({ base: 'nostrsigner:', type: 'nip04_encrypt', plainText: params.content, ...params });
}

export function decryptNip04Uri(params: EncryptDecryptParams): string {
  return buildUri({ base: 'nostrsigner:', type: 'nip04_decrypt', encryptedText: params.content, ...params });
}

export function encryptNip44Uri(params: EncryptDecryptParams): string {
  return buildUri({ base: 'nostrsigner:', type: 'nip44_encrypt', plainText: params.content, ...params });
}

export function decryptNip44Uri(params: EncryptDecryptParams): string {
  return buildUri({ base: 'nostrsigner:', type: 'nip44_decrypt', encryptedText: params.content, ...params });
}
