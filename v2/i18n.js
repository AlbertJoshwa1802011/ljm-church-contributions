// Centralized i18n for the milestone-v2 flow (English + Tamil).
// See docs/milestone-v2/01-PRD.md §7.13 — one dictionary, one t() helper, one
// persisted language choice, instead of scattered `if (language === "ta")`
// checks across every page. Load this before any page-specific <script>.
//
// Static UI strings: tag an element `data-i18n="key"` (textContent) or
// `data-i18n-placeholder="key"` (input placeholder); this file fills them in
// on load and again whenever the language changes.
// Dynamic CMS content (promises/testimonies/etc., which carry *_en/*_ta
// columns from the API) should call LJM_I18N.pick(enText, taText) directly.
(function (global) {
  "use strict";
  var STORAGE_KEY = "ljmLang";
  var DEFAULT_LANG = "en";

  var DICT = {
    en: {
      nav_home: "Home", nav_about: "About", nav_watch: "Watch & Listen", nav_events: "Events",
      nav_blog: "Blog", nav_giving: "Our Giving", nav_promises: "Promises", nav_testimonies: "Testimonies",
      nav_pray: "Pray", nav_contact: "Contact",
      btn_give: "Give", btn_give_today: "Give Today", btn_pray: "Pray", btn_contact: "Contact",
      btn_plan_visit: "Plan a Visit", btn_submit: "Submit", btn_send: "Send message",
      btn_share_testimony: "Share your testimony",
      lang_toggle_label: "தமிழ்",

      home_eyebrow: "✦ Light of Jesus Ministry",
      home_h1_1: "Light for the world,", home_h1_em: "hope", home_h1_2: "for today.",
      home_lede: "Two churches, one family — Church of Light and City Worship Center. Wherever you're joining from, you're welcome at the table.",
      home_todays_promise: "Today's Promise",
      action_give_title: "Give", action_give_body: "Support the ministry, a fund, or a cause close to your heart — from anywhere in the world.",
      action_pray_title: "Pray", action_pray_body: "Send a prayer request, ask for a callback, or reach our prayer team directly.",
      action_connect_title: "Connect", action_connect_body: "Visit a service, join a program, or get in touch with our team.",
      go_give: "Give now →", go_pray: "Request prayer →", go_connect: "Get in touch →",
      testimony_eyebrow: "A Story of Faith", testimony_teaser_heading: "What God has been doing",
      testimony_teaser_cta: "Read more testimonies →",

      promises_h1: "Promises", promises_lede: "Today's word, this month's, and this year's — carried by faith, one day at a time.",
      promises_today: "Today", promises_month: "This Month", promises_year: "This Year", promises_browse: "Past Promises",

      testimonies_h1: "Testimonies & Miracles", testimonies_lede: "Real stories from real lives — what God has done for this ministry family.",
      testimonies_filter_all: "All", testimonies_filter_testimony: "Testimonies", testimonies_filter_miracle: "Miracles",
      testimonies_empty: "No testimonies published yet — check back soon.",
      testimony_form_heading: "Share your story", testimony_form_lede: "Your submission is reviewed by our team before it appears publicly.",
      field_title: "Title", field_story: "Your story", field_name_optional: "Your name (optional)", field_place: "Place (optional)",
      field_kind: "Type",

      pray_h1: "Pray", pray_lede: "Send a prayer request — our prayer team stands with you, in confidence.",
      field_request: "Your prayer request", field_wants_callback: "I'd like a callback",
      pray_thankyou: "Your prayer request has been received. Our team is praying with you.",

      contact_h1: "Contact", contact_lede: "Reach our team — we'll respond as soon as we can.",
      field_name: "Name", field_email: "Email", field_subject: "Subject", field_message: "Message",
      contact_thankyou: "Your message has been sent. We'll be in touch soon.",

      field_required: "required"
    },
    ta: {
      nav_home: "முகப்பு", nav_about: "எங்களைப் பற்றி", nav_watch: "பார் & கேள்", nav_events: "நிகழ்வுகள்",
      nav_blog: "வலைப்பதிவு", nav_giving: "எங்கள் காணிக்கை", nav_promises: "வாக்குத்தத்தங்கள்", nav_testimonies: "சாட்சிகள்",
      nav_pray: "ஜெபம்", nav_contact: "தொடர்பு",
      btn_give: "காணிக்கை", btn_give_today: "இன்று கொடுங்கள்", btn_pray: "ஜெபிக்க", btn_contact: "தொடர்பு",
      btn_plan_visit: "வருகை திட்டமிடுங்கள்", btn_submit: "சமர்ப்பிக்க", btn_send: "செய்தி அனுப்பு",
      btn_share_testimony: "உங்கள் சாட்சியை பகிரவும்",
      lang_toggle_label: "English",

      home_eyebrow: "✦ லைட் ஆஃப் ஜீசஸ் மினிஸ்ட்ரி",
      home_h1_1: "உலகிற்கு ஒளி,", home_h1_em: "நம்பிக்கை", home_h1_2: "இன்றைக்கு.",
      home_lede: "இரண்டு தேவாலயங்கள், ஒரே குடும்பம் — சர்ச் ஆஃப் லைட் மற்றும் சிட்டி வொர்ஷிப் சென்டர். நீங்கள் எங்கிருந்தாலும், இங்கு வரவேற்கப்படுகிறீர்கள்.",
      home_todays_promise: "இன்றைய வாக்குத்தத்தம்",
      action_give_title: "காணிக்கை", action_give_body: "உலகின் எந்த மூலையிலிருந்தும் — ஊழியத்திற்கோ, ஒரு நிதிக்கோ, உங்கள் இதயத்திற்கு நெருக்கமான காரணத்திற்கோ ஆதரவளியுங்கள்.",
      action_pray_title: "ஜெபம்", action_pray_body: "ஒரு ஜெப வேண்டுகோளை அனுப்பவும், அல்லது எங்கள் ஜெப குழுவை நேரடியாக அணுகவும்.",
      action_connect_title: "தொடர்பு", action_connect_body: "ஒரு ஆராதனையில் பங்கேற்கவும், ஒரு நிகழ்ச்சியில் சேரவும், அல்லது எங்கள் குழுவை தொடர்பு கொள்ளவும்.",
      go_give: "இப்போது கொடுங்கள் →", go_pray: "ஜெபம் கேளுங்கள் →", go_connect: "தொடர்பு கொள்ளுங்கள் →",
      testimony_eyebrow: "விசுவாசத்தின் கதை", testimony_teaser_heading: "தேவன் செய்து வருவது",
      testimony_teaser_cta: "மேலும் சாட்சிகளைப் படிக்க →",

      promises_h1: "வாக்குத்தத்தங்கள்", promises_lede: "இன்றைய வார்த்தை, இந்த மாதம், இந்த ஆண்டு — ஒவ்வொரு நாளும் விசுவாசத்துடன்.",
      promises_today: "இன்று", promises_month: "இந்த மாதம்", promises_year: "இந்த ஆண்டு", promises_browse: "முந்தைய வாக்குத்தத்தங்கள்",

      testimonies_h1: "சாட்சிகள் & அற்புதங்கள்", testimonies_lede: "உண்மையான வாழ்க்கைகளிலிருந்து உண்மையான கதைகள் — இந்த ஊழிய குடும்பத்திற்காக தேவன் செய்தது.",
      testimonies_filter_all: "அனைத்தும்", testimonies_filter_testimony: "சாட்சிகள்", testimonies_filter_miracle: "அற்புதங்கள்",
      testimonies_empty: "இன்னும் சாட்சிகள் வெளியிடப்படவில்லை — விரைவில் மீண்டும் பாருங்கள்.",
      testimony_form_heading: "உங்கள் கதையைப் பகிரவும்", testimony_form_lede: "பொதுவில் தோன்றுவதற்கு முன் உங்கள் சமர்ப்பிப்பு எங்கள் குழுவால் மதிப்பாய்வு செய்யப்படும்.",
      field_title: "தலைப்பு", field_story: "உங்கள் கதை", field_name_optional: "உங்கள் பெயர் (விருப்பம்)", field_place: "இடம் (விருப்பம்)",
      field_kind: "வகை",

      pray_h1: "ஜெபம்", pray_lede: "ஒரு ஜெப வேண்டுகோளை அனுப்பவும் — எங்கள் ஜெப குழு உங்களுடன் நிற்கிறது.",
      field_request: "உங்கள் ஜெப வேண்டுகோள்", field_wants_callback: "எனக்கு அழைப்பு வேண்டும்",
      pray_thankyou: "உங்கள் ஜெப வேண்டுகோள் பெறப்பட்டது. எங்கள் குழு உங்களுடன் ஜெபிக்கிறது.",

      contact_h1: "தொடர்பு", contact_lede: "எங்கள் குழுவை அணுகவும் — கூடிய விரைவில் பதிலளிப்போம்.",
      field_name: "பெயர்", field_email: "மின்னஞ்சல்", field_subject: "பொருள்", field_message: "செய்தி",
      contact_thankyou: "உங்கள் செய்தி அனுப்பப்பட்டது. விரைவில் தொடர்பு கொள்வோம்.",

      field_required: "அவசியம்"
    }
  };

  function getLang() {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG; } catch (_) { return DEFAULT_LANG; }
  }

  function t(key, fallback) {
    var lang = getLang();
    return (DICT[lang] && DICT[lang][key]) || DICT.en[key] || fallback || key;
  }

  // Prefer the Tamil column when the current language is Tamil AND a Tamil
  // value was actually supplied for this row — bilingual coverage is
  // per-item, not all-or-nothing, so this always has a safe fallback.
  function pick(enText, taText) {
    return getLang() === "ta" && taText ? taText : enText;
  }

  function applyTranslations(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    scope.querySelectorAll(".lang-toggle").forEach(function (b) {
      b.textContent = t("lang_toggle_label");
    });
  }

  function setLang(lang) {
    lang = lang === "ta" ? "ta" : "en";
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) { /* private mode, etc. */ }
    document.documentElement.setAttribute("lang", lang);
    applyTranslations();
    document.dispatchEvent(new CustomEvent("ljm:langchange", { detail: { lang: lang } }));
  }

  function initToggle() {
    document.querySelectorAll(".lang-toggle").forEach(function (b) {
      if (b.dataset.i18nBound) return;
      b.dataset.i18nBound = "1";
      b.addEventListener("click", function () { setLang(getLang() === "en" ? "ta" : "en"); });
    });
  }

  function boot() {
    document.documentElement.setAttribute("lang", getLang());
    applyTranslations();
    initToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.LJM_I18N = { t: t, pick: pick, getLang: getLang, setLang: setLang, applyTranslations: applyTranslations, initToggle: initToggle };
})(window);
