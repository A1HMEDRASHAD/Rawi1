// ============================================================================
// شبكة البوصلة الإخبارية — محرك غرفة العمليات المركزية (One UI 9 — النسخة النهائية)
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. إعدادات الاتصال بقاعدة البيانات (مع دعم تخصيص ونقل النظام SaaS)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAd4Df_Fpp2GlGkRPyvmKuFW68LbL_a4yU",
  authDomain: "rawi-01.firebaseapp.com",
  projectId: "rawi-01",
  storageBucket: "rawi-01.firebasestorage.app",
  messagingSenderId: "91203142966",
  appId: "1:91203142966:web:a44f7c06c98529a57a9f97",
  measurementId: "G-2VNWNSZLBJ"
};

function getActiveFirebaseConfig() {
  try {
    const saved = localStorage.getItem("bosla_custom_firebase_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.apiKey === "string" &&
        parsed.apiKey.length > 10 &&
        typeof parsed.projectId === "string" &&
        parsed.projectId.length > 2
      ) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Using default Firebase configuration.");
  }
  return DEFAULT_FIREBASE_CONFIG;
}

let app;
let auth;
let db;
try {
  app = initializeApp(getActiveFirebaseConfig());
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  app = initializeApp(DEFAULT_FIREBASE_CONFIG, "adminFallbackApp");
  auth = getAuth(app);
  db = getFirestore(app);
}

const googleProvider = new GoogleAuthProvider();

// 2. الثوابت، الحسابات السيادية، والأغلفة المدمجة برمجياً (بدون أي روابط خارجية)
const SETTINGS_CACHE_KEY = "bosla_public_settings_final_v3";
const SOVEREIGN_EMAILS = ["a1hmedrashad@gmail.com", "rawialshamal@gmail.com"];

const BLANK_SURFACE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='360' viewBox='0 0 600 360'><rect width='100%' height='100%' fill='%231e293b'/><circle cx='300' cy='180' r='38' fill='none' stroke='%233b82f6' stroke-width='2' stroke-opacity='0.4'/></svg>";

const BLANK_AVATAR_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><rect width='100%' height='100%' rx='60' fill='%231e293b'/><circle cx='60' cy='45' r='22' fill='%23475569'/><path d='M24 106 C24 76 96 76 96 106' fill='%23475569'/></svg>";

const ROLE_LABELS = {
  sovereign: "👑 قيادة سيادية عليا",
  manager: "📊 مدير منصة وإعلانات",
  editor: "📰 محرر صحفي",
  writer: "✍️ كاتب صحفي"
};

const ROLE_LEVELS = {
  writer: 1,
  editor: 2,
  manager: 3,
  sovereign: 4
};

// الحد الأدنى من الصلاحية المطلوب لفتح كل تبويب
const TAB_MIN_ROLE = {
  "tab-dashboard": "writer",
  "tab-editor": "writer",
  "tab-profile": "writer",
  "tab-categories": "manager",
  "tab-ads": "manager",
  "tab-staff": "manager",
  "tab-settings": "sovereign"
};

const DEFAULT_CATEGORIES = [
  { name: "محلية", slug: "local", icon: "location_on", order: 1, visible: true, subcategories: ["السياسة اليمنية", "شؤون المحافظات"] },
  { name: "دولية", slug: "world", icon: "public", order: 2, visible: true, subcategories: ["الشرق الأوسط", "السياسة الدولية"] },
  { name: "تحقيقات وتقارير", slug: "reports", icon: "policy", order: 3, visible: true, subcategories: ["ملفات خاصة", "تقارير معمقة"] },
  { name: "حوارات", slug: "interviews", icon: "forum", order: 4, visible: true, subcategories: [] },
  { name: "المقالات", slug: "articles", icon: "edit_note", order: 5, visible: true, subcategories: [] },
  { name: "نافذة التقنية", slug: "tech", icon: "memory", order: 6, visible: true, subcategories: [] },
  { name: "الثقافة والفن", slug: "culture", icon: "theater_comedy", order: 7, visible: true, subcategories: [] }
];

// 3. دوال الحماية الأمنية والتعامل الآمن مع عناصر الصفحة
const $ = (id) => document.getElementById(id);

const safeOn = (id, event, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
};

const setText = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "";
};

const setHtml = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val ?? "";
};

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url, fallback = "") {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("mailto:")
  ) {
    return trimmed;
  }
  return fallback;
}

// 4. الحالة المركزية لغرفة العمليات
let currentUser = null;
let currentStaffProfile = null;
let currentRole = "writer";

let siteSettings = {
  siteName: "بوصلة السياسة اليمنية",
  networkName: "شبكة البوصلة",
  siteDesc: "منصة إخبارية وتحليلية ترصد كواليس السياسة والتقنية والثقافة",
  logoUrl: "",
  faviconUrl: "",
  ogImageUrl: "",
  hideTextLogo: true,
  accentColor: "#3b82f6",
  showAboutMenu: true,
  aboutContent: "",
  privacyContent: "",
  contactEmail: "",
  contactPhone: "",
  socialWhatsapp: "",
  socialTelegram: "",
  socialX: "",
  socialFacebook: "",
  adsenseEnabled: false,
  adsenseClientId: "",
  adsenseSlotTop: "",
  adsenseSlotInArticle: "",
  adsEnabled: false,
  customAdText: "",
  customAdLink: "",
  imgbbApiKey: ""
};

try {
  const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed === "object") {
      siteSettings = { ...siteSettings, ...parsed };
    }
  }
} catch (e) {}

let allPosts = [];
let allCategories = [...DEFAULT_CATEGORIES];
let allAds = [];
let allStaff = [];
let allKycRequests = [];

// حارس الصلاحيات البرمجي الصارم (RBAC Guard)
function hasMinRole(minRoleName) {
  const userLevel = ROLE_LEVELS[currentRole] || 1;
  const reqLevel = ROLE_LEVELS[minRoleName] || 1;
  return userLevel >= reqLevel;
}

function requireRole(minRoleName, actionLabel = "هذا الإجراء") {
  if (!hasMinRole(minRoleName)) {
    showAdminToast(`⛔ صلاحيتك الحالية لا تسمح بتنفيذ: ${actionLabel}`);
    return false;
  }
  return true;
}

// 5. إدارة المظهر، الإشعارات، والهوية البصرية الفورية
function initAdminTheme() {
  const saved = localStorage.getItem("bosla_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  setText("admin-theme-icon", saved === "dark" ? "light_mode" : "dark_mode");
}

function toggleAdminTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("bosla_theme", next);
  setText("admin-theme-icon", next === "dark" ? "light_mode" : "dark_mode");
}

