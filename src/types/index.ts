export interface Station {
  name: string;
  url: string;
}

export interface LineDestination {
  lineName: string;
  destination: string;
  url: string;
}

export interface Train {
  time: string;
  type: string;
  destination: string;
  caution: string;
  lineName?: string;
}

export interface LibraryInfo {
  name: string;
  license: string;
  copyright?: string;
}
