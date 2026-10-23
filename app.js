import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. إعدادات Firebase الافتراضية أو المخصصة (لدعم نقل/بيع النظام SaaS)
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
      if (parsed && parsed.apiKey && parsed.projectId) return parsed;
    }
  } catch (e) {
    console.warn("Invalid custom Firebase config, using default.");
  }
  return DEFAULT_FIREBASE_CONFIG;
}

const SOVEREIGN_ADMINS = [
  "a1hmedrashad@gmail.com",
  "rawialshamal@gmail.com"
];
const DEFAULT_IMGBB_KEY = "739d843d86f97bcc98efd51fba08f5d8";
const DEFAULT_LOGO = "https://i.ibb.co/BHHHLttP/image.png";
const DEFAULT_FAVICON = "https://i.ibb.co/WWSTnMgd/image.jpg";

// دوال حماية DOM لمنع أي توقف
const $ = (id) => document.getElementById(id);
const safeOn = (id, event, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
};

const app = initializeApp(getActiveFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// متغيرات حالة النظام والصلاحيات
let currentUser = null;
let currentRole = null; // 'super_admin' | 'platform_admin' | 'editor' | 'writer'
let currentStaffName = "";
let currentStaffDoc = {};
let isCurrentUserVerified = false;
let allowedCategories = [];
let selectedStaffCategories = new Set();

let allPosts = [];
let allCategories = [];
let allAds = [];
let allStaff = [];

let globalSettings = {
  siteName: "بوصلة السياسة اليمنية",
  siteNameEn: "Yemeni Politics Compass",
  networkName: "شبكة البوصلة",
  networkNameEn: "Al-Bosla Network",
  siteDesc: "منصة إخبارية وتحليلية ترصد كواليس السياسة والتقنية والثقافة بعمق ومصداقية",
  publicUrl: "",
  logoUrl: DEFAULT_LOGO,
  faviconUrl: DEFAULT_FAVICON,
  ogImageUrl: DEFAULT_FAVICON,
  hideTextLogo: true,
  accentColor: "#3b82f6",
  imgbbApiKey: DEFAULT_IMGBB_KEY,
  translateProvider: "auto_free",
  translateApiKey: "",
  firebaseCustomJson: "",
  showAboutMenu: true,
  aboutContent: "",
  aboutContentEn: "",
  privacyContent: "",
  contactEmail: "A1HMEDRASHAD@GMAIL.COM",
  contactPhone: "",
  adsEnabled: false,
  adsenseId: "",
  adSlot: "",
  customAdText: "",
  customAdLink: "",
  socialWhatsapp: "",
  socialFacebook: "",
  socialX: "",
  socialTelegram: "",
  autoTgEnabled: false,
  tgBotToken: "",
  tgChatId: "",
  autoFbEnabled: false,
  fbPageId: "",
  fbAccessToken: "",
  autoXEnabled: false,
  xApiKey: "",
  xWebhookUrl: ""
};

// 2. نظام الإشعارات، نافذة التأكيد الذكية، وقفل الأزرار لمنع التكرار (Anti-Double Submit)
function showToast(msg, isError = false) {
  const toastEl = $("toast");
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.background = isError ? "#ef4444" : "#10b981";
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3500);
}

function askSmartConfirm(title, message, iconName = "help") {
  return new Promise((resolve) => {
    const modal = $("smart-confirm-modal");
    if (!modal) {
      resolve(window.confirm(message));
      return;
    }
    $("confirm-modal-title").textContent = title;
    $("confirm-modal-msg").textContent = message;
    $("confirm-modal-icon").textContent = iconName;
    modal.classList.remove("hidden");

    const yesBtn = $("confirm-yes-btn");
    const noBtn = $("confirm-no-btn");

    const cleanup = (result) => {
      modal.classList.add("hidden");
      yesBtn.onclick = null;
      noBtn.onclick = null;
      resolve(result);
    };

    yesBtn.onclick = () => cleanup(true);
    noBtn.onclick = () => cleanup(false);
  });
}

const activeLocks = new WeakSet();
async function withSmartButtonLock(btn, asyncTask, loadingLabel = "جاري التنفيذ...") {
  if (!btn) return await asyncTask();
  if (activeLocks.has(btn)) return; // منع قاطع لأي نقرة مكررة

  activeLocks.add(btn);
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-rounded">hourglass_top</span><span>${loadingLabel}</span>`;

  try {
    await asyncTask();
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      activeLocks.delete(btn);
    }, 500);
  }
}

// 3. إدارة الوضع الليلي والنهاري والقوائم المنسدلة التفاعلية (Accordions)
function initAdminTheme() {
  const saved = localStorage.getItem("bosla_admin_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const icon = $("admin-theme-icon");
  if (icon) icon.textContent = saved === "dark" ? "light_mode" : "dark_mode";
}

safeOn("admin-theme-toggle", "click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("bosla_admin_theme", next);
  if ($("admin-theme-icon")) $("admin-theme-icon").textContent = next === "dark" ? "light_mode" : "dark_mode";
});

// تفعيل القوائم المنسدلة الذكية في الإعدادات (فتح قائمة يغلق البقية تلقائياً لمنع التشتيت)
function initSettingsAccordions() {
  const accordions = document.querySelectorAll(".settings-accordion");
  accordions.forEach(acc => {
    const trigger = acc.querySelector(".accordion-trigger");
    if (!trigger) return;
    trigger.addEventListener("click", () => {
      const isOpen = acc.classList.contains("open");
      accordions.forEach(other => other.classList.remove("open"));
      if (!isOpen) {
        acc.classList.add("open");
      }
    });
  });
}

initAdminTheme();
initSettingsAccordions();

// 4. أنيميشن الكبسولة المنزلقة (Morphing Pill Animation) في الشريط السفلي
function updateNavPillIndicator() {
  const activeBtn = document.querySelector("#admin-bottom-nav .nav-item.active");
  const indicator = $("nav-pill-indicator");
  if (!activeBtn || !indicator || activeBtn.classList.contains("hidden")) return;

  indicator.style.width = `${activeBtn.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}

window.addEventListener("resize", updateNavPillIndicator);

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.target));
});

safeOn("quick-new-post-btn", "click", () => {
  resetPostForm();
  switchTab("tab-editor");
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-view").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  $(tabId)?.classList.add("active");
  const targetBtn = document.querySelector(`.nav-item[data-target="${tabId}"]`);
  if (targetBtn) targetBtn.classList.add("active");
  updateNavPillIndicator();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 5. تسجيل الدخول وفحص الصلاحيات ذو الـ 4 مستويات
safeOn("google-login-btn", "click", async () => {
  $("login-error")?.classList.add("hidden");
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const errEl = $("login-error");
    if (errEl) {
      errEl.textContent = "تعذر تسجيل الدخول: " + err.message;
      errEl.classList.remove("hidden");
    }
  }
});

safeOn("logout-btn", "click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("login-screen")?.classList.remove("hidden");
    $("app-shell")?.classList.add("hidden");
    return;
  }

  const email = (user.email || "").toLowerCase().trim();

  if (SOVEREIGN_ADMINS.includes(email)) {
    currentUser = user;
    currentRole = "super_admin";
    currentStaffName = user.displayName || "القيادة السيادية";
    isCurrentUserVerified = true;
    allowedCategories = [];
    try {
      const snap = await getDoc(doc(db, "staff", email));
      if (snap.exists()) {
        currentStaffDoc = snap.data();
        currentStaffName = currentStaffDoc.name || currentStaffName;
      }
    } catch (e) {}
    await initDashboard();
    return;
  }

  try {
    const staffSnap = await getDoc(doc(db, "staff", email));
    if (staffSnap.exists() && staffSnap.data().active !== false) {
      const data = staffSnap.data();
      currentUser = user;
      currentStaffDoc = data;
      currentRole = data.role || "writer";
      currentStaffName = data.name || user.displayName || "محرر البوصلة";
      isCurrentUserVerified = !!data.verified;
      allowedCategories = Array.isArray(data.categories) ? data.categories : [];
      await initDashboard();
    } else {
      await signOut(auth);
      const errEl = $("login-error");
      if (errEl) {
        errEl.textContent = `الحساب (${email}) غير مصرح له بدخول غرفة العمليات.`;
        errEl.classList.remove("hidden");
      }
    }
  } catch (err) {
    const errEl = $("login-error");
    if (errEl) {
      errEl.textContent = "خطأ في فحص الصلاحيات: " + err.message;
      errEl.classList.remove("hidden");
    }
  }
});

function hasFullAdminManagement() {
  return currentRole === "super_admin" || currentRole === "platform_admin";
}

async function initDashboard() {
  $("login-screen")?.classList.add("hidden");
  $("app-shell")?.classList.remove("hidden");

  const badge = $("user-role-badge");
  const postsHeading = $("posts-view-heading");
  const postsSub = $("posts-view-sub");
  const statTotalLabel = $("stat-total-label");
  const authorInput = $("post-author");
  const verifiedHeaderIcon = $("header-verified-icon");

  if (verifiedHeaderIcon) {
    verifiedHeaderIcon.classList.toggle("hidden", !isCurrentUserVerified);
  }

  if (currentRole === "super_admin") {
    badge.textContent = "قيادة سيادية مطلقة";
    postsHeading.textContent = "إدارة جميع منشورات الشبكة";
    postsSub.textContent = "رؤية شاملة وتحكم كامل بجميع مقالات الفريق، الاعتماد، التقييد، أو الحذف";
    statTotalLabel.textContent = "إجمالي مقالات الشبكة";
    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
    document.querySelectorAll(".super-only").forEach(el => el.classList.remove("hidden"));
  } else if (currentRole === "platform_admin") {
    badge.textContent = `مدير منصة وإعلانات (${currentStaffName})`;
    postsHeading.textContent = "إدارة منشورات الشبكة";
    postsSub.textContent = "صلاحية إدارية شاملة للمنشورات والإعلانات والأقسام والفريق (باستثناء الإعدادات السيادية)";
    statTotalLabel.textContent = "إجمالي مقالات الشبكة";
    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
    document.querySelectorAll(".super-only").forEach(el => el.classList.add("hidden"));
  } else {
    badge.textContent = currentRole === "editor" ? `محرر معتمد (${currentStaffName})` : `كاتب مسودات (${currentStaffName})`;
    postsHeading.textContent = "منشوراتي الخاصة";
    postsSub.textContent = "تظهر هنا مقالاتك فقط — يمكنك تعديلها أو حذفها إذا أخطأت في نشرها ضمن أقسامك";
    statTotalLabel.textContent = "إجمالي مقالاتي";
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".super-only").forEach(el => el.classList.add("hidden"));
  }

  if (authorInput) authorInput.value = currentStaffName;

  await loadGlobalSettings();
  await loadCategories();
  populateMyProfileTab();
  await loadPosts();

  if (hasFullAdminManagement()) {
    await loadAds();
    await loadStaff();
  }

  setTimeout(updateNavPillIndicator, 140);
}

// 6. محرك ضغط ورفع الصور باستخدام مفتاح ImgBB الديناميكي القابل للتغيير من الإعدادات
function compressImageFile(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        const dataUrl = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function uploadToImgBB(file, maxWidth = 1200) {
  const activeKey = (globalSettings.imgbbApiKey || DEFAULT_IMGBB_KEY).trim();
  const base64Image = await compressImageFile(file, maxWidth);
  const formData = new FormData();
  formData.append("image", base64Image);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${activeKey}`, {
    method: "POST",
    body: formData
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "فشل الرفع إلى ImgBB — تحقق من مفتاح ImgBB في الإعدادات");
  return json.data.display_url;
}

