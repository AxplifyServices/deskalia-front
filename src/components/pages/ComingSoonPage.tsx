'use client';

import { useTranslations } from 'next-intl';
import PageFrame from '@/components/pages/PageFrame';

export default function ComingSoonPage({ title }: { title: string }) {
  const t = useTranslations('Common');

  return (
    <PageFrame title={title}>
      <div className="flex min-h-[calc(100dvh-140px)] items-center justify-center">
        <div className="rounded-[24px] bg-white p-6 text-center shadow-sm">
          <p className="text-[28px]">✦</p>
          <p className="mt-3 text-[18px] font-extrabold">{t('comingSoon')}</p>
          <p className="mt-2 text-[13px] text-[#704f49]">{t('comingSoonText')}</p>
        </div>
      </div>
    </PageFrame>
  );
}