function showAdminToast(msg) {
  const toast = $("admin-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(window._boslaAdminToastTimer);
  window._boslaAdminToastTimer = setTimeout(() => toast.classList.add("hidden"), 3800);
}

function applyAdminBranding() {
  const activeLogo = sanitizeUrl(siteSettings.logoUrl, "");
  const activeFavicon = sanitizeUrl(siteSettings.faviconUrl || activeLogo, "");
  const displaySiteName = siteSettings.siteName || "بوصلة السياسة اليمنية";
  const displayNetName = siteSettings.networkName || "شبكة البوصلة";

  document.title = `غرفة العمليات | ${displaySiteName}`;
  setText("auth-site-title", `غرفة العمليات — ${displaySiteName}`);
  setText("auth-site-subtitle", `${displayNetName} — نظام إدارة المحتوى السيادي`);
  setText("header-site-name", displaySiteName);

  if (activeFavicon) {
    if ($("admin-favicon")) $("admin-favicon").href = activeFavicon;
    if ($("admin-apple-favicon")) $("admin-apple-favicon").href = activeFavicon;
  }

  ["auth-logo-img", "header-logo-img"].forEach((id) => {
    const img = $(id);
    if (!img) return;
    if (activeLogo) {
      if (img.src !== activeLogo) img.src = activeLogo;
      img.style.opacity = "1";
      img.classList.remove("hidden");
    } else {
      img.style.opacity = "0";
      img.classList.add("hidden");
    }
  });

  if (siteSettings.accentColor && /^#[0-9A-Fa-f]{3,8}$/.test(siteSettings.accentColor.trim())) {
    document.documentElement.style.setProperty("--accent", siteSettings.accentColor.trim());
  }
}

// 6. محرك رفع الصور السحابي الذكي (ImgBB API + ضغط تلقائي مضمون عند غياب المفتاح)
function compressImageToDataUrl(file, maxWidth = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleSmartImageUpload(fileInputId, targetUrlInputId, statusSpanId, previewImgId = null) {
  const fileEl = $(fileInputId);
  const urlEl = $(targetUrlInputId);
  const statusEl = $(statusSpanId);
  if (!fileEl || !fileEl.files || fileEl.files.length === 0) return;

  const file = fileEl.files[0];
  const origLabel = statusEl ? statusEl.textContent : "رفع صورة";
  if (statusEl) statusEl.textContent = "جاري الرفع...";

  try {
    const apiKey = (siteSettings.imgbbApiKey || localStorage.getItem("bosla_imgbb_key") || "").trim();
    let finalUrl = "";

    if (apiKey) {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();
      if (json && json.success && json.data && json.data.url) {
        finalUrl = json.data.url;
      }
    }

    if (!finalUrl) {
      finalUrl = await compressImageToDataUrl(file);
    }

    if (urlEl) urlEl.value = finalUrl;
    if (previewImgId && $(previewImgId)) $(previewImgId).src = finalUrl;
    if (statusEl) statusEl.textContent = "تم الرفع ✓";
    showAdminToast("✅ تم تجهيز ورفع الصورة بنجاح");
  } catch (err) {
    console.error("Image upload error:", err);
    showAdminToast("تعذر رفع الصورة، يرجى المحاولة مجدداً");
    if (statusEl) statusEl.textContent = origLabel;
  } finally {
    fileEl.value = "";
    setTimeout(() => {
      if (statusEl) statusEl.textContent = origLabel;
    }, 2500);
  }
}

// 7. بوابة المصادقة والعزل الصارم للصلاحيات (Zero-Flicker Role Isolation)
async function resolveUserRoleAndProfile(user) {
  const email = (user.email || "").toLowerCase().trim();
  const isSovereign = SOVEREIGN_EMAILS.includes(email);

  let staffDoc = null;
  try {
    const snap = await getDoc(doc(db, "staff", email));
    if (snap.exists()) {
      staffDoc = snap.data();
    }
  } catch (e) {}

  if (isSovereign) {
    currentRole = "sovereign";
    const sovereignData = {
      email,
      name: staffDoc?.name || user.displayName || "أحمد رشاد",
      role: "sovereign",
      verified: true,
      jobTitle: staffDoc?.jobTitle || "المدير العام ورئيس التحرير",
      bio: staffDoc?.bio || "",
      avatarUrl: staffDoc?.avatarUrl || user.photoURL || siteSettings.faviconUrl || "",
      socialX: staffDoc?.socialX || "",
      socialFb: staffDoc?.socialFb || "",
      updatedAt: serverTimestamp()
    };
    currentStaffProfile = sovereignData;
    try {
      await setDoc(doc(db, "staff", email), sovereignData, { merge: true });
    } catch (e) {}
    return;
  }

  if (staffDoc) {
    currentRole = ROLE_LEVELS[staffDoc.role] ? staffDoc.role : "writer";
    currentStaffProfile = { email, ...staffDoc };
  } else {
    currentRole = "writer";
    const newWriter = {
      email,
      name: user.displayName || email.split("@")[0],
      role: "writer",
      verified: false,
      jobTitle: "كاتب صحفي",
      bio: "",
      avatarUrl: user.photoURL || "",
      createdAt: serverTimestamp()
    };
    currentStaffProfile = newWriter;
    try {
      await setDoc(doc(db, "staff", email), newWriter, { merge: true });
    } catch (e) {}
  }
}

function applyRoleUIVisibility() {
  const isEditorOrUp = hasMinRole("editor");
  const isManagerOrUp = hasMinRole("manager");
  const isSovereign = hasMinRole("sovereign");

  setText("user-role-badge", ROLE_LABELS[currentRole] || ROLE_LABELS.writer);
  setText("user-display-email", currentUser?.email || "");

  // 1. إظهار أو إخفاء التبويبات العلوية بصرامة حسب الصلاحية
  $("nav-tab-categories")?.classList.toggle("hidden", !isManagerOrUp);
  $("nav-tab-ads")?.classList.toggle("hidden", !isManagerOrUp);
  $("nav-tab-staff")?.classList.toggle("hidden", !isManagerOrUp);
  $("nav-tab-settings")?.classList.toggle("hidden", !isSovereign);

  // 2. إظهار أو إخفاء أزرار الشريط السفلي العائم (One UI Bottom Dock)
  $("dock-btn-ads")?.classList.toggle("hidden", !isManagerOrUp);
  $("dock-btn-staff")?.classList.toggle("hidden", !isManagerOrUp);
  $("dock-btn-settings")?.classList.toggle("hidden", !isSovereign);

  // 3. تخصيص واجهة لوحة القيادة والمحرر حسب صلاحية الكاتب أو المحرر
  $("editor-privileged-switches")?.classList.toggle("hidden", !isEditorOrUp);
  $("stat-breaking-card")?.classList.toggle("hidden", !isEditorOrUp);
  $("stat-staff-card")?.classList.toggle("hidden", !isManagerOrUp);

  if (!isEditorOrUp) {
    // واجهة مخصصة للكاتب الصحفي فقط
    setText("dashboard-tab-label", "مقالاتي وإحصائياتي");
    setText("dashboard-panel-title", "مقالاتي وتقاريري الصحفية");
    setText("dashboard-panel-subtitle", "متابعة وتحرير المقالات والتقارير الخاصة بك");
    setText("stat-published-label", "مقالاتي المنشورة");
    setText("stat-views-label", "قراءات مقالاتي");
  } else {
    setText("dashboard-tab-label", "القيادة والمواد");
    setText("dashboard-panel-title", "إدارة المواد الصحفية والتقارير");
    setText("dashboard-panel-subtitle", "تحكم فوري في النشر، التعديل، الأخبار العاجلة، والمقالات المثبتة");
    setText("stat-published-label", "المواد المنشورة");
    setText("stat-views-label", "إجمالي القراءات");
  }

  // تعبئة اسم الكاتب الافتراضي في المحرر
  const authorInput = $("post-author");
  if (authorInput && currentStaffProfile?.name) {
    authorInput.value = currentStaffProfile.name;
    // الكاتب العادي يكتب باسمه المعتمد فقط
    authorInput.readOnly = !isEditorOrUp;
  }

  // التأكد من عدم بقاء المستخدم في تبويب لا يملك صلاحيته
  const activeTabBtn = document.querySelector(".admin-tab-btn.active");
  const currentTabId = activeTabBtn?.dataset.tab || "tab-dashboard";
  const reqRole = TAB_MIN_ROLE[currentTabId] || "writer";
  if (!hasMinRole(reqRole)) {
    switchAdminTab("tab-dashboard");
  }
}

function switchAdminTab(tabId) {
  const minRoleRequired = TAB_MIN_ROLE[tabId] || "writer";
  if (!hasMinRole(minRoleRequired)) {
    showAdminToast("⛔ هذا القسم مخصص للإدارة فقط");
    return;
  }

  // تحديث حالة أزرار التبويبات العلوية
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // تحديث حالة أزرار الشريط السفلي (One UI Dock)
  document.querySelectorAll(".dock-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.dockTab === tabId);
  });

  // إظهار اللوحة المطلوبة وإخفاء البقية
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== tabId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 8. جلب وحفظ الإعدادات السيادية الشاملة (بما فيها AdSense والـ SaaS)
async function fetchGlobalSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) {
      siteSettings = { ...siteSettings, ...snap.data() };
      try {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(siteSettings));
      } catch (e) {}
    }
  } catch (err) {
    console.warn("Settings fetch notice:", err);
  }
  applyAdminBranding();
  if (hasMinRole("sovereign")) {
    populateSettingsForm();
  }
}