function showImagePreview(wrapId, imgId, url) {
  const wrap = $(wrapId);
  const img = $(imgId);
  if (!wrap || !img) return;
  if (url) {
    img.src = url;
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}

safeOn("trigger-upload-btn", "click", () => $("post-image-file")?.click());

safeOn("post-image-file", "change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusText = $("upload-status-text");
  if (statusText) statusText.textContent = "جاري ضغط ورفع الصورة...";
  try {
    const url = await uploadToImgBB(file, 1200);
    $("post-image-url").value = url;
    showImagePreview("image-preview-wrap", "post-image-preview", url);
    if (statusText) statusText.textContent = "تم الرفع بنجاح ✓";
    showToast("تم رفع الصورة بنجاح");
  } catch (err) {
    if (statusText) statusText.textContent = "تعذر رفع الصورة";
    showToast("خطأ في رفع الصورة: " + err.message, true);
  }
});

safeOn("post-image-url", "input", (e) => {
  showImagePreview("image-preview-wrap", "post-image-preview", e.target.value.trim());
});

// 7. التحكم بنوع المادة وأدوات المحرر الشبيه بالوورد
const postTypeSelect = $("post-type");
const mediaVideoBox = $("media-video-box");
const mediaPodcastBox = $("media-podcast-box");

safeOn("post-type", "change", () => {
  const type = postTypeSelect.value;
  mediaVideoBox?.classList.toggle("hidden", type !== "video" && type !== "infographic");
  mediaPodcastBox?.classList.toggle("hidden", type !== "podcast");
});

document.querySelectorAll(".word-toolbar .tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    const textarea = $("post-content");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);

    let replacement = "";
    switch (action) {
      case "h2": replacement = `\n## ${selected || "عنوان رئيسي للفقرة"}\n`; break;
      case "h3": replacement = `\n### ${selected || "عنوان فرعي"}\n`; break;
      case "bold": replacement = `**${selected || "نص عريض"}**`; break;
      case "italic": replacement = `*${selected || "نص مائل"}*`; break;
      case "underline": replacement = `<u>${selected || "نص تحته خط"}</u>`; break;
      case "highlight": replacement = `<mark>${selected || "نص مميز"}</mark>`; break;
      case "quote": replacement = `\n> ${selected || "اقتباس صحفي بارز"}\n`; break;
      case "ul": replacement = `\n- ${selected || "نقطة مهمة في القائمة"}\n`; break;
      case "ol": replacement = `\n1. ${selected || "عنصر مرقم في القائمة"}\n`; break;
      case "divider": replacement = `\n---\n`; break;
      case "link": {
        const url = prompt("أدخل الرابط الخارجي (URL):", "https://");
        if (!url) return;
        replacement = `[${selected || "اضغط هنا"}](${url})`;
        break;
      }
      case "paragraph": replacement = `\n\n${selected || "اكتب الفقرة الجديدة هنا..."}\n\n`; break;
    }

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    updateLivePreview();
  });
});

const previewBox = $("live-content-preview");
safeOn("toggle-preview-btn", "click", () => {
  previewBox?.classList.toggle("hidden");
  updateLivePreview();
});

safeOn("post-content", "input", () => {
  if (previewBox && !previewBox.classList.contains("hidden")) updateLivePreview();
});

function renderRichTextToHtml(raw) {
  return (raw || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (line === "---") return `<hr class="divider">`;
      let formatted = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);font-weight:700;">$1</a>');
      if (formatted.startsWith("### ")) return `<h3>${formatted.replace("### ", "")}</h3>`;
      if (formatted.startsWith("## ")) return `<h2>${formatted.replace("## ", "")}</h2>`;
      if (formatted.startsWith("> ")) return `<blockquote>${formatted.replace("> ", "")}</blockquote>`;
      if (formatted.startsWith("- ")) return `<p>• ${formatted.replace("- ", "")}</p>`;
      return `<p>${formatted}</p>`;
    })
    .join("");
}

function updateLivePreview() {
  if (!previewBox) return;
  const raw = $("post-content")?.value || "";
  previewBox.innerHTML = renderRichTextToHtml(raw) || `<span class="status-hint">اكتب في صندوق المتن لرؤية المعاينة الحية...</span>`;
}

// 8. إدارة المنشورات مع السماح للمحرر بحذف/تعديل منشوراته الخاصة فقط + منع النقر المتكرر
async function loadPosts() {
  const listEl = $("posts-list");
  try {
    const snap = await getDocs(collection(db, "posts"));
    const fetched = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (hasFullAdminManagement()) {
      allPosts = fetched;
    } else {
      const myEmail = currentUser.email.toLowerCase().trim();
      allPosts = fetched.filter(p => (p.authorEmail || "").toLowerCase().trim() === myEmail);
    }

    updatePostStats();
    renderPosts();
  } catch (err) {
    if (listEl) listEl.innerHTML = `<div class="glass-card">تعذر جلب المنشورات: ${err.message}</div>`;
  }
}

function updatePostStats() {
  if ($("stat-total")) $("stat-total").textContent = allPosts.length;
  if ($("stat-published")) $("stat-published").textContent = allPosts.filter(p => p.status === "published").length;
  if ($("stat-drafts")) $("stat-drafts").textContent = allPosts.filter(p => p.status !== "published").length;
}

let activeFilter = "all";
document.querySelectorAll(".filter-pills .pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".filter-pills .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    activeFilter = pill.dataset.filter;
    renderPosts();
  });
});

safeOn("search-posts-input", "input", renderPosts);

