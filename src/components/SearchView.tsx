import type { Station } from '../types';
import './SearchView.css';

interface SearchViewProps {
  query: string;
  setQuery: (v: string) => void;
  stations: Station[];
  url: string;
  onSearch: () => void;
  onSelect: (s: Station) => void;
}

export function SearchView({ 
  query, 
  setQuery, 
  stations, 
  url, 
  onSearch, 
  onSelect 
}: SearchViewProps) {
  return (
    <div className="search-view">
      <div className="search-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="駅名を入力 (例: 新宿)"
        />
        <button onClick={onSearch}>検索</button>
      </div>
      <div className="stations-list">
        {stations.length > 0 ? (
          <>
            <ul>
              {stations.map((station) => (
                <li key={station.name} className="list-item card" onClick={() => onSelect(station)} role='button'>
                  <span className="station-name">{station.name}</span>
                </li>
              ))}
            </ul>
            <div className="external-link">
              <a href={url} target="_blank" rel="noopener noreferrer">Yahoo!路線情報で開く</a>
            </div>
          </>
        ) : (
          <p className="placeholder-text">駅を検索してください</p>
        )}
      </div>
    </div>
  );
}
