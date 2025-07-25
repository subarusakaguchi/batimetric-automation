export const API_URL =
  "https://geoportal.sgb.gov.br/server/rest/services/geologia_marinha/batimetria/MapServer/dynamicLayer/query?";
export const WKID = 102100;
export const RADIUS = 6378137.0;
export const MAX_CONCURRENT_REQUESTS = 5;

const REQ_LIMIT_PER_MIN = 60;
const BATCH_SIZE = 10;
export const BATCH_DELAY = (60 / (REQ_LIMIT_PER_MIN / BATCH_SIZE)) * 1000; // em ms
