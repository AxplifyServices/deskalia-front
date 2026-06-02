import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await context.params;
    const body = await request.json();

    if (!body?.company) {
      return NextResponse.json(
        {
          success: false,
          error: 'Entreprise manquante.',
        },
        { status: 400 },
      );
    }

    const saveCompanyResponse = await fetch(`${API_BASE_URL}/api/companies`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify(body.company),
    });

    const saveCompanyData = await readBackendJson(saveCompanyResponse);

    if (!saveCompanyResponse.ok || !saveCompanyData?.company_id) {
      return NextResponse.json(
        {
          success: false,
          step: 'save-company',
          error:
            saveCompanyData?.error ??
            saveCompanyData?.details ??
            "Impossible d'enregistrer l'entreprise.",
        },
        { status: saveCompanyResponse.status || 500 },
      );
    }

    const linkResponse = await fetch(
      `${API_BASE_URL}/api/clients/${clientId}/link-company`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        cache: 'no-store',
        body: JSON.stringify({
          company_id: Number(saveCompanyData.company_id),
        }),
      },
    );

    const linkData = await readBackendJson(linkResponse);

    if (!linkResponse.ok || linkData?.success === false) {
      return NextResponse.json(
        {
          success: false,
          step: 'link-company',
          company_id: saveCompanyData.company_id,
          error:
            linkData?.error ??
            linkData?.details ??
            'Entreprise enregistrée, mais impossible de la lier au client.',
        },
        { status: linkResponse.status || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      company_id: saveCompanyData.company_id,
      message: linkData?.message ?? 'Entreprise liée au client.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur liaison entreprise client.',
      },
      { status: 500 },
    );
  }
}