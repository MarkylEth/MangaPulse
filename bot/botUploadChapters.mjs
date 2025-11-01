import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

/* ===== НАСТРОЙ ПОД СЕБЯ =====
   SITE_URL — страница манги, где видна кнопка «Добавить главу»
   ROOT_DIR — папка с подпапками «Том 001 Глава 1», «Том 001 Глава 2 - ...»
   TEAM_NAME — то, что ты видишь в чекбоксе в поле «Команды *»
*/
const SITE_URL  = 'http://localhost:3000/title/65-hulejasig'; // 👈 замени на актуальную URL страницы тайтла
const ROOT_DIR = "E:/manga/Сволочь";                                  // 👈 корневая папка с главами
const TEAM_NAME = 'Rikudou-Sennin Clan';                                                     // 👈 точное имя команды в модалке

/* === ДОБАВЛЕНО: правила по диапазону порядкового номера главы (1..N) === */
const TEAM_BY_RANGE = [
  { from: 1,  to: 50,       teams: ['Rikudou-Sennin Clan'] },              // одна команда
  { from: 51, to: Infinity, teams: ['Rikudou-Sennin Clan'] } // ДВЕ команды
];
function decideTeamsByIndex(seqIndex) {
  for (const r of TEAM_BY_RANGE) {
    if (seqIndex >= r.from && seqIndex <= r.to) {
      const list = Array.isArray(r.teams) ? r.teams : [r.teams].filter(Boolean);
      return list.length ? list : (TEAM_NAME ? [TEAM_NAME] : []);
    }
  }
  return TEAM_NAME ? [TEAM_NAME] : [];
}
function decideTeamByIndex(seqIndex) {
  for (const r of TEAM_BY_RANGE) {
    if (seqIndex >= r.from && seqIndex <= r.to) return r.team;
  }
  return TEAM_NAME; // fallback
}
/* ========================================================================== */
/* ======================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ========================= */
/* ========================================================================== */

/**
 * Имя папки -> данные о главе.
 * Поддерживает:
 *   "Том 001 Глава 2"
 *   "Том 001 Глава 2 - Название главы"
 *   "Том 002 Глава 18.5 - Что-то там"
 */
function parseChapterFolderName(dirName) {
  const re = /^Том\s+(\d+)\s+Глава\s+([\d.]+)(?:\s*-\s*(.+))?$/i;
  const m = dirName.match(re);
  if (!m) {
    throw new Error(`"${dirName}" не совпало с шаблоном "Том N Глава X - Название"`);
  }

  const volumeRaw  = m[1];          // например "001"
  const chapterRaw = m[2];          // например "2" или "18.5"
  const titleRaw   = m[3] ?? '';    // заголовок после "- ...", может отсутствовать

  const volume        = parseInt(volumeRaw, 10) || 0;
  const chapterNumber = parseFloat(chapterRaw); // поддержаем 12.5
  const title         = titleRaw.trim();

  return { volume, chapterNumber, title };
}

/**
 * Сортировка файлов страниц, чтобы "1,2,10" не шло как "1,10,2".
 * Мы пытаемся интерпретировать имя как число, иначе fallback через localeCompare.
 */
function sortPageFiles(files) {
  return files.sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);

    if (Number.isFinite(na) && Number.isFinite(nb)) {
      return na - nb;
    }

    return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Собираем список подпапок в ROOT_DIR ("Том 001 Глава 1", "Том 001 Глава 2 - ..."),
 * парсим их, сортируем по (том, номер главы).
 */
function getChapterFoldersSorted(rootDir) {
  const dirs = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const parsed = dirs.map(name => {
    try {
      const p = parseChapterFolderName(name);
      return {
        name,
        volume: p.volume,
        chapterNumber: p.chapterNumber,
      };
    } catch {
      console.warn(`Пропускаю папку (не подходит по формату): ${name}`);
      return null;
    }
  }).filter(Boolean);

  parsed.sort((a, b) => {
    if (a.volume !== b.volume) return a.volume - b.volume;
    return a.chapterNumber - b.chapterNumber;
  });

  return parsed.map(p => p.name);
}

/* ========================================================================== */
/* ======================== РАБОТА С БРАУЗЕРОМ ============================== */
/* ========================================================================== */

/**
 * Ждём, пока на странице появится кнопка с текстом text.
 * Это сделано для кнопки "Добавить главу".
 * timeoutMs = 0 → ждать бесконечно.
 */
async function waitForButtonByText(page, text, { timeoutMs = 0 } = {}) {
  const start = Date.now();
  while (true) {
    const found = await page.evaluate((t) => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => (b.textContent || '').trim().includes(t));
    }, text);

    if (found) return; // нашли кнопку

    if (timeoutMs && Date.now() - start > timeoutMs) {
      throw new Error(`Кнопка "${text}" не появилась за ${timeoutMs}ms`);
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

/**
 * Клик по первой кнопке, в тексте которой есть text.
 */
async function clickButtonByText(page, text) {
  const clicked = await page.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => (b.textContent || '').trim().includes(t));
    if (btn) {
      (btn).click();
      return true;
    }
    return false;
  }, text);

  if (!clicked) {
    throw new Error(`Не нашёл кнопку "${text}" для клика`);
  }
}

