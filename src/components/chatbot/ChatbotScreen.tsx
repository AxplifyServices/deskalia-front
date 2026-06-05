'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { authHeaders } from '@/lib/auth-client';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ApiMaterial = {
  nom: string;
  price: number;
};

type ApiJob = {
  Message: string;
  Job_found: string | null;
  Reformulation?: string;
  Unité?: string;
  Price?: number;
  materiel_price?: number;
  main_oeuvre_price?: number;
  total_hours?: number;
  list_materiaux?: Record<string, ApiMaterial>;
  status?: string;
};

type SearchJobsResponse = {
  success?: boolean;
  jobs?: Record<string, ApiJob>;
  conversation_id?: string;
  conversation_persistence?: {
    success: boolean;
    status: number;
    error?: string;
  } | null;
  error?: string;
};

type GenerateDevisResponse = {
  success?: boolean;
  message?: string;
  devis_id?: number;
  devis_number?: string;
  total_ht?: number;
  total_ttc?: number;
  file_path?: string;
  download_url?: string;
  pdf_url?: string;
  error?: string;
};

type JobDraft = {
  description: string;
  quantity: number;
  materialUnitPrice: number;
  laborUnitPrice: number;
  estimatedHours: number;
  taxRate: number;
};

type EditableJob = {
  key: string;
  title: string;
  description: string;
  unit: string;
  quantity: number;
  materialUnitPrice: number;
  laborUnitPrice: number;
  estimatedHours: number;
  taxRate: number;
  isEditing: boolean;
  draft: JobDraft | null;
};

type TranscribeApiResponse = {
  success?: boolean;
  text?: string;
  error?: string;
};

type ChatbotScreenProps = {
  onLogout?: () => void;
  onOpenSidebar?: () => void;
  conversationId?: string | null;
  onConversationSaved?: (conversationId: string) => void;
};

export default function ChatbotScreen({
  onLogout,
  onOpenSidebar,
  conversationId,
  onConversationSaved,
}: ChatbotScreenProps) {
  const t = useTranslations('Chatbot');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [jobs, setJobs] = useState<EditableJob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);

  const [depositPercent, setDepositPercent] = useState(30);
  const [midProjectPercent, setMidProjectPercent] = useState(30);
  const [paymentMode, setPaymentMode] = useState('Virement bancaire');

  const [validityDays, setValidityDays] = useState(30);
  const [customEstimatedDays, setCustomEstimatedDays] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [clientId, setClientId] = useState('');

  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [isGeneratingDevis, setIsGeneratingDevis] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const localConversationIdRef = useRef<string>(conversationId ?? crypto.randomUUID());
  const hasStartedLocalConversationRef = useRef(false);

  function buildAuthHeaders(extraHeaders?: Record<string, string>): HeadersInit {
    const headers = new Headers(extraHeaders);

    const authorization = authHeaders().Authorization;

    if (authorization) {
      headers.set('Authorization', authorization);
    }

    return headers;
  }

useEffect(() => {
  async function loadConversationMessages() {
    if (conversationId) {
      localConversationIdRef.current = conversationId;
    }

    if (!conversationId) {
      localConversationIdRef.current = crypto.randomUUID();
      hasStartedLocalConversationRef.current = false;
      setMessages([]);
      setJobs([]);
      setGeneratedPdfUrl(null);
      setCustomEstimatedDays(null);
      return;
    }

    if (hasStartedLocalConversationRef.current) {
      return;
    }

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'GET',
          headers: buildAuthHeaders(),
          cache: 'no-store',
        },
      );

      const data = await response.json();

      if (!response.ok || data.success === false) {
        console.warn('[CHATBOT] Impossible de charger la conversation', data);
        return;
      }

      const loadedMessages = (data.messages ?? []).map(
        (message: { role: 'user' | 'assistant'; content: string }) => ({
          id: crypto.randomUUID(),
          role: message.role,
          content: message.content,
        }),
      );

      setMessages(loadedMessages);
      setJobs([]);
      setGeneratedPdfUrl(null);
      setCustomEstimatedDays(null);
    } catch (error) {
      console.error('[CHATBOT] Erreur chargement conversation', error);
    }
  }

  void loadConversationMessages();
}, [conversationId]);

  useEffect(() => {
    return () => {
      if (generatedPdfUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(generatedPdfUrl.split('#')[0]);
      }
    };
  }, [generatedPdfUrl]);

  const totals = useMemo(() => {
    return computeTotalsFromJobs(jobs, depositPercent, midProjectPercent);
  }, [jobs, depositPercent, midProjectPercent]);

  const selectedEstimatedDays = customEstimatedDays ?? totals.estimatedDays;

