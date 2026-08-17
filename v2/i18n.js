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
      "nav.events": "Events", "nav.programs": "Programs", "nav.youth": "Youth", "nav.blog": "Blog",
      "nav.testimonies": "Testimonies", "nav.ourGiving": "Our Giving",
      "nav.pray": "Pray", "nav.contact": "Contact", "nav.give": "Give",
      "cta.give": "Give", "cta.pray": "Pray", "cta.contact": "Contact",
      "cta.submit": "Submit", "cta.readMore": "Read more", "cta.learnMore": "Learn more",
      "cta.viewAll": "View all", "cta.send": "Send",
      "cta.joinOnline": "Join Online", "cta.viewAllPrograms": "View all programs",
      "cta.submitPrayerRequest": "Submit prayer request",
      "state.loading": "Loading…", "state.empty": "Nothing here yet.",
      "state.error": "Something went wrong — please try again.",
      "footer.tagline": "Giving with faith, transparency & purpose — for Coimbatore, and for the world.",
      "programs.onlineViaMeet": "Online via Google Meet",
      "prayer.joinUsHeading": "Join Us in Prayer",
      "prayer.joinUsSub": "Scheduled prayer gatherings you can join — online or in person.",
      "prayer.needPrayer": "Need prayer? Share your request with us.",
      "home.scheduleEyebrow": "Prayer & Weekly Schedule",
      "home.scheduleHeading": "Join us in prayer and worship",
      "home.scheduleSub": "Daily prayer, Sunday services, and monthly gatherings — online or in person.",

      "footer.churchOfLight": "Church of Light",
      "footer.motherChurch": "Mother Church",
      "footer.cityWorshipCenter": "City Worship Center",
      "footer.coimbatoreTN": "Coimbatore, Tamil Nadu",
      "footer.explore": "Explore",
      "footer.quickLinks": "Quick Links",
      "footer.aboutChurches": "About & Churches",
      "footer.copyright": "© 2026 Light of Jesus Ministry",
      "footer.copyrightLedger": "© 2026 Light of Jesus Ministry — figures pulled live from the ledger.",
      "footer.backToHome": "← Back to Home",

      "home.heroTitleLine1": "Light for the world,",
      "home.heroTitleEm": "hope",
      "home.heroTitleRest": "for today.",
      "home.heroLede": "Two churches, one family — Church of Light and City Worship Center. Wherever you're joining from, you're welcome at the table.",
      "home.giveToday": "Give Today",
      "home.planVisit": "Plan a Visit",
      "home.churchOfLightMother": "Church of Light — Mother Church",
      "home.cityWorshipCenter": "City Worship Center",
      "home.bannerCaption": "Church of Light · City Worship Center — Coimbatore",
      "home.actionGiveTitle": "Give",
      "home.actionGiveDesc": "Support the ministry, a fund, or a cause close to your heart — from anywhere in the world.",
      "home.actionGiveGo": "Give now →",
      "home.actionPrayTitle": "Pray",
      "home.actionPrayDesc": "Send a prayer request, ask for a callback, or reach our prayer team directly.",
      "home.actionPrayGo": "Request prayer →",
      "home.actionConnectTitle": "Connect",
      "home.actionConnectDesc": "Visit a service, join a program, or get in touch with our team.",
      "home.actionConnectGo": "Get in touch →",
      "home.transparencyEyebrow": "Transparency",
      "home.transparencyHeading": "Giving, at a glance",
      "home.transparencyLede": "Every gift is tracked openly. Here's where things stand on the Tech Fund today — the full report, including how every rupee was spent, lives on our Giving page.",
      "home.glanceCollected": "Collected",
      "home.glanceAvailable": "Available",
      "home.glanceGiftsGiven": "Gifts Given",
      "home.glanceGoal": "Goal",
      "home.glanceSub": "{{pct}}% of the way to goal — supporting media, sound & livestream equipment for both churches.",
      "home.glanceUpdated": "Live figures, updated automatically",
      "home.glanceSeeFull": "See the full picture, fund-by-fund →",
      "home.happeningEyebrow": "What's Happening",
      "home.happeningHeading": "Upcoming at both churches",
      "home.eventsEmpty": "No upcoming events posted yet — check back soon, or see the full <a href=\"/v2/events.html\">Events page</a>.",
      "home.eventsLoadErrorFallback": "See the full <a href=\"/v2/events.html\">Events page</a>.",
      "home.testimonyEyebrow": "✨ What God has done",
      "home.testimonyHeading": "Latest testimony",
      "home.testimonySeeAll": "See all testimonies →",
      "home.eventLearnMore": "Learn more →",

      "og.eyebrow": "Transparency Report",
      "og.heading": "Our Giving",
      "og.lede": "Every gift given here is tracked openly — what's collected, what it's spent on, and who's given, updated the moment a gift is received. This is the same ledger our pastor and team see.",
      "og.fundTech": "💻 Tech Fund",
      "og.fundChristmas": "🎄 Christmas Fund",
      "og.loadingFigures": "Loading live figures…",
      "og.loadingLedger": "Loading the live ledger…",
      "og.liveFiguresUpdated": "Live figures, updated automatically",
      "og.loadError": "Could not load live figures right now — please try again shortly.",
      "og.kpiCollected": "Collected",
      "og.kpiSpent": "Spent",
      "og.kpiAvailable": "Available",
      "og.kpiRemaining": "Remaining to Goal",
      "og.kpiContributions": "Contributions",
      "og.collectedMinusSpent": "Collected − Spent",
      "og.ofGoal": "of {{goal}} goal",
      "og.avgUniqueGivers": "Avg {{avg}} · {{n}} unique givers",
      "og.itemsBought.one": "{{n}} item bought",
      "og.itemsBought.other": "{{n}} items bought",
      "og.giftsSub.one": "{{n}} gift",
      "og.giftsSub.other": "{{n}} gifts",
      "og.progressEyebrow": "Progress",
      "og.progressHeading": "Toward the goal",
      "og.ofGoalLabel": "of Goal",
      "og.givingPace": "Giving pace",
      "og.paceHeadline": "At the current pace of {{pace}}/month, we'll reach the goal by <b>{{eta}}</b> — about {{months}} away.",
      "og.paceGoalReached": "The goal has been reached — thank you!",
      "og.paceNotEnoughHistory": "Not enough monthly history yet to project a pace.",
      "og.monthsPhrase.one": "{{n}} month",
      "og.monthsPhrase.other": "{{n}} months",
      "og.monthInProgress": "*Month in progress",
      "og.recentActivity": "Recent Activity",
      "og.topContributors": "Top Contributors",
      "og.noGiftsFund": "No gifts recorded yet for this fund.",
      "og.online": "Online",
      "og.manual": "Manual",
      "og.giftsCountShort.one": "{{n}} gift",
      "og.giftsCountShort.other": "{{n}} gifts",
      "og.insightsEyebrow": "Insights",
      "og.insightsHeading": "How this fund is growing",
      "og.uniqueGivers": "Unique Givers",
      "og.perPerson": "{{amt}} per person",
      "og.avgContribution": "Avg Contribution",
      "og.acrossEntries": "across {{n}} entries",
      "og.mostActiveMonth": "Most Active Month",
      "og.vsPrior": "{{arrow}} {{pct}}% vs prior month",
      "og.goalTimeline": "Goal Timeline",
      "og.goalTimelineShort": "~{{n}} mo",
      "og.atPerMo": "at {{amt}}/mo",
      "og.givenOnline": "Given Online",
      "og.onlineManualSplit": "{{online}} online · {{manual}} manual",
      "og.shareByCategory": "Share by Category",
      "og.shareByMember": "Share by Member",
      "og.othersCount": "{{n}} others",
      "og.givingChannel": "Giving Channel",
      "og.onlineUpi": "Online / UPI",
      "og.manualCash": "Manual / Cash",
      "og.growthOverTime": "Growth over time",
      "og.totalContributors": "Total Contributors",
      "og.averageContribution": "Average Contribution",
      "og.largestGift": "Largest Single Gift",
      "og.notEnoughHistory": "Not enough history yet.",
      "og.savingForEyebrow": "What We're Saving For",
      "og.plannedUpgrades": "Planned Upgrades",
      "og.priority": "Priority",
      "og.wishlistEmpty": "Nothing on the wishlist right now — check back later.",
      "og.givingHistory": "Giving History",
      "og.totalGiven": "Total Given",
      "og.totalGifts": "Total Gifts",
      "og.modalNote": "This giving activity is shown publicly as part of our transparency report — real dates and amounts from the live ledger.",

      "mg.signInHeading": "Sign in to see your giving",
      "mg.signInBody": "Your personal giving history is private to your account. Sign in with the same Google account you used to give.",
      "mg.hi": "Hi {{name}}!",
      "mg.unlinkedBody": "We couldn't find a giving record linked to this Google account yet. If you've given before under a different name or email, contact the church office to get it linked — once linked, your history will show up here automatically.",
      "mg.makeFirstGift": "Make your first gift",
      "mg.welcomeBack": "Welcome back, {{name}}.",
      "mg.giveAgain": "Give Again",
      "mg.allTimeTotal": "All-Time Total",
      "mg.acrossGifts.one": "Across {{n}} gift",
      "mg.acrossGifts.other": "Across {{n}} gifts",
      "mg.thisYear": "This Year",
      "mg.giftsInYear.one": "{{n}} gift in {{year}}",
      "mg.giftsInYear.other": "{{n}} gifts in {{year}}",
      "mg.history": "Your Giving History",
      "mg.giftsCount.one": "{{n}} gift",
      "mg.giftsCount.other": "{{n}} gifts",
      "mg.noGifts": "No gifts recorded yet.",
      "mg.unknownDate": "Unknown date",
      "mg.ctaHeading": "Keep the light shining.",
      "mg.ctaBody": "Every gift — big or small — helps both churches serve Coimbatore and beyond.",
      "mg.giveNow": "Give Now",
      "mg.loadingHistory": "Loading your giving history…",
      "mg.loadError": "Could not load your giving history right now — please try again shortly.",
      "mg.loading": "Loading…",

      "events.eyebrow": "🎁 Sharing Every Moment",
      "events.heading": "Events & Photos",
      "events.lede": "Every gathering, outreach, and celebration across both churches — shared here like a gift, so everyone can see what God is doing among us, wherever they are.",
      "events.galleryModal": "Gallery",
      "events.noEventsHeading": "No events posted yet",
      "events.noEventsBody": "Once services, outreach, and celebrations are added from the admin console, they'll appear here with photos — shared like a gift, for anyone to see.",
      "events.eventsCountPhotos.one": "{{n}} event · {{photos}} photos",
      "events.eventsCountPhotos.other": "{{n}} events · {{photos}} photos",
      "events.noneInCategory": "No events in this category yet.",
      "events.noPhotos": "No photos uploaded for this event yet.",
      "events.loadErrorHeading": "Could not load events right now",
      "events.loadErrorBody": "Please try again shortly.",
      "events.loading": "Loading events…",
      "events.viewFullGallery": "View full gallery →",
      "events.photosSuffix.one": " · {{n}} photo",
      "events.photosSuffix.other": " · {{n}} photos",

      "give.eyebrow": "✦ Give",
      "give.heading": "Support the ministry",
      "give.ledeLead": "Every gift is tracked openly on our",
      "give.illustrativeNote": "*Illustrative — today only Tech Fund and Christmas Fund exist live.",
      "give.readyHeading": "Ready to give?",
      "give.readyBody": "Tap below to open secure checkout — choose your name, amount, and pay by card, UPI, or net banking.",
      "give.modalTitle": "Make a Contribution",
      "give.modalBody": "Your support makes a difference.",
      "give.existingMember": "Existing Member",
      "give.newMember": "New Member",
      "give.selectMember": "Select Member",
      "give.fullName": "Full Name",
      "give.monthFor": "Month for Contribution",
      "give.amount": "Amount",
      "give.emailAddress": "Email Address",
      "give.mobileNumber": "Mobile Number",
      "give.proceedToPay": "Proceed to Pay",
      "give.giveNowArrow": "Give Now →",
      "give.comingSoon": "Coming soon*",
      "give.footerCopyright": "© 2026 Light of Jesus Ministry — same real checkout as always, just a fresh look."
    },
    ta: {
      "nav.home": "முகப்பு", "nav.about": "எங்களைப் பற்றி", "nav.watch": "பார்க்க & கேட்க",
      "nav.events": "நிகழ்வுகள்", "nav.programs": "நிகழ்ச்சிகள்", "nav.youth": "இளையோர்", "nav.blog": "வலைப்பதிவு",
      "nav.testimonies": "சாட்சிகள்", "nav.ourGiving": "எங்கள் காணிக்கை",
      "nav.pray": "ஜெபம்", "nav.contact": "தொடர்பு", "nav.give": "காணிக்கை",
      "cta.give": "காணிக்கை செலுத்த", "cta.pray": "ஜெபத்திற்கு", "cta.contact": "தொடர்பு கொள்ள",
      "cta.submit": "சமர்ப்பிக்க", "cta.readMore": "மேலும் படிக்க", "cta.learnMore": "மேலும் அறிய",
      "cta.viewAll": "அனைத்தையும் காண", "cta.send": "அனுப்பு",
      "cta.joinOnline": "ஆன்லைனில் இணைக", "cta.viewAllPrograms": "அனைத்து நிகழ்ச்சிகளையும் காண",
      "cta.submitPrayerRequest": "ஜெப வேண்டுதலை சமர்ப்பிக்க",
      "state.loading": "ஏற்றுகிறது…", "state.empty": "இதுவரை எதுவும் இல்லை.",
      "state.error": "ஏதோ தவறு நடந்தது — மீண்டும் முயற்சிக்கவும்.",
      "footer.tagline": "விசுவாசம், வெளிப்படைத்தன்மை மற்றும் நோக்கத்துடன் கொடுத்தல் — கோயம்புத்தூருக்கும், உலகிற்கும்.",
      "programs.onlineViaMeet": "கூகுள் மீட் மூலம் ஆன்லைனில்",
      "prayer.joinUsHeading": "எங்களுடன் சேர்ந்து ஜெபியுங்கள்",
      "prayer.joinUsSub": "நீங்கள் இணையக்கூடிய ஜெப கூட்டங்கள் — ஆன்லைனில் அல்லது நேரடியாக.",
      "prayer.needPrayer": "ஜெபம் தேவையா? உங்கள் வேண்டுதலை எங்களுடன் பகிருங்கள்.",
      "home.scheduleEyebrow": "ஜெபம் & வாராந்திர அட்டவணை",
      "home.scheduleHeading": "ஜெபத்திலும் ஆராதனையிலும் எங்களுடன் இணையுங்கள்",
      "home.scheduleSub": "தினசரி ஜெபம், ஞாயிறு ஆராதனைகள், மாதாந்திர கூட்டங்கள் — ஆன்லைனில் அல்லது நேரடியாக.",

      "footer.churchOfLight": "சர்ச் ஆஃப் லைட்",
      "footer.motherChurch": "தாய் தேவாலயம்",
      "footer.cityWorshipCenter": "சிட்டி வொர்ஷிப் சென்டர்",
      "footer.coimbatoreTN": "கோயம்புத்தூர், தமிழ்நாடு",
      "footer.explore": "ஆராயுங்கள்",
      "footer.quickLinks": "விரைவு இணைப்புகள்",
      "footer.aboutChurches": "எங்களைப் பற்றி & தேவாலயங்கள்",
      "footer.copyright": "© 2026 Light of Jesus Ministry",
      "footer.copyrightLedger": "© 2026 Light of Jesus Ministry — நேரடி கணக்குப் புத்தகத்திலிருந்து புள்ளிவிவரங்கள்.",
      "footer.backToHome": "← முகப்புக்குத் திரும்ப",

      "home.heroTitleLine1": "உலகிற்கு ஒளி,",
      "home.heroTitleEm": "நம்பிக்கை",
      "home.heroTitleRest": "இன்றைக்கு.",
      "home.heroLede": "இரண்டு தேவாலயங்கள், ஒரே குடும்பம் — சர்ச் ஆஃப் லைட் மற்றும் சிட்டி வொர்ஷிப் சென்டர். நீங்கள் எங்கிருந்து இணைந்தாலும், இந்த மேசையில் உங்களை வரவேற்கிறோம்.",
      "home.giveToday": "இன்று காணிக்கை செலுத்த",
      "home.planVisit": "வருகை திட்டமிட",
      "home.churchOfLightMother": "சர்ச் ஆஃப் லைட் — தாய் தேவாலயம்",
      "home.cityWorshipCenter": "சிட்டி வொர்ஷிப் சென்டர்",
      "home.bannerCaption": "சர்ச் ஆஃப் லைட் · சிட்டி வொர்ஷிப் சென்டர் — கோயம்புத்தூர்",
      "home.actionGiveTitle": "காணிக்கை",
      "home.actionGiveDesc": "உலகின் எந்த மூலையிலிருந்தும் — ஊழியத்தை, ஒரு நிதியை, அல்லது உங்கள் இதயத்திற்கு நெருக்கமான ஒரு காரணத்தை ஆதரிக்கவும்.",
      "home.actionGiveGo": "இப்போது கொடுக்க →",
      "home.actionPrayTitle": "ஜெபம்",
      "home.actionPrayDesc": "ஒரு ஜெப வேண்டுதலை அனுப்பவும், அழைப்பு கேட்கவும், அல்லது எங்கள் ஜெபக் குழுவை நேரடியாக தொடர்பு கொள்ளவும்.",
      "home.actionPrayGo": "ஜெபம் கேட்க →",
      "home.actionConnectTitle": "தொடர்பு",
      "home.actionConnectDesc": "ஒரு ஆராதனைக்கு வருகை தரவும், ஒரு நிகழ்ச்சியில் இணையவும், அல்லது எங்கள் குழுவைத் தொடர்பு கொள்ளவும்.",
      "home.actionConnectGo": "தொடர்பு கொள்ள →",
      "home.transparencyEyebrow": "வெளிப்படைத்தன்மை",
      "home.transparencyHeading": "காணிக்கை, ஒரு பார்வையில்",
      "home.transparencyLede": "ஒவ்வொரு காணிக்கையும் வெளிப்படையாக கண்காணிக்கப்படுகிறது. இன்று தொழில்நுட்ப நிதியின் நிலை இதோ — ஒவ்வொரு ரூபாயும் எவ்வாறு செலவிடப்பட்டது என்பது உட்பட முழு அறிக்கையும் எங்கள் காணிக்கை பக்கத்தில் உள்ளது.",
      "home.glanceCollected": "சேகரிக்கப்பட்டது",
      "home.glanceAvailable": "கிடைக்கும் தொகை",
      "home.glanceGiftsGiven": "கொடுக்கப்பட்ட காணிக்கைகள்",
      "home.glanceGoal": "இலக்கு",
      "home.glanceSub": "இலக்கை நோக்கி {{pct}}% வழி முடிந்தது — இரு தேவாலயங்களுக்கும் மீடியா, ஒலி & நேரலை ஒளிபரப்பு உபகரணங்களை ஆதரிக்கிறது.",
      "home.glanceUpdated": "நேரடி புள்ளிவிவரங்கள், தானாக புதுப்பிக்கப்படுகின்றன",
      "home.glanceSeeFull": "நிதி வாரியாக முழு படத்தையும் காண →",
      "home.happeningEyebrow": "நடக்கும் நிகழ்வுகள்",
      "home.happeningHeading": "இரு தேவாலயங்களிலும் வரவிருக்கும் நிகழ்வுகள்",
      "home.eventsEmpty": "இதுவரை வரவிருக்கும் நிகழ்வுகள் எதுவும் இடப்படவில்லை — விரைவில் சரிபார்க்கவும், அல்லது முழு <a href=\"/v2/events.html\">நிகழ்வுகள் பக்கத்தை</a>க் காணவும்.",
      "home.eventsLoadErrorFallback": "முழு <a href=\"/v2/events.html\">நிகழ்வுகள் பக்கத்தை</a>க் காணவும்.",
      "home.testimonyEyebrow": "✨ கடவுள் செய்தது",
      "home.testimonyHeading": "சமீபத்திய சாட்சி",
      "home.testimonySeeAll": "அனைத்து சாட்சிகளையும் காண →",
      "home.eventLearnMore": "மேலும் அறிய →",

      "og.eyebrow": "வெளிப்படைத்தன்மை அறிக்கை",
      "og.heading": "எங்கள் காணிக்கை",
      "og.lede": "இங்கு கொடுக்கப்படும் ஒவ்வொரு காணிக்கையும் வெளிப்படையாக கண்காணிக்கப்படுகிறது — சேகரிக்கப்பட்டது என்ன, எதற்கு செலவிடப்படுகிறது, யார் கொடுத்தார்கள் என்பது காணிக்கை பெறப்பட்ட உடனேயே புதுப்பிக்கப்படுகிறது. இது எங்கள் போதகரும் குழுவும் பார்க்கும் அதே கணக்குப் புத்தகம்.",
      "og.fundTech": "💻 தொழில்நுட்ப நிதி",
      "og.fundChristmas": "🎄 கிறிஸ்துமஸ் நிதி",
      "og.loadingFigures": "நேரடி புள்ளிவிவரங்களை ஏற்றுகிறது…",
      "og.loadingLedger": "நேரடி கணக்குப் புத்தகத்தை ஏற்றுகிறது…",
      "og.liveFiguresUpdated": "நேரடி புள்ளிவிவரங்கள், தானாக புதுப்பிக்கப்படுகின்றன",
      "og.loadError": "இப்போது நேரடி புள்ளிவிவரங்களை ஏற்ற முடியவில்லை — சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.",
      "og.kpiCollected": "சேகரிக்கப்பட்டது",
      "og.kpiSpent": "செலவிடப்பட்டது",
      "og.kpiAvailable": "கிடைக்கும் தொகை",
      "og.kpiRemaining": "இலக்கை அடைய மீதமுள்ளது",
      "og.kpiContributions": "காணிக்கைகள்",
      "og.collectedMinusSpent": "சேகரிக்கப்பட்டது − செலவிடப்பட்டது",
      "og.ofGoal": "{{goal}} இலக்கில்",
      "og.avgUniqueGivers": "சராசரி {{avg}} · {{n}} தனிப்பட்ட கொடையாளர்கள்",
      "og.itemsBought.one": "{{n}} பொருள் வாங்கப்பட்டது",
      "og.itemsBought.other": "{{n}} பொருட்கள் வாங்கப்பட்டன",
      "og.giftsSub.one": "{{n}} காணிக்கை",
      "og.giftsSub.other": "{{n}} காணிக்கைகள்",
      "og.progressEyebrow": "முன்னேற்றம்",
      "og.progressHeading": "இலக்கை நோக்கி",
      "og.ofGoalLabel": "இலக்கில்",
      "og.givingPace": "கொடுக்கும் வேகம்",
      "og.paceHeadline": "தற்போதைய வேகமான மாதத்திற்கு {{pace}} இல், <b>{{eta}}</b> அளவில் இலக்கை அடைவோம் — சுமார் {{months}} தொலைவில்.",
      "og.paceGoalReached": "இலக்கு அடையப்பட்டது — நன்றி!",
      "og.paceNotEnoughHistory": "வேகத்தை மதிப்பிட போதுமான மாதாந்திர வரலாறு இதுவரை இல்லை.",
      "og.monthsPhrase.one": "{{n}} மாதம்",
      "og.monthsPhrase.other": "{{n}} மாதங்கள்",
      "og.monthInProgress": "*மாதம் நடந்துகொண்டிருக்கிறது",
      "og.recentActivity": "சமீபத்திய செயல்பாடு",
      "og.topContributors": "முன்னணி காணிக்கையாளர்கள்",
      "og.noGiftsFund": "இந்த நிதிக்கு இதுவரை காணிக்கைகள் பதிவு செய்யப்படவில்லை.",
      "og.online": "ஆன்லைன்",
      "og.manual": "கையேடு",
      "og.giftsCountShort.one": "{{n}} காணிக்கை",
      "og.giftsCountShort.other": "{{n}} காணிக்கைகள்",
      "og.insightsEyebrow": "நுண்ணறிவுகள்",
      "og.insightsHeading": "இந்த நிதி எவ்வாறு வளர்கிறது",
      "og.uniqueGivers": "தனிப்பட்ட கொடையாளர்கள்",
      "og.perPerson": "ஒரு நபருக்கு {{amt}}",
      "og.avgContribution": "சராசரி காணிக்கை",
      "og.acrossEntries": "{{n}} பதிவுகளில்",
      "og.mostActiveMonth": "மிகவும் சுறுசுறுப்பான மாதம்",
      "og.vsPrior": "{{arrow}} {{pct}}% முந்தைய மாதத்துடன் ஒப்பிடும்போது",
      "og.goalTimeline": "இலக்கு காலவரிசை",
      "og.goalTimelineShort": "~{{n}} மாதம்",
      "og.atPerMo": "மாதத்திற்கு {{amt}}",
      "og.givenOnline": "ஆன்லைனில் கொடுக்கப்பட்டது",
      "og.onlineManualSplit": "{{online}} ஆன்லைன் · {{manual}} கையேடு",
      "og.shareByCategory": "வகை வாரியாக பங்கு",
      "og.shareByMember": "உறுப்பினர் வாரியாக பங்கு",
      "og.othersCount": "{{n}} மற்றவர்கள்",
      "og.givingChannel": "கொடுக்கும் வழி",
      "og.onlineUpi": "ஆன்லைன் / UPI",
      "og.manualCash": "கையேடு / பணம்",
      "og.growthOverTime": "காலப்போக்கில் வளர்ச்சி",
      "og.totalContributors": "மொத்த காணிக்கையாளர்கள்",
      "og.averageContribution": "சராசரி காணிக்கை",
      "og.largestGift": "மிகப்பெரிய தனி காணிக்கை",
      "og.notEnoughHistory": "இதுவரை போதுமான வரலாறு இல்லை.",
      "og.savingForEyebrow": "நாங்கள் எதற்காக சேமிக்கிறோம்",
      "og.plannedUpgrades": "திட்டமிடப்பட்ட மேம்பாடுகள்",
      "og.priority": "முன்னுரிமை",
      "og.wishlistEmpty": "தற்போது விருப்பப்பட்டியலில் எதுவும் இல்லை — பின்னர் சரிபார்க்கவும்.",
      "og.givingHistory": "காணிக்கை வரலாறு",
      "og.totalGiven": "மொத்தம் கொடுக்கப்பட்டது",
      "og.totalGifts": "மொத்த காணிக்கைகள்",
      "og.modalNote": "இந்த காணிக்கை செயல்பாடு எங்கள் வெளிப்படைத்தன்மை அறிக்கையின் ஒரு பகுதியாக பொதுவில் காட்டப்படுகிறது — நேரடி கணக்குப் புத்தகத்திலிருந்து உண்மையான தேதிகள் மற்றும் தொகைகள்.",

      "mg.signInHeading": "உங்கள் காணிக்கையைக் காண உள்நுழையவும்",
      "mg.signInBody": "உங்கள் தனிப்பட்ட காணிக்கை வரலாறு உங்கள் கணக்கிற்கு மட்டுமே தனிப்பட்டது. நீங்கள் காணிக்கை செலுத்திய அதே Google கணக்கில் உள்நுழையவும்.",
      "mg.hi": "வணக்கம் {{name}}!",
      "mg.unlinkedBody": "இந்த Google கணக்குடன் இணைக்கப்பட்ட காணிக்கை பதிவு எதுவும் எங்களால் கண்டறிய முடியவில்லை. வேறு பெயர் அல்லது மின்னஞ்சலில் முன்பு கொடுத்திருந்தால், அதை இணைக்க சர்ச் அலுவலகத்தைத் தொடர்பு கொள்ளவும் — இணைக்கப்பட்டதும், உங்கள் வரலாறு தானாக இங்கே தோன்றும்.",
      "mg.makeFirstGift": "உங்கள் முதல் காணிக்கையை செலுத்தவும்",
      "mg.welcomeBack": "மீண்டும் வருக, {{name}}.",
      "mg.giveAgain": "மீண்டும் கொடுக்க",
      "mg.allTimeTotal": "மொத்த காணிக்கை",
      "mg.acrossGifts.one": "{{n}} காணிக்கையில்",
      "mg.acrossGifts.other": "{{n}} காணிக்கைகளில்",
      "mg.thisYear": "இந்த ஆண்டு",
      "mg.giftsInYear.one": "{{year}} இல் {{n}} காணிக்கை",
      "mg.giftsInYear.other": "{{year}} இல் {{n}} காணிக்கைகள்",
      "mg.history": "உங்கள் காணிக்கை வரலாறு",
      "mg.giftsCount.one": "{{n}} காணிக்கை",
      "mg.giftsCount.other": "{{n}} காணிக்கைகள்",
      "mg.noGifts": "இதுவரை காணிக்கைகள் பதிவு செய்யப்படவில்லை.",
      "mg.unknownDate": "தெரியாத தேதி",
      "mg.ctaHeading": "ஒளியைத் தொடர்ந்து பிரகாசிக்க வையுங்கள்.",
      "mg.ctaBody": "ஒவ்வொரு காணிக்கையும் — பெரிதோ சிறிதோ — இரு தேவாலயங்களும் கோயம்புத்தூருக்கும் அதற்கு அப்பாலும் சேவை செய்ய உதவுகிறது.",
      "mg.giveNow": "இப்போது கொடுக்க",
      "mg.loadingHistory": "உங்கள் காணிக்கை வரலாற்றை ஏற்றுகிறது…",
      "mg.loadError": "இப்போது உங்கள் காணிக்கை வரலாற்றை ஏற்ற முடியவில்லை — சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.",
      "mg.loading": "ஏற்றுகிறது…",

      "events.eyebrow": "🎁 ஒவ்வொரு தருணத்தையும் பகிர்தல்",
      "events.heading": "நிகழ்வுகள் & புகைப்படங்கள்",
      "events.lede": "இரு தேவாலயங்களிலும் நடக்கும் ஒவ்வொரு கூட்டமும், நற்செய்தி ஊழியமும், கொண்டாட்டமும் — ஒரு பரிசைப் போல இங்கே பகிரப்படுகிறது, எங்கிருந்தாலும் எல்லோரும் கடவுள் எங்களிடையே செய்வதைக் காணும் வகையில்.",
      "events.galleryModal": "படத்தொகுப்பு",
      "events.noEventsHeading": "இதுவரை நிகழ்வுகள் எதுவும் இடப்படவில்லை",
      "events.noEventsBody": "நிர்வாக பலகத்திலிருந்து ஆராதனைகள், நற்செய்தி ஊழியம், கொண்டாட்டங்கள் சேர்க்கப்பட்டதும், அவை புகைப்படங்களுடன் இங்கே தோன்றும் — யாரும் காணும் வகையில் ஒரு பரிசைப் போல பகிரப்படும்.",
      "events.eventsCountPhotos.one": "{{n}} நிகழ்வு · {{photos}} புகைப்படங்கள்",
      "events.eventsCountPhotos.other": "{{n}} நிகழ்வுகள் · {{photos}} புகைப்படங்கள்",
      "events.noneInCategory": "இந்த வகையில் இதுவரை நிகழ்வுகள் இல்லை.",
      "events.noPhotos": "இந்த நிகழ்விற்கு இதுவரை புகைப்படங்கள் பதிவேற்றப்படவில்லை.",
      "events.loadErrorHeading": "இப்போது நிகழ்வுகளை ஏற்ற முடியவில்லை",
      "events.loadErrorBody": "சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.",
      "events.loading": "நிகழ்வுகளை ஏற்றுகிறது…",
      "events.viewFullGallery": "முழு படத்தொகுப்பையும் காண →",
      "events.photosSuffix.one": " · {{n}} புகைப்படம்",
      "events.photosSuffix.other": " · {{n}} புகைப்படங்கள்",

      "give.eyebrow": "✦ காணிக்கை",
      "give.heading": "ஊழியத்தை ஆதரிக்கவும்",
      "give.ledeLead": "ஒவ்வொரு காணிக்கையும் எங்கள் பக்கத்தில் வெளிப்படையாக கண்காணிக்கப்படுகிறது",
      "give.illustrativeNote": "*விளக்கமானது — இன்று தொழில்நுட்ப நிதி மற்றும் கிறிஸ்துமஸ் நிதி மட்டுமே நேரடியாக உள்ளன.",
      "give.readyHeading": "கொடுக்க தயாரா?",
      "give.readyBody": "பாதுகாப்பான செக்அவுட்டைத் திறக்க கீழே தட்டவும் — உங்கள் பெயர், தொகையைத் தேர்ந்தெடுத்து, கார்டு, UPI அல்லது நெட் பேங்கிங் மூலம் செலுத்தவும்.",
      "give.modalTitle": "காணிக்கை செலுத்த",
      "give.modalBody": "உங்கள் ஆதரவு ஒரு மாற்றத்தை ஏற்படுத்துகிறது.",
      "give.existingMember": "இருக்கும் உறுப்பினர்",
      "give.newMember": "புதிய உறுப்பினர்",
      "give.selectMember": "உறுப்பினரைத் தேர்ந்தெடுக்கவும்",
      "give.fullName": "முழு பெயர்",
      "give.monthFor": "காணிக்கைக்கான மாதம்",
      "give.amount": "தொகை",
      "give.emailAddress": "மின்னஞ்சல் முகவரி",
      "give.mobileNumber": "மொபைல் எண்",
      "give.proceedToPay": "செலுத்த தொடரவும்",
      "give.giveNowArrow": "இப்போது கொடுக்க →",
      "give.comingSoon": "விரைவில் வருகிறது*",
      "give.footerCopyright": "© 2026 Light of Jesus Ministry — எப்போதும் போல் அதே உண்மையான செக்அவுட், புதிய தோற்றத்துடன்."
    }
  };

  function lang() {
    try { return localStorage.getItem(KEY) === "ta" ? "ta" : "en"; } catch (_) { return "en"; }
  }

  // t('a.b') -> plain lookup. t('a.b', {name: 'X'}) -> lookup + replace
  // every {{name}} token in the resolved string with vars.name. Vars are
  // inserted as-is (not HTML-escaped) since callers only ever pass
  // developer-formatted values (dates, amounts, counts) here, never raw
  // user input — user-supplied strings (member names, etc.) must still be
  // escaped by the caller before being placed in HTML.
  function t(key, vars) {
    var d = DICT[lang()] || DICT.en;
    var str = d[key] || DICT.en[key] || key;
    if (vars) {
      str = str.replace(/\{\{(\w+)\}\}/g, function (_, k) {
        return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : "";
      });
    }
    return str;
  }

  // tn('og.giftsSub', count, {amt: '...'}) -> picks the '.one' key when
  // count === 1, else '.other' -- for the handful of dictionary entries
  // that need English singular/plural forms (Tamil reuses one phrasing
  // for both, so its '.one'/'.other' values are identical by design).
  function tn(key, n, vars) {
    var merged = { n: n };
    if (vars) { for (var k in vars) { if (Object.prototype.hasOwnProperty.call(vars, k)) merged[k] = vars[k]; } }
    return t(key + (n === 1 ? ".one" : ".other"), merged);
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

  window.LJM_I18N = { lang: lang, t: t, tn: tn, bi: bi, setLang: setLang, toggle: toggle, applyDom: applyDom };
})();
