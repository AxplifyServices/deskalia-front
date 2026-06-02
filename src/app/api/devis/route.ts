import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ClientApiItem = {
  id?: number;
  nom_client?: string | null;
  prenom_client?: string | null;
};

type DevisApiItem = {
  id_devis: number;
  numero_devis?: string | null;
  date_creation?: string | null;
  date_validite?: string | null;
  montant_ht?: number | null;
  montant_tva?: number | null;
  montant_ttc?: number | null;
  statut_devis?: string | null;
  chemin_pdf?: string | null;
  client_id?: number | null;
  nom_client?: string | null;
  prenom_client?: string | null;
};

function isJsonResponse(response: Response) {
  return response.headers.get('content-type')?.includes('application/json');
}

function normalizeDevisList(data: unknown): DevisApiItem[] {
  if (Array.isArray(data)) {
    return data as DevisApiItem[];
  }

  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { devis?: unknown[] }).devis)
  ) {
    return (data as { devis: DevisApiItem[] }).devis;
  }

  return [];
}

export async function GET(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const globalResponse = await fetch(`${API_BASE_URL}/devis`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    if (globalResponse.ok && isJsonResponse(globalResponse)) {
      const globalData = await readBackendJson(globalResponse);
      const globalDevis = normalizeDevisList(globalData);

      return NextResponse.json({
        success: true,
        source: 'global',
        devis: globalDevis,
      });
    }

    const globalText = await globalResponse.text();

    console.warn('[API devis] Endpoint global /devis inutilisable, fallback clients.', {
      status: globalResponse.status,
      contentType: globalResponse.headers.get('content-type'),
      preview: globalText.slice(0, 300),
    });

    const clientsResponse = await fetch(`${API_BASE_URL}/clients`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const clientsData = await readBackendJson(clientsResponse);

    if (!clientsResponse.ok || !Array.isArray(clientsData)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Impossible de charger les devis : endpoint global indisponible et clients indisponibles.',
          details: clientsData,
        },
        { status: 502 },
      );
    }

    const clients = clientsData as ClientApiItem[];
    const allDevis: DevisApiItem[] = [];

    for (const client of clients) {
      if (!client.id) continue;

      const clientDevisResponse = await fetch(
        `${API_BASE_URL}/clients/${client.id}/devis`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: authorization,
          },
          cache: 'no-store',
        },
      );

      const clientDevisData = await readBackendJson(clientDevisResponse);

      if (!clientDevisResponse.ok || !Array.isArray(clientDevisData)) {
        console.warn('[API devis] Devis client indisponibles', {
          clientId: client.id,
          status: clientDevisResponse.status,
          data: clientDevisData,
        });
        continue;
      }

      for (const item of clientDevisData as DevisApiItem[]) {
        allDevis.push({
          ...item,
          client_id: item.client_id ?? client.id,
          nom_client: item.nom_client ?? client.nom_client ?? null,
          prenom_client: item.prenom_client ?? client.prenom_client ?? null,
        });
      }
    }

    allDevis.sort((a, b) => {
      const aTime = a.date_creation ? new Date(a.date_creation).getTime() : 0;
      const bTime = b.date_creation ? new Date(b.date_creation).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      source: 'clients-fallback',
      devis: allDevis,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur devis.',
      },
      { status: 500 },
    );
  }
}