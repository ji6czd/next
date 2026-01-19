import type { Train } from '../types';
import './TimetableView.css';

interface TimetableViewProps {
  trains: Train[];
  url: string;
  dayKind: number;
  onKindChange: (k: number) => void;
}

export function TimetableView({
  trains,
  url,
  dayKind,
  onKindChange
}: TimetableViewProps) {
  return (
    <div className="timetable-view">
      <div className="sticky-controls">
        <div className="kind-selector">
          {[{ label: '平日', val: 1 }, { label: '土曜', val: 2 }, { label: '日祝', val: 4 }].map(k => (
            <button key={k.val} onClick={() => onKindChange(k.val)} className={`kind-btn ${dayKind === k.val ? 'active' : ''}`}>
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
                {t.caution && <><span className="sr-only">&nbsp;</span><span className="caution">{t.caution}</span></>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="external-link">
        <a href={url} target="_blank" rel="noopener noreferrer">Yahoo!路線情報で時刻表を見る</a>
      </div>
    </div>
  );
}