function renderPosts() {
  const listEl = $("posts-list");
  if (!listEl) return;
  const searchTerm = ($("search-posts-input")?.value || "").toLowerCase().trim();

  const filtered = allPosts.filter(post => {
    if (activeFilter !== "all" && post.status !== activeFilter) return false;
    if (searchTerm) {
      const inTitle = (post.title || "").toLowerCase().includes(searchTerm);
      const inSummary = (post.summary || "").toLowerCase().includes(searchTerm);
      const inAuthor = (post.author || "").toLowerCase().includes(searchTerm);
      const inTags = (post.tags || []).some(t => t.toLowerCase().includes(searchTerm));
      return inTitle || inSummary || inAuthor || inTags;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="glass-card" style="text-align:center;color:var(--text-muted)">لا توجد منشورات مطابقة حالياً</div>`;
    return;
  }

  const typeLabels = {
    article: "📰 مقال",
    video: "🎬 فيديو",
    infographic: "📊 فيديو جرافيك",
    podcast: "🎙️ بودكاست",
    photos: "📷 صور"
  };

  listEl.innerHTML = filtered.map(post => {
    const statusLabel = post.status === "published" ? "منشور" : post.status === "restricted" ? "مقيّد" : "مسودة";
    const statusClass = post.status === "published" ? "status-published" : post.status === "restricted" ? "status-restricted" : "status-draft";
    const thumb = post.imageUrl || globalSettings.logoUrl || DEFAULT_LOGO;
    const typeBadge = typeLabels[post.postType || "article"] || "📰 مقال";
    const isMyOwnPost = (post.authorEmail || "").toLowerCase().trim() === currentUser.email.toLowerCase().trim();
    const canDelete = hasFullAdminManagement() || isMyOwnPost;

    return `
      <article class="glass-card post-item">
        <div class="post-top">
          <img src="${thumb}" alt="صورة" class="post-thumb">
          <div class="post-meta-info">
            <div class="badges-row">
              <span class="status-badge ${statusClass}">${statusLabel}</span>
              <span class="status-badge cat-badge">${post.categoryName || post.category || "عام"}</span>
              <span class="status-badge cat-badge">${typeBadge}</span>
              ${post.isBreaking ? `<span class="status-badge status-restricted">⚡ عاجل</span>` : ""}
            </div>
            <h3>${post.title}</h3>
            <div class="post-submeta">
              الكاتب: ${post.author || "هيئة التحرير"} ${post.authorVerified ? `<span class="verified-badge" style="font-size:16px;">verified</span>` : ""} • المشاهدات: ${post.views || 0}
            </div>
          </div>
        </div>
        <div class="post-actions-bar">
          <button class="action-chip chip-smart" onclick="window.smartCopyPost('${post.id}')">
            <span class="material-symbols-rounded">content_copy</span>
            <span>النسخ الذكي</span>
          </button>
          <button class="action-chip" onclick="window.editPost('${post.id}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          ${hasFullAdminManagement() ? `
          <button class="action-chip" onclick="window.toggleRestrictPost('${post.id}', this)">
            <span class="material-symbols-rounded">${post.status === "published" ? "visibility_off" : "publish"}</span>
            <span>${post.status === "published" ? "تقييد" : "اعتماد ونشر"}</span>
          </button>` : ""}
          ${canDelete ? `
          <button class="action-chip chip-danger" onclick="window.deletePost('${post.id}', this)">
            <span class="material-symbols-rounded">delete_forever</span>
            <span>حذف</span>
          </button>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

// إرسال ونشر المقال مع نافذة التأكيد الذكية وقفل الزر لمنع التكرار
safeOn("post-form", "submit", async (e) => {
  e.preventDefault();
  const postId = $("post-id").value;
  const desiredStatus = currentRole === "writer" ? "draft" : "published";
  const confirmTitle = postId ? "تأكيد حفظ التعديلات" : (desiredStatus === "published" ? "تأكيد النشر الفوري" : "تأكيد إرسال المسودة");
  const confirmMsg = postId
    ? "هل أنت متأكد من حفظ التعديلات على هذه المادة الصحفية؟"
    : (desiredStatus === "published" ? "هل أنت متأكد من نشر هذه المادة الآن للجمهور في الموقع العام؟" : "سيتم حفظ المادة كمسودة للمراجعة، هل أنت متأكد؟");

  const ok = await askSmartConfirm(confirmTitle, confirmMsg, "rocket_launch");
  if (!ok) return;

  await withSmartButtonLock($("publish-post-btn"), async () => {
    await savePostToFirestore(desiredStatus);
  }, "جاري النشر والحفظ...");
});

safeOn("save-draft-btn", "click", async () => {
  const ok = await askSmartConfirm("حفظ كمسودة", "هل تريد حفظ هذه المادة كمسودة دون نشرها للجمهور؟", "save");
  if (!ok) return;

  await withSmartButtonLock($("save-draft-btn"), async () => {
    await savePostToFirestore("draft");
  }, "جاري حفظ المسودة...");
});

async function savePostToFirestore(status) {
  const postId = $("post-id").value;
  const catSelect = $("post-category");
  const categorySlug = catSelect.value;
  const catObj = allCategories.find(c => c.slug === categorySlug);
  const categoryName = catObj?.name || catSelect.options[catSelect.selectedIndex]?.textContent || "";

  if (!categorySlug) {
    showToast("يرجى اختيار القسم الرئيسي أولاً", true);
    return;
  }

  if (!hasFullAdminManagement() && allowedCategories.length > 0 && !allowedCategories.includes(categorySlug)) {
    showToast("غير مصرح لك بالنشر في هذا القسم!", true);
    return;
  }

  if (postId && !hasFullAdminManagement()) {
    const existing = allPosts.find(p => p.id === postId);
    if (!existing || (existing.authorEmail || "").toLowerCase() !== currentUser.email.toLowerCase()) {
      showToast("لا يمكنك تعديل مقال لا يخصك!", true);
      return;
    }
  }

  const tagsRaw = $("post-tags").value;
  const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);

  const payload = {
    postType: $("post-type").value || "article",
    title: $("post-title").value.trim(),
    summary: $("post-summary").value.trim(),
    content: $("post-content").value.trim(),
    videoUrl: $("post-video-url").value.trim(),
    podcastPlatform: $("post-podcast-platform").value,
    podcastUrl: $("post-podcast-url").value.trim(),
    podcastDuration: $("post-podcast-duration").value.trim(),
    category: categorySlug,
    categoryName: categoryName,
    categoryNameEn: catObj?.nameEn || "",
    subcategory: $("post-subcategory").value,
    author: $("post-author").value.trim() || currentStaffName,
    authorAvatar: currentStaffDoc.avatarUrl || "",
    authorBio: currentStaffDoc.bio || "",
    authorJobTitle: currentStaffDoc.jobTitle || "",
    authorVerified: isCurrentUserVerified,
    sourceUrl: $("post-source-url").value.trim(),
    imageUrl: $("post-image-url").value.trim(),
    tags: tags,
    isBreaking: $("post-is-breaking").checked,
    isFeatured: $("post-is-featured").checked,
    status: status,
    updatedAt: serverTimestamp()
  };

  try {
    if (postId) {
      await updateDoc(doc(db, "posts", postId), payload);
      showToast("تم تحديث المادة الصحفية بنجاح ✓");
    } else {
      payload.authorEmail = currentUser.email.toLowerCase().trim();
      payload.createdAt = serverTimestamp();
      payload.views = 0;
      const docRef = await addDoc(collection(db, "posts"), payload);
      if (status === "published") {
        await triggerAutoSocialPublish({ id: docRef.id, ...payload });
      }
      showToast(status === "published" ? "تم النشر في الموقع بنجاح! 🚀" : "تم حفظ المسودة بنجاح ✓");
    }
    resetPostForm();
    await loadPosts();
    switchTab("tab-posts");
  } catch (err) {
    showToast("خطأ أثناء حفظ المقال: " + err.message, true);
  }
}

function resetPostForm() {
  $("post-form")?.reset();
  $("post-id").value = "";
  $("post-type").value = "article";
  mediaVideoBox?.classList.add("hidden");
  mediaPodcastBox?.classList.add("hidden");
  previewBox?.classList.add("hidden");
  $("editor-heading").textContent = "نشر مادة صحفية";
  $("cancel-edit-btn")?.classList.add("hidden");
  showImagePreview("image-preview-wrap", "post-image-preview", "");
  $("post-author").value = currentStaffDoc.displayName || currentStaffName || "هيئة التحرير";
}

safeOn("cancel-edit-btn", "click", () => {
  resetPostForm();
  switchTab("tab-posts");
});

window.editPost = (id) => {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  if (!hasFullAdminManagement() && (post.authorEmail || "").toLowerCase() !== currentUser.email.toLowerCase()) {
    showToast("عذراً، يمكنك تعديل مقالاتك الخاصة فقط.", true);
    return;
  }

  $("post-id").value = post.id;
  $("post-type").value = post.postType || "article";
  postTypeSelect?.dispatchEvent(new Event("change"));

  $("post-title").value = post.title || "";
  $("post-summary").value = post.summary || "";
  $("post-content").value = post.content || "";

  $("post-video-url").value = post.videoUrl || "";
  $("post-podcast-platform").value = post.podcastPlatform || "Spotify";
  $("post-podcast-url").value = post.podcastUrl || "";
  $("post-podcast-duration").value = post.podcastDuration || "";

  $("post-category").value = post.category || "";
  populateSubcategories(post.category, post.subcategory);
  $("post-author").value = post.author || "";
  $("post-source-url").value = post.sourceUrl || "";
  $("post-image-url").value = post.imageUrl || "";
  showImagePreview("image-preview-wrap", "post-image-preview", post.imageUrl || "");
  $("post-tags").value = (post.tags || []).join(", ");
  $("post-is-breaking").checked = !!post.isBreaking;
  $("post-is-featured").checked = !!post.isFeatured;

  $("editor-heading").textContent = "تعديل المادة الصحفية";
  $("cancel-edit-btn")?.classList.remove("hidden");
  switchTab("tab-editor");
};

window.toggleRestrictPost = async (id, btnEl) => {
  if (!hasFullAdminManagement()) return;
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  const newStatus = post.status === "published" ? "restricted" : "published";
  await withSmartButtonLock(btnEl, async () => {
    try {
      await updateDoc(doc(db, "posts", id), { status: newStatus, updatedAt: serverTimestamp() });
      showToast(newStatus === "published" ? "تم اعتماد ونشر المقال" : "تم تقييد المقال وإخفاؤه");
      await loadPosts();
    } catch (err) {
      showToast("تعذر تحديث الحالة: " + err.message, true);
    }
  }, "جاري التحديث...");
};

window.deletePost = async (id, btnEl) => {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  const isMyOwn = (post.authorEmail || "").toLowerCase().trim() === currentUser.email.toLowerCase().trim();
  if (!hasFullAdminManagement() && !isMyOwn) {
    showToast("لا تملك صلاحية حذف هذا المقال!", true);
    return;
  }

  const ok = await askSmartConfirm("تأكيد الحذف النهائي", `هل أنت متأكد من حذف المقال: "${post.title}" نهائياً؟ لا يمكن التراجع عن هذه الخطوة.`, "delete_forever");
  if (!ok) return;

  await withSmartButtonLock(btnEl, async () => {
    try {
      await deleteDoc(doc(db, "posts", id));
      showToast("تم حذف المقال نهائياً ✓");
      await loadPosts();
    } catch (err) {
      showToast("فشل الحذف: " + err.message, true);
    }
  }, "جاري الحذف...");
};

window.smartCopyPost = async (id) => {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  const baseUrl = (globalSettings.publicUrl || window.location.origin).replace(/\/$/, "");
  const articleUrl = `${baseUrl}/?post=${post.id}`;
  const hashtags = (post.tags || []).map(t => `#${t.replace(/\s+/g, "_")}`).join(" ");

  let socialBlock = [];
  if (globalSettings.socialWhatsapp) socialBlock.push(`🟢 واتساب: ${globalSettings.socialWhatsapp}`);
  if (globalSettings.socialTelegram) socialBlock.push(`🔵 تيليجرام: ${globalSettings.socialTelegram}`);
  if (globalSettings.socialX) socialBlock.push(`⚫ إكس: ${globalSettings.socialX}`);
  if (globalSettings.socialFacebook) socialBlock.push(`🔷 فيسبوك: ${globalSettings.socialFacebook}`);

  const formattedText = [
    `🧭 ${globalSettings.siteName} | ${post.categoryName || ""}`,
    `━━━━━━━━━━━━━━`,
    `📌 ${post.title}`,
    ``,
    `${post.summary}`,
    ``,
    `📖 التفاصيل الكاملة عبر ${globalSettings.networkName}:`,
    `${articleUrl}`,
    socialBlock.length ? `\n━━━━━━━━━━━━━━\n${socialBlock.join("\n")}` : "",
    hashtags ? `\n${hashtags}` : ""
  ].filter(Boolean).join("\n");

  try {
    await navigator.clipboard.writeText(formattedText);
    showToast("تم نسخ الحزمة الذكية! جاهزة للصق في المنصات");
  } catch (err) {
    showToast("تعذر النسخ التلقائي", true);
  }
};

// 9. تبويب "ملفي الصحفي وتوثيق الهوية (KYC)" لكل محرر وكاتب وإداري
function populateMyProfileTab() {
  const avatar = currentStaffDoc.avatarUrl || currentUser?.photoURL || DEFAULT_FAVICON;
  const displayName = currentStaffDoc.displayName || currentStaffName || "صحفي البوصلة";
  const kycStatus = currentStaffDoc.kycStatus || (isCurrentUserVerified ? "approved" : "none");

  if ($("my-profile-avatar-preview")) $("my-profile-avatar-preview").src = avatar;
  if ($("my-profile-name-display")) $("my-profile-name-display").textContent = displayName;
  $("my-profile-verified-icon")?.classList.toggle("hidden", !isCurrentUserVerified);

  const statusTextEl = $("my-kyc-status-text");
  if (statusTextEl) {
    if (isCurrentUserVerified || kycStatus === "approved") {
      statusTextEl.textContent = "✅ حسابك موثق رسمياً بالشارة الزرقاء المعتمدة في شبكة البوصلة.";
      statusTextEl.style.color = "#10b981";
    } else if (kycStatus === "pending") {
      statusTextEl.textContent = "⏳ طلب التوثيق الخاص بك قيد المراجعة حالياً لدى الإدارة.";
      statusTextEl.style.color = "#f59e0b";
    } else if (kycStatus === "rejected") {
      statusTextEl.textContent = `❌ تم رفض طلب التوثيق السابق (${currentStaffDoc.kycRejectReason || "بيانات غير مكتملة"}) — يمكنك تصحيح البيانات وإعادة الإرسال.`;
      statusTextEl.style.color = "#ef4444";
    } else {
      statusTextEl.textContent = "حالة التوثيق: غير موثق بعد — عبئ نموذج الهوية بالأسفل للحصول على الشارة الزرقاء.";
      statusTextEl.style.color = "";
    }
  }

  if ($("prof-display-name")) $("prof-display-name").value = displayName;
  if ($("prof-job-title")) $("prof-job-title").value = currentStaffDoc.jobTitle || "";
  if ($("prof-avatar-url")) $("prof-avatar-url").value = currentStaffDoc.avatarUrl || "";
  if ($("prof-bio")) $("prof-bio").value = currentStaffDoc.bio || "";
  if ($("prof-social-x")) $("prof-social-x").value = currentStaffDoc.socialX || "";
  if ($("prof-social-fb")) $("prof-social-fb").value = currentStaffDoc.socialFb || "";

  const kyc = currentStaffDoc.kycData || {};
  if ($("kyc-full-name")) $("kyc-full-name").value = kyc.fullName || "";
  if ($("kyc-country")) $("kyc-country").value = kyc.country || "";
  if ($("kyc-doc-type")) $("kyc-doc-type").value = kyc.docType || "national_id";
  if ($("kyc-doc-number")) $("kyc-doc-number").value = kyc.docNumber || "";
  if ($("kyc-phone")) $("kyc-phone").value = kyc.phone || "";
  if ($("kyc-whatsapp")) $("kyc-whatsapp").value = kyc.whatsapp || "";
  if ($("kyc-city")) $("kyc-city").value = kyc.city || "";
  if ($("kyc-address")) $("kyc-address").value = kyc.address || "";
}

safeOn("trigger-prof-avatar-btn", "click", () => $("prof-avatar-file")?.click());

safeOn("prof-avatar-file", "change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const st = $("prof-avatar-status");
  if (st) st.textContent = "جاري ضغط ورفع صورتك الشخصية...";
  try {
    const url = await uploadToImgBB(file, 500);
    $("prof-avatar-url").value = url;
    if ($("my-profile-avatar-preview")) $("my-profile-avatar-preview").src = url;
    if (st) st.textContent = "تم رفع الصورة الشخصية بنجاح ✓";
    showToast("تم رفع صورتك الشخصية!");
  } catch (err) {
    if (st) st.textContent = "فشل رفع الصورة";
    showToast("خطأ: " + err.message, true);
  }
});

safeOn("profile-public-form", "submit", async (e) => {
  e.preventDefault();
  const ok = await askSmartConfirm("حفظ الملف الصحفي", "هل تريد تحديث بيانات ملفك الصحفي وصورتك وسيرتك الذاتية الظاهرة للقرّاء؟", "badge");
  if (!ok) return;

  await withSmartButtonLock($("save-public-profile-btn"), async () => {
    const email = currentUser.email.toLowerCase().trim();
    const updatedFields = {
      name: $("prof-display-name").value.trim(),
      displayName: $("prof-display-name").value.trim(),
      jobTitle: $("prof-job-title").value.trim(),
      avatarUrl: $("prof-avatar-url").value.trim(),
      bio: $("prof-bio").value.trim(),
      socialX: $("prof-social-x").value.trim(),
      socialFb: $("prof-social-fb").value.trim(),
      updatedAt: serverTimestamp()
    };

    if (currentRole === "super_admin") {
      updatedFields.role = "super_admin";
      updatedFields.verified = true;
      updatedFields.active = true;
    }

    try {
      await setDoc(doc(db, "staff", email), updatedFields, { merge: true });
      currentStaffDoc = { ...currentStaffDoc, ...updatedFields };
      currentStaffName = updatedFields.displayName;
      if ($("post-author")) $("post-author").value = currentStaffName;
      populateMyProfileTab();
      showToast("تم تحديث ملفك الصحفي العام بنجاح ✓");
    } catch (err) {
      showToast("تعذر حفظ الملف الصحفي: " + err.message, true);
    }
  }, "جاري الحفظ...");
});

safeOn("kyc-verification-form", "submit", async (e) => {
  e.preventDefault();
  const ok = await askSmartConfirm(
    "إرسال طلب التوثيق الرسمي (KYC)",
    "أقر بأن جميع بيانات الهوية وأرقام التواصل المدخلة صحيحة ومطابقة للوثائق الرسمية، وأوافق على مراجعتها من قِبل الإدارة لمنحي الشارة الزرقاء.",
    "verified"
  );
  if (!ok) return;

  await withSmartButtonLock($("submit-kyc-btn"), async () => {
    const email = currentUser.email.toLowerCase().trim();
    const kycData = {
      fullName: $("kyc-full-name").value.trim(),
      country: $("kyc-country").value.trim(),
      docType: $("kyc-doc-type").value,
      docNumber: $("kyc-doc-number").value.trim(),
      phone: $("kyc-phone").value.trim(),
      whatsapp: $("kyc-whatsapp").value.trim(),
      city: $("kyc-city").value.trim(),
      address: $("kyc-address").value.trim(),
      submittedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "staff", email), {
        kycData,
        kycStatus: currentRole === "super_admin" ? "approved" : "pending",
        updatedAt: serverTimestamp()
      }, { merge: true });

      currentStaffDoc.kycData = kycData;
      currentStaffDoc.kycStatus = currentRole === "super_admin" ? "approved" : "pending";
      populateMyProfileTab();
      showToast("تم إرسال بيانات التوثيق بنجاح! ستقوم الإدارة بمراجعتها وتفعيل الشارة الزرقاء.");
    } catch (err) {
      showToast("تعذر إرسال طلب التوثيق: " + err.message, true);
    }
  }, "جاري الإرسال...");
});

