# Classroom mode across phones (Firebase)

Without configuration the classroom runs in **local mode**: host and players must be tabs of the same browser. To let a room join from their phones by scanning the QR code, connect a free Firebase project (Spark plan, no card needed):

1. https://console.firebase.google.com → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
3. **Build → Firestore Database → Create database** (production mode, any nearby location).
4. Firestore → **Rules**: paste the content of [`../firestore.rules`](../firestore.rules) and **Publish**.
5. Project settings (gear) → **Your apps → Web (`</>`)** → register an app (no Hosting) → copy the `firebaseConfig` object.
6. Create `data/classroom.json`:

```json
{
  "publicUrl": "https://YOUR-SITE.pages.dev/",
  "firebase": { "apiKey": "…", "authDomain": "…", "projectId": "…", "storageBucket": "…", "messagingSenderId": "…", "appId": "…" }
}
```

7. Authentication → **Settings → Authorized domains**: add your `.pages.dev` domain (localhost is already there).

The web config is not a secret (Firebase identifies the project with it); access is controlled by the rules. Players are anonymous ("Detective #3"): no names, emails or other personal data are stored. `publicUrl` makes the QR point to the public site when the host page is opened from localhost.
