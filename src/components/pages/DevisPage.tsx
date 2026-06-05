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

const PAGE_SIZE = 6;

export default function DevisPage() {
  const t = useTranslations('Devis');

  const [devis, setDevis] = useState<Devis[]>([]);
  const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

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
      setPage(1);
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

  const filteredDevis = useMemo(() => {
    const cleanQuery = normalizeText(query);

    if (!cleanQuery) return sortedDevis;

    return sortedDevis.filter((item) => {
      const searchable = [
        item.numero_devis,
        item.statut_devis,
        item.nom_client,
        item.prenom_client,
        item.client_id ? `client ${item.client_id}` : '',
        item.montant_ht,
        item.montant_ttc,
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(searchable).includes(cleanQuery);
    });
  }, [query, sortedDevis]);

  const totalPages = Math.max(1, Math.ceil(filteredDevis.length / PAGE_SIZE));

  const paginatedDevis = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredDevis.slice(start, start + PAGE_SIZE);
  }, [filteredDevis, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
          {t('refresh')}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[22px] bg-white p-3 shadow-sm">
          <label className="flex h-12 items-center gap-3 rounded-[16px] bg-[#f3eee9] px-4">
            <span className="text-[22px] text-[#704f49]">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-bold text-[#2b1d1b] outline-none placeholder:text-[#9c8179]"
            />
          </label>
        </div>

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

        {!loading && !error && filteredDevis.length === 0 ? (
          <EmptyState
            title={query ? t('emptySearchTitle') : t('emptyTitle')}
            description={query ? t('emptySearchDescription') : t('emptyDescription')}
          />
        ) : null}

        {!loading && !error && filteredDevis.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedDevis.map((item, index) => (
                <DevisListItem
                  key={getDevisKey(item, index)}
                  devis={item}
                  t={t}
                  onClick={() => setSelectedDevis(item)}
                />
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={filteredDevis.length}
              pageSize={PAGE_SIZE}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
              t={t}
            />
          </>
        ) : null}
      </div>

      {selectedDevis ? (
        <DevisDetailModal
          devis={selectedDevis}
          t={t}
          onClose={() => setSelectedDevis(null)}
        />
      ) : null}
    </PageFrame>
  );
}

function DevisListItem({
  devis,
  t,
  onClick,
}: {
  devis: Devis;
  t: (key: string) => string;
  onClick: () => void;
}) {
  const title = formatClientName(devis);
  const subtitle = devis.numero_devis || t('quoteWithoutNumber');
  const amount = formatAmount(devis.montant_ht ?? devis.montant_ttc ?? 0);
  const status = formatStatus(devis.statut_devis, t);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[22px] bg-white p-4 text-left shadow-sm active:scale-[0.99]"
    >
      <div className="flex gap-4">
        <div className="flex h-[116px] w-[90px] shrink-0 items-center justify-center rounded-[14px] border border-[#ead8ce] bg-[#fbf8f6]">
          <div className="w-[58px] rounded-[6px] border border-[#d8c7bd] bg-white p-1 shadow-sm">
            <div className="mb-1 h-2 w-8 rounded bg-[#2b1d1b]" />
            <div className="space-y-1">
              <div className="h-1 w-full rounded bg-[#d8c7bd]" />
              <div className="h-1 w-10/12 rounded bg-[#d8c7bd]" />
              <div className="h-1 w-11/12 rounded bg-[#d8c7bd]" />
              <div className="h-1 w-7/12 rounded bg-[#d8c7bd]" />
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1 w-full rounded bg-[#eee3dd]" />
              <div className="h-1 w-full rounded bg-[#eee3dd]" />
              <div className="h-1 w-8/12 rounded bg-[#eee3dd]" />
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[8px] bg-[#cbb7aa] px-3 py-1 text-[13px] font-extrabold text-[#2b1d1b]">
              {status}
            </span>

            {devis.date_creation ? (
              <span className="text-[15px] font-extrabold text-[#2b1d1b]">
                {formatDate(devis.date_creation)}
              </span>
            ) : null}
          </div>

          <p className="mt-3 truncate text-[20px] font-black text-[#2b1d1b]">
            {title}
          </p>

          <p className="mt-2 line-clamp-2 text-[15px] font-bold leading-6 text-[#704f49]">
            {subtitle}
          </p>

          <p className="mt-3 text-[18px] font-black text-[#2b1d1b]">
            {amount} HT
          </p>
        </div>
      </div>
    </button>
  );
}

function DevisDetailModal({
  devis,
  t,
  onClose,
}: {
  devis: Devis;
  t: (key: string) => string;
  onClose: () => void;
}) {
  const pdfUrl = buildPdfUrl(devis);
  const clientName = formatClientName(devis);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-[980px] flex-col overflow-hidden rounded-[24px] bg-[#f8f3ee] shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ead8ce] bg-white p-4">
          <div className="min-w-0">
            <p className="truncate text-[18px] font-black text-[#2b1d1b]">
              {devis.numero_devis || t('quoteWithoutNumber')}
            </p>
            <p className="mt-1 truncate text-[13px] font-bold text-[#704f49]">
              {clientName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1ece8] text-[22px] font-black text-[#704f49] active:scale-95"
            aria-label={t('close')}
          >
            ×
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[340px_1fr]">
          <aside className="min-h-0 overflow-y-auto border-b border-[#ead8ce] bg-white p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-3">
              <DetailLine label={t('status')} value={formatStatus(devis.statut_devis, t)} />
              <DetailLine label={t('client')} value={clientName} />
              <DetailLine
                label={t('clientId')}
                value={devis.client_id ? String(devis.client_id) : t('notProvided')}
              />
              <DetailLine
                label={t('creationDate')}
                value={devis.date_creation ? formatDate(devis.date_creation) : t('notProvided')}
              />
              <DetailLine
                label={t('validityDate')}
                value={devis.date_validite ? formatDate(devis.date_validite) : t('notProvided')}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <AmountBox label={t('amountHT')} value={devis.montant_ht} />
              <AmountBox label={t('amountTVA')} value={devis.montant_tva} />
              <AmountBox label={t('amountTTC')} value={devis.montant_ttc} strong />
            </div>

            <div className="mt-5 rounded-[18px] bg-[#fbf8f6] p-4">
              <p className="text-[12px] font-black uppercase tracking-wide text-[#704f49]">
                {t('pdfStatus')}
              </p>
              <p className="mt-2 text-[13px] font-bold text-[#2b1d1b]">
                {pdfUrl ? t('pdfAvailable') : t('pdfUnavailable')}
              </p>
            </div>
          </aside>

          <main className="min-h-0 bg-[#f8f3ee] p-3">
            {pdfUrl ? (
              <iframe
                title={devis.numero_devis || t('quoteWithoutNumber')}
                src={pdfUrl}
                className="h-full min-h-[520px] w-full rounded-[18px] border border-[#ead8ce] bg-white"
              />
            ) : (
              <div className="flex h-full min-h-[520px] items-center justify-center rounded-[18px] border border-dashed border-[#d7c4b8] bg-white p-8 text-center">
                <div>
                  <p className="text-[18px] font-black text-[#2b1d1b]">
                    {t('pdfUnavailableTitle')}
                  </p>
                  <p className="mt-2 text-[13px] font-bold text-[#704f49]">
                    {t('pdfUnavailableDescription')}
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPrevious,
  onNext,
  t,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
  t: (key: string) => string;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onPrevious}
        disabled={page <= 1}
        className="h-10 rounded-full bg-[#f1ece8] px-4 text-[13px] font-extrabold text-[#704f49] disabled:opacity-40"
      >
        {t('previous')}
      </button>

      <p className="text-center text-[12px] font-extrabold text-[#704f49]">
        {start}-{end} / {totalItems}
        <br />
        {t('page')} {page} / {totalPages}
      </p>

      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="h-10 rounded-full bg-[#f1ece8] px-4 text-[13px] font-extrabold text-[#704f49] disabled:opacity-40"
      >
        {t('next')}
      </button>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-[#fbf8f6] p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#704f49]">
        {label}
      </p>
      <p className="mt-1 break-words text-[14px] font-extrabold text-[#2b1d1b]">
        {value}
      </p>
    </div>
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
    <div className="rounded-[16px] bg-[#fbf8f6] p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#704f49]">
        {label}
      </p>
      <p className={`mt-1 text-[16px] ${strong ? 'font-black' : 'font-extrabold'}`}>
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

  if (
    normalized.includes('attente') ||
    normalized.includes('pending') ||
    normalized.includes('en attente')
  ) {
    return t('pending');
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

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildPdfUrl(devis: Devis) {
  if (devis.id_devis) {
    return `/api/devis/pdf?downloadUrl=${encodeURIComponent(`/devis/${devis.id_devis}/pdf`)}`;
  }

  const path = devis.chemin_pdf;

  if (!path) return null;

  if (path.startsWith('/devis/')) {
    return `/api/devis/pdf?downloadUrl=${encodeURIComponent(path)}`;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return null;
}