async function sendTextToSearchJobs(content: string) {
  const cleanContent = content.trim();
  if (!cleanContent || isThinking) return;

  const activeConversationId = localConversationIdRef.current;

  const currentChatHistory = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  hasStartedLocalConversationRef.current = true;

  setMessages((current) => [
    ...current,
    { id: crypto.randomUUID(), role: 'user', content: cleanContent },
  ]);

  setInput('');
  setJobs([]);
  setGeneratedPdfUrl(null);
  setCustomEstimatedDays(null);
  setIsThinking(true);

  try {
    const response = await fetch('/api/search-jobs', {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        query: cleanContent,
        conversation_id: activeConversationId,
        chat_history: currentChatHistory,
        persist_conversation: true,
      }),
    });

    const data = (await response.json()) as SearchJobsResponse;

    const savedConversationId = data.conversation_id || activeConversationId;

    if (savedConversationId) {
      localConversationIdRef.current = savedConversationId;
    }

    if (!response.ok || data.success === false) {
      const errorMessage = data.error || t('searchError');

      if (
        response.status === 401 ||
        errorMessage.toLowerCase().includes('token has expired') ||
        errorMessage.toLowerCase().includes('expired')
      ) {
        onLogout?.();
        throw new Error('Votre session a expiré. Merci de vous reconnecter.');
      }

      throw new Error(errorMessage);
    }

    const normalizedJobs = normalizeJobs(data.jobs || {});
    setJobs(normalizedJobs);

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          normalizedJobs.length > 0
            ? t('jobsFound', { count: normalizedJobs.length })
            : t('noJobsFound'),
      },
    ]);

    if (data.conversation_persistence?.success === true && savedConversationId) {
      onConversationSaved?.(savedConversationId);
    }

    if (data.conversation_persistence?.success === false) {
      console.warn(
        '[CHATBOT] La recherche jobs a réussi mais la conversation n’a pas été sauvegardée',
        data.conversation_persistence,
      );
    }
  } catch (error) {
    console.error('[CHATBOT] Erreur recherche jobs', error);

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : t('searchError'),
      },
    ]);
  } finally {
    setIsThinking(false);
  }
}

  async function startRecording() {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        if (recordedAudioUrl) {
          URL.revokeObjectURL(recordedAudioUrl);
        }

        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(audioUrl);

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      });

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('[CHATBOT] Erreur micro', error);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: t('microphoneError'),
        },
      ]);
    }
  }

  function stopRecording() {
    if (!isRecording) return;

    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function clearRecordedAudio() {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }

    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
  }

  async function sendRecordedAudio() {
    if (!recordedAudioBlob || isThinking) return;

    setIsThinking(true);

    try {
      const formData = new FormData();
      formData.append('audio', recordedAudioBlob, 'recording.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: formData,
      });

      const data = (await response.json()) as TranscribeApiResponse;

      if (!response.ok || data.success === false || !data.text) {
        throw new Error(data.error || t('transcriptionError'));
      }

      clearRecordedAudio();
      setIsThinking(false);
      await sendTextToSearchJobs(data.text);
    } catch (error) {
      console.error('[CHATBOT] Erreur transcription audio', error);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: error instanceof Error ? error.message : t('transcriptionError'),
        },
      ]);

      setIsThinking(false);
    }
  }

  function startEdit(jobKey: string) {
    setJobs((current) =>
      current.map((job) =>
        job.key === jobKey
          ? {
              ...job,
              isEditing: true,
              draft: {
                description: job.description,
                quantity: job.quantity,
                materialUnitPrice: job.materialUnitPrice,
                laborUnitPrice: job.laborUnitPrice,
                estimatedHours: job.estimatedHours,
                taxRate: job.taxRate,
              },
            }
          : job,
      ),
    );
  }

  function updateDraft(jobKey: string, patch: Partial<JobDraft>) {
    setJobs((current) =>
      current.map((job) =>
        job.key === jobKey && job.draft
          ? {
              ...job,
              draft: {
                ...job.draft,
                ...patch,
              },
            }
          : job,
      ),
    );
  }

  function validateJob(jobKey: string) {
    setJobs((current) =>
      current.map((job) => {
        if (job.key !== jobKey || !job.draft) return job;

        return {
          ...job,
          description: job.draft.description,
          quantity: job.draft.quantity,
          materialUnitPrice: job.draft.materialUnitPrice,
          laborUnitPrice: job.draft.laborUnitPrice,
          estimatedHours: job.draft.estimatedHours,
          taxRate: job.draft.taxRate,
          isEditing: false,
          draft: null,
        };
      }),
    );
  }

  function cancelJobEdit(jobKey: string) {
    setJobs((current) =>
      current.map((job) =>
        job.key === jobKey
          ? {
              ...job,
              isEditing: false,
              draft: null,
            }
          : job,
      ),
    );
  }

  function removeJob(jobKey: string) {
    setJobs((current) => current.filter((job) => job.key !== jobKey));
  }