/**
 * Дождаться открытия модалки "Новая глава".
 * В шапке модалки у тебя <h3>Новая глава</h3>.
 */
async function waitModalOpen(page) {
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('h3'))
      .some(h => (h.textContent || '').trim() === 'Новая глава'),
    { polling: 200, timeout: 10000 }
  );
}

/**
 * Дождаться закрытия модалки "Новая глава".
 * После загрузки глава коммитится, модалка демонтируется.
 */
async function waitModalClose(page) {
  await page.waitForFunction(
    () => !Array.from(document.querySelectorAll('h3'))
      .some(h => (h.textContent || '').trim() === 'Новая глава'),
    { polling: 300, timeout: 0 }
  );
}

/**
 * Ввести текст/число в <input placeholder="...">
 * Мы привязаны к плейсхолдерам:
 *  - "0"                → Том
 *  - "например, 12"     → Номер главы *
 *  - "Название"         → Название (опционально)
 */
async function typeIntoInputByPlaceholder(page, placeholder, value) {
  if (value === null || value === undefined || value === '') return;

  const handle = await page.$(`input[placeholder="${placeholder}"]`);
  if (!handle) {
    throw new Error(`Нет input[placeholder="${placeholder}"]`);
  }

  // очистка поля
  await handle.click({ clickCount: 3 });
  await page.keyboard.press('Backspace');

  // ввод
  await page.keyboard.type(String(value), { delay: 20 });
}

/**
 * Ждём, пока появится чекбокс команды с нужным именем.
 * Это важно, потому что команды грузятся через fetch в useEffect.
 */
async function waitForTeamOption(page, teamName, { timeoutMs = 10000 } = {}) {
  const start = Date.now();
  while (true) {
    const found = await page.evaluate((name) => {
      const labels = Array.from(document.querySelectorAll('label'));
      for (const label of labels) {
        const span = label.querySelector('span');
        if (!span) continue;
        const txt = (span.textContent || '').trim();
        if (txt.includes(name)) {
          return true;
        }
      }
      return false;
    }, teamName);

    if (found) return;

    if (timeoutMs && Date.now() - start > timeoutMs) {
      throw new Error(`Команда "${teamName}" не появилась в списке за ${timeoutMs}ms`);
    }

    await new Promise(r => setTimeout(r, 200));
  }
}

/**
 * Ставит галочку у команды перевода по имени.
 */
async function checkTeamByName(page, teamName) {
  if (!teamName.trim()) return;

  const result = await page.evaluate((name) => {
    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      const span = label.querySelector('span');
      if (!span) continue;
      const txt = (span.textContent || '').trim();
      if (txt.includes(name)) {
        const cb = label.querySelector('input[type="checkbox"]');
        if (!cb) return { ok: false, reason: 'нет чекбокса' };

        if (!cb.checked) {
          cb.click();
          return { ok: true, clickedText: txt, already: false };
        } else {
          return { ok: true, clickedText: txt, already: true };
        }
      }
    }
    return { ok: false, reason: 'label не найден' };
  }, teamName);

  if (!result.ok) {
    throw new Error(`Не смог выбрать команду "${teamName}": ${result.reason || 'неизвестно'}`);
  }

  if (result.already) {
    console.log(`Команда "${result.clickedText}" уже была выбрана`);
  } else {
    console.log(`Выбрана команда "${result.clickedText}"`);
  }
}

/**
 * Находим <input type="file" multiple> внутри модалки и загружаем туда файлы.
 * Puppeteer сам сделает uploadFile(...).
 */
async function uploadFilesIntoModal(page, filePaths) {
  const input = await page.$('input[type="file"][multiple]');
  if (!input) {
    throw new Error('Не найден input[type="file"][multiple] в модалке');
  }
  await input.uploadFile(...filePaths);
}

/* === ДОБАВЛЕНО: сброс всех выбранных команд перед выбором новой === */
async function uncheckAllTeams(page) {
  await page.evaluate(() => {
    document.querySelectorAll('label input[type="checkbox"]').forEach(cb => {
      const el = cb; // HTMLInputElement
      if (el.checked) el.click();
    });
  });
}

/* ========================================================================== */
/* ======================== ЗАГРУЗКА ОДНОЙ ГЛАВЫ ============================ */
/* ========================================================================== */

