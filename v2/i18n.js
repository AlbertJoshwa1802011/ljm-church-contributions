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
      "cta.give": "Give", "cta.pray": "Pray", "cta.contact": "Contact",
      "cta.submit": "Submit", "cta.readMore": "Read more", "cta.learnMore": "Learn more",
      "cta.viewAll": "View all", "cta.send": "Send",
      "state.loading": "Loading…", "state.empty": "Nothing here yet.",
      "state.error": "Something went wrong — please try again.",
      "footer.tagline": "Giving with faith, transparency & purpose — for Coimbatore, and for the world.",

      // Home page (docs/milestone-v2/13-home-experience-rework.md). t() falls
      // back to the raw key, so every data-i18n attribute on a page must have an
      // entry here or the key itself would be rendered to the visitor.
      "home.eyebrow": "\u2726 Light of Jesus Ministry",
      "home.headline": "Light for the world, hope for today.",
      "home.lede": "One ministry, two church homes in Coimbatore. Wherever you are joining from, you are welcome at the table.",
      "home.cta.happening": "See what's happening",
      "home.cta.watch": "Watch a service",
      "home.action.pray.title": "Pray",
      "home.action.pray.body": "Send a prayer request, ask for a callback, or reach our prayer team directly.",
      "home.action.pray.go": "Request prayer \u2192",
      "home.action.visit.title": "Plan a visit",
      "home.action.visit.body": "Find a service time, get directions, or join us online from anywhere.",
      "home.action.visit.go": "See how to visit \u2192",
      "home.action.connect.title": "Connect",
      "home.action.connect.body": "Talk to our team, ask a question, or tell us how we can help.",
      "home.action.connect.go": "Get in touch \u2192",
      "home.happening.eyebrow": "What's Happening",
      "home.happening.title": "Upcoming across the ministry",
      "home.happening.sub": "ஒவ்வொரு அட்டையையும் தட்டினால் முழு அட்டவணை, இடம், ஆன்லைனில் இணையும் வழி ஆகியவை தெரியும்.",
      "home.times.eyebrow": "Service times",
      "home.times.title": "Service times & weekly programs",
      "home.times.sub": "ஒவ்வொரு சபையின் வாராந்திர கூட்டங்கள். ஆன்லைனில் நடைபெறுபவற்றுக்கு இணையும் பொத்தான் உள்ளது.",
      "home.times.all": "See the full schedule \u2192",
      "home.watch.eyebrow": "Watch",
      "home.watch.title": "Live service & recent messages",
      "home.watch.empty": "Livestream links haven't been added yet \u2014 check back soon.",
      "home.give.eyebrow": "Giving",
      "home.give.title": "Give with confidence",
      "home.give.sub": "Every gift is tracked openly. Here is where the Tech Fund stands today \u2014 the full report, including how every rupee was spent, lives on our Giving page.",
      "home.give.cta": "Give Today",
      "home.give.report": "See the full report",
      "home.visit.eyebrow": "Plan a visit",
      "home.visit.title": "Come and worship with us",
      "home.visit.sub": "Both of our churches are in Coimbatore, and everyone is welcome \u2014 whoever you are, and whatever week you have had."
    },
    ta: {
      "nav.home": "முகப்பு", "nav.about": "எங்களைப் பற்றி", "nav.watch": "பார்க்க & கேட்க",
      "nav.events": "நிகழ்வுகள்", "nav.programs": "நிகழ்ச்சிகள்", "nav.blog": "வலைப்பதிவு",
      "nav.testimonies": "சாட்சிகள்", "nav.ourGiving": "எங்கள் காணிக்கை",
      "nav.pray": "ஜெபம்", "nav.contact": "தொடர்பு", "nav.give": "காணிக்கை",
      "cta.give": "காணிக்கை செலுத்த", "cta.pray": "ஜெபத்திற்கு", "cta.contact": "தொடர்பு கொள்ள",
      "cta.submit": "சமர்ப்பிக்க", "cta.readMore": "மேலும் படிக்க", "cta.learnMore": "மேலும் அறிய",
      "cta.viewAll": "அனைத்தையும் காண", "cta.send": "அனுப்பு",
      "state.loading": "ஏற்றுகிறது…", "state.empty": "இதுவரை எதுவும் இல்லை.",
      "state.error": "ஏதோ தவறு நடந்தது — மீண்டும் முயற்சிக்கவும்.",
      "footer.tagline": "\u0bb5\u0bbf\u0bb8\u0bc1\u0bb5\u0bbe\u0b9a\u0bae\u0bcd, \u0bb5\u0bc6\u0bb3\u0bbf\u0baa\u0bcd\u0baa\u0b9f\u0bc8\u0ba4\u0bcd\u0ba4\u0ba9\u0bcd\u0bae\u0bc8 \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0ba8\u0bcb\u0b95\u0bcd\u0b95\u0ba4\u0bcd\u0ba4\u0bc1\u0b9f\u0ba9\u0bcd \u0b95\u0bca\u0b9f\u0bc1\u0ba4\u0bcd\u0ba4\u0bb2\u0bcd \u2014 \u0b95\u0bcb\u0baf\u0bae\u0bcd\u0baa\u0bc1\u0ba4\u0bcd\u0ba4\u0bc2\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd, \u0b89\u0bb2\u0b95\u0bbf\u0bb1\u0bcd\u0b95\u0bc1\u0bae\u0bcd.",

      "home.eyebrow": "\u2726 \u0b87\u0baf\u0bc7\u0b9a\u0bc1\u0bb5\u0bbf\u0ba9\u0bcd \u0b92\u0bb3\u0bbf \u0b9a\u0bc7\u0bb5\u0bc8",
      "home.headline": "\u0b89\u0bb2\u0b95\u0bbf\u0bb1\u0bcd\u0b95\u0bc1 \u0b92\u0bb3\u0bbf, \u0b87\u0ba9\u0bcd\u0bb1\u0bc1 \u0ba8\u0bae\u0bcd\u0baa\u0bbf\u0b95\u0bcd\u0b95\u0bc8.",
      "home.lede": "\u0b92\u0bb0\u0bc7 \u0b9a\u0bc7\u0bb5\u0bc8, \u0b95\u0bcb\u0baf\u0bae\u0bcd\u0baa\u0bc1\u0ba4\u0bcd\u0ba4\u0bc2\u0bb0\u0bbf\u0bb2\u0bcd \u0b87\u0bb0\u0ba3\u0bcd\u0b9f\u0bc1 \u0b9a\u0baa\u0bc8\u0b95\u0bb3\u0bcd. \u0ba8\u0bc0\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u0b8e\u0b99\u0bcd\u0b95\u0bbf\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bbe\u0bb2\u0bc1\u0bae\u0bcd \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bc1\u0b95\u0bcd\u0b95\u0bc1 \u0b87\u0b99\u0bcd\u0b95\u0bc7 \u0bb5\u0bb0\u0bb5\u0bc7\u0bb1\u0bcd\u0baa\u0bc1.",
      "home.cta.happening": "\u0ba8\u0b9f\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd \u0ba8\u0bbf\u0b95\u0bb4\u0bcd\u0bb5\u0bc1\u0b95\u0bb3\u0bcd",
      "home.cta.watch": "\u0b86\u0bb0\u0bbe\u0ba4\u0ba9\u0bc8\u0baf\u0bc8\u0baa\u0bcd \u0baa\u0bbe\u0bb0\u0bcd\u0b95\u0bcd\u0b95",
      "home.action.pray.title": "\u0b9c\u0bc6\u0baa\u0bae\u0bcd",
      "home.action.pray.body": "\u0b9c\u0bc6\u0baa \u0bb5\u0bbf\u0ba3\u0bcd\u0ba3\u0baa\u0bcd\u0baa\u0bae\u0bcd \u0b85\u0ba9\u0bcd\u0baa\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u2014 \u0ba8\u0bae\u0ba4\u0bc1 \u0b9c\u0bc6\u0baa \u0b95\u0bc1\u0bb4\u0bc1 \u0b89\u0b99\u0bcd\u0b95\u0bb3\u0bc1\u0b95\u0bcd\u0b95\u0bbe\u0b95 \u0b9c\u0bc6\u0baa\u0bbf\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd.",
      "home.action.pray.go": "\u0b9c\u0bc6\u0baa\u0ba4\u0bcd\u0ba4\u0bbf\u0bb1\u0bcd\u0b95\u0bc1 \u2192",
      "home.action.visit.title": "\u0bb5\u0bb0\u0bc1\u0b95\u0bc8 \u0ba4\u0bbf\u0b9f\u0bcd\u0b9f\u0bae\u0bbf\u0b9f",
      "home.action.visit.body": "\u0b86\u0bb0\u0bbe\u0ba4\u0ba9\u0bc8 \u0ba8\u0bc7\u0bb0\u0bae\u0bcd, \u0bb5\u0bb4\u0bbf\u0ba4\u0bcd\u0ba4\u0b9f\u0bae\u0bcd, \u0b85\u0bb2\u0bcd\u0bb2\u0ba4\u0bc1 \u0b86\u0ba9\u0bcd\u0bb2\u0bc8\u0ba9\u0bbf\u0bb2\u0bcd \u0b87\u0ba3\u0bc8\u0baf \u0bb5\u0bbf\u0bb5\u0bb0\u0b99\u0bcd\u0b95\u0bb3\u0bcd.",
      "home.action.visit.go": "\u0bb5\u0bbf\u0bb5\u0bb0\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u2192",
      "home.action.connect.title": "\u0ba4\u0bca\u0b9f\u0bb0\u0bcd\u0baa\u0bc1",
      "home.action.connect.body": "\u0ba8\u0bae\u0ba4\u0bc1 \u0b95\u0bc1\u0bb4\u0bc1\u0bb5\u0bc1\u0b9f\u0ba9\u0bcd \u0baa\u0bc7\u0b9a\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd \u2014 \u0b8e\u0ba8\u0bcd\u0ba4 \u0b95\u0bc7\u0bb3\u0bcd\u0bb5\u0bbf\u0baf\u0bbe\u0b95 \u0b87\u0bb0\u0bc1\u0ba8\u0bcd\u0ba4\u0bbe\u0bb2\u0bc1\u0bae\u0bcd.",
      "home.action.connect.go": "\u0ba4\u0bca\u0b9f\u0bb0\u0bcd\u0baa\u0bc1 \u0b95\u0bca\u0bb3\u0bcd\u0bb3 \u2192",
      "home.happening.eyebrow": "\u0ba8\u0b9f\u0baa\u0bcd\u0baa\u0bb5\u0bc8",
      "home.happening.title": "\u0bb5\u0bb0\u0bb5\u0bbf\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd \u0ba8\u0bbf\u0b95\u0bb4\u0bcd\u0bb5\u0bc1\u0b95\u0bb3\u0bcd",
      "home.happening.sub": "ஒவ்வொரு அட்டையையும் தட்டினால் முழு அட்டவணை, இடம், ஆன்லைனில் இணையும் வழி ஆகியவை தெரியும்.",
      "home.times.eyebrow": "\u0b86\u0bb0\u0bbe\u0ba4\u0ba9\u0bc8 \u0ba8\u0bc7\u0bb0\u0bae\u0bcd",
      "home.times.title": "\u0b86\u0bb0\u0bbe\u0ba4\u0ba9\u0bc8 \u0ba8\u0bc7\u0bb0\u0bae\u0bcd \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0bb5\u0bbe\u0bb0\u0bbe\u0ba8\u0bcd\u0ba4\u0bbf\u0bb0 \u0ba8\u0bbf\u0b95\u0bb4\u0bcd\u0b9a\u0bcd\u0b9a\u0bbf\u0b95\u0bb3\u0bcd",
      "home.times.sub": "ஒவ்வொரு சபையின் வாராந்திர கூட்டங்கள். ஆன்லைனில் நடைபெறுபவற்றுக்கு இணையும் பொத்தான் உள்ளது.",
      "home.times.all": "\u0bae\u0bc1\u0bb4\u0bc1 \u0b85\u0b9f\u0bcd\u0b9f\u0bb5\u0ba3\u0bc8 \u2192",
      "home.watch.eyebrow": "\u0baa\u0bbe\u0bb0\u0bcd\u0b95\u0bcd\u0b95",
      "home.watch.title": "\u0ba8\u0bc7\u0bb0\u0bb2\u0bc8 \u0b86\u0bb0\u0bbe\u0ba4\u0ba9\u0bc8 \u0bae\u0bb1\u0bcd\u0bb1\u0bc1\u0bae\u0bcd \u0b9a\u0bae\u0bc0\u0baa\u0ba4\u0bcd\u0ba4\u0bbf\u0baf \u0b9a\u0bc6\u0baf\u0bcd\u0ba4\u0bbf\u0b95\u0bb3\u0bcd",
      "home.watch.empty": "\u0ba8\u0bc7\u0bb0\u0bb2\u0bc8 \u0b87\u0ba3\u0bc8\u0baa\u0bcd\u0baa\u0bc1\u0b95\u0bb3\u0bcd \u0b87\u0ba9\u0bcd\u0ba9\u0bc1\u0bae\u0bcd \u0b9a\u0bc7\u0bb0\u0bcd\u0b95\u0bcd\u0b95\u0baa\u0bcd\u0baa\u0b9f\u0bb5\u0bbf\u0bb2\u0bcd\u0bb2\u0bc8.",
      "home.give.eyebrow": "\u0b95\u0bbe\u0ba3\u0bbf\u0b95\u0bcd\u0b95\u0bc8",
      "home.give.title": "\u0ba8\u0bae\u0bcd\u0baa\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bc1\u0b9f\u0ba9\u0bcd \u0b95\u0bca\u0b9f\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd",
      "home.give.sub": "\u0b92\u0bb5\u0bcd\u0bb5\u0bca\u0bb0\u0bc1 \u0b95\u0bbe\u0ba3\u0bbf\u0b95\u0bcd\u0b95\u0bc8\u0baf\u0bc1\u0bae\u0bcd \u0bb5\u0bc6\u0bb3\u0bbf\u0baa\u0bcd\u0baa\u0b9f\u0bc8\u0baf\u0bbe\u0b95\u0baa\u0bcd \u0baa\u0ba4\u0bbf\u0bb5\u0bc1 \u0b9a\u0bc6\u0baf\u0bcd\u0baf\u0baa\u0bcd\u0baa\u0b9f\u0bc1\u0b95\u0bbf\u0bb1\u0ba4\u0bc1.",
      "home.give.cta": "\u0b87\u0ba9\u0bcd\u0bb1\u0bc1 \u0b95\u0bca\u0b9f\u0bc1\u0b95\u0bcd\u0b95",
      "home.give.report": "\u0bae\u0bc1\u0bb4\u0bc1 \u0b85\u0bb1\u0bbf\u0b95\u0bcd\u0b95\u0bc8",
      "home.visit.eyebrow": "\u0bb5\u0bb0\u0bc1\u0b95\u0bc8 \u0ba4\u0bbf\u0b9f\u0bcd\u0b9f\u0bae\u0bbf\u0b9f",
      "home.visit.title": "\u0ba8\u0bae\u0bcd\u0bae\u0bc1\u0b9f\u0ba9\u0bcd \u0b86\u0bb0\u0bbe\u0ba4\u0bbf\u0b95\u0bcd\u0b95 \u0bb5\u0bbe\u0bb0\u0bc1\u0b99\u0bcd\u0b95\u0bb3\u0bcd",
      "home.visit.sub": "\u0ba8\u0bae\u0ba4\u0bc1 \u0b87\u0bb0\u0ba3\u0bcd\u0b9f\u0bc1 \u0b9a\u0baa\u0bc8\u0b95\u0bb3\u0bc1\u0bae\u0bcd \u0b95\u0bcb\u0baf\u0bae\u0bcd\u0baa\u0bc1\u0ba4\u0bcd\u0ba4\u0bc2\u0bb0\u0bbf\u0bb2\u0bcd \u0b89\u0bb3\u0bcd\u0bb3\u0ba9. \u0b85\u0ba9\u0bc8\u0bb5\u0bb0\u0bc1\u0b95\u0bcd\u0b95\u0bc1\u0bae\u0bcd \u0bb5\u0bb0\u0bb5\u0bc7\u0bb1\u0bcd\u0baa\u0bc1."
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
