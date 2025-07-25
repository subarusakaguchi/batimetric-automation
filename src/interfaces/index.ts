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