function populateSettingsForm() {
  if (!hasMinRole("sovereign")) return;

  if ($("set-site-name")) $("set-site-name").value = siteSettings.siteName || "";
  if ($("set-network-name")) $("set-network-name").value = siteSettings.networkName || "";

  const accentHex = (siteSettings.accentColor || "#3b82f6").trim();
  if ($("set-accent-color")) $("set-accent-color").value = accentHex;
  if ($("set-accent-picker") && /^#[0-9A-Fa-f]{6}$/.test(accentHex)) {
    $("set-accent-picker").value = accentHex;
  }

  if ($("set-site-desc")) $("set-site-desc").value = siteSettings.siteDesc || "";
  if ($("set-logo-url")) $("set-logo-url").value = siteSettings.logoUrl || "";
  if ($("set-favicon-url")) $("set-favicon-url").value = siteSettings.faviconUrl || "";
  if ($("set-og-image-url")) $("set-og-image-url").value = siteSettings.ogImageUrl || "";
  if ($("set-hide-text-logo")) $("set-hide-text-logo").checked = siteSettings.hideTextLogo !== false;

  if ($("set-show-about-menu")) $("set-show-about-menu").checked = siteSettings.showAboutMenu !== false;
  if ($("set-about-content")) $("set-about-content").value = siteSettings.aboutContent || "";
  if ($("set-privacy-content")) $("set-privacy-content").value = siteSettings.privacyContent || "";
  if ($("set-contact-email")) $("set-contact-email").value = siteSettings.contactEmail || "";
  if ($("set-contact-phone")) $("set-contact-phone").value = siteSettings.contactPhone || "";

  if ($("set-social-wa")) $("set-social-wa").value = siteSettings.socialWhatsapp || "";
  if ($("set-social-tg")) $("set-social-tg").value = siteSettings.socialTelegram || "";
  if ($("set-social-x")) $("set-social-x").value = siteSettings.socialX || "";
  if ($("set-social-fb")) $("set-social-fb").value = siteSettings.socialFacebook || "";

  if ($("set-adsense-enabled")) $("set-adsense-enabled").checked = Boolean(siteSettings.adsenseEnabled);
  if ($("set-adsense-client-id")) $("set-adsense-client-id").value = siteSettings.adsenseClientId || "";
  if ($("set-adsense-slot-top")) $("set-adsense-slot-top").value = siteSettings.adsenseSlotTop || "";
  if ($("set-adsense-slot-inarticle")) $("set-adsense-slot-inarticle").value = siteSettings.adsenseSlotInArticle || "";

  if ($("set-ads-enabled")) $("set-ads-enabled").checked = Boolean(siteSettings.adsEnabled);
  if ($("set-custom-ad-text")) $("set-custom-ad-text").value = siteSettings.customAdText || "";
  if ($("set-custom-ad-link")) $("set-custom-ad-link").value = siteSettings.customAdLink || "";

  if ($("set-imgbb-key")) {
    $("set-imgbb-key").value = siteSettings.imgbbApiKey || localStorage.getItem("bosla_imgbb_key") || "";
  }
  if ($("set-custom-firebase-json")) {
    $("set-custom-firebase-json").value = localStorage.getItem("bosla_custom_firebase_config") || "";
  }
}

async function saveGlobalSettings(e) {
  e.preventDefault();
  if (!requireRole("sovereign", "تعديل الإعدادات السيادية")) return;

  const btn = $("save-settings-btn");
  if (btn) btn.disabled = true;

  try {
    const customFbRaw = ($("set-custom-firebase-json")?.value || "").trim();
    if (customFbRaw) {
      try {
        const parsedFb = JSON.parse(customFbRaw);
        if (!parsedFb.apiKey || !parsedFb.projectId) {
          throw new Error("Invalid Firebase JSON");
        }
        localStorage.setItem("bosla_custom_firebase_config", JSON.stringify(parsedFb));
      } catch (jsonErr) {
        showAdminToast("⚠️ صيغة كود Firebase JSON غير صحيحة");
        if (btn) btn.disabled = false;
        return;
      }
    } else {
      localStorage.removeItem("bosla_custom_firebase_config");
    }

    const imgbbKey = ($("set-imgbb-key")?.value || "").trim();
    if (imgbbKey) localStorage.setItem("bosla_imgbb_key", imgbbKey);

    const logoClean = sanitizeUrl($("set-logo-url")?.value, "");
    const favClean = sanitizeUrl($("set-favicon-url")?.value, "") || logoClean;
    const ogClean = sanitizeUrl($("set-og-image-url")?.value, "") || favClean || logoClean;

    const updated = {
      siteName: ($("set-site-name")?.value || "بوصلة السياسة اليمنية").trim(),
      networkName: ($("set-network-name")?.value || "شبكة البوصلة").trim(),
      accentColor: ($("set-accent-color")?.value || "#3b82f6").trim(),
      siteDesc: ($("set-site-desc")?.value || "").trim(),
      logoUrl: logoClean,
      faviconUrl: favClean,
      ogImageUrl: ogClean,
      hideTextLogo: Boolean($("set-hide-text-logo")?.checked),
      showAboutMenu: Boolean($("set-show-about-menu")?.checked),
      aboutContent: ($("set-about-content")?.value || "").trim(),
      privacyContent: ($("set-privacy-content")?.value || "").trim(),
      contactEmail: ($("set-contact-email")?.value || "").trim(),
      contactPhone: ($("set-contact-phone")?.value || "").trim(),
      socialWhatsapp: sanitizeUrl($("set-social-wa")?.value, ""),
      socialTelegram: sanitizeUrl($("set-social-tg")?.value, ""),
      socialX: sanitizeUrl($("set-social-x")?.value, ""),
      socialFacebook: sanitizeUrl($("set-social-fb")?.value, ""),
      adsenseEnabled: Boolean($("set-adsense-enabled")?.checked),
      adsenseClientId: ($("set-adsense-client-id")?.value || "").trim(),
      adsenseSlotTop: ($("set-adsense-slot-top")?.value || "").trim(),
      adsenseSlotInArticle: ($("set-adsense-slot-inarticle")?.value || "").trim(),
      adsEnabled: Boolean($("set-ads-enabled")?.checked),
      customAdText: ($("set-custom-ad-text")?.value || "").trim(),
      customAdLink: sanitizeUrl($("set-custom-ad-link")?.value, ""),
      imgbbApiKey: imgbbKey,
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "settings", "global"), updated, { merge: true });
    siteSettings = { ...siteSettings, ...updated };
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(siteSettings));
    applyAdminBranding();
    showAdminToast("✅ تم حفظ وتعميم كافة الإعدادات السيادية بنجاح");
  } catch (err) {
    console.error("Save settings error:", err);
    showAdminToast("حدث خطأ أثناء حفظ الإعدادات");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 9. إدارة الأقسام الرئيسية والتصنيفات الفرعية
async function fetchAdminCategories() {
  try {
    const snap = await getDocs(collection(db, "categories"));
    if (!snap.empty) {
      allCategories = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));
    } else if (hasMinRole("manager")) {
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, "categories", cat.slug), cat);
      }
      allCategories = [...DEFAULT_CATEGORIES];
    }
  } catch (err) {
    console.warn("Categories fetch notice:", err);
  }
  populateCategorySelects();
  if (hasMinRole("manager")) {
    renderCategoriesAdminList();
  }
}

function populateCategorySelects() {
  const postCatSelect = $("post-category");
  const filterCatSelect = $("admin-posts-cat-filter");

  if (postCatSelect) {
    const currentVal = postCatSelect.value;
    postCatSelect.innerHTML = allCategories
      .map((c) => `<option value="${escapeHTML(c.slug)}">${escapeHTML(c.name)}</option>`)
      .join("");
    if (currentVal && allCategories.some((c) => c.slug === currentVal)) {
      postCatSelect.value = currentVal;
    }
    updateEditorSubcategorySelect();
  }

  if (filterCatSelect) {
    const currentFilter = filterCatSelect.value || "all";
    filterCatSelect.innerHTML =
      `<option value="all">كل الأقسام</option>` +
      allCategories
        .map((c) => `<option value="${escapeHTML(c.slug)}">${escapeHTML(c.name)}</option>`)
        .join("");
    filterCatSelect.value = currentFilter;
  }
}

function updateEditorSubcategorySelect(selectedSub = "") {
  const catSlug = $("post-category")?.value;
  const subSelect = $("post-subcategory");
  if (!subSelect) return;

  const catObj = allCategories.find((c) => c.slug === catSlug);
  const subs = Array.isArray(catObj?.subcategories) ? catObj.subcategories : [];

  subSelect.innerHTML =
    `<option value="">— بدون تصنيف فرعي —</option>` +
    subs.map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");

  if (selectedSub && subs.includes(selectedSub)) {
    subSelect.value = selectedSub;
  }
}

