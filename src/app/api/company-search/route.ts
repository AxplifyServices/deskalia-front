import { NextResponse } from 'next/server';
import {
  API_BASE_URL,
  getBearerToken,
  readBackendJson,
  unauthorizedResponse,
} from '@/lib/backend';

export const runtime = 'nodejs';

type CompanyResult = {
  adresse?: string;
  code_naf?: string;
  denomination?: string;
  siren?: string;
  siret?: string;
};

type CompanySearchResponse =
  | CompanyResult[]
  | {
      success?: boolean;
      count?: number;
      companies?: CompanyResult[];
      error?: string;
      details?: string;
    };

function normalizeCompanies(data: CompanySearchResponse): CompanyResult[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.companies)) return data.companies;
  return [];
}

export async function POST(request: Request) {
  const authorization = getBearerToken(request);

  if (!authorization) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();

    const query = String(body.q ?? body.query ?? '').trim();
    const searchType = String(body.search_type ?? 'name').trim();

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Le nom de l'entreprise est requis." },
        { status: 400 },
      );
    }

    const response = await fetch(`${API_BASE_URL}/api/company-search`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      cache: 'no-store',
      body: JSON.stringify({
        search_type: searchType,
        q: query,
        query,
      }),
    });

    const data = (await readBackendJson(response)) as CompanySearchResponse;

    if (!response.ok) {
      const errorMessage = Array.isArray(data)
        ? 'Erreur API company-search.'
        : data.error ?? data.details ?? 'Erreur API company-search.';

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      companies: normalizeCompanies(data),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur serveur pendant la recherche entreprise.',
      },
      { status: 500 },
    );
  }
}