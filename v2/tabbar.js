// WhatsApp-style primary tab bar for every v2 page.
// Injects a floating Liquid Glass capsule (Home / Events / Give / Pray / More).
// More toggles the existing hamburger drawer — it does not add new routes.
// Give still goes to /v2/give-flow.html (same Razorpay checkout as before).
(function () {
  if (document.getElementById("tabBar")) return;

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1V10.5Z"/></svg>',
    events: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/></svg>',
    give: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z"/></svg>',
    pray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v7M9 7h6"/><path d="M7 14c0-2 2.2-3.5 5-3.5s5 1.5 5 3.5v6H7v-6Z"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/></svg>'
  };

  function pathTab(pathname) {
    var p = pathname || "";
    if (p === "/" || p === "/index.html" || p === "/v2" || p === "/v2/" || /\/v2\/index\.html$/.test(p)) return "home";
    if (/events\.html/.test(p)) return "events";
    if (/give-flow\.html/.test(p)) return "give";
    if (/prayer\.html/.test(p)) return "pray";
    return "more";
  }

  var current = pathTab(window.location.pathname);
  var nav = document.createElement("nav");
  nav.id = "tabBar";
  nav.className = "tabbar";
  nav.setAttribute("aria-label", "Primary");
  nav.innerHTML =
    '<a class="tabbar-item' + (current === "home" ? " current" : "") + '" href="/" data-tab="home">' + ICONS.home + '<span data-i18n="nav.home">Home</span></a>' +
    '<a class="tabbar-item' + (current === "events" ? " current" : "") + '" href="/v2/events.html" data-tab="events">' + ICONS.events + '<span data-i18n="nav.events">Events</span></a>' +
    '<a class="tabbar-item' + (current === "give" ? " current" : "") + '" href="/v2/give-flow.html" data-tab="give">' + ICONS.give + '<span data-i18n="nav.give">Give</span></a>' +
    '<a class="tabbar-item' + (current === "pray" ? " current" : "") + '" href="/v2/prayer.html" data-tab="pray">' + ICONS.pray + '<span data-i18n="nav.pray">Pray</span></a>' +
    '<button type="button" class="tabbar-item' + (current === "more" ? " current" : "") + '" id="tabbarMore" data-tab="more" aria-label="More" aria-controls="navDrawer" aria-expanded="false">' + ICONS.more + '<span data-i18n="nav.more">More</span></button>';

  document.body.appendChild(nav);
  document.body.classList.add("has-tabbar");

  if (window.LJM_I18N && typeof window.LJM_I18N.applyDom === "function") {
    window.LJM_I18N.applyDom(nav);
  }

  var moreBtn = document.getElementById("tabbarMore");
  var hamburger = document.getElementById("hamburgerBtn");
  var drawer = document.getElementById("navDrawer");
  if (moreBtn && hamburger && drawer) {
    moreBtn.addEventListener("click", function () {
      if (drawer.classList.contains("open")) {
        var closeBtn = document.getElementById("navDrawerClose");
        if (closeBtn) closeBtn.click();
        else hamburger.click();
      } else {
        hamburger.click();
      }
      moreBtn.setAttribute("aria-expanded", drawer.classList.contains("open") ? "true" : "false");
    });
  }
})();
