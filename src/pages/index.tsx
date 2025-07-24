"use client";

import { useState } from "react";
import {
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";

type Coordinate = {
  latitude: string;
  longitude: string;
};

interface Envelope {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference: Wkid;
}

interface Wkid {
  wkid: number;
}

interface BatimetriaResponse {
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

const API_URL =
  "https://geoportal.sgb.gov.br/server/rest/services/geologia_marinha/batimetria/MapServer/dynamicLayer/query?";

const WKID = 102100;

export default function Home() {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([
    { latitude: "", longitude: "" },
  ]);
  const [results, setResults] = useState<
    Array<{ coord: Coordinate; features: BatimetriaResponse["features"] }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const parseCoordinate = (value: string): number | null => {
    const parsed = parseFloat(value.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  };

  const latLonToEnvelope = (
    latitude: number,
    longitude: number,
    deltaMeters = 1000,
  ): Envelope => {
    const RADIUS = 6378137.0;
    const x = RADIUS * ((longitude * Math.PI) / 180);
    const y =
      RADIUS * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 180 / 2));

    return {
      xmin: x - deltaMeters,
      ymin: y - deltaMeters,
      xmax: x + deltaMeters,
      ymax: y + deltaMeters,
      spatialReference: { wkid: WKID },
    };
  };

  const fetchDepthForEnvelope = async (
    env: Envelope,
  ): Promise<BatimetriaResponse> => {
    const params = new URLSearchParams({
      f: "json",
      returnGeometry: "false",
      spatialRel: "esriSpatialRelIntersects",
      geometry: JSON.stringify(env),
      geometryType: "esriGeometryEnvelope",
      inSR: "102100",
      outFields: "profundida",
      outSR: "102100",
      layer: '{"source":{"type":"mapLayer","mapLayerId":0}}',
    });

    const res = await fetch(API_URL + params.toString());
    if (!res.ok) throw new Error(`Erro na API: ${res.status}`);

    return (await res.json()) as BatimetriaResponse;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);

    const promises = coordinates.map(async (coord) => {
      const lat = parseCoordinate(coord.latitude);
      const lon = parseCoordinate(coord.longitude);

      if (lat == null || lon == null) return { coord, features: [] };

      const envelope = latLonToEnvelope(lat, lon);
      try {
        const res = await fetchDepthForEnvelope(envelope);
        return { coord, features: res.features };
      } catch {
        return { coord, features: [] };
      }
    });

    const allResults = await Promise.all(promises);
    setResults(allResults);
    setLoading(false);
  };

  const addCoordinate = () =>
    setCoordinates([...coordinates, { latitude: "", longitude: "" }]);
  const removeCoordinate = (index: number) =>
    setCoordinates(coordinates.filter((_, i) => i !== index));
  const updateCoordinate = (
    index: number,
    field: "latitude" | "longitude",
    value: string,
  ) => {
    const newCoords = [...coordinates];
    newCoords[index]![field] = value;
    setCoordinates(newCoords);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-100 to-white p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-6 rounded-3xl bg-white p-8 shadow-2xl"
      >
        <h1 className="text-center text-3xl font-bold text-blue-800">
          🔍 Consulta de Batimetria
        </h1>

        {coordinates.map((coord, index) => (
          <div key={index} className="grid grid-cols-3 items-center gap-4">
            <input
              type="text"
              inputMode="decimal"
              value={coord.latitude}
              onChange={(e) =>
                updateCoordinate(index, "latitude", e.target.value)
              }
              className="rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Latitude ex: -2,21"
            />
            <input
              type="text"
              inputMode="decimal"
              value={coord.longitude}
              onChange={(e) =>
                updateCoordinate(index, "longitude", e.target.value)
              }
              className="rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Longitude ex: -47,43"
            />
            {coordinates.length > 1 && (
              <button
                type="button"
                onClick={() => removeCoordinate(index)}
                className="flex items-center justify-center rounded-lg bg-red-500 p-2 text-white transition hover:bg-red-600"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}

        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={addCoordinate}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5" /> Adicionar coordenada
          </button>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
            {loading ? "Consultando..." : "Buscar Batimetria"}
          </button>
        </div>

        {error && <p className="text-center text-red-600">{error}</p>}

        {results.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-center text-lg font-semibold text-blue-900">
              🌊 Resultados encontrados:
            </h2>
            {results.map(({ coord, features }, i) => (
              <div
                key={i}
                className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow"
              >
                <h3 className="mb-2 font-semibold text-blue-900">
                  📍 Lat: {coord.latitude}, Lon: {coord.longitude}
                </h3>
                {features.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum dado encontrado.
                  </p>
                ) : (
                  features.map((f, j) => (
                    <div key={j} className="text-sm text-gray-800">
                      {Object.entries(f.attributes).map(([key, val]) => (
                        <p key={key}>
                          <span className="font-medium capitalize">{key}:</span>{" "}
                          {val ?? "N/A"}
                        </p>
                      ))}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </form>
    </main>
  );
}
