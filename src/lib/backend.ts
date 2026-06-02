import { NextResponse } from 'next/server';
import { devError, devLog, devWarn } from '@/lib/dev-log';

export const API_BASE_URL =
  process.env.DESKALIA_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'https://vps-9a8f1704.vps.ovh.net';

export function previewValue(
  value: string | null | undefined,
  start = 8,
  end = 6,
) {
  if (!value) return null;

  if (value.length <= start + end) {
    return `${value.slice(0, 3)}...`;
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function logServer(requestId: string, message: string, data?: unknown) {
  const prefix = `[NEXT PROXY][${requestId}] ${message}`;

  if (data !== undefined) {
    devLog(prefix, data);
  } else {
    devLog(prefix);
  }
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');

  devLog('[BACKEND PROXY] Authorization header présent =', Boolean(authorization));

  if (!authorization?.startsWith('Bearer ')) {
    devWarn('[BACKEND PROXY] Authorization absent ou ne commence pas par Bearer');
    return null;
  }

  const token = authorization.replace('Bearer ', '').trim();
  const tokenParts = token ? token.split('.').length : 0;

  devLog('[BACKEND PROXY] JWT preview =', previewValue(token));
  devLog('[BACKEND PROXY] JWT parts =', tokenParts);

  if (!token || tokenParts !== 3) {
    devError('[BACKEND PROXY] Authorization invalide', {
      authorizationPreview: previewValue(authorization),
      tokenParts,
    });

    return null;
  }

  return `Bearer ${token}`;
}

export function unauthorizedResponse() {
  devWarn('[BACKEND PROXY] Requête refusée: utilisateur non connecté');

  return NextResponse.json(
    { success: false, error: 'Utilisateur non connecté.' },
    { status: 401 },
  );
}

export async function readBackendJson(response: Response) {
  const text = await response.text();

  devLog('[BACKEND PROXY] Status backend =', response.status);
  devLog('[BACKEND PROXY] Content-Type backend =', response.headers.get('content-type'));
  devLog(
    '[BACKEND PROXY] Body backend preview =',
    text.length > 1200 ? `${text.slice(0, 1200)}...` : text,
  );

  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    devError('[BACKEND PROXY] JSON backend invalide', error);

    return {
      error: text || 'Réponse backend invalide.',
      raw: text,
    };
  }
}