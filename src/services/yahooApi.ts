import { Capacitor } from '@capacitor/core';
import type { Station, LineDestination, Train } from '../types';
import { getApiUrl, normalizeYahooUrl, resolveCapacitorInterceptorUrl } from './urlHelper';
import { PC_CHROME_UA } from '../constants/libraries';

export async function searchStations(query: string): Promise<{ stations: Station[], url: string }> {
  const url = getApiUrl(`/timetable/search?q=${encodeURIComponent(query)}`);

  const res = await fetch(url, Capacitor.isNativePlatform() ? { headers: { 'User-Agent': PC_CHROME_UA } } : {});
  const html = await res.text();

  // Capacitor HttpプラグインによるインターセプターURLの処理
  const currentUrl = resolveCapacitorInterceptorUrl(res.url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const urlObj = new URL(currentUrl);
  const titleEl = doc.querySelector('h1');
  const titleText = titleEl?.textContent || '';

  // 検索結果ページか、直接駅ページかを判定
  // titleTextに「検索結果」が含まれる場合は検索結果ページ
  if (titleText.includes('の検索結果')) {
    // Look for links that point to timetables
    const elements = doc.querySelectorAll('a[href^="/timetable/"]');
    const results: Station[] = [];

    elements.forEach((el) => {
      const rawHref = el.getAttribute('href');
      const name = el.textContent?.trim();
      const searchName = name?.replace(/\(.+\)/g, '');
      if (rawHref && searchName && searchName.includes(query)) {
        const href = rawHref.split('?')[0];
        results.push({
          name: name,
          url: `https://transit.yahoo.co.jp${href}`,
        });
      }
    });

    // Filter out duplicate or irrelevant generic generic timetable links if any
    const uniqueResults = Array.from(new Map(results.map(item => [item.name, item])).values());

    return { stations: uniqueResults, url: normalizeYahooUrl(currentUrl) };
  } else {
    // Direct hit: Single station page
    const titleEl = doc.querySelector('#mdSearchLine h1.title') || doc.querySelector('h1');
    const name = titleEl?.textContent?.trim() || query;

    // Reconstruct the Yahoo URL from the proxy URL
    let yahooPath = urlObj.pathname;
    // Web環境（プロキシー経由）の場合のみパス変換を実行
    if (!Capacitor.isNativePlatform() && yahooPath.startsWith('/api/yahoo')) {
      yahooPath = yahooPath.replace(/^\/api\/yahoo/, '');
    }

    const realUrl = `https://transit.yahoo.co.jp${yahooPath}${urlObj.search}`;

    return {
      stations: [{
        name: name,
        url: realUrl,
      }],
      url: realUrl
    };
  }
}

export async function fetchLines(stationUrl: string): Promise<{ lines: LineDestination[], url: string }> {
  const urlObj = new URL(stationUrl);
  // Web環境（プロキシー経由）の場合のパス変換
  const path = urlObj.pathname + urlObj.search;

  // もしstationUrlがすでにプロキシURLでない場合、プロキシ用に変換する必要があるか確認
  // ここでは入力されたstationUrlが "https://transit.yahoo.co.jp/..." である前提で処理する

  const fetchUrl = getApiUrl(path);

  const res = await fetch(fetchUrl, Capacitor.isNativePlatform() ? { headers: { 'User-Agent': PC_CHROME_UA } } : {});
  const html = await res.text();
  const currentUrl = normalizeYahooUrl(res.url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const lines: LineDestination[] = [];

  // ul.elmSearchItem.direction > li > dl > dt (路線名) / dd > ul > li > a (行き先)
  const lineGroups = doc.querySelectorAll('ul.elmSearchItem.direction > li > dl');

  lineGroups.forEach(group => {
    const lineName = group.querySelector('dt')?.textContent?.trim() || '';
    const destLinks = group.querySelectorAll('dd > ul > li > a');

    destLinks.forEach(link => {
      const destName = link.textContent?.trim() || '';
      const rawHref = link.getAttribute('href');
      if (lineName && destName && rawHref) {
        // クエリパラメータを除去
        const href = rawHref.split('?')[0];
        lines.push({
          lineName,
          destination: destName,
          url: `https://transit.yahoo.co.jp${href}`
        });
      }
    });
  });

  return { lines, url: currentUrl };
}

export async function fetchTimetable(lineUrl: string, kind: number = 1): Promise<{ trains: Train[], url: string }> {
  const urlObj = new URL(lineUrl);
  // Web環境（プロキシー経由）の場合のパス変換
  const searchParams = new URLSearchParams(urlObj.search);
  searchParams.set('kind', kind.toString());
  const path = urlObj.pathname + '?' + searchParams.toString();

  const fetchUrl = getApiUrl(path);

  const res = await fetch(fetchUrl, Capacitor.isNativePlatform() ? { headers: { 'User-Agent': PC_CHROME_UA } } : {});
  const html = await res.text();
  const currentUrl = normalizeYahooUrl(res.url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const trains: Train[] = [];

  // 凡例マップの定義
  const typeMap: { [key: string]: string } = {};
  const destMap: { [key: string]: string } = {};
  const cautionMap: { [key: string]: string } = {};

  // 種別凡例
  const typeRow = Array.from(doc.querySelectorAll('tr')).find(row => row.querySelector('th')?.textContent?.includes('列車種別'));
  if (typeRow) {
    typeRow.querySelectorAll('td li').forEach(li => {
      const text = li.textContent?.trim() || '';
      const parts = text.split(/[:：]/);
      if (parts.length >= 2) {
        typeMap[parts[0].trim()] = parts[1].trim();
      }
    });
  }

  // 行き先凡例
  const destRow = Array.from(doc.querySelectorAll('tr')).find(row => row.querySelector('th')?.textContent?.includes('行き先・経由'));
  if (destRow) {
    destRow.querySelectorAll('td li').forEach(li => {
      const text = li.textContent?.trim() || '';
      const parts = text.split(/[:：]/);
      if (parts.length >= 2) {
        destMap[parts[0].trim()] = parts[1].trim();
      }
    });
  }

  // 変更・注意マーク凡例
  const cautionRow = Array.from(doc.querySelectorAll('tr')).find(row => row.querySelector('th')?.textContent?.includes('変更・注意マーク'));
  if (cautionRow) {
    cautionRow.querySelectorAll('td li').forEach(li => {
      const text = li.textContent?.trim() || '';
      const parts = text.split(/[:：]/);
      if (parts.length >= 2) {
        cautionMap[parts[0].trim()] = parts[1].trim();
      }
    });
  }


  // 時刻表テーブルの解析: table.tblDiaDetail
  // 各行(tr)が「時」、その中のtd > ul > li が各列車
  const hourRows = doc.querySelectorAll('table.tblDiaDetail tr[id^="hh_"]');

  hourRows.forEach(row => {
    const hour = row.querySelector('.hour')?.textContent?.trim();
    if (!hour) return;

    const trainItems = row.querySelectorAll('td ul li.timeNumb a');
    trainItems.forEach(item => {
      const dl = item.querySelector('dl');
      if (!dl) return;

      const dt = dl.querySelector('dt');
      let min = '';
      if (dt) {
        // <span class="mark">を除去して「分」だけを取得
        const dtClone = dt.cloneNode(true) as HTMLElement; // クローンを作成して元のDOMは破壊しない
        const mark = dtClone.querySelector('.mark');
        if (mark) {
          mark.remove();
        }
        min = dtClone.textContent?.trim() || '';
      }

      const time = `${hour}:${min?.padStart(2, '0')}`;

      // 種別: <dd class="trainType">[中]</dd>
      let typeRaw = dl.querySelector('.trainType')?.textContent?.trim() || '';
      // []を取り除く
      typeRaw = typeRaw.replace(/\[|\]/g, '');
      // 空文字なら'無印'をキーにする。マップに存在しない場合は空文字にする
      const typeKey = typeRaw === '' ? '無印' : typeRaw;
      const type = typeMap[typeKey] || '';

      // 行き先: <dd class="trainFor">青</dd>
      const destRaw = dl.querySelector('.trainFor')?.textContent?.trim() || '無印';
      const destination = destMap[destRaw] || destRaw;

      // 注意マーク: <dt>0<span class="mark">●◆</span></dt> の中のspan
      const markSpan = dl.querySelector('dt span.mark');
      const cautionRaw = markSpan?.textContent?.trim() || '';
      // 凡例から置換。複数のマークがある場合がある (例: ●◆)
      let caution = '';
      if (cautionRaw) {
        const marks = cautionRaw.split('');
        caution = marks.map(m => cautionMap[m] || m).join(' ');
      }

      trains.push({
        time,
        type,
        destination,
        caution
      });
    });
  });

  return { trains, url: currentUrl };
}