async function validateAllEstimates() {
  if (jobs.length === 0 || isGeneratingDevis) return;

  setIsGeneratingDevis(true);
  setGeneratedPdfUrl(null);

  try {
    const payload = buildDevisPayload(jobs);

    console.log('[CHATBOT][DEVIS] Payload envoyé au proxy Next =', payload);

    const response = await fetch('/api/devis/from-jobs', {
      method: 'POST',
      headers: buildAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();

    console.log('[CHATBOT][DEVIS] Status génération =', response.status);
    console.log(
      '[CHATBOT][DEVIS] Réponse génération brute =',
      rawText.length > 1200 ? `${rawText.slice(0, 1200)}...` : rawText,
    );

    let data: GenerateDevisResponse;

    try {
      data = rawText ? (JSON.parse(rawText) as GenerateDevisResponse) : {};
    } catch (parseError) {
      console.error('[CHATBOT][DEVIS] Réponse génération non JSON', parseError);

      throw new Error(
        `Réponse invalide du serveur. Status ${response.status}. Le serveur a renvoyé une réponse non JSON.`,
      );
    }

    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.message || t('generateDevisError'));
    }

    const pdfProxyUrl = data.pdf_url || data.download_url || null;

    console.log('[CHATBOT][DEVIS] URL PDF reçue =', pdfProxyUrl);

    if (!pdfProxyUrl) {
      throw new Error('Le devis a été généré mais aucune URL PDF n’a été retournée.');
    }

    /**
     * Important :
     * Une iframe n’envoie pas le header Authorization.
     * Donc on récupère le PDF nous-mêmes avec fetch + JWT,
     * puis on affiche un blob local dans l’iframe.
     */
    const pdfResponse = await fetch(pdfProxyUrl, {
      method: 'GET',
      headers: buildAuthHeaders({
        Accept: 'application/pdf',
      }),
      cache: 'no-store',
    });

    console.log('[CHATBOT][DEVIS] Status récupération PDF =', pdfResponse.status);
    console.log(
      '[CHATBOT][DEVIS] Content-Type PDF =',
      pdfResponse.headers.get('content-type'),
    );

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();

      console.error('[CHATBOT][DEVIS] Erreur récupération PDF =', errorText);

      let readableError = 'Le devis a été généré, mais le PDF est inaccessible.';

      try {
        const errorJson = JSON.parse(errorText) as { error?: string };
        readableError = errorJson.error || readableError;
      } catch {
        // Réponse non JSON, on garde le message générique.
      }

      throw new Error(readableError);
    }

    const pdfBlob = await pdfResponse.blob();
    const pdfBlobUrl = URL.createObjectURL(pdfBlob);

    console.log('[CHATBOT][DEVIS] Blob PDF créé =', pdfBlobUrl);

    setGeneratedPdfUrl(pdfBlobUrl);

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.devis_number
          ? t('devisGenerated', { number: data.devis_number })
          : 'Le devis a été généré avec succès.',
      },
    ]);
  } catch (error) {
    console.error('[CHATBOT][DEVIS] Erreur génération / affichage devis', error);

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error ? error.message : t('generateDevisError'),
      },
    ]);
  } finally {
    setIsGeneratingDevis(false);
  }
}

  function buildDevisPayload(sourceJobs: EditableJob[] = jobs) {
    const computedTotals = computeTotalsFromJobs(sourceJobs, depositPercent, midProjectPercent);
    const finalEstimatedDays = customEstimatedDays ?? computedTotals.estimatedDays;

    const payloadJobs = sourceJobs.reduce<Record<string, unknown>>((acc, job, index) => {
      const current = getVisibleJobValues(job);
      const totalHT = getTotalHT(current);
      const tax = getTaxAmount(current);
      const totalTTC = roundMoney(totalHT + tax);

      acc[`Job_${index + 1}`] = {
        Description_finale: current.description,
        Quantite_finale: current.quantity,
        Price_finale: totalTTC,
        Price_finale_sans_tax: totalHT,
        materiel_price_finale: getMaterialTotal(current),
        main_oeuvre_price_finale: getLaborTotal(current),
        tax_finale: tax,
        Unité: job.unit,
        total_hours_finale: getEstimatedHoursTotal(current),
      };

      return acc;
    }, {});

    return {
      ...payloadJobs,
      Acompte: computedTotals.depositAmount,
      Millieu_chantier: computedTotals.midProjectAmount,
      Mode_paiement: paymentMode,
      Validite: validityDays,
      Durée_estimee: finalEstimatedDays || undefined,
      date_debut: startDate,
      client_id: clientId ? Number(clientId) : undefined,
    };
  }

  const canSend = Boolean(input.trim() || recordedAudioBlob) && !isThinking && !isRecording;

  return (
    <main className="h-full min-h-0 overflow-hidden bg-[#f5f1ee] text-[#2b201e]">
      <section className="mx-auto flex h-full min-h-0 w-full max-w-[560px] flex-col px-4 pb-4 pt-4 sm:px-6 lg:pt-5">
        <header className="relative hidden h-[48px] shrink-0 items-center justify-center lg:flex">
          {onOpenSidebar ? (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#704f49] shadow-sm active:scale-[0.96]"
              aria-label={t('openSidebar')}
              title={t('openSidebar')}
            >
              ☰
            </button>
          ) : null}

          <p className="text-[16px] font-extrabold">{t('title')}</p>

          {onLogout ? (
            <button
              type="button"
              onClick={() => {
                console.warn('[CHATBOT] Clic bouton déconnexion');
                onLogout();
              }}
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[18px] font-black text-[#ff642d] shadow-sm active:scale-[0.96]"
              aria-label={t('logout')}
              title={t('logout')}
            >
              ⎋
            </button>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-4 pt-4">
            {messages.length === 0 && jobs.length === 0 ? (
              <div className="flex min-h-full items-center justify-center">
                <AliaLogo size="large" />
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) =>
                  message.role === 'user' ? (
                    <div
                      key={message.id}
                      className="ml-auto max-w-[78%] rounded-[12px] border border-[#dfcec5] bg-white/40 px-5 py-4 text-[18px] leading-[1.45]"
                    >
                      {message.content}
                    </div>
                  ) : (
                    <div key={message.id} className="flex max-w-[90%] items-start gap-2">
                      <AliaLogo size="small" />
                      <div className="rounded-[22px] bg-white px-5 py-4 text-[15px] leading-[1.45]">
                        {message.content}
                      </div>
                    </div>
                  ),
                )}

                {jobs.length > 0 ? (
                  <div className="space-y-4">
                    {jobs.map((job, index) => (
                      <JobCard
                        key={job.key}
                        job={job}
                        index={index}
                        onStartEdit={() => startEdit(job.key)}
                        onDraftChange={(patch) => updateDraft(job.key, patch)}
                        onValidate={() => validateJob(job.key)}
                        onCancel={() => cancelJobEdit(job.key)}
                        onRemove={() => removeJob(job.key)}
                      />
                    ))}

                    <QuoteOptionsCard
                      depositPercent={depositPercent}
                      midProjectPercent={midProjectPercent}
                      paymentMode={paymentMode}
                      validityDays={validityDays}
                      estimatedDays={selectedEstimatedDays}
                      startDate={startDate}
                      clientId={clientId}
                      depositAmount={totals.depositAmount}
                      midProjectAmount={totals.midProjectAmount}
                      totalHT={totals.totalHT}
                      tax={totals.tax}
                      totalTTC={totals.totalTTC}
                      isGeneratingDevis={isGeneratingDevis}
                      onDepositPercentChange={setDepositPercent}
                      onMidProjectPercentChange={setMidProjectPercent}
                      onPaymentModeChange={setPaymentMode}
                      onValidityDaysChange={setValidityDays}
                      onEstimatedDaysChange={setCustomEstimatedDays}
                      onStartDateChange={setStartDate}
                      onClientIdChange={setClientId}
                      onValidate={validateAllEstimates}
                    />

                    {generatedPdfUrl ? (
                      <div className="rounded-[14px] bg-white p-4 shadow-sm">
                        <p className="mb-3 text-[13px] font-extrabold">
                          {t('generatedDevis')}
                        </p>
                        <iframe
                          src={generatedPdfUrl}
                          className="h-[520px] w-full rounded-[10px] border border-[#eee7e2]"
                          title={t('generatedDevis')}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isThinking ? (
                  <div className="flex items-start gap-2">
                    <AliaLogo size="small" />
                    <div className="flex h-11 items-center rounded-[22px] bg-white px-5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-[#ff642d]" />
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {recordedAudioUrl ? (
            <div className="mb-3 rounded-[14px] bg-white p-3 shadow-sm">
              <audio src={recordedAudioUrl} controls className="w-full" />

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={clearRecordedAudio}
                  className="h-10 flex-1 rounded-[9px] bg-[#f1ece8] text-[12px] font-bold"
                >
                  {t('cancelAudio')}
                </button>

                <button
                  type="button"
                  onClick={sendRecordedAudio}
                  disabled={isThinking}
                  className="h-10 flex-1 rounded-[9px] bg-[#ff642d] text-[12px] font-extrabold text-white disabled:opacity-60"
                >
                  {t('sendAudio')}
                </button>
              </div>
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();

              if (recordedAudioBlob) {
                void sendRecordedAudio();
              } else {
                void sendTextToSearchJobs(input);
              }
            }}
            className="shrink-0"
          >
            <div className="flex min-h-[60px] items-center gap-2 rounded-[18px] bg-white px-3 py-2 shadow-sm">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  isRecording ? 'bg-[#ff3b2f] text-white' : 'bg-[#f1ece8] text-[#ff642d]'
                }`}
                aria-label={isRecording ? t('stopRecording') : t('startRecording')}
              >
                <MicroIcon />
              </button>

              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={isRecording ? t('recording') : t('inputPlaceholder')}
                disabled={isRecording}
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9d8d86]"
              />

              <button
                type="submit"
                disabled={!canSend}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ff642d] text-[18px] font-black text-white disabled:opacity-40"
                aria-label={t('send')}
              >
                ↑
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function JobCard({
  job,
  index,
  onStartEdit,
  onDraftChange,
  onValidate,
  onCancel,
  onRemove,
}: {
  job: EditableJob;
  index: number;
  onStartEdit: () => void;
  onDraftChange: (patch: Partial<JobDraft>) => void;
  onValidate: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('Chatbot');
  const current = getVisibleJobValues(job);

  const materialTotal = getMaterialTotal(current);
  const laborTotal = getLaborTotal(current);
  const totalHours = getEstimatedHoursTotal(current);
  const totalHT = getTotalHT(current);
  const tax = getTaxAmount(current);
  const totalTTC = roundMoney(totalHT + tax);

  return (
    <div className="rounded-[14px] bg-white p-4 shadow-sm">
      {!job.isEditing ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-extrabold">
              {t('item')} #{index + 1}
            </p>
            <p className="shrink-0 text-[12px] font-bold text-[#ff642d]">
              {formatCurrency(totalTTC)}
            </p>
          </div>

          <p className="mt-2 text-[13px] leading-[1.4]">{job.description}</p>

          <div className="mt-3 rounded-[10px] bg-[#fbf8f6] px-3 py-2 text-[12px]">
            <div className="flex justify-between">
              <span>{t('quantity')}</span>
              <strong>
                {job.quantity} {job.unit}
              </strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('materialsPrice')}</span>
              <strong>{formatCurrency(materialTotal)}</strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('laborPrice')}</span>
              <strong>{formatCurrency(laborTotal)}</strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('totalEstimatedHours')}</span>
              <strong>
                {formatHours(totalHours)} {t('hoursShort')}
              </strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('totalHT')}</span>
              <strong>{formatCurrency(totalHT)}</strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('tax')}</span>
              <strong>{job.taxRate}%</strong>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onStartEdit}
              className="rounded-[8px] bg-[#f1ece8] px-3 py-2 text-[12px] font-bold"
            >
              {t('edit')}
            </button>

            <button
              type="button"
              onClick={onRemove}
              className="rounded-[8px] bg-[#fff0ee] px-3 py-2 text-[12px] font-bold text-[#ff3b2f]"
            >
              {t('delete')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] font-extrabold">
            {t('editItem')} #{index + 1}
          </p>

          <textarea
            value={current.description}
            onChange={(event) => onDraftChange({ description: event.target.value })}
            rows={3}
            className="mt-2 w-full resize-none rounded-[8px] border border-[#eee7e2] bg-[#fbf8f6] p-2 text-[12px] leading-[1.35] outline-none"
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberField
              label={`${t('materialsPrice')} / ${job.unit}`}
              value={current.materialUnitPrice}
              onChange={(value) => onDraftChange({ materialUnitPrice: value })}
            />

            <NumberField
              label={`${t('laborPrice')} / ${job.unit}`}
              value={current.laborUnitPrice}
              onChange={(value) => onDraftChange({ laborUnitPrice: value })}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberField
              label={`${t('quantity')} (${job.unit})`}
              value={current.quantity}
              onChange={(value) => onDraftChange({ quantity: value })}
            />

            <NumberField
              label={t('estimatedHoursPerUnit')}
              value={current.estimatedHours}
              onChange={(value) => onDraftChange({ estimatedHours: value })}
              suffix={t('hoursShort')}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <NumberField
              label={t('tax')}
              value={current.taxRate}
              onChange={(value) => onDraftChange({ taxRate: value })}
              suffix="%"
            />
          </div>

          <div className="mt-3 rounded-[10px] bg-[#fbf8f6] px-3 py-2 text-[12px]">
            <div className="flex justify-between">
              <span>{t('materialsTotal')}</span>
              <strong>{formatCurrency(materialTotal)}</strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('laborTotal')}</span>
              <strong>{formatCurrency(laborTotal)}</strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('totalEstimatedHours')}</span>
              <strong>
                {formatHours(totalHours)} {t('hoursShort')}
              </strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('totalHT')}</span>
              <strong>{formatCurrency(totalHT)}</strong>
            </div>

            <div className="mt-1 flex justify-between">
              <span>{t('estimatedTotal')}</span>
              <strong>{formatCurrency(totalTTC)}</strong>
            </div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-[8px] bg-[#f1ece8] px-3 py-2 text-[12px] font-bold"
            >
              {t('cancel')}
            </button>

            <button
              type="button"
              onClick={onValidate}
              className="rounded-[8px] bg-[#24c23b] px-3 py-2 text-[12px] font-extrabold text-white"
            >
              {t('validate')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function QuoteOptionsCard({
  depositPercent,
  midProjectPercent,
  paymentMode,
  validityDays,
  estimatedDays,
  startDate,
  clientId,
  depositAmount,
  midProjectAmount,
  totalHT,
  tax,
  totalTTC,
  isGeneratingDevis,
  onDepositPercentChange,
  onMidProjectPercentChange,
  onPaymentModeChange,
  onValidityDaysChange,
  onEstimatedDaysChange,
  onStartDateChange,
  onClientIdChange,
  onValidate,
}: {
  depositPercent: number;
  midProjectPercent: number;
  paymentMode: string;
  validityDays: number;
  estimatedDays: number;
  startDate: string;
  clientId: string;
  depositAmount: number;
  midProjectAmount: number;
  totalHT: number;
  tax: number;
  totalTTC: number;
  isGeneratingDevis: boolean;
  onDepositPercentChange: (value: number) => void;
  onMidProjectPercentChange: (value: number) => void;
  onPaymentModeChange: (value: string) => void;
  onValidityDaysChange: (value: number) => void;
  onEstimatedDaysChange: (value: number | null) => void;
  onStartDateChange: (value: string) => void;
  onClientIdChange: (value: string) => void;
  onValidate: () => void;
}) {
  const t = useTranslations('Chatbot');

  return (
    <div className="rounded-[14px] bg-white p-4 shadow-sm">
      <p className="mb-3 text-[13px] font-extrabold">{t('quoteOptions')}</p>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t('estimatedDays')}
          value={estimatedDays}
          onChange={(value) => onEstimatedDaysChange(value)}
          suffix={t('daysShort')}
        />

        <NumberField
          label="Validité du devis"
          value={validityDays}
          onChange={onValidityDaysChange}
          suffix={t('daysShort')}
        />
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-bold text-[#6b5752]">
          {t('startDate')}
        </span>
        <input
          type="text"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          placeholder={t('startDatePlaceholder')}
          className="h-[38px] w-full rounded-[8px] border border-[#eee7e2] bg-white px-2 text-[12px] outline-none"
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-bold text-[#6b5752]">
          {t('clientId')}
        </span>
        <input
          type="number"
          value={clientId}
          onChange={(event) => onClientIdChange(event.target.value)}
          placeholder={t('clientIdPlaceholder')}
          className="h-[38px] w-full rounded-[8px] border border-[#eee7e2] bg-white px-2 text-[12px] outline-none"
        />
      </label>

      <NumberField
        label={t('depositPercent')}
        value={depositPercent}
        onChange={onDepositPercentChange}
        suffix="%"
        className="mt-3"
      />

      <p className="mt-1 text-[11px] text-[#7b6862]">
        {t('amount')}: {formatCurrency(depositAmount)}
      </p>

      <NumberField
        label={t('midProjectPercent')}
        value={midProjectPercent}
        onChange={onMidProjectPercentChange}
        suffix="%"
        className="mt-3"
      />

      <p className="mt-1 text-[11px] text-[#7b6862]">
        {t('amount')}: {formatCurrency(midProjectAmount)}
      </p>

      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-bold text-[#6b5752]">
          {t('paymentMode')}
        </span>
        <select
          value={paymentMode}
          onChange={(event) => onPaymentModeChange(event.target.value)}
          className="h-[38px] w-full rounded-[8px] border border-[#eee7e2] bg-white px-2 text-[12px] outline-none"
        >
          <option value="Virement bancaire">{t('paymentModes.bankTransfer')}</option>
          <option value="Espèces">{t('paymentModes.cash')}</option>
          <option value="Chèque">{t('paymentModes.check')}</option>
        </select>
      </label>

      <div className="mt-3 rounded-[10px] bg-[#fbf8f6] px-3 py-3 text-[12px]">
        <div className="flex justify-between">
          <span>{t('totalHT')}</span>
          <strong>{formatCurrency(totalHT)}</strong>
        </div>

        <div className="mt-1 flex justify-between">
          <span>{t('taxAmount')}</span>
          <strong>{formatCurrency(tax)}</strong>
        </div>

        <div className="mt-1 flex justify-between">
          <span>{t('estimatedTotal')}</span>
          <strong>{formatCurrency(totalTTC)}</strong>
        </div>
      </div>

      <button
        type="button"
        onClick={onValidate}
        disabled={isGeneratingDevis}
        className="mt-4 h-[42px] w-full rounded-[9px] bg-[#24c23b] text-[13px] font-extrabold text-white disabled:opacity-60"
      >
        {isGeneratingDevis ? t('generatingDevis') : t('validateAllEstimates')}
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled = false,
  suffix,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  suffix?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[10px] font-bold text-[#6b5752]">{label}</span>
      <div className="flex h-[34px] items-center rounded-[6px] border border-[#eee7e2] bg-white px-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-[11px] outline-none disabled:text-[#8a7871]"
        />
        {suffix ? <span className="text-[11px] text-[#8a7871]">{suffix}</span> : null}
      </div>
    </label>
  );
}

function normalizeJobs(apiJobs: Record<string, ApiJob>): EditableJob[] {
  return Object.entries(apiJobs)
    .filter(([, job]) => job.Job_found && job.Message === 'Job trouvé')
    .map(([key, job]) => ({
      key,
      title: job.Job_found ?? '',
      description: job.Reformulation || job.Job_found || '',
      unit: job.Unité || 'U',
      quantity: 1,
      materialUnitPrice: Number(job.materiel_price ?? 0),
      laborUnitPrice: Number(job.main_oeuvre_price ?? 0),
      estimatedHours: Number(job.total_hours ?? 0),
      taxRate: 20,
      isEditing: false,
      draft: null,
    }));
}

function getVisibleJobValues(job: EditableJob): JobDraft {
  return job.draft
    ? job.draft
    : {
        description: job.description,
        quantity: job.quantity,
        materialUnitPrice: job.materialUnitPrice,
        laborUnitPrice: job.laborUnitPrice,
        estimatedHours: job.estimatedHours,
        taxRate: job.taxRate,
      };
}

function computeTotalsFromJobs(
  jobs: EditableJob[],
  depositPercent: number,
  midProjectPercent: number,
) {
  const totalHT = jobs.reduce((sum, job) => {
    const current = getVisibleJobValues(job);
    return sum + getTotalHT(current);
  }, 0);

  const tax = jobs.reduce((sum, job) => {
    const current = getVisibleJobValues(job);
    return sum + getTaxAmount(current);
  }, 0);

  const totalHours = jobs.reduce((sum, job) => {
    const current = getVisibleJobValues(job);
    return sum + getEstimatedHoursTotal(current);
  }, 0);

  const totalTTC = totalHT + tax;

  return {
    totalHT: roundMoney(totalHT),
    tax: roundMoney(tax),
    totalTTC: roundMoney(totalTTC),
    totalHours: roundHours(totalHours),
    estimatedDays: getEstimatedDaysFromHours(totalHours),
    depositAmount: roundMoney(totalTTC * (depositPercent / 100)),
    midProjectAmount: roundMoney(totalTTC * (midProjectPercent / 100)),
  };
}

function getMaterialTotal(job: JobDraft) {
  return roundMoney(job.materialUnitPrice * job.quantity);
}

function getLaborTotal(job: JobDraft) {
  return roundMoney(job.laborUnitPrice * job.quantity);
}

function getEstimatedHoursTotal(job: JobDraft) {
  return roundHours(job.estimatedHours * job.quantity);
}

function getEstimatedDaysFromHours(totalHours: number) {
  const cleanTotalHours = Number(totalHours) || 0;

  if (cleanTotalHours <= 0) {
    return 0;
  }

  return Math.ceil(cleanTotalHours / 8);
}

function roundHours(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getTotalHT(job: JobDraft) {
  return roundMoney(getMaterialTotal(job) + getLaborTotal(job));
}

function getTaxAmount(job: JobDraft) {
  return roundMoney(getTotalHT(job) * (job.taxRate / 100));
}

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(value) || 0);
}

function formatHours(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function MicroIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v1a7 7 0 0 1-14 0v-1"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 18v4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AliaLogo({ size }: { size: 'small' | 'large' }) {
  const className =
    size === 'large'
      ? 'flex h-16 w-16 items-center justify-center rounded-full bg-[#ff642d] text-[36px] text-white'
      : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff642d] text-[18px] text-white';

  return <div className={className}>✺</div>;
}