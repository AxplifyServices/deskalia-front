import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GUEST_API_KEY =
  process.env.DESKALIA_GUEST_API_KEY ?? 'guest-dev-key-change-in-prod';

function buildGuestCompany() {
  return {
    nom: process.env.DESKALIA_GUEST_COMPANY_NAME ?? 'Deskalia Test',
    adresse: process.env.DESKALIA_GUEST_COMPANY_ADDRESS ?? '',
    code_postal: process.env.DESKALIA_GUEST_COMPANY_POSTAL_CODE ?? '',
    ville: process.env.DESKALIA_GUEST_COMPANY_CITY ?? '',
    forme_juridique: process.env.DESKALIA_GUEST_COMPANY_LEGAL_FORM ?? 'EI',
    siret: process.env.DESKALIA_GUEST_COMPANY_SIRET ?? '',
    tva_number: process.env.DESKALIA_GUEST_COMPANY_TVA ?? '',
    phone: process.env.DESKALIA_GUEST_COMPANY_PHONE ?? '',
    email: process.env.DESKALIA_GUEST_COMPANY_EMAIL ?? '',
    ape: process.env.DESKALIA_GUEST_COMPANY_APE ?? '',
    n_rm: process.env.DESKALIA_GUEST_COMPANY_N_RM ?? '',
    rc_pro: process.env.DESKALIA_GUEST_COMPANY_RC_PRO ?? '',
  };
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const authorization = getBearerToken(request);
  const useGuestMode = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true' || !authorization;

  console.log('');
  console.log('='.repeat(80));
  console.log(`[API devis/from-jobs][${requestId}] Requête reçue`);
  console.log(`[API devis/from-jobs][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log(`[API devis/from-jobs][${requestId}] Mode invité =`, useGuestMode);
  console.log(`[API devis/from-jobs][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log('='.repeat(80));

  try {
    const body = await request.json();

    const backendUrl = useGuestMode
      ? `${API_BASE_URL}/api/guest/devis`
      : `${API_BASE_URL}/api/devis/from-jobs`;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    let payload = body;

    if (useGuestMode) {
      headers['X-API-Key'] = GUEST_API_KEY;

      payload = {
        ...body,
        company: body.company ?? buildGuestCompany(),
      };

      delete payload.client_id;
    } else if (authorization) {
      headers.Authorization = authorization;
    }

    console.log(`[API devis/from-jobs][${requestId}] Appel back =`, backendUrl);
    console.log(`[API devis/from-jobs][${requestId}] Payload envoyé =`, payload);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      cache: 'no-store',
      body: JSON.stringify(payload),
    });

    const data = await readBackendJson(response);

    console.log(`[API devis/from-jobs][${requestId}] Status back =`, response.status);
    console.log(`[API devis/from-jobs][${requestId}] Réponse back =`, data);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error ??
            data?.details ??
            data?.msg ??
            `Erreur génération devis côté back. Status ${response.status}`,
          details: data,
          backendStatus: response.status,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      ...data,
      pdf_url: useGuestMode
        ? `${API_BASE_URL}${data.download_url}`
        : `/api/devis/pdf?downloadUrl=${encodeURIComponent(data.download_url)}`,
      mode: useGuestMode ? 'guest' : 'authenticated',
    });
  } catch (error) {
    console.error(`[API devis/from-jobs][${requestId}] Exception proxy Next =`, error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur génération devis.',
      },
      { status: 500 },
    );
  }
}