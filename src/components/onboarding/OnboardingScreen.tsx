'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import CompanySearchStep from './CompanySearchStep';

type OnboardingScreenProps = {
  onComplete: () => void;
};

type OnboardingStep =
  | 'welcome'
  | 'step1'
  | 'step2'
  | 'step3'
  | 'step4'
  | 'companySearch'
  | 'chatbot';

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const t = useTranslations('Onboarding');
  const [step, setStep] = useState<OnboardingStep>('welcome');

  if (step === 'step1') return <OnboardingStepOne onContinue={() => setStep('step2')} />;
  if (step === 'step2') return <OnboardingStepTwo onContinue={() => setStep('step3')} />;
  if (step === 'step3') return <OnboardingStepThree onContinue={() => setStep('step4')} />;
  if (step === 'step4') {
   return <OnboardingStepFour onContinue={() => setStep('companySearch')} />;
  }
  if (step === 'companySearch') {
    return <CompanySearchStep onContinue={onComplete} />;
  }

  return (
    <main className="h-screen overflow-hidden bg-[#F5F1EE]">
      <section className="mx-auto flex h-screen w-full max-w-[1440px] flex-col items-center justify-center px-6 py-5">
        <div className="flex w-full max-w-[720px] flex-col items-center text-center">
          <Image
            src="/images/logo-deskalia.jpg"
            alt="Deskalia"
            width={520}
            height={420}
            priority
            className="mb-5 h-auto w-[205px] sm:w-[360px] lg:w-[460px]"
          />

          <h1 className="max-w-[620px] whitespace-pre-line text-[24px] font-extrabold leading-[1.08] text-[#73514c] sm:text-[42px] lg:text-[52px]">
            {t.rich('title', {
              highlight: (chunks) => (
                <span className="italic text-[#ff642d]">{chunks}</span>
              ),
            })}
          </h1>

          <button
            type="button"
            onClick={() => setStep('step1')}
            className="mt-7 h-[50px] w-full max-w-[340px] rounded-[12px] bg-[#ff642d] text-[16px] font-semibold text-black active:scale-[0.98]"
          >
            {t('button')}
          </button>
        </div>
      </section>
    </main>
  );
}