/* === МАЛЕНЬКАЯ ПРАВКА: добавили seqIndex (порядковый № 1..N) === */
async function uploadOneChapter(page, absDir, dirName, seqIndex) {
  console.log('\n==============================');
  console.log('📂 Папка главы:', dirName);

  // 1. Парсим имя папки -> том, номер главы, название (если есть).
  let volume, chapterNumber, title;
  try {
    const parsed = parseChapterFolderName(dirName);
    volume        = parsed.volume;
    chapterNumber = parsed.chapterNumber;
    title         = parsed.title;
  } catch (err) {
    console.error('❌ Не удалось распарсить имя папки:', err.message);
    return;
  }

  // 2. Собираем список страниц (картинки).
  let pages = fs.readdirSync(absDir, { withFileTypes: true })
    .filter(f => f.isFile())
    .map(f => f.name)
    .filter(n => /\.(jpe?g|png|webp|gif)$/i.test(n));

  if (!pages.length) {
    console.warn('⚠ В этой папке нет картинок. Пропускаю.');
    return;
  }

  // Сортируем страницы и делаем абсолютные пути.
  pages = sortPageFiles(pages);
  const absoluteFiles = pages.map(f => path.join(absDir, f));

  console.log(`→ Том: ${volume}, Глава: ${chapterNumber}, Страниц: ${pages.length}`);
  if (title) {
    console.log(`→ Название главы: "${title}"`);
  }

  // 3. Открываем модалку "Новая глава" (кнопка «Добавить главу»).
  await clickButtonByText(page, 'Добавить главу');

  // 4. Ждём, пока модалка полностью смонтируется.
  await waitModalOpen(page);

  // 5. Заполняем поля.
  await typeIntoInputByPlaceholder(page, '0', volume);
  await typeIntoInputByPlaceholder(page, 'например, 12', chapterNumber);
  if (title) await typeIntoInputByPlaceholder(page, 'Название', title);

  // 6. ВЫБОР КОМАНДЫ ПО ДИАПАЗОНУ (по порядковому номеру главы)
  const teamsToPick = decideTeamsByIndex(chapterNumber);

if (teamsToPick.length) {
  await uncheckAllTeams(page);

  for (const t of teamsToPick) {
    if (!t || !t.trim()) continue;
    await waitForTeamOption(page, t, { timeoutMs: 10000 });
    await checkTeamByName(page, t);
    console.log(`👥 Глава ${chapterNumber}: добавлена команда "${t}"`);
  }
} else {
  console.log(`👥 Глава ${chapterNumber}: команды не выбраны (правило не сработало)`);
}

  // 7. Заливаем страницы через <input type="file" multiple>.
  await uploadFilesIntoModal(page, absoluteFiles);

  // 8. Жмём "Загрузить".
  await clickButtonByText(page, 'Загрузить');

  // 9. Ждём, пока модалка закроется → сервер закончил создание/коммит главы.
  await waitModalClose(page);

  console.log('✅ Глава загружена.');
}

/* ========================================================================== */
/* ============================== MAIN ====================================== */
/* ========================================================================== */

(async () => {
  // ВАЖНО:
  // - одновременно только один бот с одним и тем же .bot-profile
  // - если ругается "The browser is already running", значит у тебя ещё открыто предыдущее окно Chromium
  //   → закрой то окно и убей прошлый процесс node перед повторным запуском.

  const browser = await puppeteer.launch({
    headless: false,            // хотим видеть, что он делает
    defaultViewport: null,
    args: ['--start-maximized'],
    userDataDir: path.resolve('./.bot-profile'), // одна и та же папка профиля = одна и та же сессия
  });

  const page = await browser.newPage();
  await page.goto(SITE_URL, { waitUntil: 'networkidle2' });

  console.log('Ждём кнопку «Добавить главу».');
  console.log('Если ты не авторизован — логинься прямо в ЭТОМ окне, не в другом браузере.');
  console.log('После логина вернись на страницу тайтла. Как только кнопка станет доступна, бот поедет дальше.');

  // Ждём появления кнопки "Добавить главу" без таймаута.
  await waitForButtonByText(page, 'Добавить главу', { timeoutMs: 0 });

  console.log('Ок, кнопка «Добавить главу» найдена — начинаем массовую загрузку.');

  // Собираем все главы из папки.
  const folders = getChapterFoldersSorted(ROOT_DIR);
  console.log('Найдено папок:', folders.length);

  // По каждой папке -> создаём главу.  (ПРАВКА: передаём i+1)
  for (let i = 0; i < folders.length; i++) {
    const folderName = folders[i];
    const absPath = path.join(ROOT_DIR, folderName);
    try {
      await uploadOneChapter(page, absPath, folderName, i + 1); // 1-based индекс

      // Хочешь помечать "готово"? Можем переименовывать папку.
      // fs.renameSync(absPath, absPath + ' [OK]');

    } catch (err) {
      console.error(`💥 Ошибка при "${folderName}":`, err.message || err);
      // не падаем, идём к следующей главе
    }
  }

  console.log('\n🎉 Все папки обработаны.');
  console.log('Браузер специально НЕ закрываю — можешь руками посмотреть результат.');
  // не закрываем браузер, чтобы ты мог глянуть
  // await browser.close();
})();