// 10. إدارة الرعايات والإعلانات الممولة
safeOn("trigger-ad-upload-btn", "click", () => $("ad-image-file")?.click());

safeOn("ad-image-file", "change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = $("ad-upload-status");
  if (statusEl) statusEl.textContent = "جاري رفع صورة البانر / الإعلان...";
  try {
    const url = await uploadToImgBB(file, 1400);
    $("ad-image-url").value = url;
    showImagePreview("ad-preview-wrap", "ad-image-preview", url);
    if (statusEl) statusEl.textContent = "تم رفع صورة الإعلان ✓";
    showToast("تم رفع صورة الإعلان بنجاح");
  } catch (err) {
    if (statusEl) statusEl.textContent = "فشل رفع الصورة";
    showToast("خطأ في رفع صورة الإعلان: " + err.message, true);
  }
});

safeOn("ad-image-url", "input", (e) => {
  showImagePreview("ad-preview-wrap", "ad-image-preview", e.target.value.trim());
});

async function loadAds() {
  const listEl = $("ads-list");
  try {
    const snap = await getDocs(collection(db, "ads"));
    allAds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateAdStats();
    renderAdsList();
  } catch (err) {
    if (listEl) listEl.innerHTML = `<div class="glass-card">تعذر جلب الإعلانات: ${err.message}</div>`;
  }
}

function updateAdStats() {
  const activeCount = allAds.filter(a => a.active !== false).length;
  const totalViews = allAds.reduce((sum, a) => sum + (a.views || 0), 0);
  const totalClicks = allAds.reduce((sum, a) => sum + (a.clicks || 0), 0);

  if ($("stat-ads-active")) $("stat-ads-active").textContent = activeCount;
  if ($("stat-ads-views")) $("stat-ads-views").textContent = totalViews;
  if ($("stat-ads-clicks")) $("stat-ads-clicks").textContent = totalClicks;
}