function ProgressBars({ active }: { active: number }) {
  return (
    <div className="mb-4 grid grid-cols-4 gap-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className={`h-[5px] rounded-full ${
            index < active ? 'bg-[#6f4b49]' : 'bg-[#cbb8ad]'
          }`}
        />
      ))}
    </div>
  );
}

function BottomActions({
  progress,
  children,
  onContinue,
}: {
  progress: string;
  children: React.ReactNode;
  onContinue?: () => void;
}) {
  const t = useTranslations('Onboarding.common');

  return (
    <div className="mt-auto">
      <p className="mb-2 text-[36px] font-extrabold italic leading-none text-[#ff642d]">
        {progress}
      </p>

      <h1 className="text-[30px] font-extrabold leading-[1.05] tracking-[-0.5px] text-[#6f4b49]">
        {children}
      </h1>

      <div className="mt-4 border-t border-[#dccdc5] pt-4">
        <button
          type="button"
          onClick={onContinue}
          className="h-[48px] w-full rounded-[12px] bg-[#ff642d] text-[16px] font-extrabold text-[#241815] active:scale-[0.98]"
        >
          {t('continue')}
        </button>
      </div>
    </div>
  );
}

function OnboardingLayout({
  active,
  children,
}: {
  active: number;
  children: React.ReactNode;
}) {
  return (
    <main className="h-screen overflow-hidden bg-[#F5F1EE]">
      <section className="mx-auto flex h-screen w-full max-w-[480px] flex-col overflow-hidden bg-[#F5F1EE] px-5 py-4">
        <ProgressBars active={active} />
        {children}
      </section>
    </main>
  );
}

function OnboardingStepOne({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations('Onboarding.step1');

  return (
    <OnboardingLayout active={1}>
      <div className="relative h-[255px] shrink-0">
        <div className="absolute left-2 top-1 rounded-[12px] bg-white px-4 py-3 shadow-xl">
          <p className="text-[20px] font-extrabold text-[#2a1c19]">{t('card1Title')}</p>
          <p className="text-[18px] text-[#2a1c19]">{t('card1Subtitle')}</p>
        </div>

        <div className="absolute right-0 top-[105px] rounded-[12px] bg-white px-3 py-2 shadow-lg">
          <p className="text-[16px] font-extrabold text-[#2a1c19]">{t('card2Title')}</p>
          <p className="text-[14px] text-[#2a1c19]">{t('card2Subtitle')}</p>
        </div>

        <div className="absolute left-[85px] top-[190px] rounded-[9px] bg-white px-3 py-2 shadow-md">
          <p className="text-[14px] font-extrabold text-[#2a1c19]">{t('card3Title')}</p>
          <p className="text-[12px] text-[#2a1c19]">{t('card3Subtitle')}</p>
        </div>
      </div>

      <BottomActions progress={t('progress')} onContinue={onContinue}>
        {t('headlineBefore')}{' '}
        <span className="text-[#ff642d]">{t('headlineHighlight')}</span>{' '}
        {t('headlineAfter')}
      </BottomActions>
    </OnboardingLayout>
  );
}

function OnboardingStepTwo({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations('Onboarding.step2');

  return (
    <OnboardingLayout active={2}>
      <div className="flex h-[285px] shrink-0 flex-col items-center justify-center text-center text-[#6f4b49]">
        <p className="text-[46px] font-extrabold leading-none tracking-[-1px]">{t('visualLine1')}</p>
        <p className="mt-4 text-[30px] font-extrabold leading-none">{t('visualLine2')}</p>
        <p className="mt-4 text-[24px] font-extrabold leading-none">{t('visualLine3')}</p>
        <p className="mt-4 text-[18px] font-extrabold leading-none blur-[1px] opacity-80">{t('visualLine4')}</p>
        <p className="mt-4 text-[12px] font-extrabold leading-none blur-[2px] opacity-45">{t('visualLine5')}</p>
      </div>

      <BottomActions progress={t('progress')} onContinue={onContinue}>
        <span className="text-[#ff642d]">{t('headlineHighlight')}</span>{' '}
        {t('headlineAfter')}
      </BottomActions>
    </OnboardingLayout>
  );
}

function QuoteMockup() {
  return (
    <div className="relative mx-auto h-[310px] w-full max-w-[350px]">
      <div className="absolute left-[48px] top-[62px] z-10 rounded-[8px] bg-[#efc59e] px-7 py-4 text-[15px] font-extrabold text-[#7a3419]">
        Valider
      </div>

      <div className="absolute left-1/2 top-[72px] h-[255px] w-[235px] -translate-x-1/2 rounded-[10px] bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="h-4 w-16 rounded bg-[#111]" />
            <div className="mt-2 h-1.5 w-20 rounded bg-[#d9d9d9]" />
            <div className="mt-1 h-1.5 w-16 rounded bg-[#d9d9d9]" />
          </div>
          <div className="space-y-1">
            <div className="h-2 w-24 rounded bg-[#374151]" />
            <div className="h-2 w-20 rounded bg-[#374151]" />
          </div>
        </div>

        <div className="mb-2 h-3 w-24 rounded bg-[#374151]" />
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-[1px]">
          {Array.from({ length: 44 }).map((_, index) => (
            <div
              key={index}
              className={`h-3 rounded-sm ${index % 4 === 1 ? 'bg-[#e5e7eb]' : 'bg-[#f3f4f6]'}`}
            />
          ))}
        </div>
      </div>

      <div className="absolute right-[25px] top-[255px] z-20 rounded-[8px] bg-[#efc59e] px-7 py-4 text-[15px] font-extrabold text-[#7a3419]">
        Modifier
      </div>
    </div>
  );
}

function EnvelopeMockup() {
  return (
    <div className="flex h-[390px] shrink-0 items-center justify-center">
      <div className="relative h-[285px] w-[330px]">
        <div className="absolute inset-x-0 bottom-0 h-[210px] rounded-[38px] border-[18px] border-[#ff642d] bg-[#ffbd7b] shadow-2xl" />

        <div className="absolute left-1/2 top-[15px] h-[170px] w-[250px] -translate-x-1/2 rounded-t-[28px] bg-[#ff642d] rotate-45" />

        <div className="absolute left-1/2 top-[70px] z-20 h-[185px] w-[165px] -translate-x-1/2 bg-white p-2 shadow-lg">
          <div className="mb-2 flex items-start justify-between">
            <div className="h-4 w-14 rounded bg-[#111]" />
            <div className="space-y-1">
              <div className="h-1.5 w-20 rounded bg-[#374151]" />
              <div className="h-1.5 w-16 rounded bg-[#374151]" />
            </div>
          </div>

          <div className="mb-2 h-2.5 w-20 rounded bg-[#374151]" />
          <div className="grid grid-cols-[1fr_2fr_1fr] gap-[1px]">
            {Array.from({ length: 45 }).map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-sm ${index % 3 === 1 ? 'bg-[#e5e7eb]' : 'bg-[#f3f4f6]'}`}
              />
            ))}
          </div>
        </div>

        <div className="absolute inset-x-[18px] bottom-[18px] z-30 h-[145px] rounded-b-[22px] bg-[#ffbd7b] [clip-path:polygon(0_0,50%_58%,100%_0,100%_100%,0_100%)]" />
      </div>
    </div>
  );
}

function OnboardingStepThree({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations('Onboarding.step3');

  return (
    <OnboardingLayout active={3}>
      <QuoteMockup />

      <BottomActions progress={t('progress')} onContinue={onContinue}>
        {t('headlineBefore')},{' '}
        <span>{t('headlineMiddle')}</span>
        <br />
        {t('headlineAnd')}{' '}
        <span className="text-[#ff642d]">{t('headlineHighlight')}</span>{' '}
        {t('headlineAfter')}
      </BottomActions>
    </OnboardingLayout>
  );
}

function OnboardingStepFour({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations('Onboarding.step4');

  return (
    <OnboardingLayout active={4}>
      <EnvelopeMockup />

      <BottomActions progress={t('progress')} onContinue={onContinue}>
        {t('headline')}
      </BottomActions>
    </OnboardingLayout>
  );
}