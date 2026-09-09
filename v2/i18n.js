// Minimal client-side i18n scaffold for the v2 ministry app (PRD §7.13,
// TRD §3: "bilingual DB columns for admin content + a small client-side i18n
// dictionary for static UI labels; toggle stored in localStorage").
//
// Usage:
//   <span data-i18n="nav.home">Home</span>       -- swapped by key on toggle
//   <input data-i18n-placeholder="prayer.namePh">
//   LJM_I18N.lang()               -- 'en' | 'ta'
//   LJM_I18N.bi(row, 'text')      -- picks row.textEn/row.textTa by current lang, falling back to English
//
// This is intentionally small: it covers navigation + the handful of shared
// calls-to-action every v2 page repeats, not a full content translation
// system (Tamil translation of every admin-authored paragraph is an ongoing
// content task, not a code task — see docs/milestone-v2 for scope notes).
(function () {
  var KEY = "ljmLang";
  var DICT = {
    en: {
      "nav.home": "Home", "nav.about": "About", "nav.watch": "Watch & Listen",
      "nav.events": "Events", "nav.programs": "Programs", "nav.blog": "Blog",
      "nav.testimonies": "Testimonies", "nav.ourGiving": "Our Giving",
      "nav.pray": "Pray", "nav.contact": "Contact", "nav.give": "Give",
      "nav.more": "More",
      "cta.give": "Give", "cta.pray": "Pray", "cta.contact": "Contact",
      "cta.submit": "Submit", "cta.readMore": "Read more", "cta.learnMore": "Learn more",
      "cta.viewAll": "View all", "cta.send": "Send",
      "state.loading": "Loading…", "state.empty": "Nothing here yet.",
      "state.error": "Something went wrong — please try again.",
      "footer.tagline": "Giving with faith, transparency & purpose — for Coimbatore, and for the world."
    },
    ta: {
      "nav.home": "முகப்பு", "nav.about": "எங்களைப் பற்றி", "nav.watch": "பார்க்க & கேட்க",
      "nav.events": "நிகழ்வுகள்", "nav.programs": "நிகழ்ச்சிகள்", "nav.blog": "வலைப்பதிவு",
      "nav.testimonies": "சாட்சிகள்", "nav.ourGiving": "எங்கள் காணிக்கை",
      "nav.pray": "ஜெபம்", "nav.contact": "தொடர்பு", "nav.give": "காணிக்கை",
      "nav.more": "மேலும்",
      "cta.give": "காணிக்கை செலுத்த", "cta.pray": "ஜெபத்திற்கு", "cta.contact": "தொடர்பு கொள்ள",
      "cta.submit": "சமர்ப்பிக்க", "cta.readMore": "மேலும் படிக்க", "cta.learnMore": "மேலும் அறிய",
      "cta.viewAll": "அனைத்தையும் காண", "cta.send": "அனுப்பு",
      "state.loading": "ஏற்றுகிறது…", "state.empty": "இதுவரை எதுவும் இல்லை.",
      "state.error": "ஏதோ தவறு நடந்தது — மீண்டும் முயற்சிக்கவும்.",
      "footer.tagline": "விசுவாசம், வெளிப்படைத்தன்மை மற்றும் நோக்கத்துடன் கொடுத்தல் — கோயம்புத்தூருக்கும், உலகிற்கும்."
    }
  };

  function lang() {
    try { return localStorage.getItem(KEY) === "ta" ? "ta" : "en"; } catch (_) { return "en"; }
  }

  function t(key) {
    var d = DICT[lang()] || DICT.en;
    return d[key] || DICT.en[key] || key;
  }

  // Picks the bilingual field for the current language from an API row that
  // follows the *_en/*_ta convention (e.g. bi(promise, 'text') -> textEn/textTa),
  // falling back to English when no Tamil value is set for that row.
  function bi(row, field) {
    if (!row) return "";
    var taKey = field + "Ta", enKey = field + "En";
    if (lang() === "ta" && row[taKey] && String(row[taKey]).trim()) return row[taKey];
    return row[enKey] || "";
  }

  function applyDom(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    (root || document).querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll(".lang-toggle").forEach(function (btn) {
      btn.textContent = lang() === "ta" ? "EN" : "TA";
      btn.setAttribute("aria-label", lang() === "ta" ? "Switch to English" : "தமிழுக்கு மாற்ற");
    });
    document.documentElement.setAttribute("lang", lang() === "ta" ? "ta" : "en");
  }

  function setLang(next) {
    try { localStorage.setItem(KEY, next === "ta" ? "ta" : "en"); } catch (_) {}
    applyDom();
    window.dispatchEvent(new CustomEvent("ljm-lang-changed", { detail: { lang: lang() } }));
  }

  function toggle() { setLang(lang() === "ta" ? "en" : "ta"); }

  document.addEventListener("DOMContentLoaded", function () {
    applyDom();
    document.querySelectorAll(".lang-toggle").forEach(function (btn) {
      btn.addEventListener("click", toggle);
    });
  });

  window.LJM_I18N = { lang: lang, t: t, bi: bi, setLang: setLang, toggle: toggle, applyDom: applyDom };
})();
