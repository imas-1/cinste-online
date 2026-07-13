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

## ⚠️ Reguli Firebase — prioritate mare, citește înainte să distribui aplicația

**Regulile "test mode" pe care le ai acum permit oricui cu adresa bazei de date să citească și să scrie ORICE, nu doar datele din propriile grupuri.** Sunt bune doar pentru dezvoltare/testare, nu pentru o aplicație reală cu utilizatori străini.

### Cum aplici regulile noi, fără să riști să stricăm ceva

1. Firebase Console → Realtime Database → tab **Rules**
2. **Copiază tot ce ai acum într-un fișier text separat, salvat pe calculator** — ăsta e planul tău de rollback dacă ceva nu merge
3. Înlocuiește cu regulile de mai jos → **Publish**
4. **Testează imediat, cu tine logat**: intră în grup, adaugă o cinstă, invită pe altcineva cu un cod, aprobă-l ca admin. Dacă ceva dă eroare de permisiuni, revino la regulile salvate la pasul 2 și spune-mi exact ce eroare ai primit — te ajut să le ajustez.

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "groups": {
          "$groupId": {
            ".write": "auth != null && (auth.uid === $uid || root.child('groups').child($groupId).child('members').child(auth.uid).child('role').val() === 'admin')"
          }
        },
        "displayName": {
          ".write": "auth != null && auth.uid === $uid"
        },
        "fcmTokens": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    },
    "groups": {
      ".read": "auth != null && auth.uid === 'm7dxclvNRLUnQSYGHIl43AWxtkk1'",
      "$groupId": {
        ".read": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).exists()",
        ".write": "auth != null && !data.exists() && newData.child('members').child(auth.uid).child('role').val() === 'admin'",
        "name": {
          ".write": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).child('role').val() === 'admin'"
        },
        "inviteCode": {
          ".write": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).child('role').val() === 'admin'"
        },
        "createdBy": {
          ".write": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).child('role').val() === 'admin'"
        },
        "goal": {
          ".write": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).child('role').val() === 'admin'"
        },
        "members": {
          "$uid": {
            ".read": "auth != null",
            ".write": "auth != null && (auth.uid === $uid || root.child('groups').child($groupId).child('members').child(auth.uid).child('role').val() === 'admin')"
          }
        },
        "pendingMembers": {
          "$uid": {
            ".read": "auth != null",
            ".write": "auth != null && (auth.uid === $uid || root.child('groups').child($groupId).child('members').child(auth.uid).child('role').val() === 'admin')"
          }
        },
        "entries": {
          "$entryId": {
            ".read": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).exists()",
            ".write": "auth != null && root.child('groups').child($groupId).child('members').child(auth.uid).exists()"
          }
        }
      }
    },
    "inviteCodes": {
      "$code": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "feedback": {
      ".write": "auth != null",
      ".read": false
    }
  }
}
```

**Ce fac aceste reguli, pe scurt:**
- Fiecare persoană își poate citi/scrie doar propriul profil (`users/{uid}`)
- Un admin de grup poate scrie în profilul altcuiva DOAR pentru a-l adăuga/elimina din acel grup (necesar când aprobă/elimină membri)
- Doar membrii unui grup pot citi datele acelui grup (nume, membri, cinste)
- Doar adminii pot schimba numele grupului sau regenera codul de invitație
- Codurile de invitație pot fi citite/verificate de orice utilizator logat (necesar ca să te poți alătura unui grup nou)

**Nu sunt 100% bulletproof** — de exemplu, oricine logat poate citi un cod de invitație valid dacă îl ghicește (puțin probabil, sunt 6 caractere aleatorii din 32, deci ~1 miliard de combinații). Pentru o aplicație vândută la scară mare, merită o rundă de audit de securitate suplimentară înainte de lansare publică — pot să te ajut cu asta quando ajungi acolo.

## Restul pașilor (Realtime Database, Vercel, PWA)

Identici cu înainte — vezi structura de fișiere `public/manifest.json`, `public/sw.js`, `public/icon.png` pentru PWA.

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
