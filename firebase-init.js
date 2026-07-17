// ─────────────────────────────────────────────────────────────
// 1. Go to https://console.firebase.google.com
// 2. Create a free project (no credit card needed)
// 3. Build > Realtime Database > Create Database > start in TEST MODE
// 4. Project settings (gear icon) > General > "Your apps" > Add app > Web (</>)
// 5. Copy the firebaseConfig object it gives you and paste it below,
//    replacing the placeholder values.
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5qxouzFeu7DvhXW8RF8jYXj465QZrzDM",
  authDomain: "our-sketchbook.firebaseapp.com",
  databaseURL: "https://our-sketchbook-default-rtdb.firebaseio.com",
  projectId: "our-sketchbook",
  storageBucket: "our-sketchbook.firebasestorage.app",
  messagingSenderId: "798806297171",
  appId: "1:798806297171:web:ac37e64b0156b37938d4a6"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);