function renderAdsList() {
  const listEl = $("ads-list");
  if (!listEl) return;
  if (allAds.length === 0) {
    listEl.innerHTML = `<div class="glass-card" style="text-align:center;color:var(--text-muted)">لا توجد حملات إعلانية مضافة حالياً.</div>`;
    return;
  }

  const placementNames = {
    all: "جميع المواضع",
    top: "أعلى الرئيسية",
    between_posts: "بين الأخبار",
    in_article: "وسط المقالات"
  };

  listEl.innerHTML = allAds.map(ad => {
    const isActive = ad.active !== false;
    const views = ad.views || 0;
    const clicks = ad.clicks || 0;
    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : "0.0";
    const thumb = ad.imageUrl || globalSettings.logoUrl || DEFAULT_LOGO;
    const styleBadge = ad.adStyle === "banner" ? "🖼️ بانر أفقي ممتد" : "✨ بطاقة رعاية زجاجية";

    return `
      <article class="glass-card post-item">
        <div class="post-top">
          <img src="${thumb}" alt="${ad.sponsorName}" class="post-thumb">
          <div class="post-meta-info">
            <div class="badges-row">
              <span class="status-badge ${isActive ? "status-published" : "status-restricted"}">${isActive ? "إعلان نشط" : "متوقف مؤقتاً"}</span>
              <span class="status-badge cat-badge">${styleBadge}</span>
              <span class="status-badge cat-badge">${placementNames[ad.placement] || "جميع المواضع"}</span>
            </div>
            <h3>${ad.title}</h3>
            <div class="post-submeta">الراعي: <strong>${ad.sponsorName}</strong> • <a href="${ad.targetUrl}" target="_blank" style="color:var(--accent)">معاينة الرابط</a></div>
            <div class="ad-metrics-bar">
              <span class="metric-pill views">👁️ الظهور: ${views}</span>
              <span class="metric-pill clicks">🖱️ النقرات: ${clicks}</span>
              <span class="metric-pill ctr">📈 التفاعل CTR: ${ctr}%</span>
            </div>
          </div>
        </div>
        <div class="post-actions-bar">
          <button class="action-chip" onclick="window.toggleAdStatus('${ad.id}', this)">
            <span class="material-symbols-rounded">${isActive ? "pause_circle" : "play_circle"}</span>
            <span>${isActive ? "إيقاف مؤقت" : "تفعيل الإعلان"}</span>
          </button>
          <button class="action-chip" onclick="window.editAd('${ad.id}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          <button class="action-chip" onclick="window.resetAdStats('${ad.id}', this)">
            <span class="material-symbols-rounded">restart_alt</span>
            <span>تصفير العداد</span>
          </button>
          <button class="action-chip chip-danger" onclick="window.deleteAd('${ad.id}', this)">
            <span class="material-symbols-rounded">delete</span>
            <span>حذف</span>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

safeOn("ad-form", "submit", async (e) => {
  e.preventDefault();
  const ok = await askSmartConfirm("حفظ الحملة الإعلانية", "هل أنت متأكد من حفظ ونشر هذه الحملة الإعلانية؟", "campaign");
  if (!ok) return;

  await withSmartButtonLock($("save-ad-btn"), async () => {
    const adId = $("ad-id").value;
    const payload = {
      adStyle: $("ad-style").value || "banner",
      sponsorName: $("ad-sponsor").value.trim(),
      title: $("ad-title").value.trim(),
      targetUrl: $("ad-target-url").value.trim(),
      placement: $("ad-placement").value,
      imageUrl: $("ad-image-url").value.trim(),
      active: $("ad-active").checked,
      updatedAt: serverTimestamp()
    };

    try {
      if (adId) {
        await updateDoc(doc(db, "ads", adId), payload);
        showToast("تم تحديث الحملة الإعلانية بنجاح");
      } else {
        payload.views = 0;
        payload.clicks = 0;
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "ads"), payload);
        showToast("تم إطلاق الحملة الإعلانية في الموقع بنجاح!");
      }
      resetAdForm();
      await loadAds();
    } catch (err) {
      showToast("تعذر حفظ الإعلان: " + err.message, true);
    }
  }, "جاري حفظ الإعلان...");
});

function resetAdForm() {
  $("ad-form")?.reset();
  $("ad-id").value = "";
  $("ad-form-heading").textContent = "إضافة حملة إعلانية / رعاية جديدة";
  $("cancel-ad-edit-btn")?.classList.add("hidden");
  showImagePreview("ad-preview-wrap", "ad-image-preview", "");
}

safeOn("cancel-ad-edit-btn", "click", resetAdForm);

window.editAd = (id) => {
  const ad = allAds.find(a => a.id === id);
  if (!ad) return;
  $("ad-id").value = ad.id;
  $("ad-style").value = ad.adStyle || "banner";
  $("ad-sponsor").value = ad.sponsorName || "";
  $("ad-title").value = ad.title || "";
  $("ad-target-url").value = ad.targetUrl || "";
  $("ad-placement").value = ad.placement || "all";
  $("ad-image-url").value = ad.imageUrl || "";
  showImagePreview("ad-preview-wrap", "ad-image-preview", ad.imageUrl || "");
  $("ad-active").checked = ad.active !== false;

  $("ad-form-heading").textContent = "تعديل الحملة الإعلانية";
  $("cancel-ad-edit-btn")?.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.toggleAdStatus = async (id, btnEl) => {
  const ad = allAds.find(a => a.id === id);
  if (!ad) return;
  const nextState = ad.active === false ? true : false;
  await withSmartButtonLock(btnEl, async () => {
    await updateDoc(doc(db, "ads", id), { active: nextState });
    showToast(nextState ? "تم تفعيل الإعلان" : "تم إيقاف الإعلان مؤقتاً");
    await loadAds();
  });
};

window.resetAdStats = async (id, btnEl) => {
  const ok = await askSmartConfirm("تصفير إحصائيات الإعلان", "هل تريد تصفير عدادات الظهور والنقرات لهذا الإعلان؟", "restart_alt");
  if (!ok) return;
  await withSmartButtonLock(btnEl, async () => {
    await updateDoc(doc(db, "ads", id), { views: 0, clicks: 0 });
    showToast("تم تصفير إحصائيات الإعلان");
    await loadAds();
  });
};

window.deleteAd = async (id, btnEl) => {
  const ok = await askSmartConfirm("حذف الإعلان", "هل أنت متأكد من حذف هذه الحملة الإعلانية نهائياً؟", "delete");
  if (!ok) return;
  await withSmartButtonLock(btnEl, async () => {
    await deleteDoc(doc(db, "ads", id));
    showToast("تم حذف الإعلان");
    await loadAds();
  });
};

// 11. هندسة الأقسام والقائمة الجانبية
async function loadCategories() {
  try {
    const snap = await getDocs(collection(db, "categories"));
    allCategories = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 99) - (b.order || 99));
    renderCategorySelects();
    renderCategoriesList();
    renderStaffCategoryPicker();
  } catch (err) {
    showToast("تنبيه في جلب الأقسام: " + err.message, true);
  }
}

function renderCategorySelects() {
  const select = $("post-category");
  if (!select) return;
  const visibleCats = !hasFullAdminManagement()
    ? allCategories.filter(c => allowedCategories.includes(c.slug))
    : allCategories;

  if (visibleCats.length === 0 && !hasFullAdminManagement()) {
    select.innerHTML = `<option value="">لم يتم تخصيص قسم لحسابك بعد</option>`;
    return;
  }

  select.innerHTML = `<option value="">اختر القسم...</option>` + visibleCats.map(c => (
    `<option value="${c.slug}">${c.name}</option>`
  )).join("");
}

safeOn("post-category", "change", (e) => {
  populateSubcategories(e.target.value);
});

function populateSubcategories(catSlug, selectedSub = "") {
  const subSelect = $("post-subcategory");
  if (!subSelect) return;
  const cat = allCategories.find(c => c.slug === catSlug);
  const subs = cat?.subcategories || [];
  subSelect.innerHTML = `<option value="">بدون قسم فرعي</option>` + subs.map(s => (
    `<option value="${s}" ${s === selectedSub ? "selected" : ""}>${s}</option>`
  )).join("");
}

function renderCategoriesList() {
  const container = $("categories-list");
  if (!container) return;

  container.innerHTML = allCategories.map(c => {
    const isVisible = c.visible !== false;
    return `
      <div class="glass-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div class="badges-row">
              <span class="status-badge ${isVisible ? "status-published" : "status-restricted"}">${isVisible ? "👁️ ظاهر في الموقع" : "🚫 مخفي حالياً"}</span>
              <span class="status-badge cat-badge">ترتيب: ${c.order || 1}</span>
            </div>
            <h4>${c.name} <small style="color:var(--text-muted)">(${c.nameEn || c.slug})</small></h4>
          </div>
        </div>
        <p class="status-hint" style="margin-top:8px;">المعرف: <code>${c.slug}</code> • الفروع: ${(c.subcategories || []).join(" ، ") || "لا يوجد"}</p>
        <div class="post-actions-bar" style="margin-top:12px;">
          <button class="action-chip ${isVisible ? "" : "chip-smart"}" onclick="window.toggleCategoryVisibility('${c.slug}', this)">
            <span class="material-symbols-rounded">${isVisible ? "visibility_off" : "visibility"}</span>
            <span>${isVisible ? "إخفاء القسم" : "إظهار القسم"}</span>
          </button>
          <button class="action-chip" onclick="window.editCategory('${c.slug}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          <button class="action-chip chip-danger" onclick="window.deleteCategory('${c.slug}', this)">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.toggleCategoryVisibility = async (slug, btnEl) => {
  const cat = allCategories.find(c => c.slug === slug);
  if (!cat) return;
  const nextVisible = cat.visible === false ? true : false;
  await withSmartButtonLock(btnEl, async () => {
    await updateDoc(doc(db, "categories", slug), { visible: nextVisible });
    showToast(nextVisible ? `تم إظهار قسم "${cat.name}" في الموقع العام` : `تم إخفاء قسم "${cat.name}" من الواجهة`);
    await loadCategories();
  });
};

window.editCategory = (slug) => {
  const cat = allCategories.find(c => c.slug === slug);
  if (!cat) return;
  $("cat-name").value = cat.name || "";
  $("cat-name-en").value = cat.nameEn || "";
  $("cat-slug").value = cat.slug || "";
  $("cat-icon").value = cat.icon || "newspaper";
  $("cat-subs").value = (cat.subcategories || []).join(", ");
  $("cat-order").value = cat.order || 1;
  $("cat-visible").checked = cat.visible !== false;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

safeOn("category-form", "submit", async (e) => {
  e.preventDefault();
  await withSmartButtonLock($("save-cat-btn"), async () => {
    const slug = $("cat-slug").value.trim().toLowerCase().replace(/\s+/g, "-");
    const subs = $("cat-subs").value.split(",").map(s => s.trim()).filter(Boolean);

    await setDoc(doc(db, "categories", slug), {
      name: $("cat-name").value.trim(),
      nameEn: $("cat-name-en").value.trim(),
      slug: slug,
      icon: $("cat-icon").value.trim() || "newspaper",
      subcategories: subs,
      order: parseInt($("cat-order").value || "1", 10),
      visible: $("cat-visible").checked
    });
    $("category-form").reset();
    showToast("تم حفظ القسم وتحديث القائمة الجانبية بنجاح ✓");
    await loadCategories();
  }, "جاري الحفظ...");
});

safeOn("seed-categories-btn", "click", async () => {
  const ok = await askSmartConfirm("توليد الأقسام القياسية", "هل تريد توليد كافة الأقسام القياسية للمنصة والقائمة الجانبية؟", "auto_awesome");
  if (!ok) return;

  await withSmartButtonLock($("seed-categories-btn"), async () => {
    const defaults = [
      { name: "محلية", nameEn: "Local News", slug: "local", icon: "location_on", order: 1, visible: true, subcategories: ["السياسة اليمنية", "شؤون المحافظات", "اقتصاد ومعيشة"] },
      { name: "دولية", nameEn: "International", slug: "world", icon: "public", order: 2, visible: true, subcategories: ["الشرق الأوسط", "السياسة الدولية", "تطورات إقليمية"] },
      { name: "تحقيقات وتقارير", nameEn: "Reports & Investigations", slug: "reports", icon: "policy", order: 3, visible: true, subcategories: ["ملفات خاصة", "تقارير معمقة", "كواليس السياسة"] },
      { name: "حوارات", nameEn: "Interviews", slug: "interviews", icon: "forum", order: 4, visible: true, subcategories: ["لقاءات خاصة", "ندوات سياسية"] },
      { name: "المقالات", nameEn: "Opinion Articles", slug: "articles", icon: "edit_note", order: 5, visible: true, subcategories: ["مقالات رأي", "قراءات استراتيجية"] },
      { name: "نافذة التقنية", nameEn: "Technology", slug: "tech", icon: "memory", order: 6, visible: true, subcategories: ["الذكاء الاصطناعي", "الهواتف والأنظمة", "الأمن السيبراني"] },
      { name: "الثقافة والفن", nameEn: "Culture & Art", slug: "culture", icon: "theater_comedy", order: 7, visible: true, subcategories: ["أدب وروايات", "فكر وتراث", "سينما وفنون"] },
      { name: "بودكاست", nameEn: "Podcast", slug: "podcast", icon: "podcasts", order: 8, visible: false, subcategories: ["بودكاست البوصلة", "حلقات صوتية"] },
      { name: "فيديو جرافيك", nameEn: "Video Graphics", slug: "infographic", icon: "monitoring", order: 9, visible: false, subcategories: ["إنفوجرافيك", "خرائط تفاعلية"] },
      { name: "الفيديو", nameEn: "Videos", slug: "video", icon: "smart_display", order: 10, visible: false, subcategories: ["تقارير مرئية", "وثائقيات قصيرة"] },
      { name: "الصور", nameEn: "Photo Gallery", slug: "photos", icon: "photo_library", order: 11, visible: false, subcategories: ["عدسة البوصلة", "حكاية صورة"] }
    ];
    for (const item of defaults) {
      await setDoc(doc(db, "categories", item.slug), item);
    }
    showToast("تم توليد كافة الأقسام القياسية بنجاح!");
    await loadCategories();
  }, "جاري التوليد...");
});

window.deleteCategory = async (slug, btnEl) => {
  const ok = await askSmartConfirm("حذف القسم", "هل أنت متأكد من حذف هذا القسم نهائياً؟", "delete");
  if (!ok) return;
  await withSmartButtonLock(btnEl, async () => {
    await deleteDoc(doc(db, "categories", slug));
    showToast("تم حذف القسم");
    await loadCategories();
  });
};

// 12. إدارة الفريق، البحث الفوري عن الموظفين، ومراجعة طلبات التوثيق KYC
safeOn("staff-cat-search", "input", renderStaffCategoryPicker);
safeOn("staff-role", "change", (e) => {
  const isPlatAdmin = e.target.value === "platform_admin";
  $("staff-cat-picker-wrap")?.classList.toggle("hidden", isPlatAdmin);
});

function renderStaffCategoryPicker() {
  const chipsContainer = $("staff-cat-chips");
  const summaryContainer = $("staff-selected-display");
  if (!chipsContainer || !summaryContainer) return;

  const q = ($("staff-cat-search")?.value || "").toLowerCase().trim();
  const filteredCats = allCategories.filter(c => {
    if (!q) return true;
    return (c.name || "").toLowerCase().includes(q) || (c.slug || "").toLowerCase().includes(q);
  });

  if (filteredCats.length === 0) {
    chipsContainer.innerHTML = `<span class="status-hint">لا توجد أقسام مطابقة للبحث...</span>`;
  } else {
    chipsContainer.innerHTML = filteredCats.map(c => {
      const isSelected = selectedStaffCategories.has(c.slug);
      return `
        <button type="button" class="cat-select-chip ${isSelected ? "selected" : ""}" onclick="window.toggleStaffCatChip('${c.slug}')">
          <span class="material-symbols-rounded" style="font-size:17px;">${isSelected ? "check_circle" : "add_circle"}</span>
          <span>${c.name}</span>
        </button>
      `;
    }).join("");
  }

  if (selectedStaffCategories.size === 0) {
    summaryContainer.innerHTML = `<span class="status-hint">لم يتم اختيار قسم بعد</span>`;
  } else {
    summaryContainer.innerHTML = Array.from(selectedStaffCategories).map(slug => {
      const catObj = allCategories.find(c => c.slug === slug);
      return `<span class="status-badge cat-badge">${catObj ? catObj.name : slug}</span>`;
    }).join("");
  }
}

window.toggleStaffCatChip = (slug) => {
  if (selectedStaffCategories.has(slug)) {
    selectedStaffCategories.delete(slug);
  } else {
    selectedStaffCategories.add(slug);
  }
  renderStaffCategoryPicker();
};

async function loadStaff() {
  try {
    const snap = await getDocs(collection(db, "staff"));
    allStaff = snap.docs.map(d => ({ email: d.id, ...d.data() }));
    renderKycRequests();
    renderStaffList();
  } catch (err) {
    showToast("تعذر جلب قائمة الفريق: " + err.message, true);
  }
}

safeOn("search-staff-input", "input", renderStaffList);

function renderKycRequests() {
  const listEl = $("kyc-requests-list");
  const countBadge = $("kyc-pending-count");
  if (!listEl) return;

  const pendingList = allStaff.filter(m => m.kycData && (m.kycStatus === "pending" || !m.verified));
  if (countBadge) countBadge.textContent = `${pendingList.length} طلبات`;

  if (pendingList.length === 0) {
    listEl.innerHTML = `<div class="status-hint">لا توجد طلبات توثيق معلقة حالياً.</div>`;
    return;
  }

  const docTypeNames = {
    national_id: "بطاقة هوية وطنية",
    passport: "جواز سفر",
    driver_license: "رخصة قيادة",
    press_card: "بطاقة صحفية"
  };

  listEl.innerHTML = pendingList.map(m => {
    const kyc = m.kycData || {};
    const cleanWa = (kyc.whatsapp || kyc.phone || "").replace(/[^0-9]/g, "");
    const avatar = m.avatarUrl || DEFAULT_FAVICON;

    return `
      <div class="glass-card post-item" style="border-color:rgba(56, 189, 248, 0.35);">
        <div class="post-top">
          <img src="${avatar}" alt="${m.name}" class="staff-avatar-sm">
          <div class="post-meta-info">
            <div class="badges-row">
              <span class="status-badge status-draft">طلب توثيق هوية (KYC)</span>
              <span class="status-badge cat-badge">${docTypeNames[kyc.docType] || "وثيقة رسمية"}</span>
            </div>
            <h3>${kyc.fullName || m.name} <small style="color:var(--text-muted)">(${m.email})</small></h3>
            <div class="post-submeta" style="margin-top:6px;line-height:1.8;">
              🌍 الدولة/المدينة: <strong>${kyc.country || "-"} - ${kyc.city || "-"}</strong> | 🪪 رقم الوثيقة: <code>${kyc.docNumber || "-"}</code><br>
              📞 الهاتف: <strong dir="ltr">${kyc.phone || "-"}</strong> | 💬 واتساب: <strong dir="ltr">${kyc.whatsapp || "-"}</strong>
              ${kyc.address ? `<br>📍 العنوان: ${kyc.address}` : ""}
            </div>
          </div>
        </div>
        <div class="post-actions-bar">
          <button class="action-chip chip-smart" onclick="window.approveKyc('${m.email}', this)">
            <span class="material-symbols-rounded">verified</span>
            <span>اعتماد ومنح الشارة الزرقاء</span>
          </button>
          ${cleanWa ? `
          <a href="https://wa.me/${cleanWa}" target="_blank" class="action-chip chip-wa">
            <span class="material-symbols-rounded">chat</span>
            <span>مراسلة عبر واتساب</span>
          </a>` : ""}
          <button class="action-chip chip-danger" onclick="window.rejectKyc('${m.email}', this)">
            <span class="material-symbols-rounded">cancel</span>
            <span>رفض الطلب</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.approveKyc = async (email, btnEl) => {
  const ok = await askSmartConfirm("منح الشارة الزرقاء الموثقة", `هل أنت متأكد من اعتماد وثائق العضو (${email}) ومنحه الشارة الزرقاء الرسمية في الموقع؟`, "verified");
  if (!ok) return;

  await withSmartButtonLock(btnEl, async () => {
    await updateDoc(doc(db, "staff", email), {
      verified: true,
      kycStatus: "approved",
      updatedAt: serverTimestamp()
    });
    showToast("تم توثيق الحساب ومنح الشارة الزرقاء بنجاح ✓");
    await loadStaff();
  });
};

window.rejectKyc = async (email, btnEl) => {
  const reason = prompt("أدخل سبب رفض طلب التوثيق ليظهر للمحرر:", "يرجى التأكد من صحة رقم الوثيقة ورقم الواتساب");
  if (reason === null) return;

  await withSmartButtonLock(btnEl, async () => {
    await updateDoc(doc(db, "staff", email), {
      verified: false,
      kycStatus: "rejected",
      kycRejectReason: reason,
      updatedAt: serverTimestamp()
    });
    showToast("تم رفض طلب التوثيق وإبلاغ العضو");
    await loadStaff();
  });
};

function renderStaffList() {
  const container = $("staff-list");
  if (!container) return;

  const q = ($("search-staff-input")?.value || "").toLowerCase().trim();
  const filtered = allStaff.filter(m => {
    if (!q) return true;
    const kyc = m.kycData || {};
    const blob = [
      m.name, m.displayName, m.email, m.jobTitle,
      kyc.fullName, kyc.phone, kyc.whatsapp, kyc.city,
      ...(m.categories || [])
    ].join(" ").toLowerCase();
    return blob.includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="glass-card" style="grid-column:1/-1;text-align:center;color:var(--text-muted)">لا يوجد أعضاء مطابقون للبحث.</div>`;
    return;
  }

  const roleLabels = {
    super_admin: "👑 قيادة سيادية",
    platform_admin: "🛡️ مدير منصة وإعلانات",
    editor: "✍️ محرر معتمد",
    writer: "📝 كاتب مسودات"
  };

  container.innerHTML = filtered.map(m => {
    const catNames = (m.categories || []).map(slug => {
      const found = allCategories.find(c => c.slug === slug);
      return found ? found.name : slug;
    });
    const avatar = m.avatarUrl || DEFAULT_FAVICON;
    const kyc = m.kycData || {};
    const cleanWa = (kyc.whatsapp || kyc.phone || "").replace(/[^0-9]/g, "");

    return `
      <div class="glass-card">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${avatar}" alt="${m.name}" class="staff-avatar-sm">
          <div>
            <h4 style="display:flex;align-items:center;gap:5px;">
              <span>${m.name || m.displayName || "عضو الفريق"}</span>
              ${m.verified ? `<span class="verified-badge" title="موثق بالشارة الزرقاء">verified</span>` : ""}
            </h4>
            <p class="status-hint">${m.email}</p>
          </div>
        </div>
        <div class="badges-row" style="margin-top:10px;">
          <span class="status-badge status-published">${roleLabels[m.role] || "محرر"}</span>
          ${m.role !== "platform_admin" && m.role !== "super_admin" ? `<span class="status-badge cat-badge">الأقسام: ${catNames.length ? catNames.join(" ، ") : "غير محدد"}</span>` : ""}
        </div>
        <div class="post-actions-bar" style="margin-top:12px;">
          <button class="action-chip" onclick="window.editStaffMember('${m.email}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          <button class="action-chip ${m.verified ? "" : "chip-smart"}" onclick="window.toggleStaffVerified('${m.email}', this)">
            <span class="material-symbols-rounded">verified</span>
            <span>${m.verified ? "إلغاء التوثيق" : "منح الشارة"}</span>
          </button>
          ${cleanWa ? `
          <a href="https://wa.me/${cleanWa}" target="_blank" class="action-chip chip-wa" title="واتساب">
            <span class="material-symbols-rounded">chat</span>
          </a>` : ""}
          ${!SOVEREIGN_ADMINS.includes(m.email.toLowerCase()) ? `
          <button class="action-chip chip-danger" onclick="window.removeStaff('${m.email}', this)">
            <span class="material-symbols-rounded">person_remove</span>
          </button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

window.toggleStaffVerified = async (email, btnEl) => {
  const member = allStaff.find(m => m.email === email);
  if (!member) return;
  const nextVer = !member.verified;
  await withSmartButtonLock(btnEl, async () => {
    await updateDoc(doc(db, "staff", email), {
      verified: nextVer,
      kycStatus: nextVer ? "approved" : "none"
    });
    showToast(nextVer ? "تم منح الشارة الزرقاء للعضو ✓" : "تم سحب الشارة الزرقاء");
    await loadStaff();
  });
};

window.editStaffMember = (email) => {
  const member = allStaff.find(m => m.email === email);
  if (!member) return;
  $("staff-email").value = member.email;
  $("staff-name").value = member.name || "";
  $("staff-role").value = member.role || "editor";
  $("staff-verified-check").checked = !!member.verified;
  $("staff-cat-picker-wrap")?.classList.toggle("hidden", member.role === "platform_admin");
  selectedStaffCategories = new Set(member.categories || []);
  renderStaffCategoryPicker();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

safeOn("staff-form", "submit", async (e) => {
  e.preventDefault();
  const email = $("staff-email").value.trim().toLowerCase();
  const role = $("staff-role").value;

  if (SOVEREIGN_ADMINS.includes(email)) {
    showToast("هذا البريد مالك سيادي مطلق ولا يخضع لتقييد الأقسام!", true);
    return;
  }

  if (role !== "platform_admin" && selectedStaffCategories.size === 0) {
    showToast("يرجى النقر على قسم واحد على الأقل لمنحه لهذا المحرر", true);
    return;
  }

  const ok = await askSmartConfirm("اعتماد صلاحية العضو", `هل تريد حفظ صلاحيات (${email}) في فريق الشبكة؟`, "person_add");
  if (!ok) return;

  await withSmartButtonLock($("save-staff-btn"), async () => {
    const catsArray = role === "platform_admin" ? allCategories.map(c => c.slug) : Array.from(selectedStaffCategories);
    const isVer = $("staff-verified-check").checked;

    await setDoc(doc(db, "staff", email), {
      name: $("staff-name").value.trim(),
      displayName: $("staff-name").value.trim(),
      role: role,
      categories: catsArray,
      verified: isVer,
      kycStatus: isVer ? "approved" : "none",
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    $("staff-form").reset();
    selectedStaffCategories.clear();
    renderStaffCategoryPicker();
    showToast("تم اعتماد وحفظ صلاحيات العضو بنجاح ✓");
    await loadStaff();
  }, "جاري الحفظ...");
});

window.removeStaff = async (email, btnEl) => {
  if (SOVEREIGN_ADMINS.includes(email.toLowerCase())) return;
  const ok = await askSmartConfirm("سحب صلاحية العضو", `هل أنت متأكد من سحب الصلاحية نهائياً من (${email})؟`, "person_remove");
  if (!ok) return;

  await withSmartButtonLock(btnEl, async () => {
    await deleteDoc(doc(db, "staff", email));
    showToast("تم سحب الصلاحية");
    await loadStaff();
  });
};

// 13. إدارة الإعدادات السيادية، صورة معاينة واتساب (OG Image)، ومفاتيح النظام (SaaS Keys)
safeOn("upload-logo-btn", "click", () => $("logo-file-picker")?.click());
safeOn("logo-file-picker", "change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showToast("جاري رفع الشعار المفرغ الجديد...");
  try {
    const url = await uploadToImgBB(file, 900);
    $("set-logo-url").value = url;
    showToast("تم رفع الشعار! اضغط حفظ الإعدادات بالأسفل لاعتماده.");
  } catch (err) {
    showToast("فشل رفع الشعار: " + err.message, true);
  }
});

safeOn("upload-favicon-btn", "click", () => $("favicon-file-picker")?.click());
safeOn("favicon-file-picker", "change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showToast("جاري رفع أيقونة البحث الجديدة...");
  try {
    const url = await uploadToImgBB(file, 256);
    $("set-favicon-url").value = url;
    showToast("تم رفع الأيقونة! اضغط حفظ الإعدادات لاعتمادها.");
  } catch (err) {
    showToast("فشل رفع الأيقونة: " + err.message, true);
  }
});

// رفع صورة المعاينة المستقلة لواتساب ومنصات التواصل (Open Graph Image)
safeOn("upload-og-btn", "click", () => $("og-file-picker")?.click());
safeOn("og-file-picker", "change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showToast("جاري رفع صورة غلاف المعاينة (Open Graph)...");
  try {
    const url = await uploadToImgBB(file, 1200);
    $("set-og-image-url").value = url;
    showToast("تم رفع صورة المعاينة! اضغط حفظ الإعدادات بالأسفل لاعتمادها.");
  } catch (err) {
    showToast("فشل رفع صورة المعاينة: " + err.message, true);
  }
});

// مولّد كود قاعدة بيانات Firebase (لنقل أو بيع النظام بسهولة)
safeOn("generate-firebase-snippet-btn", "click", async () => {
  const raw = ($("set-firebase-json")?.value || "").trim();
  if (!raw) {
    const currentStr = JSON.stringify(getActiveFirebaseConfig(), null, 2);
    $("set-firebase-json").value = currentStr;
    showToast("تم عرض كود قاعدة البيانات الحالية — يمكنك تعديله أو نسخه");
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.apiKey || !parsed.projectId) throw new Error("تأكد من وجود apiKey و projectId");
    localStorage.setItem("bosla_custom_firebase_config", JSON.stringify(parsed));
    const snippet = `const firebaseConfig = ${JSON.stringify(parsed, null, 2)};`;
    await navigator.clipboard.writeText(snippet);
    showToast("تم تفعيل وحفظ كود قاعدة البيانات ونسخه للحافظة بنجاح!");
  } catch (err) {
    showToast("صيغة JSON غير صحيحة: " + err.message, true);
  }
});

safeOn("seed-legal-pages-btn", "click", () => {
  const siteAr = $("set-site-name").value.trim() || "بوصلة السياسة اليمنية";
  const netAr = $("set-network-name").value.trim() || "شبكة البوصلة";
  const siteEn = $("set-site-name-en").value.trim() || "Yemeni Politics Compass";

  $("set-about-content").value = [
    `## من نحن — ${siteAr}`,
    `${siteAr} هي منصة إخبارية وتحليلية مستقلة تعمل ضمن "${netAr}"، تأسست لتقديم قراءة معمقة وموثوقة للأحداث السياسية، الاقتصادية، التقنية، والثقافية في اليمن والمنطقة والعالم.`,
    `## رؤيتنا ورسالتنا التحريرية`,
    `نؤمن في ${netAr} بأن الصحافة الرصينة هي بوصلة الوعي، ونلتزم بأعلى معايير الدقة المهنية، التحقق من المصادر، وفصل الخبر عن الرأي، مع توفير مساحة حرة للتحليلات الاستراتيجية والحوارات البناءة.`
  ].join("\n\n");

  $("set-about-content-en").value = [
    `## About ${siteEn}`,
    `${siteEn} is an independent news and analytical platform operating under Al-Bosla Media Network, dedicated to delivering in-depth coverage of Yemeni, regional, and international politics, technology, and culture.`
  ].join("\n\n");

  $("set-privacy-content").value = [
    `## سياسة الخصوصية وحماية البيانات`,
    `تحترم منصة "${siteAr}" (${netAr}) خصوصية جميع زوارها وتلتزم بحماية بياناتهم وفق المعايير الدولية لخصوصية الاستخدام على شبكة الإنترنت.`,
    `## ملفات تعريف الارتباط (Cookies) وإعلانات Google AdSense`,
    `يستخدم موقعنا ملفات تعريف الارتباط لتحسين تجربة التصفح وحفظ تفضيلات القارئ. كما قد نستخدم خدمات إعلانية لطرف ثالث مثل (Google AdSense) لعرض إعلانات ملائمة لاهتمامات الزائر.`
  ].join("\n\n");

  showToast("تم توليد صياغة احترافية لصفحتي من نحن وسياسة الخصوصية!");
});

async function loadGlobalSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) {
      const data = snap.data();
      globalSettings = {
        ...globalSettings,
        ...data,
        logoUrl: data.logoUrl || DEFAULT_LOGO,
        faviconUrl: data.faviconUrl || DEFAULT_FAVICON,
        ogImageUrl: data.ogImageUrl || data.faviconUrl || DEFAULT_FAVICON,
        imgbbApiKey: data.imgbbApiKey || DEFAULT_IMGBB_KEY
      };
    }
    applySettingsToUI();
  } catch (err) {
    applySettingsToUI();
  }
}

function applySettingsToUI() {
  const activeLogo = globalSettings.logoUrl || DEFAULT_LOGO;
  const activeFavicon = globalSettings.faviconUrl || DEFAULT_FAVICON;

  if ($("header-logo-img")) $("header-logo-img").src = activeLogo;
  if ($("login-logo-img")) $("login-logo-img").src = activeLogo;
  if ($("admin-footer-logo")) $("admin-footer-logo").src = activeLogo;

  if ($("dynamic-favicon")) $("dynamic-favicon").href = activeFavicon;
  if ($("apple-favicon")) $("apple-favicon").href = activeFavicon;

  if ($("header-network-name")) $("header-network-name").textContent = globalSettings.siteName || "بوصلة السياسة اليمنية";
  if ($("admin-footer-name")) $("admin-footer-name").textContent = `غرفة العمليات المركزية — ${globalSettings.networkName || "شبكة البوصلة"}`;
  document.documentElement.style.setProperty("--accent", globalSettings.accentColor || "#3b82f6");

  if (currentRole !== "super_admin") return;

  $("set-site-name").value = globalSettings.siteName || "";
  $("set-site-name-en").value = globalSettings.siteNameEn || "Yemeni Politics Compass";
  $("set-network-name").value = globalSettings.networkName || "";
  $("set-network-name-en").value = globalSettings.networkNameEn || "Al-Bosla Network";
  $("set-logo-url").value = activeLogo;
  $("set-favicon-url").value = activeFavicon;
  $("set-og-image-url").value = globalSettings.ogImageUrl || activeFavicon;
  $("set-hide-text-logo").checked = globalSettings.hideTextLogo !== false;
  $("set-site-desc").value = globalSettings.siteDesc || "";
  $("set-public-url").value = globalSettings.publicUrl || "";
  $("set-accent-color").value = globalSettings.accentColor || "#3b82f6";

  $("set-imgbb-key").value = globalSettings.imgbbApiKey || DEFAULT_IMGBB_KEY;
  $("set-translate-provider").value = globalSettings.translateProvider || "auto_free";
  $("set-translate-api-key").value = globalSettings.translateApiKey || "";
  $("set-firebase-json").value = globalSettings.firebaseCustomJson || JSON.stringify(getActiveFirebaseConfig(), null, 2);

  $("set-show-about-menu").checked = globalSettings.showAboutMenu !== false;
  $("set-about-content").value = globalSettings.aboutContent || "";
  $("set-about-content-en").value = globalSettings.aboutContentEn || "";
  $("set-privacy-content").value = globalSettings.privacyContent || "";
  $("set-contact-email").value = globalSettings.contactEmail || "";
  $("set-contact-phone").value = globalSettings.contactPhone || "";

  $("set-ads-enabled").checked = !!globalSettings.adsEnabled;
  $("set-adsense-id").value = globalSettings.adsenseId || "";
  $("set-ad-slot").value = globalSettings.adSlot || "";
  $("set-custom-ad-text").value = globalSettings.customAdText || "";
  $("set-custom-ad-link").value = globalSettings.customAdLink || "";

  $("set-social-whatsapp").value = globalSettings.socialWhatsapp || "";
  $("set-social-facebook").value = globalSettings.socialFacebook || "";
  $("set-social-x").value = globalSettings.socialX || "";
  $("set-social-telegram").value = globalSettings.socialTelegram || "";

  $("set-auto-tg-enabled").checked = !!globalSettings.autoTgEnabled;
  $("set-tg-bot-token").value = globalSettings.tgBotToken || "";
  $("set-tg-chat-id").value = globalSettings.tgChatId || "";

  $("set-auto-fb-enabled").checked = !!globalSettings.autoFbEnabled;
  $("set-fb-page-id").value = globalSettings.fbPageId || "";
  $("set-fb-access-token").value = globalSettings.fbAccessToken || "";

  $("set-auto-x-enabled").checked = !!globalSettings.autoXEnabled;
  $("set-x-api-key").value = globalSettings.xApiKey || "";
  $("set-x-webhook-url").value = globalSettings.xWebhookUrl || "";
}

safeOn("settings-form", "submit", async (e) => {
  e.preventDefault();
  if (currentRole !== "super_admin") {
    showToast("عذراً، الإعدادات السيادية محصورة بمالكي الشبكة فقط!", true);
    return;
  }

  const ok = await askSmartConfirm(
    "حفظ الإعدادات والمفاتيح السيادية",
    "هل أنت متأكد من حفظ وتعميم هذه الإعدادات والمفاتيح على الموقع العام وغرفة العمليات؟",
    "tune"
  );
  if (!ok) return;

  await withSmartButtonLock($("save-settings-btn"), async () => {
    const updated = {
      siteName: $("set-site-name").value.trim(),
      siteNameEn: $("set-site-name-en").value.trim(),
      networkName: $("set-network-name").value.trim(),
      networkNameEn: $("set-network-name-en").value.trim(),
      logoUrl: $("set-logo-url").value.trim() || DEFAULT_LOGO,
      faviconUrl: $("set-favicon-url").value.trim() || DEFAULT_FAVICON,
      ogImageUrl: $("set-og-image-url").value.trim() || $("set-favicon-url").value.trim() || DEFAULT_FAVICON,
      hideTextLogo: $("set-hide-text-logo").checked,
      siteDesc: $("set-site-desc").value.trim(),
      publicUrl: $("set-public-url").value.trim(),
      accentColor: $("set-accent-color").value,
      imgbbApiKey: $("set-imgbb-key").value.trim() || DEFAULT_IMGBB_KEY,
      translateProvider: $("set-translate-provider").value,
      translateApiKey: $("set-translate-api-key").value.trim(),
      firebaseCustomJson: $("set-firebase-json").value.trim(),
      showAboutMenu: $("set-show-about-menu").checked,
      aboutContent: $("set-about-content").value.trim(),
      aboutContentEn: $("set-about-content-en").value.trim(),
      privacyContent: $("set-privacy-content").value.trim(),
      contactEmail: $("set-contact-email").value.trim(),
      contactPhone: $("set-contact-phone").value.trim(),
      adsEnabled: $("set-ads-enabled").checked,
      adsenseId: $("set-adsense-id").value.trim(),
      adSlot: $("set-ad-slot").value.trim(),
      customAdText: $("set-custom-ad-text").value.trim(),
      customAdLink: $("set-custom-ad-link").value.trim(),
      socialWhatsapp: $("set-social-whatsapp").value.trim(),
      socialFacebook: $("set-social-facebook").value.trim(),
      socialX: $("set-social-x").value.trim(),
      socialTelegram: $("set-social-telegram").value.trim(),
      autoTgEnabled: $("set-auto-tg-enabled").checked,
      tgBotToken: $("set-tg-bot-token").value.trim(),
      tgChatId: $("set-tg-chat-id").value.trim(),
      autoFbEnabled: $("set-auto-fb-enabled").checked,
      fbPageId: $("set-fb-page-id").value.trim(),
      fbAccessToken: $("set-fb-access-token").value.trim(),
      autoXEnabled: $("set-auto-x-enabled").checked,
      xApiKey: $("set-x-api-key").value.trim(),
      xWebhookUrl: $("set-x-webhook-url").value.trim(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, "settings", "global"), updated);
      globalSettings = updated;
      applySettingsToUI();
      showToast("تم حفظ الهوية والمفاتيح والصفحات وتعميمها بنجاح ✓");
    } catch (err) {
      showToast("خطأ في حفظ الإعدادات: " + err.message, true);
    }
  }, "جاري حفظ الإعدادات...");
});

// 14. محرك النشر التلقائي للمنصات
async function triggerAutoSocialPublish(post) {
  const articleUrl = `${(globalSettings.publicUrl || "").replace(/\/$/, "")}/?post=${post.id}`;
  const text = `🧭 ${globalSettings.siteName}\n📌 ${post.title}\n\n${post.summary}\n\n🔗 ${articleUrl}`;

  if (globalSettings.autoTgEnabled && globalSettings.tgBotToken && globalSettings.tgChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${globalSettings.tgBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: globalSettings.tgChatId, text })
      });
    } catch (e) {}
  }

  if (globalSettings.autoFbEnabled && globalSettings.fbPageId && globalSettings.fbAccessToken) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${globalSettings.fbPageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, link: articleUrl, access_token: globalSettings.fbAccessToken })
      });
    } catch (e) {}
  }

  if (globalSettings.autoXEnabled && globalSettings.xWebhookUrl) {
    try {
      await fetch(globalSettings.xWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: post.title, summary: post.summary, url: articleUrl })
      });
    } catch (e) {}
  }
}
