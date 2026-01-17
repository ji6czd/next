import requests
from bs4 import BeautifulSoup
import time
import json
import os

OUTPUT_FILE = 'stations.json'
BASE_URL = 'https://transit.yahoo.co.jp/timetable/{id}?kind=1'

def get_station_name(station_id):
    url = BASE_URL.format(id=station_id)
    try:
        # サーバー負荷軽減のため、User-Agentを設定
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return None
        
        # エンコーディングの自動判別
        response.encoding = response.apparent_encoding
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 駅名の抽出 (h1タグを想定)
        h1 = soup.find('h1')
        if h1:
            station_name = h1.text.strip()
            return station_name
            
        return None
            
    except Exception as e:
        print(f"ID {station_id}: Error - {e}")
        return None

def main():
    stations = []
    # 既存のデータがあれば読み込む
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                stations = json.load(f)
            print(f"Loaded {len(stations)} existing stations from {OUTPUT_FILE}.")
        except Exception as e:
            print(f"Could not load existing data: {e}. Starting fresh.")

    # 21000から21999まで
    start_id = 20000
    end_id = 30099
    
    print(f"Fetching station data for IDs {start_id} to {end_id}...")
    print("This process will take some time due to wait intervals.")

    try:
        for station_id in range(start_id, end_id + 1):
            name = get_station_name(station_id)
            if name:
                print(f"Found: {station_id} -> {name}")
                stations.append({
                    'id': station_id,
                    'name': name
                })
            
            time.sleep(1.0)
            
            # 進捗表示
            if station_id % 100 == 0:
                print(f"Processed up to ID {station_id}...")

    except KeyboardInterrupt:
        print("\nProcess interrupted by user. Saving collected data...")
    
    # JSONファイルへの書き出し
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(stations, f, ensure_ascii=False, indent=2)
    
    print(f"\nCompleted. {len(stations)} stations saved to {OUTPUT_FILE}.")

if __name__ == "__main__":
    main()