function renderCategoriesAdminList() {
  const listEl = $("categories-admin-list");
  if (!listEl || !hasMinRole("manager")) return;

  if (allCategories.length === 0) {
    listEl.innerHTML = `<div class="empty-state">لا توجد أقسام مسجلة.</div>`;
    return;
  }

  listEl.innerHTML = allCategories
    .map((c) => {
      const subsText =
        Array.isArray(c.subcategories) && c.subcategories.length > 0
          ? c.subcategories.join(" ، ")
          : "بدون فروع";
      const safeId = escapeHTML(c.id || c.slug);
      return `
        <div class="admin-item-row">
          <div class="item-main-info">
            <div class="stat-icon-box blue-tint">
              <span class="material-symbols-rounded" translate="no">${escapeHTML(c.icon || "newspaper")}</span>
            </div>
            <div>
              <div class="item-title">${escapeHTML(c.name)} <span class="badge-pill">#${Number(c.order) || 1}</span></div>
              <div class="item-meta">
                <span>المعرّف: <b>${escapeHTML(c.slug)}</b></span>
                <span>• الفروع: ${escapeHTML(subsText)}</span>
                <span>• ${c.visible !== false ? "🟢 ظاهر" : "🔴 مخفي"}</span>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <button type="button" class="action-chip" onclick="window.editCategory('${safeId}')">تعديل</button>
            <button type="button" class="action-chip danger" onclick="window.deleteCategory('${safeId}')">حذف</button>
          </div>
        </div>
      `;
    })
    .join("");
}

window.editCategory = (catId) => {
  if (!requireRole("manager", "تعديل الأقسام")) return;
  const cat = allCategories.find((c) => (c.id || c.slug) === catId);
  if (!cat) return;
  $("edit-cat-id").value = cat.id || cat.slug;
  $("cat-name").value = cat.name || "";
  $("cat-slug").value = cat.slug || "";
  $("cat-order").value = Number(cat.order) || 1;
  $("cat-icon").value = cat.icon || "newspaper";
  $("cat-subcategories").value = Array.isArray(cat.subcategories) ? cat.subcategories.join("، ") : "";
  $("cat-visible").checked = cat.visible !== false;
  setText("cat-form-title", `تعديل القسم: ${cat.name}`);
};

window.deleteCategory = async (catId) => {
  if (!requireRole("manager", "حذف قسم")) return;
  if (!confirm("هل أنت متأكد من حذف هذا القسم؟")) return;
  try {
    await deleteDoc(doc(db, "categories", catId));
    showAdminToast("🗑️ تم حذف القسم بنجاح");
    await fetchAdminCategories();
  } catch (err) {
    showAdminToast("تعذر حذف القسم");
  }
};

function resetCategoryForm() {
  $("category-form")?.reset();
  if ($("edit-cat-id")) $("edit-cat-id").value = "";
  setText("cat-form-title", "إضافة / تعديل قسم صحفي");
}

