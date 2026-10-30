// IndexNow: tells Bing/Yandex/Seznam (and any other participating engine) about URL
// changes instead of waiting for a crawl. The key is a fixed, non-secret token; the
// verification file at /<key>.txt must serve the key as its entire body. A Carrel
// publish submits the changed page through site-api's indexNowHook
// (lib/carrel/site-api.server.ts).
export const INDEXNOW_KEY = "00684e0087cdfeb65e76fa0b88d1c4e0";
