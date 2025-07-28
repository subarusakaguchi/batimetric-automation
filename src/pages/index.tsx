"use client";

import { useState } from "react";
import {
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/solid";
import type {
  BatimetriaResponse,
  Coordinate,
  CoordinateWithLayer,
  CsvSchema,
  Envelope,
  Result,
} from "~/interfaces";
import {
  API_URL,
  BATCH_DELAY,
  MAX_CONCURRENT_REQUESTS,
  RADIUS,
  WKID,
} from "~/utils/constants";
import * as Papa from "papaparse";

export default function Home() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinate[]>([
    { latitude: "", longitude: "" },
  ]);

  const parseCoordinate = (value: string): number | null => {
    const parsed = parseFloat(value.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  };

  const latLonToEnvelope = (
    latitude: number,
    longitude: number,
    deltaMeters = 1000,
  ): Envelope => {
    const x = calcXValue(longitude);
    const y = calcYValue(latitude);
    return returnEnvelope(x, y, deltaMeters);
  };

  const calcXValue = (longitude: number): number => {
    return RADIUS * ((longitude * Math.PI) / 180);
  };

  const calcYValue = (latitude: number): number => {
    return (
      RADIUS * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 180 / 2))
    );
  };

  const returnEnvelope = (
    x: number,
    y: number,
    deltaMeters: number,
  ): Envelope => {
    return {
      xmin: x - deltaMeters,
      ymin: y - deltaMeters,
      xmax: x + deltaMeters,
      ymax: y + deltaMeters,
      spatialReference: { wkid: WKID },
    };
  };

  const fetchDepthForEnvelope = async (
    envelope: Envelope,
    mapLayerId: number,
  ): Promise<BatimetriaResponse> => {
    const params = returnSearchParams(envelope, mapLayerId);
    const res = await fetch(API_URL + params.toString());
    if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
    return (await res.json()) as BatimetriaResponse;
  };

  const returnSearchParams = (
    envelope: Envelope,
    mapLayerId: number,
  ): URLSearchParams => {
    return new URLSearchParams({
      f: "json",
      returnGeometry: "false",
      spatialRel: "esriSpatialRelIntersects",
      geometry: JSON.stringify(envelope),
      geometryType: "esriGeometryEnvelope",
      inSR: "102100",
      outFields: "profundida",
      outSR: "102100",
      layer: JSON.stringify({
        source: {
          type: "mapLayer",
          mapLayerId,
        },
      }),
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);

    try {
      const allResults = await runInBatches(
        coordinates,
        MAX_CONCURRENT_REQUESTS,
      );
      setResults(allResults);
    } catch (err) {
      setError("Erro durante a consulta em lote.");
      console.error(err);
    }

    setLoading(false);
  }

  async function runInBatches(
    coordinates: Coordinate[],
    batchSize = 10,
  ): Promise<Result[]> {
    const results: Result[] = [];
    const queue: CoordinateWithLayer[] = coordinates.map((coord) => ({
      ...coord,
      mapLayerId: 0,
    }));

    while (queue.length > 0) {
      const batch = queue.splice(0, batchSize); // retira os primeiros `batchSize` itens

      const batchPromises = batch.map(async (coord) => {
        const lat = parseCoordinate(coord.latitude);
        const lon = parseCoordinate(coord.longitude);
        if (lat == null || lon == null) return { coord, features: [] };

        const envelope = latLonToEnvelope(lat, lon);
        try {
          const res = await fetchDepthForEnvelope(
            envelope,
            coord.mapLayerId ?? 0,
          );
          return { coord, features: res.features };
        } catch (err) {
          console.warn(
            `Erro na coordenada lat:${coord.latitude}, lon:${coord.longitude}`,
            err,
          );
          return { coord, features: [] };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        if (
          result.features.length === 0 &&
          (result.coord.mapLayerId ?? 0) < 5
        ) {
          // Reenfileira no início com mapLayerId incrementado
          queue.unshift({
            ...result.coord,
            mapLayerId: (result.coord.mapLayerId ?? 0) + 1,
          });
        } else {
          results.push(result);
        }
      }

      if (queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
      }
    }

    return results;
  }

  const addCoordinate = (latValue = "", lonValue = "") =>
    setCoordinates([
      ...coordinates,
      { latitude: latValue, longitude: lonValue },
    ]);

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

  function parseStringCoordinate(coordinate: string): number {
    const regex = /(\d{1,3})°\s*(\d{1,2})'?(\d{1,2}(?:\.\d+)?)?"?([NSEW])/i;
    const match = regex.exec(coordinate.trim());

    if (!match?.[1] || !match[2] || !match[3] || !match[4]) {
      throw new Error(`Formato de coordenada inválido: ${coordinate}`);
    }

    const degrees = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseFloat(match[3]);
    const direction = match[4].toUpperCase();

    let decimal = degrees + minutes / 60 + seconds / 3600;

    if (direction === "S" || direction === "W") {
      decimal *= -1;
    }

    // Arredonda para duas casas decimais
    return Math.round(decimal * 100) / 100;
  }

  const displayCsvValues = (results: Papa.ParseResult<CsvSchema>) => {
    const newCoordinates: Coordinate[] = [];

    results.data.forEach((row, index) => {
      if (index > 2) {
        const csvRow: CsvSchema = row;
        const lat = csvRow._3;
        const lon = csvRow._6;

        if (lat && lon) {
          try {
            const parsedLat = parseStringCoordinate(lat);
            const parsedLon = parseStringCoordinate(lon);
            newCoordinates.push({
              latitude: parsedLat.toString(),
              longitude: parsedLon.toString(),
            });
          } catch (e) {
            console.warn(`Erro ao parsear coordenada na linha ${index + 1}`);
          }
        }
      }
    });

    // Atualize o estado apenas uma vez
    setCoordinates((prev) => [...prev, ...newCoordinates]);
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
                className="flex cursor-pointer items-center justify-center rounded-lg bg-red-500 p-2 text-white transition hover:bg-red-600"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => addCoordinate()}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5" />
            Adicionar coordenada
          </button>

          <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-white transition hover:bg-yellow-600">
            <ArrowUpTrayIcon className="h-5 w-5" />
            Upload CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  Papa.parse(file, {
                    delimiter: ";",
                    skipEmptyLines: true,
                    dynamicTyping: true,
                    header: true,

                    complete: (results: Papa.ParseResult<CsvSchema>) =>
                      displayCsvValues(results),
                  });
                }
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-60"
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
                          <span className="font-medium capitalize">
                            {key}de:
                          </span>{" "}
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
