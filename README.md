# Caietul de cinste

Aplicație completă, cu cont real, grupuri separate, roluri, dark mode, și toate funcțiile: cinste, rambursări, poze, calendar, roata norocului, clasament cu porecle, premii lunare.

## ⚠️ Pas obligatoriu — activează Authentication în Firebase

Fără asta, aplicația NU va porni (ecranul de login rămâne blocat).

1. Consola Firebase → proiectul tău → meniul ☰ → **Build → Authentication → Get started**
2. Tab **Sign-in method** → activează:
   - **Email/Password** (Enable → Save)
   - **Google** (Enable → alege un email de suport → Save)

## Structura datelor (Realtime Database)

```
users/{uid}/
  displayName
  groups/{groupId}: true

groups/{groupId}/
  name
  inviteCode
  createdBy
  members/{uid}: { name, role: "admin"|"member", joinedAt }
  entries/{entryId}: { from, to, amount, type, note, date, photos, ... }

inviteCodes/{CODE}: groupId
```

## ⚠️ Securitate — important înainte să distribui aplicația public

Regulile "test mode" pe care le ai acum permit oricui cu URL-ul bazei de date să citească/scrie orice, nu doar membrii propriilor grupuri. E ok pentru testare, dar **nu e sigur pentru lansare publică**. Când ești gata, în Firebase → Realtime Database → Rules, pune ceva de genul:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "groups": {
      "$groupId": {
        ".read": "auth != null && data.child('members').child(auth.uid).exists()",
        "entries": {
          ".write": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).exists()"
        },
        "members": {
          ".write": "auth != null"
        }
      }
    },
    "inviteCodes": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

Astea sunt un punct de plecare rezonabil, nu perfect — dacă vrei, te ajut să le rafinez mai mult înainte de lansare.

## Restul pașilor (Realtime Database, Vercel, PWA)

Identici cu înainte — vezi structura de fișiere `public/manifest.json`, `public/sw.js`, `public/icon.svg` pentru PWA.

## Despre publicarea pe App Store / Google Play

Codul din acest proiect (auth, grupuri, roluri) e temelia necesară, dar publicarea propriu-zisă cere:
- Cont Apple Developer (99$/an) + un Mac cu Xcode pentru build iOS
- Cont Google Play Developer (25$, o singură dată) — nu necesită Mac
- Ambalare cu **Capacitor** (`npm install @capacitor/core @capacitor/ios @capacitor/android`) — pas separat, te ghidez când ești gata
- O politică de confidențialitate (obligatorie pentru ambele magazine, mai ales cu autentificare + date personale)

Astea sunt pași pe care trebuie să-i faci tu (cont, hardware, submitere) — eu te pot ghida exact, dar nu le pot face în locul tău.

## Notificări push „mereu" (chiar cu aplicația închisă)

### Pas 1 — Firebase: cheia VAPID (ai făcut-o deja)
Firebase Console → Cloud Messaging → Web Push certificates → cheia generată e deja pusă în `src/firebase.js` (`VAPID_KEY`).

### Pas 2 — Service Account (pentru trimiterea efectivă, prin Vercel)
1. Firebase Console → ⚙️ Project Settings → tab **Service Accounts**
2. **Generate new private key** → se descarcă un fișier `.json`
3. Deschide fișierul, ai nevoie de 3 valori: `project_id`, `client_email`, `private_key`

### Pas 3 — Variabile de mediu în Vercel
Proiect → **Settings → Environment Variables** → adaugă:
- `FIREBASE_PROJECT_ID` = valoarea din json
- `FIREBASE_CLIENT_EMAIL` = valoarea din json
- `FIREBASE_PRIVATE_KEY` = valoarea din json (tot, cu `-----BEGIN PRIVATE KEY-----` și `-----END PRIVATE KEY-----`)

Apoi **Redeploy** ca variabilele să fie active.

### Cum funcționează
Când cineva apasă clopoțelul din aplicație, browserul cere token FCM și îl salvează în baza de date. Când se adaugă o cinstă nouă, aplicația cheamă funcția serverless `/api/notify` (rulează pe Vercel, gratuit) care trimite notificarea prin Firebase Admin — asta funcționează chiar și cu telefonul blocat sau aplicația închisă (cât timp telefonul e pornit și conectat la internet).

**Limitare reală**: pe iPhone, notificările web push funcționează doar dacă aplicația e **adăugată pe ecranul principal ca PWA** (Safari → Distribuie → Adaugă pe ecranul principal) — Safari normal (tab de browser) nu suportă asta pe iOS.
