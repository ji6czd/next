import { useState } from 'react'
import type { Station, LineDestination, Train } from './types'
import { searchStations, fetchLines, fetchTimetable } from './services/yahooApi'
import { getCurrentDayKind } from './services/urlHelper'
import { useBackButton } from './hooks/useBackButton'
import { AboutModal } from './components/AboutModal'
import { SearchView } from './components/SearchView'
import { LinesView } from './components/LinesView'
import { TimetableView } from './components/TimetableView'
import './App.css'

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

  useBackButton(view, showAbout, {
    closeAbout: () => setShowAbout(false),
    toLines: () => setView('lines'),
    toSearch: () => setView('search'),
  });

  const handleSearch = async () => {
    const result = await searchStations(searchQuery);

    if (result.stations.length > 0) {
      window.navigator.vibrate(200);
    }

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
      window.navigator.vibrate(200);
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
      window.navigator.vibrate(200);
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
      window.navigator.vibrate(200);
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
        <h1 className="app-title">
          {view === 'search' ? 'NEX-T' : view === 'lines' ? selectedStation?.name : selectedLine?.lineName}
        </h1>
      </header>

      {view === 'search' && (
        <SearchView
          query={searchQuery}
          setQuery={setSearchQuery}
          stations={stations}
          url={searchUrl}
          onSearch={handleSearch}
          onSelect={handleStationSelect}
        />
      )}

      {view === 'lines' && (
        <LinesView
          lines={lines}
          url={linesUrl}
          nextTrains={nextTrains}
          isSearching={isSearchingNext}
          onNextSearch={handleNextTrains}
          onSelect={handleLineSelect}
        />
      )}

      {view === 'timetable' && (
        <TimetableView
          trains={trains}
          url={timetableUrl}
          dayKind={dayKind}
          onKindChange={handleKindChange}
        />
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
