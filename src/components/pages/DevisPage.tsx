'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import PageFrame from '@/components/pages/PageFrame';
import { authHeaders } from '@/lib/auth-client';

type Devis = {
  id_devis?: number;
  id?: number;
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

type DevisApiResponse = {
  success?: boolean;
  source?: string;
  devis?: Devis[];
  error?: string;
};

export default function DevisPage() {
  const t = useTranslations('Devis');

  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDevis() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/devis', {
        method: 'GET',
        headers: {
          ...authHeaders(),
        },
        cache: 'no-store',
      });

      const data = (await response.json()) as DevisApiResponse;

      if (!response.ok || data.success === false) {
        throw new Error(data.error || t('loadError'));
      }

      setDevis(Array.isArray(data.devis) ? data.devis : []);
    } catch (loadError) {
      console.error('[DEVIS] Erreur chargement', loadError);
      setError(loadError instanceof Error ? loadError.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevis();
  }, []);

  const sortedDevis = useMemo(() => {
    return [...devis].sort((a, b) => {
      const aTime = a.date_creation ? new Date(a.date_creation).getTime() : 0;
      const bTime = b.date_creation ? new Date(b.date_creation).getTime() : 0;

      return bTime - aTime;
    });
  }, [devis]);

  return (
    <PageFrame
      title={t('title')}
      action={
        <button
          type="button"
          onClick={loadDevis}
          disabled={loading}
          className="h-11 rounded-full bg-[#ff642d] px-5 text-[13px] font-extrabold text-white shadow-sm active:scale-95 disabled:opacity-60"
        >
          Actualiser
        </button>
      }
    >
      {loading ? (
        <p className="py-8 text-center text-[14px] font-bold text-[#704f49]">
          {t('loading')}
        </p>
      ) : null}

      {!loading && error ? (
        <div className="rounded-[18px] bg-[#fff0ee] p-4 text-[13px] font-bold text-[#c63b28] shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error && sortedDevis.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : null}

      {!loading && !error && sortedDevis.length > 0 ? (
        <div className="space-y-3">
          {sortedDevis.map((item, index) => (
            <DevisCard key={getDevisKey(item, index)} devis={item} t={t} />
          ))}
        </div>
      ) : null}
    </PageFrame>
  );
}

function DevisCard({
  devis,
  t,
}: {
  devis: Devis;
  t: (key: string) => string;
}) {
  const pdfUrl = buildPdfUrl(devis.chemin_pdf);

  return (
    <article className="rounded-[18px] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold">
            {devis.numero_devis || t('quoteWithoutNumber')}
          </p>

          <p className="mt-1 truncate text-[13px] text-[#704f49]">
            {formatClientName(devis)}
          </p>

          {devis.date_creation ? (
            <p className="mt-1 text-[12px] text-[#8b7770]">
              {t('date')} : {formatDate(devis.date_creation)}
            </p>
          ) : null}
        </div>

        <span className="shrink-0 rounded-full bg-[#f1ece8] px-3 py-1 text-[11px] font-extrabold text-[#704f49]">
          {formatStatus(devis.statut_devis, t)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <AmountBox label="HT" value={devis.montant_ht} />
        <AmountBox label="TVA" value={devis.montant_tva} />
        <AmountBox label="TTC" value={devis.montant_ttc} strong />
      </div>

      {devis.date_validite ? (
        <p className="mt-3 text-[12px] font-bold text-[#704f49]">
          Validité : {formatDate(devis.date_validite)}
        </p>
      ) : null}

      {pdfUrl ? (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex h-10 items-center justify-center rounded-[10px] bg-[#f1ece8] text-[13px] font-extrabold text-[#704f49] active:scale-[0.98]"
        >
          Ouvrir le PDF
        </a>
      ) : null}
    </article>
  );
}

function AmountBox({
  label,
  value,
  strong = false,
}: {
  label: string;
  value?: number | null;
  strong?: boolean;
}) {
  return (
    <div className="rounded-[14px] bg-[#fbf8f6] p-3">
      <p className="text-[11px] font-extrabold text-[#704f49]">{label}</p>
      <p className={`mt-1 text-[15px] ${strong ? 'font-black' : 'font-extrabold'}`}>
        {formatAmount(value)}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] bg-white p-6 text-center shadow-sm">
      <p className="text-[17px] font-extrabold">{title}</p>
      <p className="mt-2 text-[13px] text-[#704f49]">{description}</p>
    </div>
  );
}

function getDevisKey(devis: Devis, index: number) {
  return devis.id_devis ?? devis.id ?? devis.numero_devis ?? `devis-${index}`;
}

function formatClientName(devis: Devis) {
  const fullName = `${devis.prenom_client ?? ''} ${devis.nom_client ?? ''}`.trim();

  if (fullName) return fullName;
  if (devis.client_id) return `Client #${devis.client_id}`;

  return 'Client non renseigné';
}

function formatStatus(status: string | null | undefined, t: (key: string) => string) {
  const normalized = normalizeText(status ?? '');

  if (!normalized) return t('draft');

  if (normalized.includes('brouillon') || normalized.includes('draft')) {
    return t('draft');
  }

  if (normalized.includes('envoye') || normalized.includes('sent')) {
    return t('sent');
  }

  if (
    normalized.includes('valide') ||
    normalized.includes('validated') ||
    normalized.includes('accepte')
  ) {
    return t('validated');
  }

  if (
    normalized.includes('refuse') ||
    normalized.includes('refused') ||
    normalized.includes('rejete')
  ) {
    return t('refused');
  }

  return status ?? t('draft');
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatAmount(value?: number | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildPdfUrl(path?: string | null) {
  if (!path) return null;

  if (path.startsWith('/devis/')) {
    return `/api/devis/pdf?downloadUrl=${encodeURIComponent(path)}`;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return null;
}