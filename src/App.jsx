import React, { useState, useEffect, useRef } from "react";
import {
  Coins,
  Plus,
  LogOut,
  Users,
  Receipt,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Scale,
  Trash2,
  Camera,
  Bell,
  BellOff,
  Dices,
  Award,
  Calendar as CalendarIcon,
  Sun,
  Moon,
  Copy,
  Shield,
  UserPlus,
  Mail,
  Lock,
  ArrowLeftRight,
  MessageCircle,
  ArrowUpDown,
  Download,
  QrCode,
  Ban,
  Crown,
  Pencil,
} from "lucide-react";
import { db, auth, googleProvider, getMessagingIfSupported, VAPID_KEY } from "./firebase";
import { ref, onValue, set, push, remove, get } from "firebase/database";
import { getToken, onMessage } from "firebase/messaging";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";

const THEME_KEY = "cinsteTheme";
const ACTIVE_GROUP_KEY = "cinsteActiveGroup";
const CREATOR_UID = "m7dxclvNRLUnQSYGHIl43AWxtkk1";

const AVATAR_GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-500",
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-fuchsia-400 to-pink-500",
  "from-lime-400 to-green-500",
  "from-red-400 to-orange-500",
];

const WHEEL_COLORS = ["#f59e0b", "#ec4899", "#8b5cf6", "#10b981", "#3b82f6", "#f43f5e", "#14b8a6", "#eab308"];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

let avatarMetaStore = {};
function setAvatarMeta(map) {
  avatarMetaStore = map;
}

const AVATAR_COLOR_SWATCHES = [
  "#f59e0b", "#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#ec4899", "#84cc16", "#06b6d4",
];
const AVATAR_EMOJIS = [
  "😎", "🦊", "🐱", "🐶", "🐼", "🦁", "🐨", "🐸", "🦄", "🐵", "🧑‍🚀", "🥷",
  "🤠", "🕵️", "🧙", "🦹", "🧛", "🧑‍🎤", "🥸", "🧑‍🎨",
];

function Avatar({ name, size = 10, photo, color, emoji }) {
  const meta = avatarMetaStore[name] || {};
  photo = photo || meta.photo;
  color = color || meta.color;
  emoji = emoji || meta.emoji;
  const initial = name?.[0]?.toUpperCase() || "?";
  const px = size * 4;
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        loading="lazy"
        className="shrink-0 rounded-full object-cover shadow-sm"
        style={{ width: px, height: px }}
      />
    );
  }
  const bgStyle = color ? { backgroundColor: color, width: px, height: px, fontSize: size * 1.4 } : { width: px, height: px, fontSize: size * 1.4 };
  return (
    <div
      className={`shrink-0 rounded-full ${color ? "" : `bg-gradient-to-br ${colorFor(name)}`} flex items-center justify-center text-white font-bold shadow-sm`}
      style={bgStyle}
    >
      {emoji || initial}
    </div>
  );
}

function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="blob-1 absolute -top-16 -left-16 w-72 h-72 rounded-full bg-amber-300/30 dark:bg-amber-500/10 blur-3xl" />
      <div className="blob-2 absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-rose-300/25 dark:bg-rose-500/10 blur-3xl" />
      <div className="blob-1 absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-violet-300/20 dark:bg-violet-500/10 blur-3xl" />
    </div>
  );
}

