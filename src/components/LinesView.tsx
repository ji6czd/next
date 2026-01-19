import type { LineDestination, Train } from '../types';
import './LinesView.css';

interface LinesViewProps {
  lines: LineDestination[];
  url: string;
  nextTrains: Train[];
  isSearching: boolean;
  onNextSearch: () => void;
  onSelect: (l: LineDestination) => void;
}

export function LinesView({
  lines,
  url,
  nextTrains,
  isSearching,
  onNextSearch,
  onSelect
}: LinesViewProps) {
  return (
    <div className="lines-view">
      <div className="action-banner">
        <button onClick={onNextSearch} disabled={isSearching || lines.length === 0} className="primary-btn full-width">
          {isSearching ? '検索中...' : '次の電車を最短検索'}
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
                {t.caution && <><span className="sr-only">&nbsp;</span><span className="caution">{t.caution}</span></>}
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
              <li key={index} className="list-item card" onClick={() => onSelect(line)}>
                <div className="line-info">
                  <span className="line-name">{line.lineName}</span>
                  <span className="line-dest">{line.destination}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="external-link">
          <a href={url} target="_blank" rel="noopener noreferrer">Yahoo!路線情報で開く</a>
        </div>
      </div>
    </div>
  );
}
