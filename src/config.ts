// Dev: run `adb reverse tcp:3000 tcp:3000` so a USB phone or emulator reaches the PC's server on localhost.
// OAuth "Web application" client from Google Cloud; the server checks ID tokens against the same ID.
export const GOOGLE_WEB_CLIENT_ID = '1036733705918-uq45tdb6jifo73btaljt1ats55i8r44h.apps.googleusercontent.com';
// Release builds reach the laptop's server through the ngrok tunnel (`ngrok http --url=<domain> 3000`).
// shortcut: testers' APKs depend on the laptop and tunnel being up; point this at the real API once the backend is deployed.
export const API_URL = __DEV__ ? 'http://localhost:3000' : 'https://nonfatigable-lena-unoptimistic.ngrok-free.dev';
