// app/title/[id]/edit/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Header } from "@/components/Header";
import { useTheme } from "@/lib/theme/context";
import { ArrowLeft, Upload, X, User, AlertTriangle, CheckCircle } from "lucide-react";

/* ====== константы ====== */
const RU_STATUS = ["онгоинг", "завершен", "приостановлен"] as const;
const TR_STATUS = ["продолжается", "завершен", "заброшен", "заморожен"] as const;
const AGE = ["0+", "12+", "16+", "18+"] as const;
const TYPES = ["манга", "манхва", "маньхуа", "другое"] as const;

/** БД хранит статус тайтла на АНГЛИЙСКОМ (ongoing/completed/hiatus) - маппим в/из русских значений UI */
const STATUS_EN_TO_RU: Record<string, (typeof RU_STATUS)[number]> = {
  ongoing: "онгоинг",
  completed: "завершен",
  hiatus: "приостановлен",
};
const STATUS_RU_TO_EN: Record<(typeof RU_STATUS)[number], "ongoing" | "completed" | "hiatus"> = {
  онгоинг: "ongoing",
  завершен: "completed",
  приостановлен: "hiatus",
};

/* ====== лимиты ====== */
const LIMITS = {
  titleRu: 199,
  titleRomaji: 200,
  person: 100,         // author / artist
  description: 4000,
  modMessage: 1000,
  teamSearch: 60,
  url: 2048,
};

const TEAM_SEARCH_MIN = 3;
const TEAM_DEBOUNCE_MS = 350; // 300–500 мс — комфортно

const DEFAULT_GENRES = [
  "Арт","Безумие","Боевик","Боевые искусства","Вампиры","Военное","Гарем","Гендерная интрига",
  "Героическое фэнтези","Демоны","Детектив","Дзёсэй","Драма","Игра","Исекай","История","Киберпанк",
  "Кодомо","Комедия","Космос","Магия","Махо-сёдзё","Машины","Меха","Мистика","Музыка",
  "Научная фантастика","Омегаверс","Пародия","Повседневность","Полиция","Постапокалиптика",
  "Приключения","Психология","Романтика","Самурайский боевик","Сверхъестественное",
  "Сёдзё","Сёнен","Спорт","Супер сила","Сэйнэн","Трагедия","Триллер","Ужасы",
  "Фантастика","Фэнтези","Школа","Эротика","Этти",
];

const DEFAULT_TAGS = [
  "Азартные игры","Алхимия","Амнезия / Потеря памяти","Ангелы","Антигерой","Антиутопия","Апокалипсис",
  "Армия","Артефакты","Боги","Бои на мечах","Борьба за власть","Брат и сестра","Будущее","Ведьма",
  "Вестерн","Видеоигры","Виртуальная реальность","Владыка демонов","Военные","Война",
  "Волшебники / маги","Волшебные существа","Воспоминания из другого мира","Выживание",
  "ГГ женщина","ГГ имба","ГГ мужчина","Геймеры","Гильдии","ГГ глупый","Гоблины","Горничные",
  "Гуро","Гяру","Демоны","Драконы","Дружба","Жестокий мир","Животные компаньоны",
  "Завоевание мира","Зверолюди","Злые духи","Зомби","Игровые элементы","Империи","Исторические",
  "Камера","Квесты","Космос","Кулинария","Культивирование","ЛГБТ","Легендарное оружие","Лоли",
  "Магическая академия","Магия","Мафия","Медицина","Месть","Монстро-девушки","Монстры","Мурим",
  "На проверке","Навыки / способности","Наёмники","Насилие / жестокость","Нежить","Ниндзя",
  "Обмен телами","Обратный Гарем","Огнестрельное оружие","Офисные Работники","Пародия","Пираты",
  "Подземелья","Политика","Полиция","Полностью CGI","Преступники / Криминал","Призраки / Духи",
  "Путешествие во времени","Рабы","Разумные расы","Ранги силы","Регрессия","Реинкарнация","Роботы",
  "Рыцари","Самураи","Сгенерировано ИИ","Система","Скрытые личности","Содержит нецензурную брань",
  "Спасение мира","Спортивное тело","Средневековье","Стимпанк","Супергерои","Традиционные игры",
  "ГГ умный","Учитель","Фермерство","Философия","Хикикомори","Холодное оружие","Шантаж","Эльфы",
  "Якудза","Яндере","Япония",
];

