import { useState, useRef, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import './App.css'

interface Station {
  name: string
  url: string
}

interface LineDestination {
  lineName: string
  destination: string
  url: string
}

interface Train {
  time: string
  type: string
  destination: string
  caution: string
  lineName?: string; // 追加
}

interface LibraryInfo {
  name: string;
  license: string;
  copyright?: string;
}

const LIBRARIES: LibraryInfo[] = [
  { name: 'React', license: 'MIT', copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.' },
  { name: 'React DOM', license: 'MIT', copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.' },
  { name: 'Vite', license: 'MIT', copyright: 'Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors' },
  { name: 'Capacitor', license: 'MIT', copyright: 'Copyright (c) 2017-present Drifty Co.' },
];

const PC_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function AboutModal({ onClose }: { onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modalElement = modalRef.current;
    if (!modalElement) return;

    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // モーダルが開いたときに最初の要素にフォーカス
    if (firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div ref={modalRef} className="modal-content">
        <h2 className="modal-title">このアプリについて</h2>
        <p>Copyright © 2026 NEX-T App</p>

        <h3 className="modal-subtitle">オープンソースライセンス</h3>
        <ul className="library-list">
          {LIBRARIES.map((lib) => (
            <li key={lib.name} className="library-item">
              <div className="library-name">{lib.name}</div>
              <div className="library-license">License: {lib.license}</div>
              {lib.copyright && <div className="library-copyright">{lib.copyright}</div>}
            </li>
          ))}
        </ul>

        <div className="modal-footer">
          <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

// URL生成ヘルパー関数: ネイティブアプリでは直接接続、Webではプロキシー経由
function getApiUrl(path: string): string {
  if (Capacitor.isNativePlatform()) {
    return `https://transit.yahoo.co.jp${path}`;
  }
  return `/api/yahoo${path}`;
}

function resolveCapacitorInterceptorUrl(url: string): string {
  if (url.includes('_capacitor_http_interceptor_')) {
    const tempUrl = new URL(url);
    const originalUrl = tempUrl.searchParams.get('u');
    if (originalUrl) {
      return originalUrl;
    }
  }
  return url;
}

function normalizeYahooUrl(rawUrl: string): string {
  let url = resolveCapacitorInterceptorUrl(rawUrl);

  // Web環境（プロキシー経由）の場合、元のYahoo URLに復元する
  if (!Capacitor.isNativePlatform()) {
    try {
      const urlObj = new URL(url, window.location.href);
      if (urlObj.pathname.startsWith('/api/yahoo')) {
        const yahooPath = urlObj.pathname.replace(/^\/api\/yahoo/, '');
        url = `https://transit.yahoo.co.jp${yahooPath}${urlObj.search}`;
      }
    } catch (e) {
      console.warn("Failed to normalize URL", e);
    }
  }
  return url;
}

async function searchStations(query: string): Promise<{ stations: Station[], url: string }> {
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
      if (rawHref && name) {
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

async function fetchLines(stationUrl: string): Promise<{ lines: LineDestination[], url: string }> {
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

async function fetchTimetable(lineUrl: string, kind: number = 1): Promise<{ trains: Train[], url: string }> {
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

// 曜日からYahoo!のkind値を返すヘルパー
function getCurrentDayKind(): number {
  const now = new Date();
  const day = now.getDay(); // 0: 日, 1: 月... 6: 土
  if (day === 0) return 4; // 日・祝
  if (day === 6) return 2; // 土曜
  return 1; // 平日
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'search' | 'lines' | 'timetable'>('search');
  const [stations, setStations] = useState<Station[]>([])
  const [searchUrl, setSearchUrl] = useState<string>('');
  const [lines, setLines] = useState<LineDestination[]>([])
  const [linesUrl, setLinesUrl] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedLine, setSelectedLine] = useState<LineDestination | null>(null);
  const [dayKind, setDayKind] = useState<number>(1);
  const [trains, setTrains] = useState<Train[]>([]);
  const [timetableUrl, setTimetableUrl] = useState<string>('');
  const [showAbout, setShowAbout] = useState(false);
  const [nextTrains, setNextTrains] = useState<Train[]>([]);
  const [isSearchingNext, setIsSearchingNext] = useState(false);

  const handleSearch = async () => {
    const result = await searchStations(searchQuery);

    setStations(result.stations);
    setSearchUrl(result.url);
    setView('search');
    setLines([]);
    setLinesUrl('');
    setSelectedStation(null);
    setSelectedLine(null);
    setTrains([]);
    setNextTrains([]);
  }

  const handleStationSelect = async (station: Station) => {
    setSelectedStation(station);
    setView('lines');
    setLines([]); // クリアしてから読み込み
    setLinesUrl('');
    setSelectedLine(null);
    setTrains([]);
    setNextTrains([]);
    try {
      const result = await fetchLines(station.url);
      setLines(result.lines);
      setLinesUrl(result.url);
    } catch (e) {
      console.error("Failed to fetch lines:", e);
      alert("時刻表の取得に失敗しました");
    }
  };

  const handleNextTrains = async () => {
    if (lines.length === 0) return;
    setIsSearchingNext(true);
    setNextTrains([]);

    const kind = getCurrentDayKind();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    try {
      const allTrainsPromises = lines.map(async (line) => {
        const result = await fetchTimetable(line.url, kind);
        return result.trains.map(t => ({ ...t, lineName: line.lineName }));
      });

      const results = await Promise.all(allTrainsPromises);
      const flattened = results.flat();

      const futureTrains = flattened
        .filter(t => {
          const [h, m] = t.time.split(':').map(Number);
          const trainMinutes = h * 60 + m;
          return trainMinutes >= currentMinutes;
        })
        .sort((a, b) => {
          const [ah, am] = a.time.split(':').map(Number);
          const [bh, bm] = b.time.split(':').map(Number);
          return (ah * 60 + am) - (bh * 60 + bm);
        })
        .slice(0, 15);

      setNextTrains(futureTrains);
    } catch (e) {
      console.error(e);
      alert("次列車の取得に失敗しました");
    } finally {
      setIsSearchingNext(false);
    }
  };

  const handleLineSelect = async (line: LineDestination) => {
    setSelectedLine(line);
    setView('timetable');
    setTrains([]); // Clear previous
    setTimetableUrl('');
    try {
      // kindを指定せず、Yahoo側のデフォルト（現在時刻に応じた種別）で取得
      const result = await fetchTimetable(line.url);
      setTrains(result.trains);
      setTimetableUrl(result.url);
    } catch (e) {
      console.error("Failed to fetch timetable:", e);
      alert("時刻表の取得に失敗しました");
    }
  };

  const handleKindChange = async (kind: number) => {
    setDayKind(kind);
    if (selectedLine) {
      setTrains([]); // Clear previous
      setTimetableUrl('');
      try {
        const result = await fetchTimetable(selectedLine.url, kind);
        setTrains(result.trains);
        setTimetableUrl(result.url);
      } catch (e) {
        console.error("Failed to fetch timetable:", e);
        alert("時刻表の取得に失敗しました");
      }
    }
  };

  const handleBack = () => {
    if (view === 'timetable') setView('lines');
    else if (view === 'lines') setView('search');
  };

  return (
    <div className="App">
      <header className="app-header-nav">
        {view !== 'search' && (
          <button onClick={handleBack} className="back-btn">← 戻る</button>
        )}
        <h1 className="app-title">{view === 'search' ? 'NEX-T' : view === 'lines' ? selectedStation?.name : selectedLine?.lineName}</h1>
      </header>

      {view === 'search' && (
        <div className="search-view">
          <div className="search-box">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="駅名を入力 (例: 新宿)"
            />
            <button onClick={handleSearch}>検索</button>
          </div>

          <div className="stations-list">
            {stations.length > 0 ? (
              <>
                <ul>
                  {stations.map((station) => (
                    <li key={station.name} className="list-item card" onClick={() => handleStationSelect(station)} role='button'>
                      <span className="station-name">{station.name}</span>
                      {/* <span className="chevron">›</span> */}
                    </li>
                  ))}
                </ul>
                <div className="external-link">
                  <a href={searchUrl} target="_blank" rel="noopener noreferrer">Yahoo!路線情報で開く</a>                </div>
              </>
            ) : (
              <p className="placeholder-text">駅を検索してください</p>
            )}
          </div>
        </div>
      )}

      {view === 'lines' && (
        <div className="lines-view">
          <div className="action-banner">
            <button
              onClick={handleNextTrains}
              disabled={isSearchingNext || lines.length === 0}
              className="primary-btn full-width"
            >
              {isSearchingNext ? '検索中...' : '次の電車を最短検索'}
            </button>
          </div>

          {nextTrains.length > 0 && (
            <div className="next-trains-section card">
              <h4 className="card-title">直近の出発予定</h4>
              <ul className="timetable-list">
                {nextTrains.map((t, i) => (
                  <li key={i} className="timetable-item card">
                    <span className="time">{t.time}</span>
                    <span className="sr-only">&nbsp;</span>
                    <span className="details">
                      <span className="line-name" style={{ fontSize: '0.8em', display: 'block', opacity: 0.8 }}>{t.lineName}</span>
                      <span className="type">{t.type}</span>
                      <span className="sr-only">&nbsp;</span>
                      <span className="dest">{t.destination}行</span>
                    </span>
                    {t.caution && (
                      <>
                        <span className="sr-only">&nbsp;</span>
                        <span className="caution">{t.caution}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="lines-section">
            <h3 className="section-label">路線を選択</h3>
            {lines.length === 0 ? (
              <p className="loading-text">路線情報を読み込み中...</p>
            ) : (
              <ul className="line-list">
                {lines.map((line, index) => (
                  <li key={index} className="list-item card" onClick={() => handleLineSelect(line)}>
                    <div className="line-info">
                      <span className="line-name">{line.lineName}</span>
                      <span className="line-dest">{line.destination}</span>
                    </div>
                    {/* <span className="chevron">›</span> */}
                  </li>
                ))}
              </ul>
            )}
            <div className="external-link">
              <a href={linesUrl} target="_blank" rel="noopener noreferrer">Yahoo!路線情報で開く</a>
            </div>
          </div>
        </div>
      )}

      {view === 'timetable' && (
        <div className="timetable-view">
          <div className="sticky-controls">
            <div className="kind-selector">
              {[
                { label: '平日', val: 1 },
                { label: '土曜', val: 2 },
                { label: '日祝', val: 4 }
              ].map(k => (
                <button
                  key={k.val}
                  onClick={() => handleKindChange(k.val)}
                  className={`kind-btn ${dayKind === k.val ? 'active' : ''}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="timetable-content">
            {trains.length === 0 ? (
              <p className="loading-text">時刻表を読み込み中...</p>
            ) : (
              <ul className="timetable-list">
                {trains.map((t, i) => (
                  <li key={i} className="timetable-item card">
                    <span className="time">{t.time}</span>
                    <span className="sr-only">&nbsp;</span>
                    <span className="details">
                      <span className="type">{t.type}</span>
                      <span className="sr-only">&nbsp;</span>
                      <span className="dest">{t.destination}行</span>
                    </span>
                    {t.caution && (
                      <>
                        <span className="sr-only">&nbsp;</span>
                        <span className="caution">{t.caution}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="external-link">
            <a href={timetableUrl} target="_blank" rel="noopener noreferrer">Yahoo!路線情報で時刻表を見る</a>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <button onClick={() => setShowAbout(true)} className="about-btn">
          ⓘ アプリについて
        </button>
      </footer>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  )
}

export default App
