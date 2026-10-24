// Dev: run `adb reverse tcp:3000 tcp:3000` so a USB phone or emulator reaches the PC's server on localhost.
// OAuth "Web application" client from Google Cloud; the server checks ID tokens against the same ID.
export const GOOGLE_WEB_CLIENT_ID = '1036733705918-uq45tdb6jifo73btaljt1ats55i8r44h.apps.googleusercontent.com';
// Release builds use the VPS (server repo: voya-server, deployed with docker-compose.prod.yml).
// shortcut: plain http until the API has a domain; switch to https://<domain> then (and drop cleartext in AndroidManifest.xml).
export const API_URL = __DEV__ ? 'http://localhost:3000' : 'http://45.74.156.4';