/* ====== утилиты ====== */
const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");
const toStrArray = (v: any): string[] => {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (!v) return [];
  try {
    const p = typeof v === "string" ? JSON.parse(v) : v;
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    if (typeof v === "string") {
      return v.split(/[,\n;]+/g).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }
};
const isValidImg = (s: string) => /^https?:\/\/|^\//i.test(s || "");

// безопасная обрезка перед отправкой
const clamp = (s: string | null | undefined, n: number) => (s ?? "").slice(0, n);

/** безопасный json */
async function safeJson<T = any>(res: Response): Promise<T | null> {
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!text) return null;
  if (ct.includes("application/json")) {
    try { return JSON.parse(text) as T; } catch { return null; }
  }
  try { return JSON.parse(text) as T; } catch { return null; }
}

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ===================================================== */

export default function TitleEditPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const search = useSearchParams();

  const rawId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
  const mangaId = Number(rawId?.match(/^\d+/)?.[0] ?? NaN);

  // --- КУДА ВОЗВРАЩАТЬСЯ ---
  const fromParamRaw = search?.get("from") || null;
  const [backHref, setBackHref] = useState<string | null>(null);

  useEffect(() => {
    const fromParam = fromParamRaw && decodeURIComponent(fromParamRaw);
    if (fromParam && fromParam.startsWith("/")) {
      setBackHref(fromParam);
      return;
    }
    const ref = typeof document !== "undefined" ? document.referrer : "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (ref && origin && ref.startsWith(origin)) {
      const path = ref.slice(origin.length) || "/";
      setBackHref(path);
      return;
    }
    setBackHref(`/title/${mangaId}`);
  }, [fromParamRaw, mangaId]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      const ref = document.referrer;
      const origin = window.location.origin;
      if (ref && ref.startsWith(origin)) {
        router.back();
        return;
      }
    }
    router.push(backHref || `/title/${mangaId}`);
  };

  // Глобальный фон страницы - как у тайтла (светлый / тёмный градиент)
  const pageBg =
    theme === "light"
      ? "bg-gray-50 text-gray-900"
      : "bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(255,255,255,0.06),transparent_50%),radial-gradient(900px_500px_at_120%_-10%,rgba(59,130,246,0.08),transparent_40%)] bg-[#0f0f0f] text-gray-100";

  // «стеклянные» карточки и инпуты
  const glassCard =
    theme === "light"
      ? "bg-white/80 border-black/10 backdrop-blur-xl"
      : "bg-white/[0.03] border-white/10 backdrop-blur-xl";
  const label = theme === "light" ? "text-gray-700" : "text-gray-100";
  const muted = theme === "light" ? "text-gray-500" : "text-gray-400";

  // подсказываем системе желаемую схему
  const inputBase =
    "w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none transition-colors " +
    "[appearance:auto] dark:[color-scheme:dark] light:[color-scheme:light]";
  const inputCls =
    theme === "light"
      ? cn(inputBase, "border border-black/10 bg-white/70 focus:border-black/25")
      : cn(inputBase, "border border-white/10 bg-white/[0.04] text-white focus:border-white/25");
  const selectCls = inputCls + " [appearance:auto]";

  // кнопки
  const primaryBtn =
    "group relative rounded-xl px-5 py-2 text-sm font-semibold border border-black/20 dark:border-white/20 bg-white/80 dark:bg-white/[0.06] hover:bg-white/90 dark:hover:bg-white/[0.09] backdrop-blur transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_20px_-10px_rgba(0,0,0,0.45)] hover:shadow-[0_1px_0_rgba(0,0,0,0.06),0_12px_28px_-10px_rgba(0,0,0,0.55)]";
  const secondaryBtn =
    "rounded-xl px-4 py-2 text-sm border border-black/15 dark:border-white/15 bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // форма
  const [coverUrl, setCoverUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [titleRu, setTitleRu] = useState("");
  const [titleRomaji, setTitleRomaji] = useState("");
  const [author, setAuthor] = useState("");
  const [artist, setArtist] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<(typeof RU_STATUS)[number] | "">("");              // RU (UI)
  const [trStatus, setTrStatus] = useState<(typeof TR_STATUS)[number] | "">("");          // RU
  const [age, setAge] = useState<(typeof AGE)[number] | "">("");
  const [year, setYear] = useState<number | "">("");
  const [kind, setKind] = useState<(typeof TYPES)[number] | "">("");

  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const [origLinks, setOrigLinks] = useState<string[]>([]);
  const [modMessage, setModMessage] = useState("");

  const [translators, setTranslators] = useState<
    { id: number | string; name: string; slug: string | null }[]
  >([]);
  const [translatorQuery, setTranslatorQuery] = useState("");
  const [translatorResults, setTranslatorResults] = useState<any[]>([]);

  // Дебаунс-значение и кеш результатов
  const debouncedTeamQ = useDebounced(translatorQuery.trim().toLowerCase(), TEAM_DEBOUNCE_MS);
  const teamCacheRef = React.useRef<Record<string, any[]>>({});

  // превью обложки
  const coverPreviewUrl = useMemo(() => {
    if (!coverFile) return null;
    return URL.createObjectURL(coverFile);
  }, [coverFile]);

  useEffect(() => {
    return () => { if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl); };
  }, [coverPreviewUrl]);

  /* ===== загрузка ===== */
  useEffect(() => {
    if (!Number.isFinite(mangaId)) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const baseRes = await fetch(`/api/manga/${mangaId}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const baseJ = (await safeJson<any>(baseRes)) ?? {};
        if (!baseRes.ok || !baseJ?.item) throw new Error("Тайтл не найден");

        const m = baseJ.item;
        const [gJ, tJ, tmJ] = await Promise.all([
          fetch(`/api/manga/${mangaId}/genres`, { cache: "no-store" }).then(safeJson<any>).catch(() => null),
          fetch(`/api/manga/${mangaId}/tags`,   { cache: "no-store" }).then(safeJson<any>).catch(() => null),
          fetch(`/api/manga/${mangaId}/teams`,  { cache: "no-store" }).then(safeJson<any>).catch(() => null),
        ]);

        if (cancelled) return;

        setCoverUrl(m.cover_url || "");
        setTitleRu(m.title || "");
        setTitleRomaji(m.title_romaji || "");
        setAuthor(m.author || "");
        setArtist(m.artist || "");
        setDescription(m.description || "");

        const ru = STATUS_EN_TO_RU[(m.status || "").toString().toLowerCase()] ?? (m.status || "");
        setStatus((ru as any) || "");

        setTrStatus((m.translation_status as any) || "");
        setAge((m.age_rating as any) || "");
        setYear(
          m.release_year == null ? "" :
          Number.isFinite(Number(m.release_year)) ? Number(m.release_year) : ""
        );
        setKind((m.type as any) || "");

        const genresFromApi: string[] = Array.isArray(gJ?.items) ? gJ.items.map((x: any) => x.genre) : [];
        const tagsFromApi: string[] = Array.isArray(tJ?.items) ? tJ.items : [];
        setGenres(genresFromApi.length ? genresFromApi : toStrArray(m.genres));
        setTags(tagsFromApi.length ? tagsFromApi : toStrArray(m.tags));

        const teams = Array.isArray(tmJ?.items) ? tmJ.items : [];
        setTranslators(teams.map((t: any) => ({ id: t.id, name: t.name, slug: t.slug ?? null })));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Не удалось загрузить данные тайтла");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [mangaId]);

  /* ===== live-поиск команд (дебаунс + минимум 4 символа + отмена + кеш) ===== */
  useEffect(() => {
    let active = true;
    const q = debouncedTeamQ;

    // Короткие запросы — не дергаем API
    if (q.length < TEAM_SEARCH_MIN) {
      setTranslatorResults([]);
      return;
    }

    // Кеш — если уже искали эту строку, берём из памяти
    if (teamCacheRef.current[q]) {
      setTranslatorResults(teamCacheRef.current[q]);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/teams/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const j = await safeJson<any>(res);
        if (!active) return;
        const items = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.data) ? j.data : []);
        teamCacheRef.current[q] = items;
        setTranslatorResults(items);
      } catch (err: any) {
        if (err?.name === "AbortError") return; // прервано новым запросом — норм
        if (active) setTranslatorResults([]);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedTeamQ]);

  function addTranslator(t: any) {
    if (!t) return;
    setTranslators((prev) =>
      prev.some((x) => String(x.id) === String(t.id))
        ? prev
        : [...prev, { id: t.id, name: t.name, slug: t.slug ?? null }]
    );
    setTranslatorQuery("");
    setTranslatorResults([]);
  }
  const removeTranslator = (id: number | string) =>
    setTranslators((prev) => prev.filter((x) => String(x.id) !== String(id)));

  async function uploadCoverIfNeeded(): Promise<string> {
    if (!coverFile) return coverUrl;
    const fd = new FormData();
    fd.append("file", coverFile);
    fd.append("type", "cover");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await safeJson<{ ok?: boolean; url?: string; error?: string }>(r);
    if (!r.ok || !j?.ok || !j?.url) throw new Error(j?.error || "Ошибка загрузки обложки");
    return j.url as string;
  }

  /* ===== отправка правки ===== */
  async function submitForModeration() {
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      if (!Number.isFinite(mangaId)) throw new Error("Некорректный id тайтла");
      const finalCover = await uploadCoverIfNeeded();

      const payload = {
        title_ru: clamp(titleRu, LIMITS.titleRu) || null,
        title_romaji: clamp(titleRomaji, LIMITS.titleRomaji) || null,
        author: clamp(author, LIMITS.person) || null,
        artist: clamp(artist, LIMITS.person) || null,
        description: clamp(description, LIMITS.description) || null,
        status: status ? STATUS_RU_TO_EN[status as (typeof RU_STATUS)[number]] : null,
        translation_status: trStatus || null,
        age_rating: age || null,
        release_year: year === "" ? null : year,
        type: kind || null,
        cover_url: finalCover || null,
        genres,
        tags,
        translators,
        mangaId,
      };

      const body = {
        type: "title_edit",
        mangaId,
        author_comm: clamp(modMessage, LIMITS.modMessage) || null,
        title_romaji: clamp(titleRomaji, LIMITS.titleRomaji) || null,
        genres,
        tags,
        source_links: origLinks.slice(0, 2).map((u) => clamp(u, LIMITS.url)),
        payload,
      };

      const res = await fetch("/api/title-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await safeJson<any>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Ошибка отправки: HTTP ${res.status}`);
      }

      setNotice("Правка отправлена на модерацию");
      router.push(backHref || `/title/${mangaId}`);
    } catch (e: any) {
      setError(e?.message || "Не удалось отправить на модерацию");
    } finally {
      setSaving(false);
    }
  }

  if (!Number.isFinite(mangaId)) {
    return (
      <div className={`min-h-screen ${pageBg}`}>
        <Header showSearch={false} />
        <div className="p-6 text-sm opacity-70">Некорректный адрес: отсутствует id тайтла.</div>
      </div>
    );
  }

  /* ============ РЕНДЕР ============ */
  return (
    <div className={`min-h-screen ${pageBg}`}>
      <Header showSearch={false} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Хлебные/Навигация */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={goBack}
            className={cn("inline-flex items-center gap-2", secondaryBtn)}
          >
            <ArrowLeft className="h-4 w-4" /> Назад
          </button>
          <div className="text-2xl font-bold">Предложить правку</div>
        </div>

        {/* Alerts */}
        {error && (
          <div
            className={cn(
              "mb-4 rounded-2xl border p-3",
              theme === "light"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-red-500/10 border-red-500/30 text-red-100"
            )}
          >
            <AlertTriangle className="mr-2 inline-block h-4 w-4" />
            {error}
          </div>
        )}
        {notice && (
          <div
            className={cn(
              "mb-4 rounded-2xl border p-3",
              theme === "light"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-green-500/10 border-green-500/30 text-green-100"
            )}
          >
            <CheckCircle className="mr-2 inline-block h-4 w-4" />
            {notice}
          </div>
        )}

        {loading ? (
          <div className="opacity-70 text-sm">Загрузка…</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Левая колонка - обложка/загрузка */}
            <aside className={cn("md:col-span-4", "md:sticky md:top-6 self-start")}>
              <div className={cn("rounded-2xl border p-4", glassCard)}>
                <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  {coverPreviewUrl ? (
                    <Image src={coverPreviewUrl} alt="preview" fill className="object-cover" unoptimized />
                  ) : isValidImg(coverUrl) ? (
                    <Image src={coverUrl} alt="cover" fill className="object-cover" />
                  ) : (
                    <div className={cn("grid h-full w-full place-items-center text-sm", muted)}>Нет обложки</div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <label className={cn("inline-flex cursor-pointer items-center justify-center gap-2", secondaryBtn)}>
                    <Upload className="h-4 w-4" />
                    <span>Загрузить файл</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            </aside>

            {/* Правая колонка - форма */}
            <section className="md:col-span-8 space-y-6">
              {/* Основная информация */}
              <div className={cn("rounded-2xl border", glassCard)}>
                <SectionHeader title="Основная информация" />
                <div className="p-4 md:p-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Название (русское)" labelClass={label}>
                    <input
                      className={inputCls}
                      value={titleRu}
                      maxLength={LIMITS.titleRu}
                      onChange={(e) => setTitleRu(e.target.value)}
                      placeholder="«Ван-панчмэн»"
                    />
                  </Field>
                  <Field label="Оригинальное (ромадзи)" labelClass={label}>
                    <input
                      className={inputCls}
                      value={titleRomaji}
                      maxLength={LIMITS.titleRomaji}
                      onChange={(e) => setTitleRomaji(e.target.value)}
                      placeholder="One Punch Man / Wanpanman"
                    />
                  </Field>
                  <Field label="Автор" labelClass={label}>
                    <input
                      className={inputCls}
                      value={author}
                      maxLength={LIMITS.person}
                      onChange={(e) => setAuthor(e.target.value)}
                    />
                  </Field>
                  <Field label="Художник" labelClass={label}>
                    <input
                      className={inputCls}
                      value={artist}
                      maxLength={LIMITS.person}
                      onChange={(e) => setArtist(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="px-4 md:px-5">
                  <Divider />
                </div>
                {/* Описание */}
                <div className="p-4 md:p-5">
                  <div className={cn("mb-1 text-sm", label)}>Описание</div>
                  <textarea
                    className={cn(
                      inputCls,
                      "min-h-[140px] max-h-60 resize-none overflow-auto leading-relaxed",
                      "nice-scrollbar"
                    )}
                    value={description}
                    maxLength={LIMITS.description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Краткое описание тайтла…"
                  />
                </div>
              </div>

              {/* Статусы и атрибуты */}
              <div className={cn("rounded-2xl border", glassCard)}>
                <SectionHeader title="Статусы и атрибуты" />
                <div className="p-4 md:p-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Select label="Статус тайтла" value={status} onChange={setStatus} items={RU_STATUS} theme={theme} cls={selectCls} />
                  <Select label="Статус перевода" value={trStatus} onChange={setTrStatus} items={TR_STATUS} theme={theme} cls={selectCls} />
                  <Select label="Возрастное ограничение" value={age} onChange={setAge} items={AGE} theme={theme} cls={selectCls} />
                  <Field label="Год релиза" labelClass={label}>
                    <input
                      className={cn(
                        inputCls,
                        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      )}
                      type="number"
                      min={1900}
                      max={new Date().getFullYear() + 1}
                      value={year}
                      onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
                      placeholder="например, 2012"
                    />
                  </Field>
                  <Select label="Тип" value={kind} onChange={setKind} items={TYPES} theme={theme} cls={selectCls} />
                </div>
              </div>

              {/* Жанры и теги */}
              <div className={cn("rounded-2xl border", glassCard)}>
                <SectionHeader title="Жанры и теги" />
                <div className="p-4 md:p-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <PickTokens
                    title="Жанры"
                    theme={theme}
                    values={genres}
                    setValues={setGenres}
                    placeholder="поиск по жанрам…"
                    quick={DEFAULT_GENRES}
                  />
                  <PickTokens
                    title="Теги"
                    theme={theme}
                    values={tags}
                    setValues={setTags}
                    placeholder="поиск по тегам…"
                    quick={DEFAULT_TAGS}
                  />
                </div>
              </div>

              {/* Переводчики */}
              <div className={cn("rounded-2xl border", glassCard, "relative z-[60]")}>
                <SectionHeader title="Переводчики" />
                <div className="p-4 md:p-5">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {translators.length === 0 ? <span className={cn("text-sm", muted)}>Пока не выбрано</span> : null}
                    {translators.map((t) => (
                      <span
                        key={String(t.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                          theme === "light"
                            ? "bg-white/80 border-black/10 text-gray-900 backdrop-blur"
                            : "bg-white/[0.06] border-white/10 text-white backdrop-blur"
                        )}
                      >
                        <User className="h-4 w-4 opacity-70" />
                        <span className="max-w-[220px] truncate">{t.name}</span>
                        <button
                          className="opacity-70 hover:opacity-100"
                          onClick={() => removeTranslator(t.id)}
                          aria-label="Удалить переводчика"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                  <input
                    className={inputCls}
                    value={translatorQuery}
                    maxLength={LIMITS.teamSearch}
                    onChange={(e) => setTranslatorQuery(e.target.value)}
                    placeholder="Найдите команду по названию/слагу…"
                  />

                  {translatorQuery.trim().length > 0 &&
                  translatorQuery.trim().length < TEAM_SEARCH_MIN && (
                    <div className="mt-1 text-xs opacity-70">
                      Введите ещё {TEAM_SEARCH_MIN - translatorQuery.trim().length} символ(а) для поиска
                    </div>
                  )}

                  {translatorResults.length > 0 &&
                  translatorQuery.trim().length >= TEAM_SEARCH_MIN && (
                    <div
                      role="listbox"
                      className={cn(
                        // поверх соседних карточек
                        "absolute left-0 right-0 mt-1 w-full overflow-auto rounded-2xl border z-[70] shadow-xl",
                        // 7–8 строк по ~40px = 280–320px
                        "max-h-[155px]",
                        // единый аккуратный скролл
                        "nice-scrollbar",
                        // фон/границы по теме
                        theme === "light"
                          ? "bg-white/95 border-black/10 backdrop-blur"
                          : "bg-[#0b0b0f]/95 border-white/10 backdrop-blur text-white"
                      )}
                    >
                      {translatorResults.map((t) => (
                        <button
                          key={t.id as any}
                          type="button"
                          onClick={() => addTranslator(t)}
                          className={cn(
                            // фиксированная высота строки — так ровно считается «8 штук»
                            "w-full h-10 px-3 text-left text-sm flex items-center",
                            theme === "light" ? "hover:bg-black/5" : "hover:bg-white/10"
                          )}
                        >
                          <span className="truncate">{t.name}</span>
                          {t.slug ? (
                            <span className="ml-2 opacity-70 truncate">({t.slug})</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Источники + модсообщение */}
              <div className={cn("rounded-2xl border", glassCard)}>
                <SectionHeader title="Источники и комментарий для модерации" />
                <div className="p-4 md:p-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <LinksInput
                    label="Ссылки на оригинал"
                    theme={theme}
                    values={origLinks}
                    placeholder="https://…"
                    onChange={setOrigLinks}
                  />
                  <div>
                    <div className={cn("mb-1 text-sm", label)}>Сообщение для модераторов</div>
                    <textarea
                      className={cn(
                        inputCls,
                        "min-h-[120px] max-h-56 resize-none overflow-auto",
                        "nice-scrollbar"
                      )}
                      placeholder="Источник названия/обложки и причина правок"
                      value={modMessage}
                      maxLength={LIMITS.modMessage}
                      onChange={(e) => setModMessage(e.target.value)}
                    />
                  </div>
                </div>

                {/* Панель действий */}
                <div className="px-4 md:px-5 pb-4 md:pb-5">
                  <div className="h-px w-full bg-black/10 dark:bg-white/10 mb-4" />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={submitForModeration}
                      disabled={saving}
                      className={cn(primaryBtn, saving && "opacity-60 cursor-not-allowed")}
                    >
                      Отправить на модерацию
                    </button>
                    <button onClick={goBack} className={secondaryBtn}>
                      Отмена
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====== мелкие UI ====== */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 md:px-5 pt-4 md:pt-5">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="mt-3 h-px w-full bg-black/10 dark:bg-white/10" />
    </div>
  );
}

function Divider() { return <div className="h-px w-full bg-black/10 dark:bg-white/10" />; }

function Field({
  label,
  children,
  labelClass,
}: {
  label: string;
  children: React.ReactNode;
  labelClass?: string;
}) {
  return (
    <div>
      <div className={cn("mb-1 text-sm", labelClass)}>{label}</div>
      {children}
    </div>
  );
}

function Select<T extends readonly string[]>({
  label, value, onChange, items, theme, cls,
}: {
  label: string;
  value: T[number] | "";
  onChange: (v: T[number] | "") => void;
  items: T;
  theme: "light" | "dark";
  cls: string;
}) {
  const selectStyle: React.CSSProperties = { colorScheme: "light" };
  return (
    <div>
      <div className={`mb-1 text-sm ${theme === "light" ? "text-gray-700" : "text-gray-100"}`}>{label}</div>
      <select
        className={`${cls} [&>option]:text-black dark:[&>option]:text-black appearance-auto`}
        value={value}
        onChange={(e) => onChange(e.target.value as any)}
        style={selectStyle}
      >
        <option value="" className="text-black">-</option>
        {items.map((it) => (
          <option value={it} key={it} className="text-black">{it}</option>
        ))}
      </select>
    </div>
  );
}

function PickTokens({
  title, theme, values, setValues, placeholder, quick,
}: {
  title: string;
  theme: "light" | "dark";
  values: string[];
  setValues: (v: string[]) => void;
  placeholder: string;
  quick: readonly string[];
}) {
  const [q, setQ] = React.useState("");

  const inputBase =
    "w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none transition-colors " +
    "[appearance:auto] dark:[color-scheme:dark] light:[color-scheme:light]";
  const inputCls =
    theme === "light"
      ? cn(inputBase, "border border-black/10 bg-white/70 focus:border-black/25")
      : cn(inputBase, "border border-white/10 bg-white/[0.04] text-white focus:border-white/25");

  const available = React.useMemo(
    () => quick.filter((x) => !values.includes(x)),
    [quick, values]
  );

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return available;
    return available.filter((x) => x.toLowerCase().includes(s));
  }, [q, available]);

  const add = (token: string) => {
    if (!values.includes(token)) setValues([...values, token]);
    setQ("");
  };
  const remove = (token: string) => setValues(values.filter((x) => x !== token));

  const onEnter: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (filtered.length > 0) add(filtered[0]); }
  };

  return (
    <div>
      <div className={`mb-1 text-sm ${theme === "light" ? "text-gray-700" : "text-gray-100"}`}>{title}</div>
      <input
        className={cn(inputCls, "mb-2")}
        value={q}
        maxLength={LIMITS.teamSearch}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onEnter}
        placeholder={placeholder || "поиск по списку…"}
      />
      <div className="mb-2 flex flex-wrap gap-1">
        {values.map((s) => (
          <span
            key={s}
            className={
              theme === "light"
                ? "inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-1 text-xs text-gray-800 border border-black/10 backdrop-blur"
                : "inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-xs text-gray-100 border border-white/10 backdrop-blur"
            }
          >
            {s}
            <button type="button" onClick={() => remove(s)} className="ml-1 hover:opacity-80">×</button>
          </span>
        ))}
      </div>

      <div
        className={cn(
          "mt-2 max-h-44 overflow-auto rounded-xl border border-black/10 dark:border-white/10 p-2 text-xs bg-white/60 dark:bg-white/[0.04] backdrop-blur",
          "nice-scrollbar"
        )}
      >
        {filtered.length === 0 ? (
          <div className={cn("py-6 text-center", theme === "light" ? "text-gray-500" : "text-gray-400")}>
            Ничего не найдено
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => add(token)}
                className={cn(
                  "rounded-full px-2 py-1 transition-colors",
                  theme === "light"
                    ? "bg-black/5 text-gray-800 hover:bg-black/10"
                    : "bg-white/[0.08] text-slate-200 hover:bg-white/[0.14]"
                )}
                title="Добавить"
              >
                {token}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LinksInput({
  label, theme, values, onChange, placeholder,
}: {
  label: string;
  theme: "light" | "dark";
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const MAX = 2;

  const [rows, setRows] = useState<string[]>(() =>
    values.length ? values.slice(0, MAX) : [""]
  );

  useEffect(() => {
    const sanitized = rows.map((s) => s.trim()).filter(Boolean).slice(0, MAX);
    onChange(sanitized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const inputBase =
    "w-full rounded-xl px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none transition-colors " +
    "[appearance:auto] dark:[color-scheme:dark] light:[color-scheme:light]";
  const inputCls =
    theme === "light"
      ? cn(inputBase, "border border-black/10 bg-white/70 focus:border-black/25")
      : cn(inputBase, "border border-white/10 bg-white/[0.04] text-white focus:border-white/25");

  const btnCls =
    "rounded-xl border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm transition-colors " +
    "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

  const plusDisabled = rows.length >= MAX;

  const update = (i: number, val: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[i] = val;
      return next;
    });
  };

  const addRow = () => { if (!plusDisabled) setRows((prev) => [...prev, ""]); };
  const removeRow = (i: number) => {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length ? next : [""];
    });
  };

  return (
    <div>
      {label && (
        <div className={`mb-1 text-sm ${theme === "light" ? "text-gray-700" : "text-gray-100"}`}>
          {label}
        </div>
      )}

      <div className="space-y-2">
        {rows.map((val, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={cn(inputCls, "flex-1")}
              value={val}
              maxLength={LIMITS.url}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && i === rows.length - 1 && !plusDisabled) {
                  e.preventDefault();
                  addRow();
                }
              }}
              placeholder={placeholder || "https://…"}
              inputMode="url"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className={btnCls}
                aria-label="Удалить строку"
                title="Удалить"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={addRow}
          className={cn(btnCls, plusDisabled && "opacity-50 cursor-not-allowed")}
          disabled={plusDisabled}
          title={plusDisabled ? "Можно максимум 2 ссылки" : "Добавить строку"}
        >
          +
        </button>
      </div>
    </div>
  );
}
