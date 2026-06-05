import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const response = await fetch(`${API_BASE_URL}/devis`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      const text = await response.text();

      console.warn('[API devis] /devis ne retourne pas du JSON.', {
        status: response.status,
        contentType,
        preview: text.slice(0, 300),
      });

      return NextResponse.json(
        {
          success: false,
          error:
            'L’API globale des devis ne retourne pas du JSON. Vérifie le routage backend /devis.',
          details: {
            status: response.status,
            contentType,
            preview: text.slice(0, 300),
          },
        },
        { status: 502 },
      );
    }

    const data = await readBackendJson(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Impossible de charger les devis.',
          details: data,
        },
        { status: response.status },
      );
    }

    const devis = normalizeDevisList(data);

    devis.sort((a, b) => {
      const aTime = a.date_creation ? new Date(a.date_creation).getTime() : 0;
      const bTime = b.date_creation ? new Date(b.date_creation).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      success: true,
      source: 'global',
      devis,
    });
  } catch (error) {
    console.error('[API devis] Erreur serveur', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur serveur devis.',
      },
      { status: 500 },
    );
  }
}