//components\CreateNewsEntry.tsx
'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AddNewsModal from './AddNewsModal';

export default function CreateNewsEntry() {
  const [open, setOpen] = React.useState(false);
  const [canPost, setCanPost] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/news/can-post', { cache: 'no-store', credentials: 'include' });
        const j = await r.json().catch(() => ({}));
        if (alive) setCanPost(Boolean(j?.canPost));
      } catch {
        if (alive) setCanPost(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!canPost) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 text-sm"
      >
        <Plus className="w-4 h-4" />
        Новая новость
      </button>

      <AddNewsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onCreated={(id) => {
          setOpen(false);
          router.push(`/news/${id}`);
        }}
      />
    </>
  );
}