async function saveCategoryForm(e) {
  e.preventDefault();
  if (!requireRole("manager", "حفظ الأقسام")) return;

  const slugRaw = ($("cat-slug")?.value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
  if (!slugRaw) {
    showAdminToast("يرجى كتابة معرّف إنجليزي صالح للقسم");
    return;
  }

  const docId = ($("edit-cat-id")?.value || "").trim() || slugRaw;
  const subsRaw = ($("cat-subcategories")?.value || "")
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const payload = {
    name: ($("cat-name")?.value || "").trim(),
    slug: slugRaw,
    order: Number($("cat-order")?.value) || 1,
    icon: ($("cat-icon")?.value || "newspaper").trim(),
    subcategories: subsRaw,
    visible: Boolean($("cat-visible")?.checked)
  };

  try {
    await setDoc(doc(db, "categories", docId), payload, { merge: true });
    showAdminToast("✅ تم حفظ القسم بنجاح");
    resetCategoryForm();
    await fetchAdminCategories();
  } catch (err) {
    showAdminToast("حدث خطأ أثناء حفظ القسم");
  }
}

// 10. إدارة المواد الصحفية والمحرر المتقدم
function getTimestampSeconds(ts) {
  if (!ts) return 0;
  if (typeof ts.seconds === "number") return ts.seconds;
  if (typeof ts === "number") return ts > 1e11 ? Math.floor(ts / 1000) : ts;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

function formatAdminDate(ts) {
  const secs = getTimestampSeconds(ts);
  if (!secs) return "الآن";
  try {
    return new Date(secs * 1000).toLocaleDateString("ar-YE", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch (e) {
    return "الآن";
  }
}

async function fetchAdminPosts() {
  try {
    const snap = await getDocs(collection(db, "posts"));
    allPosts = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt));
  } catch (err) {
    console.error("Admin posts fetch error:", err);
  }
  updateDashboardStats();
  renderAdminPostsList();
}

function getVisiblePostsForCurrentUser() {
  if (hasMinRole("editor")) return allPosts;
  const myEmail = (currentUser?.email || "").toLowerCase().trim();
  const myName = (currentStaffProfile?.name || "").trim();
  return allPosts.filter((p) => {
    const postEmail = (p.authorEmail || "").toLowerCase().trim();
    if (postEmail && myEmail) return postEmail === myEmail;
    return myName && (p.author || "").trim() === myName;
  });
}

function updateDashboardStats() {
  const relevantPosts = getVisiblePostsForCurrentUser();
  const publishedCount = relevantPosts.filter((p) => (p.status || "published") === "published").length;
  const totalViews = relevantPosts.reduce((acc, p) => acc + (Number(p.views) || 0), 0);
  const breakingCount = allPosts.filter((p) => p.isBreaking && (p.status || "published") === "published").length;

  setText("stat-published-count", publishedCount);
  setText("stat-total-views", totalViews);
  setText("stat-breaking-count", breakingCount);
  setText("stat-staff-count", allStaff.length);
}

function renderAdminPostsList() {
  const listEl = $("admin-posts-list");
  if (!listEl) return;

  const q = ($("admin-posts-search")?.value || "").trim().toLowerCase();
  const catFilter = $("admin-posts-cat-filter")?.value || "all";
  const statusFilter = $("admin-posts-status-filter")?.value || "all";

  const baseList = getVisiblePostsForCurrentUser();

  const filtered = baseList.filter((p) => {
    if (catFilter !== "all" && p.category !== catFilter) return false;
    if (statusFilter !== "all" && (p.status || "published") !== statusFilter) return false;
    if (q) {
      const hay = `${p.title || ""} ${p.author || ""} ${p.summary || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">لا توجد مواد صحفية مطابقة للبحث الحالي.</div>`;
    return;
  }

  const isEditorOrUp = hasMinRole("editor");

  listEl.innerHTML = filtered
    .map((p) => {
      const thumb = sanitizeUrl(p.imageUrl || siteSettings.logoUrl, BLANK_SURFACE_SVG);
      const safeId = escapeHTML(p.id);
      const isPub = (p.status || "published") === "published";
      const catObj = allCategories.find((c) => c.slug === p.category);
      const catName = catObj ? catObj.name : p.categoryName || p.category || "عام";

      return `
        <div class="admin-item-row">
          <div class="item-main-info">
            <img src="${escapeHTML(thumb)}" alt="" class="item-thumb" loading="lazy">
            <div>
              <div class="item-title">
                ${escapeHTML(p.title || "بدون عنوان")}
                ${p.isBreaking ? `<span class="badge-pill" style="color:#ef4444;border-color:#ef4444;">⚡ عاجل</span>` : ""}
                ${p.isFeatured ? `<span class="badge-pill">🌟 رئيسي</span>` : ""}
              </div>
              <div class="item-meta">
                <span>القسم: <b>${escapeHTML(catName)}</b></span>
                <span>• الكاتب: ${escapeHTML(p.author || "هيئة التحرير")}</span>
                <span>• 👁️ ${Number(p.views) || 0}</span>
                <span>• ${escapeHTML(formatAdminDate(p.createdAt))}</span>
                <span>• ${isPub ? "🟢 منشور" : "🟠 مسودة"}</span>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <button type="button" class="action-chip" onclick="window.editPost('${safeId}')">تعديل</button>
            ${
              isEditorOrUp
                ? `
              <button type="button" class="action-chip" onclick="window.togglePostBreaking('${safeId}')">${p.isBreaking ? "إلغاء العاجل" : "⚡ عاجل"}</button>
              <button type="button" class="action-chip" onclick="window.togglePostStatus('${safeId}')">${isPub ? "تحويل لمسودة" : "نشر الآن"}</button>
              <button type="button" class="action-chip danger" onclick="window.deletePost('${safeId}')">حذف</button>
            `
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function updatePostTypeConditionalFields() {
  const type = $("post-type")?.value || "article";
  $("video-fields-box")?.classList.toggle("hidden", type !== "video");
  $("podcast-fields-box")?.classList.toggle("hidden", type !== "podcast");
}

function resetPostEditor() {
  $("post-editor-form")?.reset();
  if ($("edit-post-id")) $("edit-post-id").value = "";
  if ($("post-author") && currentStaffProfile?.name) {
    $("post-author").value = currentStaffProfile.name;
  }
  setText("editor-form-heading", "إنشاء وتحرير مادة صحفية جديدة");
  setText("save-post-btn-label", "اعتماد ونشر المادة الآن");
  updateEditorSubcategorySelect();
  updatePostTypeConditionalFields();
}

window.editPost = (postId) => {
  const post = allPosts.find((p) => p.id === postId);
  if (!post) return;

  // التحقق من ملكية الكاتب للمقال إذا لم يكن محرراً
  if (!hasMinRole("editor")) {
    const myEmail = (currentUser?.email || "").toLowerCase().trim();
    if ((post.authorEmail || "").toLowerCase().trim() !== myEmail) {
      showAdminToast("⛔ يمكنك تعديل مقالاتك الخاصة فقط");
      return;
    }
  }

  $("edit-post-id").value = post.id;
  $("post-title").value = post.title || "";
  $("post-type").value = post.postType || "article";
  $("post-category").value = post.category || (allCategories[0]?.slug || "local");
  updateEditorSubcategorySelect(post.subcategory || "");
  $("post-author").value = post.author || currentStaffProfile?.name || "هيئة التحرير";
  $("post-summary").value = post.summary || "";
  $("post-video-url").value = post.videoUrl || "";
  $("post-podcast-url").value = post.podcastUrl || "";
  $("post-podcast-platform").value = post.podcastPlatform || "";
  $("post-podcast-duration").value = post.podcastDuration || "";
  $("post-image-url").value = post.imageUrl || "";
  $("post-content").value = post.content || "";
  $("post-tags").value = Array.isArray(post.tags) ? post.tags.join("، ") : "";
  $("post-status").value = post.status || "published";
  $("post-is-breaking").checked = Boolean(post.isBreaking);
  $("post-is-featured").checked = Boolean(post.isFeatured);

  updatePostTypeConditionalFields();
  setText("editor-form-heading", `تعديل المادة: ${post.title}`);
  setText("save-post-btn-label", "حفظ التعديلات وتحديث المادة");
  switchAdminTab("tab-editor");
};

window.togglePostBreaking = async (postId) => {
  if (!requireRole("editor", "تعديل حالة العاجل")) return;
  const post = allPosts.find((p) => p.id === postId);
  if (!post) return;
  try {
    const nextState = !post.isBreaking;
    await updateDoc(doc(db, "posts", postId), { isBreaking: nextState });
    post.isBreaking = nextState;
    updateDashboardStats();
    renderAdminPostsList();
    showAdminToast(nextState ? "⚡ تم إدراج الخبر في شريط العاجل" : "تمت إزالة الخبر من شريط العاجل");
  } catch (e) {
    showAdminToast("تعذر تحديث حالة العاجل");
  }
};

window.togglePostStatus = async (postId) => {
  if (!requireRole("editor", "تغيير حالة النشر")) return;
  const post = allPosts.find((p) => p.id === postId);
  if (!post) return;
  try {
    const nextStatus = post.status === "published" ? "draft" : "published";
    await updateDoc(doc(db, "posts", postId), { status: nextStatus });
    post.status = nextStatus;
    updateDashboardStats();
    renderAdminPostsList();
    showAdminToast(nextStatus === "published" ? "✅ تم نشر المادة في الموقع العام" : "📝 تم تحويل المادة إلى مسودة");
  } catch (e) {
    showAdminToast("تعذر تغيير حالة النشر");
  }
};

window.deletePost = async (postId) => {
  if (!requireRole("editor", "حذف مادة صحفية")) return;
  if (!confirm("هل أنت متأكد من حذف هذه المادة الصحفية نهائياً؟")) return;
  try {
    await deleteDoc(doc(db, "posts", postId));
    allPosts = allPosts.filter((p) => p.id !== postId);
    updateDashboardStats();
    renderAdminPostsList();
    showAdminToast("🗑️ تم حذف المادة بنجاح");
  } catch (e) {
    showAdminToast("تعذر حذف المادة");
  }
};

async function savePostForm(e) {
  e.preventDefault();
  const btn = $("save-post-btn");
  if (btn) btn.disabled = true;

  try {
    const editId = ($("edit-post-id")?.value || "").trim();
    const existingPost = editId ? allPosts.find((p) => p.id === editId) : null;

    if (editId && !hasMinRole("editor")) {
      const myEmail = (currentUser?.email || "").toLowerCase().trim();
      if ((existingPost?.authorEmail || "").toLowerCase().trim() !== myEmail) {
        showAdminToast("⛔ لا تملك صلاحية تعديل هذا المقال");
        if (btn) btn.disabled = false;
        return;
      }
    }

    const catSlug = $("post-category")?.value || "local";
    const catObj = allCategories.find((c) => c.slug === catSlug);
    const tagsArr = ($("post-tags")?.value || "")
      .split(/[،,]/)
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    const isVerifiedAuthor =
      Boolean(currentStaffProfile?.verified) ||
      SOVEREIGN_EMAILS.includes((currentUser?.email || "").toLowerCase());

    const payload = {
      title: ($("post-title")?.value || "").trim(),
      postType: $("post-type")?.value || "article",
      category: catSlug,
      categoryName: catObj ? catObj.name : catSlug,
      subcategory: ($("post-subcategory")?.value || "").trim(),
      author: hasMinRole("editor")
        ? ($("post-author")?.value || currentStaffProfile?.name || "هيئة التحرير").trim()
        : (currentStaffProfile?.name || $("post-author")?.value || "كاتب بالبوصلة").trim(),
      authorEmail: existingPost
        ? existingPost.authorEmail || currentUser?.email || ""
        : currentUser?.email || "",
      authorAvatar: existingPost?.authorAvatar || currentStaffProfile?.avatarUrl || "",
      authorVerified: existingPost ? Boolean(existingPost.authorVerified || isVerifiedAuthor) : isVerifiedAuthor,
      summary: ($("post-summary")?.value || "").trim(),
      videoUrl: sanitizeUrl($("post-video-url")?.value, ""),
      podcastUrl: sanitizeUrl($("post-podcast-url")?.value, ""),
      podcastPlatform: ($("post-podcast-platform")?.value || "").trim(),
      podcastDuration: ($("post-podcast-duration")?.value || "").trim(),
      imageUrl: sanitizeUrl($("post-image-url")?.value, ""),
      content: ($("post-content")?.value || "").trim(),
      tags: tagsArr,
      status: $("post-status")?.value || "published",
      isBreaking: hasMinRole("editor") ? Boolean($("post-is-breaking")?.checked) : Boolean(existingPost?.isBreaking),
      isFeatured: hasMinRole("editor") ? Boolean($("post-is-featured")?.checked) : Boolean(existingPost?.isFeatured),
      updatedAt: serverTimestamp()
    };

    if (editId) {
      await updateDoc(doc(db, "posts", editId), payload);
      showAdminToast("✅ تم تحديث المادة الصحفية بنجاح");
    } else {
      payload.views = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "posts"), payload);
      showAdminToast("🚀 تم نشر المادة الصحفية بنجاح");
    }

    resetPostEditor();
    await fetchAdminPosts();
    switchAdminTab("tab-dashboard");
  } catch (err) {
    console.error("Save post error:", err);
    showAdminToast("حدث خطأ أثناء حفظ المادة الصحفية");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function applyToolbarMarkdown(mdType) {
  const textarea = $("post-content");
  if (!textarea) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const selected = textarea.value.substring(start, end) || "النص هنا";

  let replacement = selected;
  if (mdType === "h2") replacement = `\n## ${selected}\n`;
  else if (mdType === "h3") replacement = `\n### ${selected}\n`;
  else if (mdType === "bold") replacement = `**${selected}**`;
  else if (mdType === "quote") replacement = `\n> ${selected}\n`;
  else if (mdType === "bullet") replacement = `\n- ${selected}`;
  else if (mdType === "hr") replacement = `\n---\n`;

  textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
  textarea.focus();
}

// 11. إدارة الرعايات والحملات الإعلانية الذكية (للمدير والقيادة فقط)
async function fetchAdminAds() {
  if (!hasMinRole("manager")) return;
  try {
    const snap = await getDocs(collection(db, "ads"));
    allAds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Ads fetch notice:", err);
  }
  renderAdsAdminList();
}

function renderAdsAdminList() {
  const listEl = $("ads-admin-list");
  if (!listEl || !hasMinRole("manager")) return;

  if (allAds.length === 0) {
    listEl.innerHTML = `<div class="empty-state">لا توجد حملات إعلانية مسجلة حالياً.</div>`;
    return;
  }

  listEl.innerHTML = allAds
    .map((ad) => {
      const thumb = sanitizeUrl(ad.imageUrl || siteSettings.logoUrl, BLANK_SURFACE_SVG);
      const safeId = escapeHTML(ad.id);
      return `
        <div class="admin-item-row">
          <div class="item-main-info">
            <img src="${escapeHTML(thumb)}" alt="" class="item-thumb">
            <div>
              <div class="item-title">${escapeHTML(ad.title || "")}</div>
              <div class="item-meta">
                <span>الراعي: <b>${escapeHTML(ad.sponsorName || "")}</b></span>
                <span>• 👁️ ظهور: ${Number(ad.views) || 0}</span>
                <span>• 👆 نقرات: ${Number(ad.clicks) || 0}</span>
                <span>• ${ad.active !== false ? "🟢 نشط" : "🔴 متوقف"}</span>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <button type="button" class="action-chip" onclick="window.editAd('${safeId}')">تعديل</button>
            <button type="button" class="action-chip" onclick="window.toggleAdActive('${safeId}')">${ad.active !== false ? "إيقاف" : "تفعيل"}</button>
            <button type="button" class="action-chip danger" onclick="window.deleteAd('${safeId}')">حذف</button>
          </div>
        </div>
      `;
    })
    .join("");
}

window.editAd = (adId) => {
  if (!requireRole("manager", "تعديل الحملة الإعلانية")) return;
  const ad = allAds.find((a) => a.id === adId);
  if (!ad) return;
  $("edit-ad-id").value = ad.id;
  $("ad-title").value = ad.title || "";
  $("ad-sponsor").value = ad.sponsorName || "";
  $("ad-style").value = ad.adStyle || "card";
  $("ad-placement").value = ad.placement || "top";
  $("ad-target-url").value = ad.targetUrl || "";
  $("ad-image-url").value = ad.imageUrl || "";
  $("ad-active").checked = ad.active !== false;
  setText("ad-form-title", `تعديل الحملة: ${ad.title}`);
};

window.toggleAdActive = async (adId) => {
  if (!requireRole("manager", "تغيير حالة الإعلان")) return;
  const ad = allAds.find((a) => a.id === adId);
  if (!ad) return;
  try {
    const nextActive = ad.active === false;
    await updateDoc(doc(db, "ads", adId), { active: nextActive });
    ad.active = nextActive;
    renderAdsAdminList();
    showAdminToast(nextActive ? "🟢 تم تفعيل الحملة الإعلانية" : "🔴 تم إيقاف الحملة الإعلانية");
  } catch (e) {
    showAdminToast("تعذر تحديث حالة الحملة");
  }
};

window.deleteAd = async (adId) => {
  if (!requireRole("manager", "حذف إعلان")) return;
  if (!confirm("هل تريد حذف هذه الحملة الإعلانية؟")) return;
  try {
    await deleteDoc(doc(db, "ads", adId));
    showAdminToast("🗑️ تم حذف الحملة الإعلانية");
    await fetchAdminAds();
  } catch (err) {
    showAdminToast("تعذر حذف الحملة");
  }
};

function resetAdForm() {
  $("ad-form")?.reset();
  if ($("edit-ad-id")) $("edit-ad-id").value = "";
  setText("ad-form-title", "إنشاء حملة إعلانية / رعاية رسمية");
}

async function saveAdForm(e) {
  e.preventDefault();
  if (!requireRole("manager", "إدارة الإعلانات")) return;

  const editId = ($("edit-ad-id")?.value || "").trim();
  const payload = {
    title: ($("ad-title")?.value || "").trim(),
    sponsorName: ($("ad-sponsor")?.value || "").trim(),
    adStyle: $("ad-style")?.value || "card",
    placement: $("ad-placement")?.value || "top",
    targetUrl: sanitizeUrl($("ad-target-url")?.value, "#"),
    imageUrl: sanitizeUrl($("ad-image-url")?.value, ""),
    active: Boolean($("ad-active")?.checked),
    updatedAt: serverTimestamp()
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "ads", editId), payload);
    } else {
      payload.views = 0;
      payload.clicks = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "ads"), payload);
    }
    showAdminToast("✅ تم حفظ الحملة الإعلانية بنجاح");
    resetAdForm();
    await fetchAdminAds();
  } catch (err) {
    showAdminToast("حدث خطأ أثناء حفظ الإعلان");
  }
}

// 12. إدارة الكادر الصحفي، الصلاحيات، ومراجعة طلبات توثيق الهوية (KYC)
async function fetchAdminStaffAndKyc() {
  const myEmail = (currentUser?.email || "").toLowerCase().trim();

  if (hasMinRole("manager")) {
    try {
      const staffSnap = await getDocs(collection(db, "staff"));
      allStaff = staffSnap.docs.map((d) => ({ id: d.id, email: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Staff fetch notice:", err);
    }

    try {
      const kycSnap = await getDocs(collection(db, "kyc_requests"));
      allKycRequests = kycSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("KYC fetch notice:", err);
    }

    renderStaffAdminList();
    renderKycRequestsList();
  } else if (myEmail) {
    // الكاتب أو المحرر يجلب فقط حالة طلب التوثيق الخاص به دون كشف وثائق الآخرين
    try {
      const myKycSnap = await getDoc(doc(db, "kyc_requests", myEmail));
      allKycRequests = myKycSnap.exists() ? [{ id: myEmail, email: myEmail, ...myKycSnap.data() }] : [];
    } catch (e) {}
  }

  updateDashboardStats();
  populateMyProfileTab();
}

function renderStaffAdminList() {
  const listEl = $("staff-admin-list");
  if (!listEl || !hasMinRole("manager")) return;

  if (allStaff.length === 0) {
    listEl.innerHTML = `<div class="empty-state">لا يوجد أعضاء مسجلون بعد.</div>`;
    return;
  }

  listEl.innerHTML = allStaff
    .map((s) => {
      const emailKey = (s.email || s.id || "").toLowerCase();
      const isSov = SOVEREIGN_EMAILS.includes(emailKey);
      const isVer = isSov || Boolean(s.verified);
      const avatar = sanitizeUrl(s.avatarUrl || siteSettings.faviconUrl, BLANK_AVATAR_SVG);
      const roleLabel = ROLE_LABELS[isSov ? "sovereign" : s.role] || ROLE_LABELS.writer;
      const safeEmail = escapeHTML(emailKey);

      return `
        <div class="admin-item-row">
          <div class="item-main-info">
            <img src="${escapeHTML(avatar)}" alt="" class="item-avatar">
            <div>
              <div class="item-title">
                ${escapeHTML(s.name || emailKey)}
                ${isVer ? `<span class="verified-badge" translate="no" title="موثق بالشارة الزرقاء">verified</span>` : ""}
              </div>
              <div class="item-meta">
                <span>${escapeHTML(roleLabel)}</span>
                <span>• ${escapeHTML(s.jobTitle || "عضو هيئة التحرير")}</span>
                <span dir="ltr">• ${safeEmail}</span>
              </div>
            </div>
          </div>
          <div class="item-actions">
            <button type="button" class="action-chip" onclick="window.editStaffMember('${safeEmail}')">تعديل</button>
            ${
              !isSov
                ? `<button type="button" class="action-chip danger" onclick="window.deleteStaffMember('${safeEmail}')">إزالة</button>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

window.editStaffMember = (emailKey) => {
  if (!requireRole("manager", "تعديل بيانات الكادر")) return;
  const member = allStaff.find((s) => (s.email || s.id || "").toLowerCase() === emailKey.toLowerCase());
  if (!member) return;
  $("staff-email").value = emailKey;
  $("staff-name").value = member.name || "";
  $("staff-role").value = member.role || "writer";
  $("staff-job-title").value = member.jobTitle || "";
  $("staff-bio").value = member.bio || "";
  $("staff-avatar-url").value = member.avatarUrl || "";
  $("staff-verified").checked = Boolean(member.verified) || SOVEREIGN_EMAILS.includes(emailKey);
  setText("staff-form-title", `تحديث بيانات العضو: ${member.name || emailKey}`);
};

window.deleteStaffMember = async (emailKey) => {
  if (!requireRole("manager", "إزالة عضو من الكادر")) return;
  if (SOVEREIGN_EMAILS.includes(emailKey.toLowerCase())) {
    showAdminToast("⛔ لا يمكن حذف حساب القيادة السيادية");
    return;
  }
  if (!confirm("هل تريد إزالة هذا العضو من دليل الكادر الصحفي؟")) return;
  try {
    await deleteDoc(doc(db, "staff", emailKey.toLowerCase()));
    showAdminToast("تمت إزالة العضو");
    await fetchAdminStaffAndKyc();
  } catch (e) {
    showAdminToast("تعذر حذف العضو");
  }
};

async function saveStaffForm(e) {
  e.preventDefault();
  if (!requireRole("manager", "إدارة الكادر الصحفي")) return;

  const emailKey = ($("staff-email")?.value || "").trim().toLowerCase();
  if (!emailKey) return;

  const requestedRole = $("staff-role")?.value || "writer";
  if (requestedRole === "sovereign" && !hasMinRole("sovereign")) {
    showAdminToast("⛔ منح الصلاحية السيادية العليا محصور بالقيادة السيادية فقط");
    return;
  }

  const payload = {
    email: emailKey,
    name: ($("staff-name")?.value || "").trim(),
    role: SOVEREIGN_EMAILS.includes(emailKey) ? "sovereign" : requestedRole,
    jobTitle: ($("staff-job-title")?.value || "").trim(),
    bio: ($("staff-bio")?.value || "").trim(),
    avatarUrl: sanitizeUrl($("staff-avatar-url")?.value, ""),
    verified: SOVEREIGN_EMAILS.includes(emailKey) ? true : Boolean($("staff-verified")?.checked),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "staff", emailKey), payload, { merge: true });
    showAdminToast("✅ تم حفظ بيانات العضو وصلاحياته وتوثيقه بنجاح");
    $("staff-form")?.reset();
    setText("staff-form-title", "إضافة / تحديث عضو في الكادر الصحفي");
    await fetchAdminStaffAndKyc();
  } catch (err) {
    showAdminToast("حدث خطأ أثناء حفظ بيانات العضو");
  }
}

function renderKycRequestsList() {
  const listEl = $("kyc-requests-list");
  const badgeEl = $("kyc-pending-badge");
  if (!listEl || !hasMinRole("manager")) return;

  const pendingList = allKycRequests.filter((r) => r.status === "pending");
  if (badgeEl) {
    badgeEl.textContent = `${pendingList.length}`;
    badgeEl.classList.toggle("hidden", pendingList.length === 0);
  }

  if (pendingList.length === 0) {
    listEl.innerHTML = `<div class="empty-state">لا توجد طلبات توثيق هوية معلقة حالياً.</div>`;
    return;
  }

  listEl.innerHTML = pendingList
    .map((req) => {
      const safeEmail = escapeHTML((req.email || req.id || "").toLowerCase());
      return `
        <div class="admin-item-row">
          <div class="item-main-info">
            <div class="stat-icon-box purple-tint">
              <span class="material-symbols-rounded" translate="no">badge</span>
            </div>
            <div>
              <div class="item-title">${escapeHTML(req.fullLegalName || req.displayName || safeEmail)}</div>
              <div class="item-meta">
                <span>نوع الوثيقة: <b>${escapeHTML(req.docType || "هوية رسمية")}</b></span>
                <span dir="ltr">• ${safeEmail}</span>
                ${req.note ? `<span>• ملاحظة: ${escapeHTML(req.note)}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="item-actions">
            <button type="button" class="action-chip" onclick="window.previewKycDoc('${safeEmail}')">👁️ معاينة الوثيقة</button>
            <button type="button" class="action-chip success" onclick="window.approveKycRequest('${safeEmail}')">✓ اعتماد ومنح الشارة الزرقاء</button>
            <button type="button" class="action-chip danger" onclick="window.rejectKycRequest('${safeEmail}')">✕ رفض</button>
          </div>
        </div>
      `;
    })
    .join("");
}

window.previewKycDoc = (emailKey) => {
  if (!requireRole("manager", "معاينة وثائق الهوية")) return;
  const req = allKycRequests.find((r) => (r.email || r.id || "").toLowerCase() === emailKey.toLowerCase());
  if (!req) return;
  if ($("modal-kyc-img")) $("modal-kyc-img").src = sanitizeUrl(req.docUrl, BLANK_SURFACE_SVG);
  setText("modal-kyc-title", `وثيقة توثيق: ${req.fullLegalName || emailKey}`);
  setText("modal-kyc-details", `نوع الوثيقة: ${req.docType || ""} — البريد: ${emailKey}`);
  $("kyc-preview-modal")?.classList.remove("hidden");
};

window.approveKycRequest = async (emailKey) => {
  if (!requireRole("manager", "اعتماد توثيق الهوية")) return;
  try {
    const cleanEmail = emailKey.toLowerCase();
    await updateDoc(doc(db, "kyc_requests", cleanEmail), {
      status: "approved",
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser?.email || ""
    });
    await setDoc(
      doc(db, "staff", cleanEmail),
      { verified: true, kycStatus: "approved", updatedAt: serverTimestamp() },
      { merge: true }
    );
    showAdminToast("🎉 تم اعتماد التوثيق ومنح الشارة الزرقاء للصحفي بنجاح");
    await fetchAdminStaffAndKyc();
  } catch (err) {
    showAdminToast("حدث خطأ أثناء اعتماد التوثيق");
  }
};

window.rejectKycRequest = async (emailKey) => {
  if (!requireRole("manager", "رفض طلب التوثيق")) return;
  if (!confirm("هل تريد رفض طلب التوثيق هذا؟")) return;
  try {
    const cleanEmail = emailKey.toLowerCase();
    await updateDoc(doc(db, "kyc_requests", cleanEmail), {
      status: "rejected",
      reviewedAt: serverTimestamp()
    });
    await setDoc(doc(db, "staff", cleanEmail), { kycStatus: "rejected" }, { merge: true });
    showAdminToast("تم رفض طلب التوثيق");
    await fetchAdminStaffAndKyc();
  } catch (err) {
    showAdminToast("حدث خطأ أثناء رفض الطلب");
  }
};

// 13. إدارة بطاقتي الصحفية وطلب التوثيق بالشارة الزرقاء (My Profile & KYC)
function populateMyProfileTab() {
  if (!currentUser) return;
  const emailKey = (currentUser.email || "").toLowerCase();
  const myDoc =
    allStaff.find((s) => (s.email || s.id || "").toLowerCase() === emailKey) ||
    currentStaffProfile ||
    {};
  const isVer = SOVEREIGN_EMAILS.includes(emailKey) || Boolean(myDoc.verified);

  const avatar = sanitizeUrl(myDoc.avatarUrl || siteSettings.faviconUrl, BLANK_AVATAR_SVG);
  if ($("my-profile-avatar-preview")) $("my-profile-avatar-preview").src = avatar;
  setText("my-profile-name-preview", myDoc.name || emailKey);
  setText(
    "my-profile-role-preview",
    `${ROLE_LABELS[currentRole] || ""} — ${myDoc.jobTitle || "عضو هيئة التحرير"}`
  );
  $("my-profile-verified-icon")?.classList.toggle("hidden", !isVer);

  if ($("my-name")) $("my-name").value = myDoc.name || "";
  if ($("my-job-title")) $("my-job-title").value = myDoc.jobTitle || "";
  if ($("my-bio")) $("my-bio").value = myDoc.bio || "";
  if ($("my-avatar-url")) $("my-avatar-url").value = myDoc.avatarUrl || "";
  if ($("my-social-x")) $("my-social-x").value = myDoc.socialX || "";
  if ($("my-social-fb")) $("my-social-fb").value = myDoc.socialFb || "";

  const myKyc = allKycRequests.find((r) => (r.email || r.id || "").toLowerCase() === emailKey);
  if (isVer) {
    setText("kyc-status-text", "✅ حسابك الصحفي موثق رسمياً بالشارة الزرقاء");
  } else if (myKyc?.status === "pending") {
    setText("kyc-status-text", "⏳ طلبك قيد المراجعة حالياً لدى الإدارة");
  } else if (myKyc?.status === "rejected") {
    setText("kyc-status-text", "❌ تم رفض الطلب السابق — يمكنك إرسال وثيقة واضحة مجدداً");
  } else {
    setText("kyc-status-text", "غير موثق — ارفع وثيقتك للحصول على الشارة الزرقاء");
  }
}

async function saveMyProfileForm(e) {
  e.preventDefault();
  if (!currentUser) return;
  const emailKey = (currentUser.email || "").toLowerCase();

  const payload = {
    email: emailKey,
    name: ($("my-name")?.value || "").trim(),
    jobTitle: ($("my-job-title")?.value || "").trim(),
    bio: ($("my-bio")?.value || "").trim(),
    avatarUrl: sanitizeUrl($("my-avatar-url")?.value, ""),
    socialX: sanitizeUrl($("my-social-x")?.value, ""),
    socialFb: sanitizeUrl($("my-social-fb")?.value, ""),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "staff", emailKey), payload, { merge: true });
    currentStaffProfile = { ...currentStaffProfile, ...payload };
    if ($("post-author") && !hasMinRole("editor")) {
      $("post-author").value = payload.name;
    }
    showAdminToast("✅ تم تحديث بطاقتك الصحفية العامة بنجاح");
    await fetchAdminStaffAndKyc();
  } catch (err) {
    showAdminToast("حدث خطأ أثناء تحديث البطاقة الصحفية");
  }
}

async function submitMyKycRequest(e) {
  e.preventDefault();
  if (!currentUser) return;
  const emailKey = (currentUser.email || "").toLowerCase();
  const docUrlClean = sanitizeUrl($("kyc-doc-url")?.value, "");

  if (!docUrlClean) {
    showAdminToast("يرجى رفع صورة الوثيقة أولاً");
    return;
  }

  const btn = $("submit-kyc-btn");
  if (btn) btn.disabled = true;

  try {
    const payload = {
      email: emailKey,
      displayName: currentStaffProfile?.name || emailKey,
      fullLegalName: ($("kyc-full-legal-name")?.value || "").trim(),
      docType: $("kyc-doc-type")?.value || "بطاقة صحفية",
      docUrl: docUrlClean,
      note: ($("kyc-note")?.value || "").trim(),
      status: "pending",
      submittedAt: serverTimestamp()
    };

    await setDoc(doc(db, "kyc_requests", emailKey), payload, { merge: true });
    showAdminToast("📨 تم إرسال طلب توثيق الهوية للإدارة بنجاح");
    $("kyc-request-form")?.reset();
    await fetchAdminStaffAndKyc();
  } catch (err) {
    showAdminToast("حدث خطأ أثناء إرسال طلب التوثيق");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 14. ربط جميع الأحداث والتشغيل الرئيسي لغرفة العمليات
function bindAdminEvents() {
  initAdminTheme();
  applyAdminBranding();

  safeOn("admin-theme-btn", "click", toggleAdminTheme);

  // تسجيل الدخول عبر Google
  safeOn("google-login-btn", "click", async () => {
    $("auth-error-msg")?.classList.add("hidden");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setText(
        "auth-error-msg",
        "تعذر تسجيل الدخول عبر Google، تأكد من السماح بالنوافذ المنبثقة أو استخدم البريد."
      );
      $("auth-error-msg")?.classList.remove("hidden");
    }
  });

  // تسجيل الدخول عبر البريد وكلمة المرور
  safeOn("email-login-form", "submit", async (e) => {
    e.preventDefault();
    $("auth-error-msg")?.classList.add("hidden");
    const email = ($("login-email")?.value || "").trim();
    const pass = $("login-password")?.value || "";
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      setText("auth-error-msg", "البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      $("auth-error-msg")?.classList.remove("hidden");
    }
  });

  // تسجيل الخروج
  safeOn("logout-btn", "click", async () => {
    await signOut(auth);
    showAdminToast("تم تسجيل الخروج بأمان");
  });

  // التنقل بين التبويبات العلوية والشريط السفلي (One UI Dock)
  document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchAdminTab(btn.dataset.tab));
  });

  document.querySelectorAll(".dock-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchAdminTab(btn.dataset.dockTab));
  });

  safeOn("quick-new-post-btn", "click", () => {
    resetPostEditor();
    switchAdminTab("tab-editor");
  });

  // البحث والفلترة في المقالات
  safeOn("admin-posts-search", "input", renderAdminPostsList);
  safeOn("admin-posts-cat-filter", "change", renderAdminPostsList);
  safeOn("admin-posts-status-filter", "change", renderAdminPostsList);

  // أحداث محرر المقالات
  safeOn("post-category", "change", () => updateEditorSubcategorySelect());
  safeOn("post-type", "change", updatePostTypeConditionalFields);
  safeOn("reset-editor-btn", "click", resetPostEditor);
  safeOn("post-editor-form", "submit", savePostForm);

  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyToolbarMarkdown(btn.dataset.md));
  });

  // مزامنة منتقي اللون السيادي (Color Picker)
  safeOn("set-accent-picker", "input", (e) => {
    if ($("set-accent-color")) $("set-accent-color").value = e.target.value;
  });
  safeOn("set-accent-color", "input", (e) => {
    const val = (e.target.value || "").trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(val) && $("set-accent-picker")) {
      $("set-accent-picker").value = val;
    }
  });

  // زر مسح الكاش المحلي
  safeOn("clear-local-cache-btn", "click", () => {
    localStorage.removeItem(SETTINGS_CACHE_KEY);
    showAdminToast("🧹 تم مسح الكاش المحلي وتحديث الهوية الفورية");
  });

  // ربط أزرار الرفع السحابي للصور والوثائق والشعارات
  safeOn("post-image-file", "change", () =>
    handleSmartImageUpload("post-image-file", "post-image-url", "post-upload-status")
  );
  safeOn("ad-image-file", "change", () =>
    handleSmartImageUpload("ad-image-file", "ad-image-url", "ad-upload-status")
  );
  safeOn("staff-avatar-file", "change", () =>
    handleSmartImageUpload("staff-avatar-file", "staff-avatar-url", "staff-upload-status")
  );
  safeOn("my-avatar-file", "change", () =>
    handleSmartImageUpload("my-avatar-file", "my-avatar-url", "my-avatar-upload-status", "my-profile-avatar-preview")
  );
  safeOn("kyc-doc-file", "change", () =>
    handleSmartImageUpload("kyc-doc-file", "kyc-doc-url", "kyc-upload-status")
  );
  safeOn("set-logo-file", "change", () =>
    handleSmartImageUpload("set-logo-file", "set-logo-url", "logo-upload-status")
  );
  safeOn("set-favicon-file", "change", () =>
    handleSmartImageUpload("set-favicon-file", "set-favicon-url", "favicon-upload-status")
  );
  safeOn("set-og-image-file", "change", () =>
    handleSmartImageUpload("set-og-image-file", "set-og-image-url", "og-upload-status")
  );

  // حفظ النماذج
  safeOn("category-form", "submit", saveCategoryForm);
  safeOn("reset-cat-btn", "click", resetCategoryForm);

  safeOn("ad-form", "submit", saveAdForm);
  safeOn("reset-ad-btn", "click", resetAdForm);

  safeOn("staff-form", "submit", saveStaffForm);
  safeOn("reset-staff-btn", "click", () => {
    $("staff-form")?.reset();
    setText("staff-form-title", "إضافة / تحديث عضو في الكادر الصحفي");
  });

  safeOn("my-profile-form", "submit", saveMyProfileForm);
  safeOn("kyc-request-form", "submit", submitMyKycRequest);
  safeOn("global-settings-form", "submit", saveGlobalSettings);

  // إغلاق نافذة معاينة الوثيقة
  safeOn("close-kyc-modal-btn", "click", () => $("kyc-preview-modal")?.classList.add("hidden"));
  safeOn("kyc-preview-modal", "click", (e) => {
    if (e.target.id === "kyc-preview-modal") $("kyc-preview-modal")?.classList.add("hidden");
  });
}

// مراقب حالة الجلسة وتحميل البيانات حسب صلاحية العضو فقط
function initAdminApp() {
  bindAdminEvents();
  fetchGlobalSettings();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await resolveUserRoleAndProfile(user);
      applyRoleUIVisibility();

      $("auth-screen")?.classList.add("hidden");
      $("admin-app-shell")?.classList.remove("hidden");

      const tasks = [
        fetchGlobalSettings(),
        fetchAdminCategories(),
        fetchAdminStaffAndKyc(),
        fetchAdminPosts()
      ];

      if (hasMinRole("manager")) {
        tasks.push(fetchAdminAds());
      }

      await Promise.allSettled(tasks);
    } else {
      currentUser = null;
      currentStaffProfile = null;
      currentRole = "writer";
      $("admin-app-shell")?.classList.add("hidden");
      $("auth-screen")?.classList.remove("hidden");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAdminApp);
} else {
  initAdminApp();
}
