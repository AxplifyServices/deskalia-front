import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const authorization = getBearerToken(request);

  console.log('');
  console.log('='.repeat(100));
  console.log(`[COMPANY CONFIRM][${requestId}] Requête reçue`);
  console.log(`[COMPANY CONFIRM][${requestId}] API_BASE_URL =`, API_BASE_URL);
  console.log(`[COMPANY CONFIRM][${requestId}] Authorization présent =`, Boolean(authorization));
  console.log('='.repeat(100));

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const company = await request.json();

    console.log(`[COMPANY CONFIRM][${requestId}] Entreprise reçue depuis le front =`, company);

    console.log('');
    console.log(`[COMPANY CONFIRM][${requestId}] Étape 1/2 : sauvegarde entreprise`);
    console.log(`[COMPANY CONFIRM][${requestId}] URL appelée = ${API_BASE_URL}/api/companies`);

    const saveResponse = await fetch(`${API_BASE_URL}/api/companies`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify(company),
    });

    const saveData = await readBackendJson(saveResponse);

    console.log(`[COMPANY CONFIRM][${requestId}] Status sauvegarde =`, saveResponse.status);
    console.log(`[COMPANY CONFIRM][${requestId}] Réponse sauvegarde =`, saveData);

    if (!saveResponse.ok || !saveData.company_id) {
      return NextResponse.json(
        {
          success: false,
          step: 'save-company',
          error:
            saveData.error ??
            saveData.details ??
            "Impossible d'enregistrer l'entreprise.",
        },
        { status: saveResponse.status || 500 },
      );
    }

    const companyId = Number(saveData.company_id);

    console.log('');
    console.log(`[COMPANY CONFIRM][${requestId}] Étape 2/2 : liaison entreprise au compte`);
    console.log(`[COMPANY CONFIRM][${requestId}] company_id =`, companyId);
    console.log(`[COMPANY CONFIRM][${requestId}] URL appelée = ${API_BASE_URL}/api/user/link-company`);

    const linkResponse = await fetch(`${API_BASE_URL}/api/user/link-company`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify({
        company_id: companyId,
      }),
    });

    const linkData = await readBackendJson(linkResponse);

    console.log(`[COMPANY CONFIRM][${requestId}] Status liaison =`, linkResponse.status);
    console.log(`[COMPANY CONFIRM][${requestId}] Réponse liaison =`, linkData);

    if (!linkResponse.ok || linkData.success === false) {
      return NextResponse.json(
        {
          success: false,
          step: 'link-company',
          company_id: companyId,
          error:
            linkData.error ??
            linkData.details ??
            'Entreprise enregistrée, mais liaison au compte impossible.',
        },
        { status: linkResponse.status || 500 },
      );
    }

    console.log('');
    console.log(`[COMPANY CONFIRM][${requestId}] Entreprise liée avec succès au compte`);
    console.log(`[COMPANY CONFIRM][${requestId}] company_id =`, companyId);
    console.log('='.repeat(100));

    return NextResponse.json({
      success: true,
      company_id: companyId,
      message: linkData.message ?? 'Entreprise liée au compte.',
    });
  } catch (error) {
    console.error(`[COMPANY CONFIRM][${requestId}] Exception =`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur entreprise.',
      },
      { status: 500 },
    );
  }
}