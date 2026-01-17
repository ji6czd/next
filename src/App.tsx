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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', color: 'white',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000
    }}
    role="dialog"
    aria-modal="true"
    >
      <div 
        ref={modalRef}
        style={{
        backgroundColor: '#242424', color: 'rgba(255, 255, 255, 0.87)', padding: '20px', borderRadius: '8px',
        width: '80%', maxWidth: '500px', maxHeight: '80%', overflowY: 'auto', textAlign: 'left',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ marginTop: 0 }}>このアプリについて</h2>
        <p>Copyright © 2026 NEX-T App</p>
        
        <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '5px' }}>オープンソースライセンス</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {LIBRARIES.map((lib) => (
            <li key={lib.name} style={{ marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold' }}>{lib.name}</div>
              <div style={{ fontSize: '0.9em', color: '#aaa' }}>License: {lib.license}</div>
              {lib.copyright && <div style={{ fontSize: '0.85em', color: '#888' }}>{lib.copyright}</div>}
            </li>
          ))}
        </ul>
        
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
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

async function searchStations(query: string): Promise<Station[]> {
  const url = getApiUrl(`/timetable/search?q=${encodeURIComponent(query)}`);

  const res = await fetch(url);
  const html = await res.text();

  // Capacitor HttpプラグインによるインターセプターURLの処理
  const currentUrl = resolveCapacitorInterceptorUrl(res.url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const urlObj = new URL(currentUrl);

  // Check if we are on the search results page or have been redirected to a specific station
  // Search page URL usually contains '/timetable/search'
  if (urlObj.pathname.includes('/search')) {
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

    return uniqueResults;
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

    return [{
      name: name,
      url: realUrl,
    }];
  }
}

async function fetchLines(stationUrl: string): Promise<{ lines: LineDestination[], url: string }> {
  const urlObj = new URL(stationUrl);
  // Web環境（プロキシー経由）の場合のパス変換
  const path = urlObj.pathname + urlObj.search;

  // もしstationUrlがすでにプロキシURLでない場合、プロキシ用に変換する必要があるか確認
  // ここでは入力されたstationUrlが "https://transit.yahoo.co.jp/..." である前提で処理する

  const fetchUrl = getApiUrl(path);

  const res = await fetch(fetchUrl);
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

async function fetchTimetable(lineUrl: string): Promise<{ trains: Train[], url: string }> {
  const urlObj = new URL(lineUrl);
  // Web環境（プロキシー経由）の場合のパス変換
  const path = urlObj.pathname + urlObj.search;

  const fetchUrl = getApiUrl(path);

  const res = await fetch(fetchUrl);
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

function App() {
  const [searchQuery, setSearchQuery] = useState('')

  const [stations, setStations] = useState<Station[]>([])
  const [lines, setLines] = useState<LineDestination[]>([])
  const [linesUrl, setLinesUrl] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [timetableUrl, setTimetableUrl] = useState<string>('');
  const [showAbout, setShowAbout] = useState(false);

  const handleSearch = () => {
    searchStations(searchQuery).then((results) => {
      setStations(results);
      setLines([]);
      setLinesUrl('');
      setSelectedStation(null);
      setTrains([]);
    })
  }

  const handleStationSelect = async (station: Station) => {
    setSelectedStation(station);
    setLines([]); // クリアしてから読み込み
    setLinesUrl('');
    setTrains([]);
    try {
      const result = await fetchLines(station.url);
      setLines(result.lines);
      setLinesUrl(result.url);
    } catch (e) {
      console.error("Failed to fetch lines:", e);
      alert("時刻表の取得に失敗しました");
    }
  };

  const handleLineSelect = async (line: LineDestination) => {
    setTrains([]); // Clear previous
    setTimetableUrl('');
    try {
      const result = await fetchTimetable(line.url);
      setTrains(result.trains);
      setTimetableUrl(result.url);
    } catch (e) {
      console.error("Failed to fetch timetable:", e);
      alert("時刻表の取得に失敗しました");
    }
  };

  return (
    <div className="App">
      <h1>Welcome to the NEX-T</h1>
      <div className="search-box">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="駅名を入力"
        />
        <button onClick={handleSearch} tabIndex={0}>検索</button>
      </div>

      {/* 選択された駅の路線表示エリア */}
      {(selectedStation || lines.length > 0) && (
        <div className="lines-section" style={{ margin: '20px 0', border: '1px solid #ccc', padding: '10px', textAlign: 'left' }}>
          <h3>{selectedStation ? `${selectedStation.name} の路線一覧` : '路線一覧'}</h3>
          {lines.length === 0 ? (
            <p>読み込み中...</p>
          ) : (
            <div>
              <ul>
                {lines.map((line, index) => (
                  <li key={index} style={{ marginBottom: '5px' }}>
                    <button
                      onClick={() => handleLineSelect(line)}
                      style={{ background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit', textAlign: 'left' }}
                    >
                      <strong>{line.lineName}</strong>: {line.destination}
                    </button>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '10px' }}>
                <small><a href={linesUrl} target="_blank" rel="noopener noreferrer">この駅のページ（Yahoo!路線情報）</a></small>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 時刻表表示エリア */}
      {trains.length > 0 && (
        <div className="timetable-section" style={{ margin: '20px 0', border: '1px solid #ccc', padding: '10px', textAlign: 'left' }}>
          <h3>時刻表</h3>
          <div style={{ marginTop: '10px', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ padding: '5px' }}>時間</th>
                  <th style={{ padding: '5px' }}>種別</th>
                  <th style={{ padding: '5px' }}>行き先</th>
                  <th style={{ padding: '5px' }}>備考</th>
                </tr>
              </thead>
              <tbody>
                {trains.map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '5px' }}>{t.time}</td>
                    <td style={{ padding: '5px' }}>{t.type}</td>
                    <td style={{ padding: '5px' }}>{t.destination}</td>
                    <td style={{ padding: '5px' }}>{t.caution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '10px' }}>
            <p><a href={timetableUrl} target="_blank" rel="noopener noreferrer">時刻表ページ（Yahoo!路線情報）</a></p>
          </div>
        </div>
      )}

      {!selectedStation && stations.length > 0 && (
        <div className="stations-list">
          <h3>検索結果</h3>
          <ul>
            {stations.map((station) => (
              <li key={station.name} tabIndex={0} style={{ cursor: 'pointer', textDecoration: 'underline', color: 'blue', margin: '5px 0' }} onClick={() => handleStationSelect(station)} role='button'>
                {station.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #ccc', textAlign: 'center' }}>
        <button 
          onClick={() => setShowAbout(true)} 
          style={{ background: 'none', border: 'none', color: '#666', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          このアプリについて
        </button>
      </footer>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  )
}

export default App
