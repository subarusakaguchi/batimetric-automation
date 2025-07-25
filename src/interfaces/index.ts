export interface Coordinate {
  latitude: string;
  longitude: string;
}

export interface Envelope {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference: Wkid;
}

interface Wkid {
  wkid: number;
}

export interface BatimetriaResponse {
  displayFieldName: string;
  features: Array<Attribute>;
  fieldAliases: FieldAliases;
  fields: Array<Field>;
}

type FieldAliases = Record<string, string>;

interface Attribute {
  attributes: AttributeType;
}

type AttributeType = Record<string, string | number | null>;

interface Field {
  name: string;
  type: string;
  alias: string;
  length: number;
}

export interface Result {
  coord: Coordinate;
  features: BatimetriaResponse["features"];
}

export interface CsvSchema {
  "": string | null;
  _1: string | null;
  "RELATÓRIO DE POSIÇÕES": string | null;
  _2: string | null;
  _3: string | null; // Latitude
  _4: string | null;
  _5: string | null;
  _6: string | null; // Longitude
  _7: string | null;
  _8: string | null;
  _9: string | null;
  _10: string | null;
  _11: string | null;
  _12: string | null;
  _13: string | null;
  _14: string | null;
  _15: string | null;
  _16: string | null;
}
