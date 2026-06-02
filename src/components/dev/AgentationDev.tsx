'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Agentation = dynamic(
  () => import('agentation').then((mod) => mod.Agentation),
  {
    ssr: false,
  },
);

export default function AgentationDev() {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCanRender(true);
    }, 1200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!canRender) {
    return null;
  }

  return <Agentation />;
}