function Confetti({ trigger }) {
  const colors = ["#f59e0b", "#ec4899", "#8b5cf6", "#10b981", "#3b82f6", "#f43f5e"];
  const pieces = Array.from({ length: 18 });
  if (!trigger) return null;
  return (
    <div className="fixed inset-x-0 top-24 flex justify-center pointer-events-none z-50">
      {pieces.map((_, i) => {
        const dx = (Math.random() - 0.5) * 160;
        const rot = (Math.random() - 0.5) * 360;
        return (
          <span
            key={i}
            className="confetti-piece absolute w-2 h-2 rounded-sm"
            style={{
              backgroundColor: colors[i % colors.length],
              left: `${Math.random() * 100}px`,
              "--dx": `${dx}px`,
              "--rot": `${rot}deg`,
              animationDelay: `${Math.random() * 0.15}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

function formatAmount(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveLS(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}
}

function fileToCompressedBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 280;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.35));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function photosOf(e) {
  if (e.photos && e.photos.length) return e.photos;
  if (e.photo) return [e.photo];
  return [];
}

function haptic(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.09 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.09);
      osc.stop(ctx.currentTime + i * 0.09 + 0.26);
    });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([25, 30, 25]);
}

function playWheelChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [440, 550, 660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.07 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.07 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.22);
    });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([30, 40, 30, 40, 60]);
}

function exportCSV(entries) {
  const rows = [["De la", "Către", "Sumă", "Tip", "Notă", "Dată"]];
  entries
    .slice()
    .sort((a, b) => (a.date || 0) - (b.date || 0))
    .forEach((e) => {
      rows.push([e.from, e.to, e.amount, e.type, e.note || "", formatDate(e.date)]);
    });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "caietul-de-cinste.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function computeStats(members, entries) {
  const stats = {};
  members.forEach((m) => {
    stats[m] = {
      name: m,
      given: 0,
      received: 0,
      repaid: 0,
      repaidReceived: 0,
      count: 0,
      photos: 0,
      net: 0,
      foodCount: 0,
      firstCinsteToAll: false,
      lastGivenAt: null,
    };
  });
  const FOOD_WORDS = ["pizza", "shaorma", "restaurant", "terasa", "terasă", "mancare", "mâncare", "bere", "cafea", "burger", "suc"];
  entries.forEach((e) => {
    if (!stats[e.from] || !stats[e.to]) return;
    if (e.type === "cinste") {
      stats[e.from].given += e.amount;
      stats[e.to].received += e.amount;
      stats[e.from].net += e.amount;
      stats[e.to].net -= e.amount;
      if (e.splitAll) stats[e.from].firstCinsteToAll = true;
      if (!stats[e.from].lastGivenAt || e.date > stats[e.from].lastGivenAt) stats[e.from].lastGivenAt = e.date;
      const noteLower = (e.note || "").toLowerCase();
      if (FOOD_WORDS.some((w) => noteLower.includes(w))) stats[e.from].foodCount += 1;
    } else {
      stats[e.from].repaid += e.amount;
      stats[e.to].repaidReceived += e.amount;
      stats[e.from].net += e.amount;
      stats[e.to].net -= e.amount;
    }
    stats[e.from].count += 1;
    stats[e.from].photos += photosOf(e).length;
  });
  return Object.values(stats).map((s) => ({ ...s, net: Math.round(s.net * 100) / 100 }));
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

const BADGES = [
  {
    key: "biggestDebtor",
    title: "👑 Datorul Suprem",
    desc: "cel mai mare restanțier al grupului",
    pick: (stats) => stats.slice().sort((a, b) => a.net - b.net)[0],
    show: (s) => s.net < 0,
    metric: (s) => `datorează ${formatAmount(Math.abs(s.net))} lei net`,
    color: "from-red-400 to-rose-500",
  },
  {
    key: "biggestSponsor",
    title: "💸 Sponsorul Grupului",
    desc: "cel mai generos, i se datorează cel mai mult",
    pick: (stats) => stats.slice().sort((a, b) => b.net - a.net)[0],
    show: (s) => s.net > 0,
    metric: (s) => `i se cuvin ${formatAmount(s.net)} lei net`,
    color: "from-emerald-400 to-teal-500",
  },
  {
    key: "ghost",
    title: "👻 Fantoma Grupului",
    desc: "nu prea dă, dar nici nu prea primește",
    pick: (stats) =>
      stats
        .filter((s) => s.count > 0)
        .slice()
        .sort((a, b) => a.given + a.received - (b.given + b.received))[0],
    show: (s) => s.count > 0,
    metric: (s) => `doar ${formatAmount(s.given + s.received)} lei mișcați în total`,
    color: "from-gray-400 to-slate-500",
  },
  {
    key: "mostActive",
    title: "⚡ Cel Mai Activ",
    desc: "cele mai multe cinste înregistrate",
    pick: (stats) => stats.slice().sort((a, b) => b.count - a.count)[0],
    show: (s) => s.count > 0,
    metric: (s) => `${s.count} tranzacții`,
    color: "from-violet-400 to-purple-500",
  },
  {
    key: "biggestGiver",
    title: "🎩 Domnul Cinste",
    desc: "a plătit cel mai mult în total pentru alții",
    pick: (stats) => stats.slice().sort((a, b) => b.given - a.given)[0],
    show: (s) => s.given > 0,
    metric: (s) => `${formatAmount(s.given)} lei cinste date`,
    color: "from-amber-400 to-orange-500",
  },
  {
    key: "repaymentKing",
    title: "🤝 Regele Rambursărilor",
    desc: "cel mai responsabil, își achită mereu datoriile",
    pick: (stats) => stats.slice().sort((a, b) => b.repaid - a.repaid)[0],
    show: (s) => s.repaid > 0,
    metric: (s) => `${formatAmount(s.repaid)} lei rambursați`,
    color: "from-blue-400 to-indigo-500",
  },
  {
    key: "stingy",
    title: "🪙 Zgârcitul Simpatic",
    desc: "primește cinste dar încă n-a dat niciuna",
    pick: (stats) => stats.filter((s) => s.given === 0 && s.received > 0).sort((a, b) => b.received - a.received)[0],
    show: () => true,
    metric: (s) => `a primit ${formatAmount(s.received)} lei, a dat 0`,
    color: "from-yellow-400 to-amber-500",
  },
  {
    key: "photographer",
    title: "📸 Fotograful Oficial",
    desc: "cele mai multe poze atașate",
    pick: (stats) => stats.slice().sort((a, b) => b.photos - a.photos)[0],
    show: (s) => s.photos > 0,
    metric: (s) => `${s.photos} poze`,
    color: "from-sky-400 to-blue-500",
  },
];

function monthEntries(entries) {
  const now = new Date();
  return entries.filter((e) => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

const MONTHLY_AWARDS = [
  {
    key: "regeleCinstei",
    title: "🏆 Regele Cinstei",
    desc: "a plătit cel mai mult luna asta",
    pick: (stats) => stats.slice().sort((a, b) => b.given - a.given)[0],
    show: (s) => s.given > 0,
    metric: (s) => `${formatAmount(s.given)} lei cheltuiți`,
    color: "from-amber-400 to-yellow-500",
  },
  {
    key: "economul",
    title: "💰 Economul",
    desc: "a cheltuit cel mai puțin luna asta",
    pick: (stats) =>
      stats
        .filter((s) => s.count > 0)
        .slice()
        .sort((a, b) => a.given - b.given)[0],
    show: (s) => s.count > 0,
    metric: (s) => `doar ${formatAmount(s.given)} lei cheltuiți`,
    color: "from-emerald-400 to-green-500",
  },
  {
    key: "chefMaster",
    title: "🍕 Chef Master",
    desc: "cele mai multe cheltuieli la mâncare",
    pick: (stats) => stats.slice().sort((a, b) => b.foodCount - a.foodCount)[0],
    show: (s) => s.foodCount > 0,
    metric: (s) => `${s.foodCount} cheltuieli cu mâncare`,
    color: "from-orange-400 to-red-500",
  },
  {
    key: "speedPayer",
    title: "⚡ Speed Payer",
    desc: "și-a achitat cele mai multe datorii luna asta",
    pick: (stats) => stats.slice().sort((a, b) => b.repaid - a.repaid)[0],
    show: (s) => s.repaid > 0,
    metric: (s) => `${formatAmount(s.repaid)} lei rambursați`,
    color: "from-blue-400 to-cyan-500",
  },
  {
    key: "restantierul",
    title: "😅 Restanțierul",
    desc: "are cele mai multe datorii neachitate luna asta",
    pick: (stats) => stats.slice().sort((a, b) => a.net - b.net)[0],
    show: (s) => s.net < 0,
    metric: (s) => `${formatAmount(Math.abs(s.net))} lei neachitați`,
    color: "from-red-400 to-pink-500",
  },
];

const ACHIEVEMENTS = [
  { key: "first", label: "Prima Cinste", icon: "🎉", check: (s) => s.count > 0 },
  { key: "hundred", label: "100+ lei cheltuiți", icon: "💯", check: (s) => s.given >= 100 },
  { key: "fivehundred", label: "500+ lei cheltuiți", icon: "🤑", check: (s) => s.given >= 500 },
  { key: "generous", label: "Cinste la toată gașca", icon: "🎊", check: (s) => s.firstCinsteToAll },
  { key: "photo", label: "Prima poză atașată", icon: "📷", check: (s) => s.photos > 0 },
  { key: "settled", label: "Cont la zi", icon: "✅", check: (s) => s.net === 0 && s.count > 0 },
  { key: "responsible", label: "Prima rambursare", icon: "🤝", check: (s) => s.repaid > 0 },
  { key: "chef", label: "Gurmandul", icon: "🍕", check: (s) => s.foodCount >= 3 },
];

const RO_DAYS = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sb", "Du"];
const RO_MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

function sameDay(ts, y, m, d) {
  const dt = new Date(ts);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
}

function polarPoint(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sliceCenterAngle(i, total) {
  const sliceAngle = 360 / total;
  return (i + 0.5) * sliceAngle;
}

function genInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function useTheme() {
  const [theme, setTheme] = useState(() => loadLS(THEME_KEY, "light"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    saveLS(THEME_KEY, theme);
  }, [theme]);
  return [theme, setTheme];
}

function SkeletonScreen({ label }) {
  return (
    <div className="min-h-screen px-5 pt-8 animate-fadein">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="h-20 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-20 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
      ))}
      {label && <p className="text-center text-xs text-gray-400 mt-4">{label}</p>}
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-90"
      aria-label="Comută tema"
    >
      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function AuthScreen({ theme, setTheme }) {
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setErr("");
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setErr(translateAuthError(e.code));
    }
    setBusy(false);
  }

  async function handleEmailAuth() {
    setErr("");
    setInfo("");
    if (!email.trim() || !password) {
      setErr("Completează email și parolă.");
      return;
    }
    if (mode === "signup" && !displayName.trim()) {
      setErr("Alege un nume de afișare.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
        try {
          await sendEmailVerification(cred.user);
        } catch (e) {}
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e) {
      setErr(translateAuthError(e.code));
    }
    setBusy(false);
  }

  async function handleResetPassword() {
    setErr("");
    setInfo("");
    if (!email.trim()) {
      setErr("Introdu emailul contului tău.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Ți-am trimis un email cu link de resetare a parolei.");
    } catch (e) {
      setErr(translateAuthError(e.code));
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans flex flex-col items-center justify-center px-6 animate-fadein">
      <div className="absolute top-5 right-5">
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>
      <img src="/icon.png" alt="Faci cinste?" className="w-20 h-20 rounded-2xl shadow-lg shadow-amber-500/40 mb-4 animate-popin" />
      <h1 className="text-3xl font-extrabold">Faci cinste? 😉</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 text-center max-w-xs">
        {mode === "signup" ? "Creează-ți un cont ca să te alături unui grup." : "Intră în cont ca să vezi grupurile tale."}
      </p>

      <div className="mt-8 w-full max-w-xs">
        <button
          onClick={handleGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 rounded-2xl py-3 text-sm font-medium bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors active:scale-[0.98] mb-4 disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.6 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.4 6.1 29.5 4 24 4c-7.6 0-14.1 4.3-17.4 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.4l-6.3-5.3C29.4 35.4 26.8 36 24 36c-5.3 0-9.9-3.4-11.5-8.1l-6.5 5C9.8 39.6 16.4 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.3C40.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
          </svg>
          Continuă cu Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs text-gray-400">sau cu email</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {mode === "signup" && (
          <div className="relative mb-3">
            <UserPlus size={16} className="absolute left-3 top-3.5 text-gray-400" />
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Numele tău"
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        )}
        <div className="relative mb-3">
          <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        {mode !== "reset" && (
          <div className="relative mb-4">
            <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
              placeholder="Parolă"
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        {mode === "signin" && (
          <button
            onClick={() => {
              setMode("reset");
              setErr("");
              setInfo("");
            }}
            className="w-full text-right text-xs text-amber-600 dark:text-amber-400 -mt-2 mb-3"
          >
            Am uitat parola
          </button>
        )}

        {err && <p className="text-xs text-red-600 mb-3">{err}</p>}
        {info && <p className="text-xs text-green-600 mb-3">{info}</p>}

        {mode === "reset" ? (
          <>
            <button
              onClick={handleResetPassword}
              disabled={busy}
              className="w-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-xl py-3 active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/30 disabled:opacity-60"
            >
              Trimite link de resetare
            </button>
            <button
              onClick={() => {
                setMode("signin");
                setErr("");
                setInfo("");
              }}
              className="w-full text-center text-sm text-gray-500 dark:text-gray-400 mt-4"
            >
              Înapoi la login
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleEmailAuth}
              disabled={busy}
              className="w-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-xl py-3 active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/30 disabled:opacity-60"
            >
              {mode === "signup" ? "Creează cont" : "Intră în cont"}
            </button>

            <button
              onClick={() => {
                setMode(mode === "signup" ? "signin" : "signup");
                setErr("");
                setInfo("");
              }}
              className="w-full text-center text-sm text-gray-500 dark:text-gray-400 mt-4"
            >
              {mode === "signup" ? "Ai deja cont? Intră" : "Nu ai cont? Creează unul"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function translateAuthError(code) {
  const map = {
    "auth/email-already-in-use": "Există deja un cont cu acest email.",
    "auth/invalid-email": "Email invalid.",
    "auth/weak-password": "Parola trebuie să aibă cel puțin 6 caractere.",
    "auth/user-not-found": "Nu există cont cu acest email.",
    "auth/wrong-password": "Parolă greșită.",
    "auth/invalid-credential": "Email sau parolă greșită.",
    "auth/popup-closed-by-user": "Ai închis fereastra Google înainte de a termina.",
  };
  return map[code] || "A apărut o eroare. Încearcă din nou.";
}

function TypingTagline({ text }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [text]);
  return (
    <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs min-h-[2.5rem]">
      {shown}
      <span className="inline-block w-0.5 h-4 bg-amber-400 ml-0.5 align-middle animate-pulse" />
    </p>
  );
}

function GroupGate({ user, theme, setTheme, onGroupReady, isCreator, onOpenCreator }) {
  const [myGroups, setMyGroups] = useState(null); // null = loading
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("join") ? "join" : "pick";
  });
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("join") || "").toUpperCase();
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const userGroupsRef = ref(db, `users/${user.uid}/groups`);
    const unsub = onValue(userGroupsRef, async (snap) => {
      const val = snap.val() || {};
      const ids = Object.keys(val);
      if (ids.length === 0) {
        setMyGroups([]);
        return;
      }
      const results = await Promise.all(
        ids.map(async (gid) => {
          try {
            const s = await get(ref(db, `groups/${gid}/name`));
            return { id: gid, name: s.val() || "Grup" };
          } catch (e) {
            return { id: gid, name: "Grup" };
          }
        })
      );
      setMyGroups(results);
    });
    return () => unsub();
  }, [user.uid]);

  async function createGroup() {
    const name = groupName.trim() || "Grupul nostru";
    setBusy(true);
    setErr("");
    try {
      const newGroupRef = push(ref(db, "groups"));
      const gid = newGroupRef.key;
      const code = genInviteCode();
      await set(newGroupRef, {
        name,
        inviteCode: code,
        createdBy: user.uid,
        members: {
          [user.uid]: { name: user.displayName || "Eu", role: "admin", joinedAt: Date.now() },
        },
      });
      await set(ref(db, `inviteCodes/${code}`), gid);
      await set(ref(db, `users/${user.uid}/groups/${gid}`), true);
      saveLS(ACTIVE_GROUP_KEY, gid);
      onGroupReady(gid);
    } catch (e) {
      setErr("Nu am putut crea grupul: " + e.message);
    }
    setBusy(false);
  }

  async function joinGroup() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setErr("Introdu codul de invitație.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const snap = await get(ref(db, `inviteCodes/${code}`));
      const gid = snap.val();
      if (!gid) {
        setErr("Cod invalid sau grup inexistent.");
        setBusy(false);
        return;
      }
      const memberSnap = await get(ref(db, `groups/${gid}/members/${user.uid}`));
      if (memberSnap.exists()) {
        saveLS(ACTIVE_GROUP_KEY, gid);
        onGroupReady(gid);
        setBusy(false);
        return;
      }
      await set(ref(db, `groups/${gid}/pendingMembers/${user.uid}`), {
        name: user.displayName || "Membru nou",
        requestedAt: Date.now(),
      });
      setMode("pending");
    } catch (e) {
      setErr("Nu am putut trimite cererea: " + e.message);
    }
    setBusy(false);
  }

  if (myGroups === null) {
    return (
      <SkeletonScreen label="se conectează la grupurile tale…" />
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans flex flex-col items-center justify-center px-6 py-10 animate-fadein">
      <div className="absolute top-5 right-5 flex items-center gap-2">
        {isCreator && (
          <button
            onClick={onOpenCreator}
            title="Panou creator"
            className="p-2 rounded-full border border-amber-300 dark:border-amber-700 text-amber-500 bg-amber-50 dark:bg-amber-900/30"
          >
            <Crown size={15} />
          </button>
        )}
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <button
          onClick={() => signOut(auth)}
          className="p-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-300"
        >
          <LogOut size={15} />
        </button>
      </div>

      <div className="relative mb-3 animate-popin">
        <div className="absolute inset-0 rounded-3xl bg-amber-400/40 blur-2xl scale-110" />
        <img src="/icon.png" alt="Faci cinste?" className="relative w-24 h-24 rounded-3xl shadow-xl shadow-amber-500/40" />
      </div>
      <h1 className="text-2xl font-extrabold">Salut, {user.displayName} 👋</h1>
      <TypingTagline
        text={
          myGroups && myGroups.length > 0
            ? "Alege un grup ca să continui, sau pornește unul nou."
            : "Hai să creăm sau să te alături primului tău grup de cinste."
        }
      />

      <div className="w-full max-w-xs mt-6 rounded-3xl border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 backdrop-blur-md shadow-lg p-5">
      {mode === "pick" && (
        <div className="w-full space-y-2">
          {myGroups.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Grupurile tale</p>
              {myGroups.map((g, i) => (
                <button
                  key={g.id}
                  style={{ animationDelay: `${i * 70}ms` }}
                  onClick={() => {
                    saveLS(ACTIVE_GROUP_KEY, g.id);
                    onGroupReady(g.id);
                  }}
                  className="w-full animate-fadein text-left px-4 py-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-500 hover:shadow-md transition-all flex items-center gap-3 active:scale-[0.99]"
                >
                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-br ${colorFor(g.name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                  >
                    {g.name?.[0]?.toUpperCase() || "G"}
                  </div>
                  <span className="font-medium flex-1">{g.name}</span>
                  <ArrowRight size={16} className="text-gray-400" />
                </button>
              ))}
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <span className="text-[10px] text-gray-400">sau</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("create")}
              className="flex-1 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-medium rounded-xl py-2.5 active:scale-95 transition-transform shadow-md shadow-amber-500/30"
            >
              + Grup nou
            </button>
            <button
              onClick={() => setMode("join")}
              className="flex-1 border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-xl py-2.5 active:scale-95 transition-transform"
            >
              Am un cod
            </button>
          </div>
        </div>
      )}

      {mode === "create" && (
        <div className="w-full animate-slideup">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Numele grupului</p>
          <input
            autoFocus
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="ex: Frații"
            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 mb-3"
          />
          {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={createGroup}
              disabled={busy}
              className="flex-1 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-60"
            >
              Creează
            </button>
            <button onClick={() => setMode("pick")} className="px-4 text-sm text-gray-500 rounded-xl border border-gray-300 dark:border-gray-700">
              Înapoi
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div className="w-full animate-slideup">
          <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Cod de invitație</p>
          <input
            autoFocus
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ex: A1B2C3"
            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm tracking-widest font-mono focus:outline-none focus:border-amber-500 mb-3"
          />
          {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={joinGroup}
              disabled={busy}
              className="flex-1 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-medium rounded-xl py-2.5 disabled:opacity-60"
            >
              Trimite cerere
            </button>
            <button onClick={() => setMode("pick")} className="px-4 text-sm text-gray-500 rounded-xl border border-gray-300 dark:border-gray-700">
              Înapoi
            </button>
          </div>
        </div>
      )}

      {mode === "pending" && (
        <div className="w-full text-center animate-slideup">
          <p className="text-3xl mb-2">⏳</p>
          <p className="text-sm font-medium mb-1">Cerere trimisă</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Un admin al grupului trebuie să-ți aprobe intrarea. Revino aici după ce te anunță.
          </p>
          <button
            onClick={() => setMode("pick")}
            className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-xl py-2.5"
          >
            Verifică din nou
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useTheme();
  const [user, setUser] = useState(undefined); // undefined = loading, null = logged out
  const [activeGroup, setActiveGroup] = useState(() => loadLS(ACTIVE_GROUP_KEY, null));
  const [showCreator, setShowCreator] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(undefined); // undefined = loading, null = not accepted

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setActiveGroup(null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setTermsAccepted(undefined);
      return;
    }
    const unsub = onValue(ref(db, `users/${user.uid}/termsAccepted`), (snap) => {
      setTermsAccepted(snap.val() === true ? true : null);
    });
    return () => unsub();
  }, [user]);

  async function acceptTerms() {
    if (!user) return;
    try {
      await set(ref(db, `users/${user.uid}/termsAccepted`), true);
    } catch (e) {}
  }

  if (user === undefined) {
    return (
      <>
        <BackgroundBlobs />
        <SkeletonScreen />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <BackgroundBlobs />
        <AuthScreen theme={theme} setTheme={setTheme} />
      </>
    );
  }

  if (termsAccepted === undefined) {
    return (
      <>
        <BackgroundBlobs />
        <SkeletonScreen />
      </>
    );
  }

  if (termsAccepted !== true) {
    return (
      <>
        <BackgroundBlobs />
        <TermsGate theme={theme} setTheme={setTheme} onAccept={acceptTerms} onLogout={() => signOut(auth)} />
      </>
    );
  }

  if (showCreator && user.uid === CREATOR_UID) {
    return (
      <>
        <BackgroundBlobs />
        <CreatorDashboard theme={theme} setTheme={setTheme} onClose={() => setShowCreator(false)} />
      </>
    );
  }

  if (!activeGroup) {
    return (
      <>
        <BackgroundBlobs />
        <GroupGate
          user={user}
          theme={theme}
          setTheme={setTheme}
          onGroupReady={setActiveGroup}
          isCreator={user.uid === CREATOR_UID}
          onOpenCreator={() => setShowCreator(true)}
        />
      </>
    );
  }

  return (
    <GroupApp
      user={user}
      groupId={activeGroup}
      theme={theme}
      setTheme={setTheme}
      onSwitchGroup={() => {
        saveLS(ACTIVE_GROUP_KEY, null);
        setActiveGroup(null);
      }}
    />
  );
}

function GroupApp({ user, groupId, theme, setTheme, onSwitchGroup }) {
  const [groupInfo, setGroupInfo] = useState(null);
  const [groupMembers, setGroupMembers] = useState({});
  const [pendingMembers, setPendingMembers] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [entries, setEntries] = useState([]);
  const [deletedEntries, setDeletedEntries] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
  const [viewingMember, setViewingMember] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [err, setErr] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [confetti, setConfetti] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [notifOn, setNotifOn] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState("month");
  const [sortBy, setSortBy] = useState("date");

  const [form, setForm] = useState({ amount: "", targets: [], note: "", type: "cinste", photos: [], includeMe: false });

  const membersRef = ref(db, `groups/${groupId}/members`);
  const entriesRef = ref(db, `groups/${groupId}/entries`);

  useEffect(() => {
    if (!err) return;
    const t = setTimeout(() => setErr(""), 4500);
    return () => clearTimeout(t);
  }, [err]);

  useEffect(() => {
    const map = {};
    Object.values(groupMembers).forEach((m) => {
      map[m.name] = { photo: m.photo, color: m.color, emoji: m.emoji };
    });
    setAvatarMeta(map);
  }, [groupMembers]);

  useEffect(() => {
    const unsub = onValue(
      ref(db, `groups/${groupId}`),
      (snap) => {
        setConnected(true);
        const v = snap.val();
        setGroupInfo(v ? { name: v.name, inviteCode: v.inviteCode, goal: v.goal || null } : null);
        setGroupMembers(v?.members || {});
        setPendingMembers(v?.pendingMembers || {});
      },
      (e) => {
        setConnected(false);
        setErr("Eroare conexiune: " + e.message);
      }
    );
    return () => unsub();
  }, [groupId]);

  useEffect(() => {
    const unsub = onValue(
      entriesRef,
      (snap) => {
        const val = snap.val() || {};
        const all = Object.entries(val).map(([id, e]) => ({ id, ...e }));
        const active = all.filter((e) => !e.deleted);
        const deleted = all.filter((e) => e.deleted);
        active.sort((a, b) => (b.date || 0) - (a.date || 0));
        deleted.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
        setEntries(active);
        setDeletedEntries(deleted);
      },
      (e) => {
        setErr("Eroare la citirea cinstelor: " + e.message);
      }
    );
    return () => unsub();
  }, [groupId]);

  useEffect(() => {
    setNotifOn(loadLS(`cinsteNotif:${user.uid}`, false));
  }, [user.uid]);

  useEffect(() => {
    let unsub;
    (async () => {
      const messaging = await getMessagingIfSupported();
      if (!messaging) return;
      unsub = onMessage(messaging, async (payload) => {
        const title = payload.notification?.title || "Caietul de cinste";
        const body = payload.notification?.body || "";
        if (Notification.permission === "granted") {
          try {
            const reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
            if (reg) {
              reg.showNotification(title, { body, icon: "/icon.png", badge: "/icon.png" });
            }
          } catch (e) {}
        }
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  async function toggleNotif() {
    const next = !notifOn;
    if (!next) {
      setNotifOn(false);
      saveLS(`cinsteNotif:${user.uid}`, false);
      try {
        const messaging = await getMessagingIfSupported();
        if (messaging) {
          const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
          const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
          if (token) await remove(ref(db, `users/${user.uid}/fcmTokens/${token}`));
        }
      } catch (e) {}
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const messaging = await getMessagingIfSupported();
      if (messaging) {
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        if (token) {
          // Token-ul e folosit ca cheie -> imposibil să apară duplicate, chiar dacă activezi de mai multe ori
          await set(ref(db, `users/${user.uid}/fcmTokens/${token}`), true);
        }
      }
      setNotifOn(true);
      saveLS(`cinsteNotif:${user.uid}`, true);
    } catch (e) {
      setErr("Nu am putut activa notificările: " + e.message);
    }
  }

  async function notifyRecipients(names, title, body) {
    try {
      const nameToUid = {};
      Object.entries(groupMembers).forEach(([uid, m]) => {
        nameToUid[m.name] = uid;
      });
      const uids = names.map((n) => nameToUid[n]).filter(Boolean);
      const tokenLists = await Promise.all(
        uids.map(async (uid) => {
          const snap = await get(ref(db, `users/${uid}/fcmTokens`));
          const val = snap.val() || {};
          return Object.keys(val); // token-urile sunt cheile, nu valorile
        })
      );
      const tokens = tokenLists.flat();
      if (tokens.length === 0) return;
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens, title, body }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error("Notify failed:", res.status, errBody);
      }
    } catch (e) {
      console.error("Notify error:", e);
    }
  }

  const me = groupMembers[user.uid]?.name || user.displayName;
  const myRole = groupMembers[user.uid]?.role || "member";
  const isAdmin = myRole === "admin";
  const amBlocked = !!groupMembers[user.uid]?.blocked;
  const members = Object.values(groupMembers).map((m) => m.name);
  const others = members.filter((m) => m !== me);

  const [receivedToast, setReceivedToast] = useState("");
  const mountTimeRef = useRef(Date.now());
  const seenIdsRef = useRef(new Set());
  useEffect(() => {
    if (!me) return;
    entries.forEach((e) => {
      if (seenIdsRef.current.has(e.id)) return;
      seenIdsRef.current.add(e.id);
      if (e.date && e.date < mountTimeRef.current) return; // doar cinstele noi, apărute după deschiderea aplicației
      if (e.to !== me || e.from === me) return;
      const msg =
        e.type === "rambursare" ? `${e.from} ți-a dat banii înapoi 🤝` : `${e.from} ți-a făcut cinste! 🎉`;
      setReceivedToast(msg);
      playChime();
      setTimeout(() => setReceivedToast(""), 4000);
    });
  }, [entries, me]);

  async function removeMember(uid) {
    try {
      await remove(ref(db, `groups/${groupId}/members/${uid}`));
      await remove(ref(db, `users/${uid}/groups/${groupId}`));
      setConfirmDeleteMember(null);
    } catch (e) {
      setErr("Nu am putut elimina membrul: " + e.message);
    }
  }

  async function regenerateInviteCode() {
    try {
      const code = genInviteCode();
      await set(ref(db, `groups/${groupId}/inviteCode`), code);
      await set(ref(db, `inviteCodes/${code}`), groupId);
    } catch (e) {
      setErr("Nu am putut genera cod nou: " + e.message);
    }
  }

  async function editGroup({ name, photo }) {
    try {
      await set(ref(db, `groups/${groupId}/name`), name);
      await set(ref(db, `groups/${groupId}/photo`), photo || null);
    } catch (e) {
      setErr("Nu am putut actualiza grupul: " + e.message);
    }
  }

  async function deleteGroup() {
    try {
      const memberUids = Object.keys(groupMembers);
      // curățăm indexul de grupuri al fiecărui membru CÂT TIMP grupul (și rolul de admin) încă există
      await Promise.all(memberUids.map((uid) => remove(ref(db, `users/${uid}/groups/${groupId}`))));
      if (groupInfo.inviteCode) {
        await remove(ref(db, `inviteCodes/${groupInfo.inviteCode}`));
      }
      await remove(ref(db, `groups/${groupId}`));
      onSwitchGroup();
    } catch (e) {
      setErr("Nu am putut șterge grupul: " + e.message);
    }
  }

  async function setGroupGoal(count) {
    try {
      await set(ref(db, `groups/${groupId}/goal`), count > 0 ? count : null);
    } catch (e) {
      setErr("Nu am putut salva obiectivul: " + e.message);
    }
  }

  async function promoteToAdmin(uid) {
    try {
      await set(ref(db, `groups/${groupId}/members/${uid}/role`), "admin");
    } catch (e) {
      setErr("Nu am putut acorda rolul de admin: " + e.message);
    }
  }

  async function toggleBlockMember(uid) {
    try {
      const current = groupMembers[uid]?.blocked;
      await set(ref(db, `groups/${groupId}/members/${uid}/blocked`), !current);
    } catch (e) {
      setErr("Nu am putut actualiza statusul: " + e.message);
    }
  }

  async function approveMember(uid) {
    haptic(15);
    try {
      const req = pendingMembers[uid];
      await set(ref(db, `groups/${groupId}/members/${uid}`), {
        name: req?.name || "Membru",
        role: "member",
        joinedAt: Date.now(),
      });
      await set(ref(db, `users/${uid}/groups/${groupId}`), true);
      await remove(ref(db, `groups/${groupId}/pendingMembers/${uid}`));
    } catch (e) {
      setErr("Nu am putut aproba: " + e.message);
    }
  }

  async function rejectMember(uid) {
    try {
      await remove(ref(db, `groups/${groupId}/pendingMembers/${uid}`));
    } catch (e) {
      setErr("Nu am putut respinge: " + e.message);
    }
  }

  async function updateMyProfile({ name, photo, color, emoji }) {
    try {
      if (name && name !== me) {
        await updateProfile(user, { displayName: name });
      }
      const memberPath = `groups/${groupId}/members/${user.uid}`;
      await set(ref(db, `${memberPath}/name`), name || me);
      await set(ref(db, `${memberPath}/photo`), photo || null);
      await set(ref(db, `${memberPath}/color`), photo ? null : color || null);
      await set(ref(db, `${memberPath}/emoji`), photo ? null : emoji || null);
      setShowProfile(false);
    } catch (e) {
      setErr("Nu am putut actualiza profilul: " + e.message);
    }
  }

  async function submitFeedback(type, message) {
    try {
      await push(ref(db, "feedback"), {
        type,
        message,
        from: user.email || me,
        groupId,
        date: Date.now(),
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function submitEntry() {
    if (amBlocked) {
      setErr("Contul tău a fost blocat de un admin al grupului.");
      return;
    }
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) {
      setErr("Introdu o sumă validă.");
      return;
    }
    const chosen = form.targets.length > 0 ? form.targets : others;
    if (chosen.length === 0) {
      setErr("Alege cel puțin o persoană.");
      return;
    }
    const isSplit = chosen.length > 1 && form.type === "cinste";
    const divisor = form.type === "cinste" && form.includeMe ? chosen.length + 1 : chosen.length;
    const share = isSplit || form.includeMe ? Math.round((amt / divisor) * 100) / 100 : amt;

    setSaveStatus("saving");
    try {
      await Promise.all(
        chosen.map((target) => {
          const payload = {
            from: me,
            to: target,
            amount: share,
            totalAmount: amt,
            splitAll: isSplit || form.includeMe,
            splitCount: divisor,
            note: form.note.trim(),
            type: form.type,
            date: Date.now(),
          };
          if (form.photos.length) payload.photos = form.photos;
          return push(entriesRef, payload);
        })
      );
      setSaveStatus("saved");
      setConfetti(true);
      playChime();
      const notifTitle =
        form.type === "rambursare" ? `${me} ți-a dat banii înapoi 🤝` : `${me} ți-a făcut cinste! 🎉`;
      const notifBody = `${formatAmount(share)} lei${form.note ? " · " + form.note.trim() : ""}`;
      notifyRecipients(chosen, notifTitle, notifBody);
      setTimeout(() => setSaveStatus(""), 1200);
      setTimeout(() => setConfetti(false), 1000);
      setForm({ amount: "", targets: [], note: "", type: "cinste", photos: [], includeMe: false });
      setShowAddEntry(false);
      setErr("");
    } catch (e) {
      setSaveStatus("error");
      setErr("Nu am putut salva: " + e.message);
    }
  }

  async function deleteEntry(id) {
    try {
      await set(ref(db, `groups/${groupId}/entries/${id}/deleted`), true);
      await set(ref(db, `groups/${groupId}/entries/${id}/deletedAt`), Date.now());
      await set(ref(db, `groups/${groupId}/entries/${id}/deletedBy`), me);
      setConfirmDeleteEntry(null);
    } catch (e) {
      setErr("Nu am putut șterge: " + e.message);
    }
  }

  async function restoreEntry(id) {
    try {
      await remove(ref(db, `groups/${groupId}/entries/${id}/deleted`));
      await remove(ref(db, `groups/${groupId}/entries/${id}/deletedAt`));
      await remove(ref(db, `groups/${groupId}/entries/${id}/deletedBy`));
      haptic(15);
    } catch (e) {
      setErr("Nu am putut restaura: " + e.message);
    }
  }

  async function permanentlyDeleteEntry(id) {
    try {
      await remove(ref(db, `groups/${groupId}/entries/${id}`));
    } catch (e) {
      setErr("Nu am putut șterge definitiv: " + e.message);
    }
  }

  async function editEntryAmount(id, newAmount) {
    try {
      await set(ref(db, `groups/${groupId}/entries/${id}/amount`), newAmount);
      setEditingEntry(null);
    } catch (e) {
      setErr("Nu am putut edita: " + e.message);
    }
  }

  async function toggleReaction(entryId, emoji) {
    haptic(8);
    try {
      const path = `groups/${groupId}/entries/${entryId}/reactions/${emoji}/${user.uid}`;
      const snap = await get(ref(db, path));
      if (snap.exists()) {
        await remove(ref(db, path));
      } else {
        await set(ref(db, path), true);
      }
    } catch (e) {}
  }

  async function addComment(entryId, text) {
    if (!text.trim()) return;
    try {
      await push(ref(db, `groups/${groupId}/entries/${entryId}/comments`), {
        text: text.trim(),
        author: me,
        date: Date.now(),
      });
    } catch (e) {}
  }

  async function settleWithMember(otherName, netFromMyPerspective) {
    if (netFromMyPerspective === 0) return;
    haptic(15);
    const amount = Math.abs(netFromMyPerspective);
    const from = netFromMyPerspective < 0 ? me : otherName;
    const to = netFromMyPerspective < 0 ? otherName : me;
    try {
      await push(entriesRef, {
        from,
        to,
        amount,
        totalAmount: amount,
        splitAll: false,
        splitCount: 1,
        note: "achitat definitiv",
        type: "rambursare",
        date: Date.now(),
      });
    } catch (e) {
      setErr("Nu am putut marca achitat: " + e.message);
    }
  }

  if (!groupInfo) {
    return (
      <>
        <BackgroundBlobs />
        <SkeletonScreen label="se încarcă grupul…" />
      </>
    );
  }

  const balances = others.map((other) => {
    const theyOweMe = entries.filter((e) => e.from === me && e.to === other).reduce((s, e) => s + e.amount, 0);
    const iOweThem = entries.filter((e) => e.from === other && e.to === me).reduce((s, e) => s + e.amount, 0);
    return { name: other, net: Math.round((theyOweMe - iOweThem) * 100) / 100 };
  });

  if (viewingMember) {
    const withThem = entries.filter(
      (e) => (e.from === me && e.to === viewingMember) || (e.from === viewingMember && e.to === me)
    );
    const bal = balances.find((b) => b.name === viewingMember)?.net ?? 0;
    return (
      <>
        <BackgroundBlobs />
        <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans pb-24 animate-slideinright">
          <div className="border-b border-gray-200/70 dark:border-gray-800 px-5 pt-6 pb-5 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10">
            <button
              onClick={() => setViewingMember(null)}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3 transition-colors"
            >
              <ArrowLeft size={16} /> Înapoi
            </button>
            <div className="flex items-center gap-3">
              <Avatar name={viewingMember} size={12} />
              <div>
                <h1 className="text-2xl font-bold">{viewingMember}</h1>
                <p
                  className={`text-sm font-semibold ${
                    bal === 0 ? "text-gray-400" : bal > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {bal === 0
                    ? "achitat ✓"
                    : bal > 0
                    ? `îți datorează ${formatAmount(bal)} lei`
                    : `îi datorezi ${formatAmount(Math.abs(bal))} lei`}
                </p>
              </div>
            </div>
            {bal !== 0 && (
              <button
                onClick={() => settleWithMember(viewingMember, bal)}
                className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-full px-3 py-1.5 hover:bg-amber-100 transition-colors active:scale-95"
              >
                ✓ Marchează ca achitat definitiv
              </button>
            )}
          </div>
          <div className="px-5 mt-5 space-y-2">
            {withThem.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nicio tranzacție încă.</p>
            ) : (
              withThem.map((e, i) => (
                <EntryCard
                  key={e.id}
                  e={e}
                  me={me}
                  onPhoto={setLightbox}
                  deleteEntry={e.from === me ? deleteEntry : null}
                  onEdit={e.from === me ? () => setEditingEntry(e) : null}
                  confirmDeleteEntry={confirmDeleteEntry}
                  setConfirmDeleteEntry={setConfirmDeleteEntry}
                  onReact={toggleReaction}
                  onComment={addComment}
                  myUid={user.uid}
                  delay={i * 40}
                />
              ))
            )}
          </div>
        </div>
        {lightbox && <Lightbox photos={lightbox} onClose={() => setLightbox(null)} />}
        {editingEntry && (
          <EditAmountModal entry={editingEntry} onSave={(amt) => editEntryAmount(editingEntry.id, amt)} onClose={() => setEditingEntry(null)} />
        )}
      </>
    );
  }

  const receivedRaw = entries.filter((e) => e.to === me);
  const givenRaw = entries.filter((e) => e.from === me);
  const sortFn = sortBy === "value" ? (a, b) => b.amount - a.amount : (a, b) => (b.date || 0) - (a.date || 0);
  const received = receivedRaw.slice().sort(sortFn);
  const given = givenRaw.slice().sort(sortFn);
  const receivedThisMonth = monthEntries(received);
  const givenThisMonth = monthEntries(given);
  const totalReceivedMonth = receivedThisMonth.reduce((s, e) => s + e.amount, 0);
  const totalGivenMonth = givenThisMonth.reduce((s, e) => s + e.amount, 0);
  const totalReceivedAllTime = received.reduce((s, e) => s + e.amount, 0);
  const totalGivenAllTime = given.reduce((s, e) => s + e.amount, 0);
  const totalReceived = statsPeriod === "month" ? totalReceivedMonth : totalReceivedAllTime;
  const totalGiven = statsPeriod === "month" ? totalGivenMonth : totalGivenAllTime;
  const monthLabel = RO_MONTHS[new Date().getMonth()];
  const myStats = computeStats(members, entries).find((s) => s.name === me);

  return (
    <>
      <BackgroundBlobs />
      <Confetti trigger={confetti} />
      <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans pb-24 animate-fadein">
        <div className="border-b border-gray-200/70 dark:border-gray-800 px-5 pt-6 pb-5 sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={me} size={12} />
              <div>
                <button
                  onClick={() => setShowGroupPanel(true)}
                  className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400 flex items-center gap-1.5"
                >
                  {groupInfo.name}
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
                </button>
                <h1 className="text-2xl font-bold mt-0.5">Salut, {me}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === "saving" && <span className="text-[11px] text-gray-500">se salvează…</span>}
              {saveStatus === "saved" && (
                <span className="text-[11px] text-green-600 flex items-center gap-1 animate-popin">
                  <Check size={12} /> salvat
                </span>
              )}
              {saveStatus === "error" && <span className="text-[11px] text-red-600">eroare</span>}
              <button
                onClick={onSwitchGroup}
                title="Schimbă grupul"
                className="p-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-300 active:scale-90 transition-transform"
              >
                <ArrowLeftRight size={15} />
              </button>
              <ThemeToggle theme={theme} setTheme={setTheme} />
              <button
                onClick={toggleNotif}
                title="Notificări doar pe acest device, cât timp ai aplicația deschisă sau în fundal"
                className={`p-2 rounded-full border transition-colors active:scale-90 ${
                  notifOn ? "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-900/30" : "border-gray-300 dark:border-gray-700 text-gray-400"
                }`}
              >
                {notifOn ? <Bell size={15} /> : <BellOff size={15} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ai primit {statsPeriod === "month" ? `· ${monthLabel}` : "· mereu"}
              </p>
              <p className="text-2xl font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent mt-1">
                {formatAmount(totalReceived)} lei
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Ai dat {statsPeriod === "month" ? `· ${monthLabel}` : "· mereu"}
              </p>
              <p className="text-2xl font-extrabold text-gray-700 dark:text-gray-200 mt-1">{formatAmount(totalGiven)} lei</p>
            </div>
          </div>
          <button
            onClick={() => setStatsPeriod((p) => (p === "month" ? "allTime" : "month"))}
            className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 underline decoration-dotted active:scale-95 transition-transform"
          >
            {statsPeriod === "month" ? "vezi totalul din tot timpul" : `înapoi la luna ${monthLabel.toLowerCase()}`}
          </button>

          {myStats && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {ACHIEVEMENTS.filter((a) => a.check(myStats)).map((a) => (
                <span
                  key={a.key}
                  title={a.label}
                  className="text-xs bg-white/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-1 flex items-center gap-1"
                >
                  {a.icon} {a.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {err && (
          <div className="fixed top-4 inset-x-4 z-50 text-sm text-red-700 bg-white dark:bg-gray-800 dark:text-red-400 shadow-lg border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 animate-slideup">
            {err}
          </div>
        )}

        {receivedToast && (
          <div className="fixed top-4 inset-x-4 z-50 text-sm font-medium text-amber-800 bg-amber-50 dark:bg-amber-900/40 dark:text-amber-300 shadow-lg border border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3 animate-slideup">
            {receivedToast}
          </div>
        )}

        {others.length === 0 ? (
          <div className="mx-5 mt-6 text-sm text-gray-500 dark:text-gray-400 bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3">
            Nimeni altcineva nu s-a alăturat încă. Apasă pe numele grupului sus ca să vezi codul de invitație.
          </div>
        ) : (
          <div className="px-5 mt-7">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-3">
              <Scale size={14} /> Cine cui datorează
            </div>
            <div className="space-y-2">
              {balances.map((b, i) => (
                <button
                  key={b.name}
                  onClick={() => setViewingMember(b.name)}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="w-full animate-fadein text-left rounded-2xl border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-sm px-4 py-3 flex items-center justify-between hover:border-amber-400 hover:shadow-md active:scale-[0.99] transition-all"
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Avatar name={b.name} size={7} />
                    {b.name}
                  </span>
                  {b.net === 0 ? (
                    <span className="text-sm text-gray-400">achitat ✓</span>
                  ) : b.net > 0 ? (
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                      îți datorează {formatAmount(b.net)} lei
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2.5 py-1 rounded-full">
                      îi datorezi {formatAmount(Math.abs(b.net))} lei
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 mt-7 flex items-center gap-2">
          <ArrowUpDown size={13} className="text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Sortează:</span>
          <button
            onClick={() => setSortBy("date")}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              sortBy === "date" ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "border-gray-200 dark:border-gray-700 text-gray-500"
            }`}
          >
            Dată
          </button>
          <button
            onClick={() => setSortBy("value")}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              sortBy === "value" ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "border-gray-200 dark:border-gray-700 text-gray-500"
            }`}
          >
            Valoare
          </button>
        </div>

        <Section
          title="Cinste primită"
          icon={<Coins size={16} />}
          empty="Nimeni nu ți-a făcut cinste încă."
          items={received}
          deleteEntry={null}
          onPhoto={setLightbox}
          onReact={toggleReaction}
                  onComment={addComment}
          myUid={user.uid}
        />

        <Section
          title="Cinste dată"
          icon={<Receipt size={16} />}
          empty="Nu ai făcut cinste nimănui încă."
          items={given}
          deleteEntry={deleteEntry}
          onEdit={setEditingEntry}
          onPhoto={setLightbox}
          confirmDeleteEntry={confirmDeleteEntry}
          setConfirmDeleteEntry={setConfirmDeleteEntry}
          onReact={toggleReaction}
                  onComment={addComment}
          myUid={user.uid}
          givenView
        />

        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] grid grid-cols-4 gap-2">
          <button
            onClick={() => setShowStats(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300 py-1.5 rounded-xl hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors active:scale-95"
          >
            <Award size={18} /> Clasament
          </button>
          <button
            onClick={() => setShowWheel(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-pink-700 dark:text-pink-300 py-1.5 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-900/30 transition-colors active:scale-95"
          >
            <Dices size={18} /> Roata
          </button>
          <button
            onClick={() => setShowCalendar(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors active:scale-95"
          >
            <CalendarIcon size={18} /> Calendar
          </button>
          <button
            onClick={() => exportCSV(entries)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-95"
          >
            <Download size={18} /> Export
          </button>
        </div>

        <button
          onClick={() => setShowAddEntry(true)}
          className="pulse-ring fixed bottom-24 right-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg shadow-amber-500/40 active:scale-90 transition-transform z-20"
          aria-label="Adaugă cinste"
        >
          <Plus size={26} />
        </button>

        {showAddEntry && (
          <AddEntryModal me={me} members={members} form={form} setForm={setForm} onSubmit={submitEntry} onClose={() => { setShowAddEntry(false); setErr(""); }} />
        )}

        {lightbox && <Lightbox photos={lightbox} onClose={() => setLightbox(null)} />}
        {editingEntry && (
          <EditAmountModal entry={editingEntry} onSave={(amt) => editEntryAmount(editingEntry.id, amt)} onClose={() => setEditingEntry(null)} />
        )}
        {showStats && <StatsScreen members={members} entries={entries} groupGoal={groupInfo.goal} onClose={() => setShowStats(false)} />}
        {showWheel && <WheelModal members={members} onClose={() => setShowWheel(false)} />}
        {showCalendar && <CalendarModal entries={entries} onClose={() => setShowCalendar(false)} onPhoto={setLightbox} />}
        {showGroupPanel && (
          <GroupPanel
            groupInfo={groupInfo}
            groupMembers={groupMembers}
            pendingMembers={pendingMembers}
            myUid={user.uid}
            isAdmin={isAdmin}
            onClose={() => setShowGroupPanel(false)}
            onRemoveMember={removeMember}
            onApproveMember={approveMember}
            onRejectMember={rejectMember}
            onPromoteAdmin={promoteToAdmin}
            onToggleBlock={toggleBlockMember}
            onSetGoal={setGroupGoal}
            confirmDeleteMember={confirmDeleteMember}
            setConfirmDeleteMember={setConfirmDeleteMember}
            onRegenerateCode={regenerateInviteCode}
            onSwitchGroup={onSwitchGroup}
            onLogout={() => signOut(auth)}
            onOpenProfile={() => {
              setShowGroupPanel(false);
              setShowProfile(true);
            }}
            onOpenAbout={() => {
              setShowGroupPanel(false);
              setShowAbout(true);
            }}
            onOpenTrash={() => {
              setShowGroupPanel(false);
              setShowTrash(true);
            }}
            onDeleteGroup={deleteGroup}
            onEditGroup={editGroup}
          />
        )}
        {showProfile && (
          <ProfileModal
            currentMember={groupMembers[user.uid] || { name: me }}
            onSave={updateMyProfile}
            onClose={() => setShowProfile(false)}
          />
        )}
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} onSubmitFeedback={submitFeedback} />}
        {showTrash && (
          <TrashModal
            entries={deletedEntries}
            onClose={() => setShowTrash(false)}
            onRestore={restoreEntry}
            onPermanentDelete={permanentlyDeleteEntry}
          />
        )}
      </div>
    </>
  );
}

function GroupPanel({
  groupInfo,
  groupMembers,
  pendingMembers,
  myUid,
  isAdmin,
  onClose,
  onRemoveMember,
  onApproveMember,
  onRejectMember,
  onPromoteAdmin,
  onToggleBlock,
  onSetGoal,
  confirmDeleteMember,
  setConfirmDeleteMember,
  onRegenerateCode,
  onSwitchGroup,
  onLogout,
  onOpenProfile,
  onOpenAbout,
  onOpenTrash,
  onDeleteGroup,
  onEditGroup,
}) {
  const [copied, setCopied] = useState(false);
  const [goalInput, setGoalInput] = useState(groupInfo.goal || "");
  const [showQR, setShowQR] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);

  function copyCode() {
    try {
      navigator.clipboard.writeText(groupInfo.inviteCode);
      setCopied(true);
      haptic(10);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {}
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 pb-8 max-h-[88vh] overflow-y-auto animate-slideup shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Avatar name={groupInfo.name} size={10} photo={groupInfo.photo} />
            <h2 className="text-xl font-bold">{groupInfo.name}</h2>
            {isAdmin && (
              <button onClick={() => setEditGroupOpen(true)} className="text-gray-400 hover:text-amber-500 p-1">
                <Pencil size={15} />
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>

        {editGroupOpen && (
          <EditGroupModal groupInfo={groupInfo} onSave={onEditGroup} onClose={() => setEditGroupOpen(false)} />
        )}

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Cod de invitație</p>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-mono tracking-widest text-lg text-center">
            {groupInfo.inviteCode}
          </div>
          <button
            onClick={copyCode}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 active:scale-90 transition-transform"
          >
            {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
          </button>
          <button
            onClick={() => setShowQR((s) => !s)}
            className={`p-2.5 rounded-xl border transition-transform active:scale-90 ${
              showQR ? "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-900/30" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300"
            }`}
          >
            <QrCode size={18} />
          </button>
        </div>
        {showQR && (
          <div className="flex flex-col items-center mb-4 animate-popin">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                `${window.location.origin}/?join=${groupInfo.inviteCode}`
              )}`}
              alt="Cod QR invitație"
              className="rounded-2xl border border-gray-200 dark:border-gray-700"
              width={180}
              height={180}
            />
            <p className="text-[11px] text-gray-400 mt-2 text-center">Scanează cu telefonul ca să deschizi direct ecranul de alăturare</p>
          </div>
        )}
        <p className="text-xs text-gray-400 mb-4">Trimite codul ăsta cuiva ca să se alăture grupului.</p>
        {isAdmin && (
          <button onClick={onRegenerateCode} className="text-xs text-amber-600 dark:text-amber-400 underline mb-5">
            Generează cod nou (îl invalidează pe cel vechi)
          </button>
        )}

        {isAdmin && (
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              🎯 Obiectiv de grup (nr. de cinste)
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="ex: 100"
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={() => onSetGoal(parseInt(goalInput) || 0)}
                className="text-sm font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-xl px-4"
              >
                Salvează
              </button>
            </div>
          </div>
        )}

        {isAdmin && Object.keys(pendingMembers || {}).length > 0 && (
          <>
            <p className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
              Cereri de intrare ({Object.keys(pendingMembers).length})
            </p>
            <div className="space-y-2 mb-5">
              {Object.entries(pendingMembers).map(([uid, req]) => (
                <div
                  key={uid}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Avatar name={req.name} size={7} />
                    {req.name}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onApproveMember(uid)}
                      className="text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg font-medium"
                    >
                      Acceptă
                    </button>
                    <button
                      onClick={() => onRejectMember(uid)}
                      className="text-xs text-gray-500 dark:text-gray-400 px-2.5 py-1.5"
                    >
                      Refuză
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Membri ({Object.keys(groupMembers).length})</p>
        <div className="space-y-2 mb-6">
          {Object.entries(groupMembers).map(([uid, m]) => (
            <div
              key={uid}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Avatar name={m.name} size={7} />
                {m.name}
                {m.role === "admin" && (
                  <span className="text-[10px] uppercase tracking-wide bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Shield size={10} /> admin
                  </span>
                )}
                {m.blocked && (
                  <span className="text-[10px] uppercase tracking-wide bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded">
                    blocat
                  </span>
                )}
              </span>
              {isAdmin && uid !== myUid && (
                confirmDeleteMember === uid ? (
                  <div className="flex gap-1">
                    <button onClick={() => onRemoveMember(uid)} className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg">
                      Elimină
                    </button>
                    <button onClick={() => setConfirmDeleteMember(null)} className="text-xs text-gray-400 px-2 py-1">
                      Nu
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {m.role !== "admin" && (
                      <button
                        onClick={() => onPromoteAdmin(uid)}
                        title="Fă admin"
                        className="text-gray-300 hover:text-amber-500 transition-colors p-1"
                      >
                        <Shield size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => onToggleBlock(uid)}
                      title={m.blocked ? "Deblochează" : "Blochează"}
                      className={`transition-colors p-1 ${m.blocked ? "text-red-500" : "text-gray-300 hover:text-red-500"}`}
                    >
                      <Ban size={15} />
                    </button>
                    <button onClick={() => setConfirmDeleteMember(uid)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onOpenProfile}
          className="w-full text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-xl py-2.5 mb-2"
        >
          ✏️ Editează profilul meu
        </button>

        {isAdmin && (
          <button
            onClick={onOpenTrash}
            className="w-full text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-xl py-2.5 mb-2"
          >
            🗑️ Coș de gunoi (cinste șterse)
          </button>
        )}

        {isAdmin && <DeleteGroupZone groupName={groupInfo.name} onDelete={onDeleteGroup} />}

        <div className="flex gap-2 mb-3">
          <button
            onClick={onSwitchGroup}
            className="flex-1 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-xl py-2.5"
          >
            Schimbă grupul
          </button>
          <button onClick={onLogout} className="flex-1 text-sm font-medium text-red-600 border border-red-200 dark:border-red-800 rounded-xl py-2.5">
            Ieși din cont
          </button>
        </div>

        <button onClick={onOpenAbout} className="w-full text-center text-xs text-gray-400 underline">
          Despre aplicație · Confidențialitate · Termeni · Raportează o problemă
        </button>
      </div>
    </div>
  );
}

function DeleteGroupZone({ groupName, onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText.trim() === groupName;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-sm font-medium text-red-600 border border-red-200 dark:border-red-800 rounded-xl py-2.5 mb-2"
      >
        🚨 Șterge grupul definitiv
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-3 animate-popin">
      <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Ești absolut sigur?</p>
      <p className="text-xs text-red-600 dark:text-red-400 mb-3">
        Se șterg definitiv toate cinstele, membrii și istoricul grupului „{groupName}". Nu se poate anula.
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        Scrie <strong>{groupName}</strong> ca să confirmi:
      </p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="w-full bg-white dark:bg-gray-900 border border-red-300 dark:border-red-700 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-red-500"
      />
      <div className="flex gap-2">
        <button
          onClick={onDelete}
          disabled={!canDelete}
          className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Șterge definitiv
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setConfirmText("");
          }}
          className="px-4 text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-gray-300 dark:border-gray-700"
        >
          Renunță
        </button>
      </div>
    </div>
  );
}

function EditGroupModal({ groupInfo, onSave, onClose }) {
  const [name, setName] = useState(groupInfo.name);
  const [photo, setPhoto] = useState(groupInfo.photo || null);
  const [saving, setSaving] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (file) setPhoto(await fileToCompressedBase64(file));
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onSave({ name: name.trim(), photo });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-2xl p-5 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold mb-4">Editează grupul</h3>
        <div className="flex justify-center mb-4">
          <label className="cursor-pointer relative">
            <Avatar name={name || groupInfo.name} size={20} photo={photo} />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1">
              <Camera size={12} />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 mb-4 dark:bg-gray-800"
          placeholder="Numele grupului"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 font-medium">
            Anulează
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-medium disabled:opacity-50"
          >
            {saving ? "Salvez..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ currentMember, onSave, onClose }) {
  const [name, setName] = useState(currentMember.name || "");
  const [photo, setPhoto] = useState(currentMember.photo || null);
  const [color, setColor] = useState(currentMember.color || null);
  const [emoji, setEmoji] = useState(currentMember.emoji || null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await fileToCompressedBase64(file);
      setPhoto(base64);
      setColor(null);
      setEmoji(null);
    } catch (err) {}
    setUploading(false);
  }

  function pickColor(c) {
    setColor(c);
    setPhoto(null);
  }

  function pickEmoji(em) {
    setEmoji(em === emoji ? null : em);
    setPhoto(null);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 px-4 animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-3xl w-full max-w-xs p-5 shadow-2xl animate-popin max-h-[85vh] overflow-y-auto">
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <Avatar name={name || currentMember.name} size={16} photo={photo} color={color} emoji={emoji} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1.5 shadow"
              title="Încarcă o poză"
            >
              <Camera size={13} />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          {uploading && <p className="text-[11px] text-gray-400 mt-1">se încarcă…</p>}
          {photo && (
            <button onClick={() => setPhoto(null)} className="text-[11px] text-red-500 mt-1">
              Șterge poza
            </button>
          )}
        </div>

        <h3 className="text-lg font-bold mb-3 text-center">Editează profilul</h3>
        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Nume afișat</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 mb-4"
        />

        {!photo && (
          <>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Culoare fundal (dacă nu vrei poză)
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {AVATAR_COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => pickColor(c === color ? null : c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-90 ${
                    color === c ? "border-gray-900 dark:border-white scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Sau alege un avatar (în loc de inițială)
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {AVATAR_EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => pickEmoji(em)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 transition-transform active:scale-90 ${
                    emoji === em ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30" : "border-transparent bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="text-[11px] text-gray-400 mb-4">
          Modificările se aplică în acest grup. Dacă ești în mai multe grupuri, revizitează-le ca să se actualizeze și acolo.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => name.trim() && onSave({ name: name.trim(), photo, color, emoji })}
            className="flex-1 bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-xl py-2.5 active:scale-95 transition-transform"
          >
            Salvează
          </button>
          <button onClick={onClose} className="px-4 text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-gray-300 dark:border-gray-700">
            Anulează
          </button>
        </div>
      </div>
    </div>
  );
}


function EntryCard({ e, me, deleteEntry, onPhoto, onEdit, confirmDeleteEntry, setConfirmDeleteEntry, onReact, onComment, myUid, delay = 0 }) {
  const isReceived = e.to === me;
  const other = isReceived ? e.from : e.to;
  const photos = photosOf(e);
  const pendingDelete = confirmDeleteEntry === e.id;

  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fadein rounded-2xl border border-gray-200/70 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm shadow-sm px-4 py-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {photos.length > 0 ? (
          <div className="relative shrink-0">
            <img
              src={photos[0]}
              onClick={() => onPhoto(photos)}
              loading="lazy"
              className="w-12 h-12 rounded-xl object-cover cursor-pointer active:scale-95 transition-transform"
              alt=""
            />
            {photos.length > 1 && (
              <span className="absolute -bottom-1 -right-1 bg-gray-900 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                +{photos.length - 1}
              </span>
            )}
          </div>
        ) : (
          <Avatar name={other} size={10} />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
            {e.type === "rambursare" && (
              <span className="text-[10px] uppercase tracking-wide bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                rambursare
              </span>
            )}
            {isReceived ? (
              <>
                <span>{e.from}</span>
                <ArrowRight size={12} className="text-gray-400" />
                <span>ție</span>
              </>
            ) : (
              <>
                <span>lui {e.to}</span>
                <ArrowRight size={12} className="text-gray-400" />
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDate(e.date)}
            {e.splitAll ? ` · din ${formatAmount(e.totalAmount)} lei împărțit la ${e.splitCount}` : ""}
            {e.note ? ` · ${e.note}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {pendingDelete ? (
          <div className="flex items-center gap-1.5 animate-popin">
            <span className="text-xs text-gray-500">Sigur?</span>
            <button onClick={() => deleteEntry(e.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg font-medium">
              Da
            </button>
            <button onClick={() => setConfirmDeleteEntry(null)} className="text-xs text-gray-400 px-2 py-1">
              Nu
            </button>
          </div>
        ) : (
          <>
            <span
              onClick={onEdit ? onEdit : undefined}
              className={`text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent ${
                onEdit ? "cursor-pointer" : ""
              }`}
            >
              {formatAmount(e.amount)} lei
            </span>
            {deleteEntry && (
              <button onClick={() => setConfirmDeleteEntry(e.id)} className="text-gray-400 hover:text-red-600 transition-colors" aria-label="Șterge">
                <X size={16} />
              </button>
            )}
          </>
        )}
      </div>
      </div>
      {onReact && myUid && <ReactionBar entry={e} onReact={onReact} onComment={onComment} myUid={myUid} me={me} />}
    </div>
  );
}

function ReactionBar({ entry, onReact, onComment, myUid, me }) {
  const EMOJIS = ["😂", "🔥", "👍", "❤️"];
  const reactions = entry.reactions || {};
  const comments = entry.comments ? Object.entries(entry.comments) : [];
  const [showComments, setShowComments] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
      <div className="flex items-center gap-1.5">
        {EMOJIS.map((emo) => {
          const users = reactions[emo] || {};
          const count = Object.keys(users).length;
          const active = !!users[myUid];
          return (
            <button
              key={emo}
              onClick={() => onReact(entry.id, emo)}
              className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 transition-all active:scale-90 ${
                active
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30"
                  : "border-transparent hover:border-gray-200 dark:hover:border-gray-700 text-gray-400"
              }`}
            >
              <span>{emo}</span>
              {count > 0 && <span className="text-[10px]">{count}</span>}
            </button>
          );
        })}
        {onComment && (
          <button
            onClick={() => setShowComments((s) => !s)}
            className="text-xs px-2 py-1 rounded-full border border-transparent hover:border-gray-200 dark:hover:border-gray-700 text-gray-400 flex items-center gap-1 transition-all active:scale-90 ml-auto"
          >
            <MessageCircle size={13} />
            {comments.length > 0 && <span className="text-[10px]">{comments.length}</span>}
          </button>
        )}
      </div>

      {showComments && onComment && (
        <div className="mt-2 space-y-1.5 animate-fadein">
          {comments.map(([id, c]) => (
            <div key={id} className="text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5">
              <span className="font-medium">{c.author}:</span> {c.text}
            </div>
          ))}
          <div className="flex gap-1.5">
            <input
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && text.trim()) {
                  onComment(entry.id, text);
                  setText("");
                }
              }}
              placeholder="Scrie un comentariu…"
              className="flex-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => {
                if (text.trim()) {
                  onComment(entry.id, text);
                  setText("");
                }
              }}
              className="text-xs text-amber-600 dark:text-amber-400 font-medium px-2"
            >
              Trimite
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, empty, items, deleteEntry, givenView, onPhoto, onEdit, confirmDeleteEntry, setConfirmDeleteEntry, onReact, onComment, myUid }) {
  return (
    <div className="px-5 mt-7">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider mb-3">
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-6 opacity-70">
          <span className="text-4xl mb-2">🧾</span>
          <p className="text-sm text-gray-400 italic">{empty}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((e, i) => (
            <EntryCard
              key={e.id}
              e={e}
              me={givenView ? e.from : e.to}
              deleteEntry={deleteEntry}
              onEdit={onEdit ? () => onEdit(e) : null}
              onPhoto={onPhoto}
              confirmDeleteEntry={confirmDeleteEntry}
              setConfirmDeleteEntry={setConfirmDeleteEntry}
              onReact={onReact}
              onComment={onComment}
              myUid={myUid}
              delay={i * 40}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({ photos, onClose }) {
  const [idx, setIdx] = useState(0);
  const list = Array.isArray(photos) ? photos : [photos];
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-30 p-6 animate-fadein">
      <img src={list[idx]} className="max-w-full max-h-full rounded-2xl animate-popin" alt="" />
      {list.length > 1 && (
        <>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setIdx((idx - 1 + list.length) % list.length);
            }}
            className="absolute left-4 text-white bg-white/10 rounded-full p-2"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setIdx((idx + 1) % list.length);
            }}
            className="absolute right-16 text-white bg-white/10 rounded-full p-2"
          >
            <ArrowRight size={20} />
          </button>
          <div className="absolute bottom-6 text-white text-xs">
            {idx + 1} / {list.length}
          </div>
        </>
      )}
      <button onClick={onClose} className="absolute top-6 right-6 text-white">
        <X size={28} />
      </button>
    </div>
  );
}

function AddEntryModal({ me, members, form, setForm, onSubmit, onClose }) {
  const others = members.filter((m) => m !== me);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  function toggleTarget(name) {
    setForm((f) => {
      const has = f.targets.includes(name);
      return { ...f, targets: has ? f.targets.filter((t) => t !== name) : [...f.targets, name] };
    });
  }

  async function handlePhotos(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const compressed = await Promise.all(files.map(fileToCompressedBase64));
      setForm((f) => ({ ...f, photos: [...f.photos, ...compressed] }));
    } catch (err) {}
    setUploading(false);
    e.target.value = "";
  }

  function removePhoto(idx) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  }

  const chosenCount = form.targets.length > 0 ? form.targets.length : others.length;
  const divisorPreview = form.type === "cinste" && form.includeMe ? chosenCount + 1 : chosenCount;
  const share = form.amount ? formatAmount(parseFloat(form.amount) / divisorPreview) : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-20 px-0 sm:px-4 animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 pb-7 max-h-[90vh] overflow-y-auto animate-slideup shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Adaugă</h2>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setForm({ ...form, type: "cinste" })}
            className={`flex-1 py-2 rounded-xl text-sm border transition-all ${
              form.type === "cinste"
                ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 shadow-sm"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            Fac cinste
          </button>
          <button
            onClick={() => setForm({ ...form, type: "rambursare", targets: form.targets.slice(0, 1) })}
            className={`flex-1 py-2 rounded-xl text-sm border transition-all ${
              form.type === "rambursare"
                ? "border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-sm"
                : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
            }`}
          >
            Dau banii înapoi
          </button>
        </div>

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Sumă (lei)</p>
        <input
          type="number"
          inputMode="decimal"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder="ex: 80"
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-lg font-semibold focus:outline-none focus:border-amber-500 mb-4"
        />

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          {form.type === "rambursare" ? "Cui îi dai banii înapoi" : "Cui — alege pe cine vrei (dacă nu alegi pe nimeni, se împarte la toți)"}
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {others.map((m) => {
            const active = form.targets.includes(m);
            return (
              <button
                key={m}
                onClick={() => {
                  if (form.type === "rambursare") {
                    setForm({ ...form, targets: [m] });
                  } else {
                    toggleTarget(m);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1 transition-all ${
                  active
                    ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 shadow-sm"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {active && <Check size={12} />}
                {m}
              </button>
            );
          })}
        </div>
        {form.type === "cinste" && form.targets.length > 0 && (
          <button onClick={() => setForm({ ...form, targets: [] })} className="text-xs text-gray-500 dark:text-gray-400 underline mb-3">
            Resetează selecția (= toată gașca)
          </button>
        )}

        {form.type === "cinste" && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
            <button
              type="button"
              onClick={() => setForm({ ...form, includeMe: !form.includeMe })}
              className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${form.includeMe ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-700"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.includeMe ? "translate-x-4" : ""
                }`}
              />
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-400">Include-mă în preț — suma e pentru toată gașca, inclusiv eu</span>
          </label>
        )}

        {form.type === "cinste" && form.amount && chosenCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {form.includeMe
              ? `Se împarte la ${divisorPreview} (tu + ${chosenCount}): ${share} lei de fiecare, tu nu plătești`
              : chosenCount > 1
              ? `Se împarte egal: ${share} lei × ${chosenCount} persoane`
              : `${form.amount} lei către o singură persoană`}
          </p>
        )}

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Notă (opțional)</p>
        <input
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="ex: bere la terasă"
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 mb-4"
        />

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Poze (opțional, poți adăuga mai multe)</p>
        {form.photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.photos.map((p, idx) => (
              <div key={idx} className="relative w-20 h-20 animate-popin">
                <img src={p} className="w-20 h-20 rounded-xl object-cover shadow-sm" alt="" />
                <button onClick={() => removePhoto(idx)} className="absolute -top-2 -right-2 bg-white rounded-full shadow p-1 border border-gray-200">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-3 mb-4 hover:border-amber-400 hover:text-amber-600 transition-colors"
        >
          {uploading ? "se încarcă…" : (
            <>
              <Camera size={16} /> {form.photos.length > 0 ? "Adaugă încă o poză" : "Atașează o poză"}
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />

        <button
          onClick={onSubmit}
          className="w-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-xl py-3 active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/30"
        >
          Salvează
        </button>
      </div>
    </div>
  );
}

function EditAmountModal({ entry, onSave, onClose }) {
  const [val, setVal] = useState(String(entry.amount));
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 px-4 animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-3xl w-full max-w-xs p-5 shadow-2xl animate-popin">
        <h3 className="text-lg font-bold mb-3">Corectează suma</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {entry.from} → {entry.to}
        </p>
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-lg font-semibold focus:outline-none focus:border-amber-500 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              const n = parseFloat(val);
              if (n > 0) onSave(n);
            }}
            className="flex-1 bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-xl py-2.5 active:scale-95 transition-transform"
          >
            Salvează
          </button>
          <button onClick={onClose} className="px-4 text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-gray-300 dark:border-gray-700">
            Anulează
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsScreen({ members, entries, groupGoal, onClose }) {
  const stats = computeStats(members, entries);
  const monthStats = computeStats(members, monthEntries(entries));
  const now = new Date();
  const monthName = now.toLocaleDateString("ro-RO", { month: "long" });

  const cinsteEntries = entries.filter((e) => e.type === "cinste");
  const totalGroupSpent = cinsteEntries.reduce((s, e) => s + e.amount, 0);
  const avgValue = cinsteEntries.length > 0 ? totalGroupSpent / cinsteEntries.length : 0;
  const goalProgress = groupGoal ? Math.min(100, Math.round((cinsteEntries.length / groupGoal) * 100)) : null;

  const winners = BADGES.map((b) => {
    const w = b.pick(stats);
    return w && b.show(w) ? { ...b, winner: w } : null;
  }).filter(Boolean);

  const monthlyWinners = MONTHLY_AWARDS.map((b) => {
    const w = b.pick(monthStats);
    return w && b.show(w) ? { ...b, winner: w } : null;
  }).filter(Boolean);

  const sortedByNet = stats.slice().sort((a, b) => b.net - a.net);

  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const total = cinsteEntries
      .filter((e) => {
        const ed = new Date(e.date);
        return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
      })
      .reduce((s, e) => s + e.amount, 0);
    last6Months.push({ label: RO_MONTHS[d.getMonth()].slice(0, 3), total });
  }
  const maxMonthTotal = Math.max(1, ...last6Months.map((m) => m.total));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 max-h-[88vh] overflow-y-auto animate-slideup shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold">🏆 Clasamentul grupului</h2>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">se actualizează live, pe baza istoricului vostru</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Total grup</p>
            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{formatAmount(totalGroupSpent)} lei</p>
          </div>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Medie / cinste</p>
            <p className="text-xl font-extrabold text-gray-700 dark:text-gray-200 mt-0.5">{formatAmount(avgValue)} lei</p>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3 mb-5">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Ultimele 6 luni</p>
          <div className="flex items-end justify-between gap-2 h-24">
            {last6Months.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-amber-400 to-orange-500 transition-all duration-700"
                    style={{ height: `${Math.max(4, (m.total / maxMonthTotal) * 100)}%` }}
                    title={`${formatAmount(m.total)} lei`}
                  />
                </div>
                <span className="text-[9px] text-gray-400">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {goalProgress !== null && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">🎯 Obiectiv: {groupGoal} cinste</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">{cinsteEntries.length}/{groupGoal}</p>
            </div>
            <div className="h-2 rounded-full bg-amber-100 dark:bg-amber-900/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
                style={{ width: `${goalProgress}%` }}
              />
            </div>
          </div>
        )}

        {monthlyWinners.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Premiile lunii {monthName}</p>
            <div className="space-y-2 mb-6">
              {monthlyWinners.map((w, i) => (
                <div
                  key={w.key}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className={`animate-popin rounded-2xl p-4 text-white bg-gradient-to-br ${w.color} shadow-lg flex items-center gap-3`}
                >
                  <Avatar name={w.winner.name} size={11} />
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{w.title}</p>
                    <p className="text-xs opacity-90">
                      {w.winner.name} · {w.metric(w.winner)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Porecle generale</p>
        {winners.length === 0 ? (
          <p className="text-sm text-gray-400 italic mb-6">Nu sunt încă destule date pentru porecle.</p>
        ) : (
          <div className="space-y-2 mb-6">
            {winners.map((w, i) => (
              <div
                key={w.key}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`animate-popin rounded-2xl p-4 text-white bg-gradient-to-br ${w.color} shadow-lg flex items-center gap-3`}
              >
                <Avatar name={w.winner.name} size={11} />
                <div className="min-w-0">
                  <p className="font-bold text-sm">{w.title}</p>
                  <p className="text-xs opacity-90">
                    {w.winner.name} · {w.metric(w.winner)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Clasament general (balanță netă)</p>
        <div className="space-y-1.5">
          {sortedByNet.map((s, i) => {
            const d = daysSince(s.lastGivenAt);
            return (
              <div key={s.name} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <Avatar name={s.name} size={6} />
                  <span>
                    {s.name}
                    <span className="block text-[10px] text-gray-400 font-normal">
                      {d === null ? "nicio cinste încă" : d === 0 ? "a plătit azi" : `ultima cinste acum ${d} ${d === 1 ? "zi" : "zile"}`}
                    </span>
                  </span>
                </span>
                <span className={`text-sm font-semibold ${s.net === 0 ? "text-gray-400" : s.net > 0 ? "text-green-600" : "text-red-600"}`}>
                  {s.net > 0 ? "+" : ""}
                  {formatAmount(s.net)} lei
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WheelModal({ members, onClose }) {
  const [selected, setSelected] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [winner, setWinner] = useState(null);

  function toggle(name) {
    setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));
  }

  function spin() {
    if (selected.length < 2 || spinning) return;
    setWinner(null);
    const idx = Math.floor(Math.random() * selected.length);
    const angle = sliceCenterAngle(idx, selected.length);
    const nextSpinCount = spinCount + 1;
    const targetRotation = nextSpinCount * 360 * 5 - angle;
    setSpinCount(nextSpinCount);
    setSpinning(true);
    setRotation(targetRotation);
    setTimeout(() => {
      setSpinning(false);
      setWinner(selected[idx]);
      playWheelChime();
    }, 4000);
  }

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const sliceAngle = selected.length > 0 ? 360 / selected.length : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 pb-8 max-h-[92vh] overflow-y-auto animate-slideup shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Dices size={20} className="text-pink-500" /> Roata norocului
          </h2>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Cine intră la roată</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {members.map((m) => {
            const active = selected.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggle(m)}
                className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1 transition-all ${
                  active
                    ? "border-pink-500 text-pink-700 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30 shadow-sm"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {active && <Check size={12} />}
                {m}
              </button>
            );
          })}
        </div>

        {selected.length < 2 ? (
          <p className="text-xs text-gray-400 mb-4">Alege cel puțin 2 persoane ca să poți învârti roata.</p>
        ) : (
          <div className="flex flex-col items-center mb-5">
            <div className="relative" style={{ width: size, height: size }}>
              <div
                className="absolute left-1/2 -top-2 -translate-x-1/2 z-10"
                style={{ width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "18px solid #1f2937" }}
              />
              <svg
                width={size}
                height={size}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                }}
              >
                {selected.map((name, i) => {
                  const startAngle = i * sliceAngle;
                  const endAngle = (i + 1) * sliceAngle;
                  const p1 = polarPoint(cx, cy, r, startAngle);
                  const p2 = polarPoint(cx, cy, r, endAngle);
                  const largeArc = sliceAngle > 180 ? 1 : 0;
                  const path = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
                  const labelPos = polarPoint(cx, cy, r * 0.62, startAngle + sliceAngle / 2);
                  return (
                    <g key={name}>
                      <path d={path} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="white" strokeWidth="2" />
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        fill="white"
                        fontSize="13"
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${startAngle + sliceAngle / 2}, ${labelPos.x}, ${labelPos.y})`}
                      >
                        {name.length > 10 ? name.slice(0, 9) + "…" : name}
                      </text>
                    </g>
                  );
                })}
                <circle cx={cx} cy={cy} r="14" fill="white" stroke="#e5e7eb" strokeWidth="2" />
              </svg>
            </div>

            <button
              onClick={spin}
              disabled={spinning}
              className="mt-5 w-full bg-gradient-to-br from-pink-500 to-rose-500 text-white font-semibold rounded-xl py-3 active:scale-[0.98] transition-transform shadow-lg shadow-pink-500/30 disabled:opacity-60"
            >
              {spinning ? "Se învârte…" : "🎡 Învârte roata"}
            </button>

            {winner && !spinning && (
              <div className="mt-4 w-full text-center animate-popin bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-2xl p-4">
                <p className="text-sm opacity-90">A picat pe...</p>
                <p className="text-2xl font-extrabold flex items-center justify-center gap-2 mt-1">
                  <Avatar name={winner} size={9} /> {winner}
                </p>
                <p className="text-sm mt-1 opacity-90">plătește! 🎉</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarModal({ entries, onClose, onPhoto }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysCount = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysCount; d++) cells.push(d);

  function entriesForDay(d) {
    if (!d) return [];
    return entries.filter((e) => e.date && sameDay(e.date, viewYear, viewMonth, d));
  }

  function changeMonth(delta) {
    setSelectedDay(null);
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  }

  const dayEntries = selectedDay ? entriesForDay(selectedDay) : [];
  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 max-h-[90vh] overflow-y-auto animate-slideup shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarIcon size={20} className="text-blue-500" /> Calendar
          </h2>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-90 transition-transform">
            <ArrowLeft size={16} />
          </button>
          <p className="font-semibold">
            {RO_MONTHS[viewMonth]} {viewYear}
          </p>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-90 transition-transform">
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {RO_DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wide text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dayEs = entriesForDay(d);
            const total = dayEs.reduce((s, e) => s + (e.amount || 0), 0);
            const active = selectedDay === d;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(active ? null : d)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs relative transition-all ${
                  active
                    ? "bg-amber-500 text-white shadow-md scale-105"
                    : isToday(d)
                    ? "border border-amber-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span className="font-medium">{d}</span>
                {dayEs.length > 0 && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${active ? "bg-white" : "bg-amber-500"}`} />}
                {total > 0 && !active && (
                  <span className="absolute -bottom-1 text-[8px] text-amber-600 dark:text-amber-400 font-semibold">{formatAmount(total)}</span>
                )}
              </button>
            );
          })}
        </div>

        {selectedDay && (
          <div className="animate-fadein">
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              {selectedDay} {RO_MONTHS[viewMonth]} — {dayEntries.length} tranzacții
            </p>
            {dayEntries.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Nimic în ziua asta.</p>
            ) : (
              <div className="space-y-2">
                {dayEntries.map((e) => {
                  const photos = photosOf(e);
                  return (
                    <div key={e.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {photos.length > 0 ? (
                          <img src={photos[0]} onClick={() => onPhoto(photos)} loading="lazy" className="w-10 h-10 rounded-lg object-cover cursor-pointer shrink-0" alt="" />
                        ) : (
                          <Avatar name={e.from} size={8} />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            {e.from} <ArrowRight size={11} className="text-gray-400" /> {e.to}
                          </p>
                          {e.note && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{e.note}</p>}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">{formatAmount(e.amount)} lei</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ABOUT_TABS = ["Despre", "Confidențialitate", "Termeni", "Raportează / Feedback"];

function TermsGate({ theme, setTheme, onAccept, onLogout }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans flex flex-col items-center justify-center px-6 py-10 animate-fadein">
      <div className="absolute top-5 right-5 flex items-center gap-2">
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <button onClick={onLogout} className="p-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-300">
          <LogOut size={15} />
        </button>
      </div>
      <img src="/icon.png" alt="Faci cinste?" className="w-16 h-16 rounded-2xl shadow-lg shadow-amber-500/40 mb-4" />
      <h1 className="text-xl font-extrabold mb-1">Termeni și Confidențialitate</h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center">Trebuie să accepți ca să poți folosi aplicația.</p>

      <div className="w-full max-w-sm rounded-3xl border border-gray-200/70 dark:border-gray-700 bg-white/80 dark:bg-gray-800/70 backdrop-blur-md shadow-lg p-5 max-h-[50vh] overflow-y-auto text-sm text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
        <p>Folosind Faci cinste? 😉 ești de acord cu următoarele:</p>
        <p>1. Ești responsabil pentru acuratețea sumelor și tranzacțiilor pe care le introduci.</p>
        <p>2. Aplicația e un instrument de evidență, nu procesează plăți reale — banii se dau/primesc în afara aplicației.</p>
        <p>3. Datele tale (email, nume, cinstele introduse) sunt stocate pe Firebase și vizibile membrilor grupurilor din care faci parte.</p>
        <p>4. Nu vom fi răspunzători pentru neînțelegeri financiare între membrii unui grup.</p>
        <p>5. Ne rezervăm dreptul de a suspenda conturi care abuzează de aplicație (spam, conținut nepotrivit în poze/note).</p>
        <p>6. Poți cere oricând ștergerea completă a datelor tale contactând administratorul aplicației.</p>
        <p>7. Aplicația poate suferi modificări sau întreruperi temporare fără notificare prealabilă.</p>
        <p>8. Ești responsabil să păstrezi confidențiale datele de acces la contul tău.</p>
        <p>
          9. Creatorul aplicației poate vizualiza, în scop de research și îmbunătățire a experienței, toate grupurile
          și cinstele făcute din ele — inclusiv poze, comentarii și reacții. Aceste date nu sunt distribuite altor
          persoane și nu sunt folosite în scop comercial.
        </p>
        <p className="text-xs text-gray-400">Poți citi oricând textul complet din aplicație, la „Despre aplicație".</p>
      </div>

      <label className="flex items-start gap-2 mt-4 max-w-sm text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
        Am citit și sunt de acord cu termenii și cu politica de confidențialitate de mai sus.
      </label>

      <button
        onClick={onAccept}
        disabled={!checked}
        className="w-full max-w-sm mt-4 bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-xl py-3 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform shadow-lg shadow-amber-500/30"
      >
        Accept și continuă
      </button>
    </div>
  );
}

function AboutModal({ onClose, onSubmitFeedback }) {
  const [tab, setTab] = useState(0);
  const [feedbackType, setFeedbackType] = useState("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!message.trim()) return;
    const ok = await onSubmitFeedback(feedbackType, message.trim());
    if (ok) {
      setSent(true);
      setMessage("");
      setTimeout(() => setSent(false), 3000);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 max-h-[88vh] overflow-y-auto animate-slideup shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Faci cinste? 😉</h2>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-1 mb-4 overflow-x-auto">
          {ABOUT_TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                tab === i
                  ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  : "border-gray-200 dark:border-gray-700 text-gray-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
            <p>
              <strong>Faci cinste? 😉</strong> e o aplicație pentru grupuri de prieteni care țin evidența cine face cinste cui,
              cât și când — fără să mai calculați manual cine cât datorează.
            </p>
            <p>Funcții: cinste împărțite, rambursări, poze, calendar, roata norocului, clasamente și premii lunare.</p>
            <p className="text-xs text-gray-400">Versiune aplicație: 1.0</p>
          </div>
        )}

        {tab === 1 && (
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
            <p>
              <strong>Ce date colectăm:</strong> emailul și numele tău (pentru cont), numele grupurilor din care faci parte,
              cinstele pe care le înregistrezi (cine, cui, cât, notă, poze opționale).
            </p>
            <p>
              <strong>Unde stau datele:</strong> într-o bază de date Firebase (Google), accesibilă doar membrilor grupurilor
              din care faci parte.
            </p>
            <p>
              <strong>Ce NU facem:</strong> nu vindem datele tale, nu le folosim pentru publicitate, nu le distribuim către
              terți în afara funcționării aplicației.
            </p>
            <p>
              <strong>Ștergerea contului:</strong> poți cere oricând ștergerea completă a datelor tale contactând
              administratorul aplicației.
            </p>
            <p className="text-xs text-gray-400">
              Acesta e un text simplu, orientativ — nu înlocuiește o politică de confidențialitate redactată juridic dacă
              publici aplicația la scară mare.
            </p>
          </div>
        )}

        {tab === 2 && (
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
            <p>Folosind această aplicație, ești de acord că:</p>
            <p>1. Ești responsabil pentru acuratețea sumelor și tranzacțiilor pe care le introduci.</p>
            <p>2. Aplicația e un instrument de evidență, nu procesează plăți reale — banii se dau/primesc în afara aplicației.</p>
            <p>3. Nu vom fi răspunzători pentru neînțelegeri financiare între membrii unui grup.</p>
            <p>4. Ne rezervăm dreptul de a suspenda conturi care abuzează de aplicație (spam, conținut nepotrivit în poze/note).</p>
            <p className="text-xs text-gray-400">
              Text orientativ — pentru o lansare comercială reală, recomand o variantă redactată de un jurist.
            </p>
          </div>
        )}

        {tab === 3 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Tip</p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setFeedbackType("bug")}
                className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                  feedbackType === "bug"
                    ? "border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                🐞 Raportează un bug
              </button>
              <button
                onClick={() => setFeedbackType("feedback")}
                className={`flex-1 py-2 rounded-xl text-sm border transition-colors ${
                  feedbackType === "feedback"
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                💬 Feedback / idee
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={feedbackType === "bug" ? "Ce nu a mers cum trebuia?" : "Ce idee ai vrea să vezi în aplicație?"}
              rows={4}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 mb-3 resize-none"
            />
            {sent && <p className="text-xs text-green-600 mb-2">Trimis, mulțumim! 🙏</p>}
            <button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-semibold rounded-xl py-2.5 active:scale-95 transition-transform"
            >
              Trimite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TrashModal({ entries, onClose, onRestore, onPermanentDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center animate-fadein">
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 pb-8 max-h-[88vh] overflow-y-auto animate-slideup shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">🗑️ Coș de gunoi</h2>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Cinstele șterse rămân aici, vizibile doar pentru admini, până le restaurezi sau le ștergi definitiv.
        </p>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center text-center py-8 opacity-70">
            <span className="text-4xl mb-2">🗑️</span>
            <p className="text-sm text-gray-400 italic">Coșul e gol.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      {e.from} <ArrowRight size={11} className="text-gray-400" /> {e.to}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatAmount(e.amount)} lei · șters de {e.deletedBy || "?"} pe {formatDate(e.deletedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onRestore(e.id)}
                    className="flex-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg py-1.5"
                  >
                    ↩️ Restaurează
                  </button>
                  {confirmId === e.id ? (
                    <button
                      onClick={() => onPermanentDelete(e.id)}
                      className="flex-1 text-xs font-medium text-white bg-red-600 rounded-lg py-1.5"
                    >
                      Sigur? Șterge definitiv
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmId(e.id)}
                      className="flex-1 text-xs font-medium text-red-600 border border-red-200 dark:border-red-800 rounded-lg py-1.5"
                    >
                      Șterge definitiv
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatorDashboard({ theme, setTheme, onClose }) {
  const [groups, setGroups] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [creatorLightbox, setCreatorLightbox] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);

  useEffect(() => {
    const unsub = onValue(ref(db, "feedback"), (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, f]) => ({ id, ...f }));
      list.sort((a, b) => (b.date || 0) - (a.date || 0));
      setFeedbackList(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onValue(ref(db, "groups"), (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([id, g]) => ({
        id,
        name: g.name || "Grup",
        memberCount: Object.keys(g.members || {}).length,
        entryCount: Object.keys(g.entries || {}).length,
      }));
      list.sort((a, b) => b.entryCount - a.entryCount);
      setGroups(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setGroupDetail(null);
      return;
    }
    setLoadingDetail(true);
    const unsub = onValue(ref(db, `groups/${selectedId}`), (snap) => {
      const v = snap.val() || {};
      const members = Object.values(v.members || {}).map((m) => m.name);
      const entries = Object.entries(v.entries || {})
        .map(([id, e]) => ({ id, ...e }))
        .filter((e) => !e.deleted)
        .sort((a, b) => (b.date || 0) - (a.date || 0));
      setGroupDetail({ name: v.name, members, entries });
      setLoadingDetail(false);
    });
    return () => unsub();
  }, [selectedId]);

  if (selectedId && groupDetail) {
    const stats = computeStats(groupDetail.members, groupDetail.entries);
    const total = groupDetail.entries.filter((e) => e.type === "cinste").reduce((s, e) => s + e.amount, 0);
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans px-5 pt-6 pb-10 animate-fadein">
        <button
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4"
        >
          <ArrowLeft size={16} /> Toate grupurile
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
          <Crown size={18} className="text-amber-500" /> {groupDetail.name}
        </h1>
        <p className="text-xs text-gray-400 mb-5">mod spectator — doar tu vezi asta</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Membri</p>
            <p className="text-xl font-extrabold mt-0.5">{groupDetail.members.length}</p>
          </div>
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">Total cinste</p>
            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{formatAmount(total)} lei</p>
          </div>
        </div>

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Membri</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {stats.map((s) => (
            <span key={s.name} className="text-sm px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center gap-1.5">
              <Avatar name={s.name} size={5} /> {s.name}
            </span>
          ))}
        </div>

        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          Ultimele cinste ({groupDetail.entries.length})
        </p>
        <div className="space-y-2">
          {groupDetail.entries.slice(0, 40).map((e) => {
            const photos = photosOf(e);
            const reactions = Object.entries(e.reactions || {}).filter(([, users]) => Object.keys(users).length > 0);
            const comments = e.comments ? Object.values(e.comments) : [];
            return (
              <div key={e.id} className="rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {photos.length > 0 ? (
                      <img
                        src={photos[0]}
                        onClick={() => setCreatorLightbox(photos)}
                        loading="lazy"
                        className="w-10 h-10 rounded-lg object-cover cursor-pointer shrink-0"
                        alt=""
                      />
                    ) : (
                      <Avatar name={e.from} size={8} />
                    )}
                    <span className="text-sm min-w-0">
                      {e.from} → {e.to}
                      {e.note ? <span className="text-gray-400"> · {e.note}</span> : ""}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    {formatAmount(e.amount)} lei
                  </span>
                </div>
                {(reactions.length > 0 || comments.length > 0) && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2">
                    {reactions.map(([emo, users]) => (
                      <span key={emo} className="text-xs bg-white dark:bg-gray-900 px-2 py-0.5 rounded-full">
                        {emo} {Object.keys(users).length}
                      </span>
                    ))}
                    {comments.map((c, i) => (
                      <span key={i} className="text-xs text-gray-500 dark:text-gray-400 italic">
                        💬 {c.author}: {c.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {creatorLightbox && <Lightbox photos={creatorLightbox} onClose={() => setCreatorLightbox(null)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 font-sans px-5 pt-6 pb-10 animate-fadein">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Crown size={20} className="text-amber-500" /> Panou creator
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button onClick={onClose} className="p-2 rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-300">
            <X size={16} />
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-5">toate grupurile, mod spectator — vizibil doar pentru tine</p>

      <button
        onClick={() => setShowFeedback((s) => !s)}
        className={`w-full flex items-center justify-between text-sm font-medium rounded-2xl px-4 py-3 mb-5 border transition-colors ${
          showFeedback
            ? "border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
        }`}
      >
        <span>💬 Feedback primit ({feedbackList.length})</span>
        <ArrowRight size={16} className={showFeedback ? "rotate-90 transition-transform" : "transition-transform"} />
      </button>

      {showFeedback && (
        <div className="space-y-2 mb-6 animate-fadein">
          {feedbackList.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Niciun mesaj încă.</p>
          ) : (
            feedbackList.map((f) => (
              <div key={f.id} className="rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                      f.type === "bug" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400" : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                    }`}
                  >
                    {f.type === "bug" ? "🐞 bug" : "💬 idee"}
                  </span>
                  <span className="text-[10px] text-gray-400">{formatDate(f.date)}</span>
                </div>
                <p className="text-sm">{f.message}</p>
                <p className="text-xs text-gray-400 mt-1">de la: {f.from}</p>
              </div>
            ))
          )}
        </div>
      )}

      {groups === null ? (
        <SkeletonScreen />
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Niciun grup creat încă.</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className="w-full text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${colorFor(g.name)} flex items-center justify-center text-white font-bold text-sm shrink-0`}
                >
                  {g.name?.[0]?.toUpperCase() || "G"}
                </div>
                <div>
                  <p className="font-medium text-sm">{g.name}</p>
                  <p className="text-xs text-gray-400">
                    {g.memberCount} membri · {g.entryCount} cinste
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
