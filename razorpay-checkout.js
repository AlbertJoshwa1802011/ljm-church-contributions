/**
 * RAZORPAY CHECKOUT LOGIC & PREMIUM MODAL
 */

// SECURITY NOTE: This is the Razorpay PUBLIC Key ID. 
// It is perfectly safe and necessary for this ID to be exposed in frontend JavaScript code.
// NEVER expose the Razorpay KEY SECRET here. The Secret is kept securely on the backend (payment-webhook.gs).
const RAZORPAY_TEST_KEY_ID = "rzp_live_STrG9mXFNPWfMM";

function getFundContext() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("fund") || "tech-contributions";
}

function compactFundKey(raw) {
    return String(raw || "").toLowerCase().replace(/\s+/g, "");
}

function canonicalFundSlug(raw) {
    const f = compactFundKey(raw);
    if (f === "tech" || f === "techfund" || f === "tech-contributions") return "tech-contributions";
    if (f === "christmas-fund-2k26" || f === "christmasfund2k26" || f === "christmas2k26"
        || f === "christmas2k26fund" || f === "christmasfund2026" || f === "christmas-fund-2026"
        || f === "christmas2026" || f === "christmas2026fund") {
        return "christmas-fund-2k26";
    }
    if (f === "christmas" || f === "christmasfund" || f === "christmas-fund"
        || f === "christmasfund2025" || f === "christmas-fund-2025" || f === "christmas2025") {
        return "christmas-fund";
    }
    return "tech-contributions";
}

// Mirrors functions/api/_fund.js so the Razorpay / Google Pay note matches
// the ledger the webhook will record the gift against. Unknown funds still
// fall through to Tech Fund (same as webhook.js).
function fundDisplayName(raw) {
    const slug = canonicalFundSlug(raw);
    if (slug === "christmas-fund-2k26") return "Christmas 2k26 fund";
    if (slug === "christmas-fund") return "Christmas Fund 2025";
    return "Tech Fund";
}

function isChristmas2k26Fund(raw) {
    return canonicalFundSlug(raw) === "christmas-fund-2k26";
}

function isClosedChristmas2025(raw) {
    return canonicalFundSlug(raw) === "christmas-fund";
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("rzp-button1");
    const modal = document.getElementById("contributionModal");
    const backdrop = document.getElementById("contribModalBackdrop");
    const closeBtn = document.getElementById("contribModalClose");
    
    const btnExisting = document.getElementById("btnExistingMember");
    const btnNew = document.getElementById("btnNewMember");
    const fieldExisting = document.getElementById("existingMemberField");
    const fieldNew = document.getElementById("newMemberField");
    
    const selectExisting = document.getElementById("existingMemberSelect");
    const inputNew = document.getElementById("newMemberInput");
    
    const inputAmount = document.getElementById("contribAmount");
    const inputEmail = document.getElementById("contribEmail");
    const inputPhone = document.getElementById("contribPhone");
    const amountChips = document.querySelectorAll(".amount-chip");
    
    const proceedBtn = document.getElementById("proceedToPayBtn");
    
    let isNewMember = false;
    let paymentInProgress = false;

    if (!btn || !modal) return;

    // Christmas Fund 2025 is history-only — new gifts go to Christmas Fund 2k26.
    if (isClosedChristmas2025(getFundContext())) {
        btn.style.display = "none";
        btn.dataset.paymentsClosed = "1";
        const notice = document.createElement("p");
        notice.className = "fund-closed-note";
        notice.innerHTML = 'This is the 2025 Christmas ledger. Give to <a href="index.html?fund=christmas-fund-2k26">Christmas Fund 2k26</a> instead.';
        if (btn.parentNode) btn.parentNode.appendChild(notice);
    } else {
        setTimeout(() => {
            btn.style.display = "inline-block";
        }, 1000);
    }

    // Load existing members
    let memberLoadInterval = null;
    let membersAlreadyLoaded = false;
    function loadMembers() {
        let members = [];
        if (typeof getCachedMembersList === 'function') {
            members = getCachedMembersList() || [];
        }
        
        if (members.length === 0 && window._currentContributions) {
            members = Array.from(new Set(window._currentContributions.map(c => c.Member))).filter(Boolean);
        }
        
        if (members && members.length > 0) {
            const currentSelection = selectExisting.value;

            if (membersAlreadyLoaded && currentSelection) {
                const sortedMembers = members.slice().sort();
                const existingOptions = Array.from(selectExisting.options).slice(1).map(o => o.value);
                const listsMatch = sortedMembers.length === existingOptions.length &&
                    sortedMembers.every((m, i) => m === existingOptions[i]);
                if (listsMatch) {
                    if (memberLoadInterval) {
                        clearInterval(memberLoadInterval);
                        memberLoadInterval = null;
                    }
                    return true;
                }
            }

            selectExisting.innerHTML = '<option value="">-- Select your name --</option>';
            members.sort().forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                selectExisting.appendChild(opt);
            });

            if (currentSelection) {
                const stillExists = Array.from(selectExisting.options).some(o => o.value === currentSelection);
                if (stillExists) {
                    selectExisting.value = currentSelection;
                }
            }

            membersAlreadyLoaded = true;
            if (memberLoadInterval) {
                clearInterval(memberLoadInterval);
                memberLoadInterval = null;
            }
            return true;
        } else {
            selectExisting.innerHTML = '<option value="">Syncing members from sheet... 🔄</option>';
            return false;
        }
    }

    // Listen for data-ready event from script.js
    document.addEventListener('LJM_DATA_READY', () => {
        console.log("🚀 LJM_DATA_READY received in checkout script");
        loadMembers();
    });

    function applySeasonMonthOptions() {
        const monthEl = document.getElementById("monthSelect");
        if (!monthEl) return;
        const seasonOnly = isChristmas2k26Fund(getFundContext());
        const seasonMonths = ["October", "November", "December"];
        Array.from(monthEl.options).forEach(opt => {
            if (!opt.value) return;
            opt.hidden = seasonOnly && !seasonMonths.includes(opt.value);
            opt.disabled = seasonOnly && !seasonMonths.includes(opt.value);
        });
        const hint = monthEl.parentNode && monthEl.parentNode.querySelector(".field-hint");
        if (hint) {
            hint.textContent = seasonOnly
                ? "Christmas Fund 2k26 is for October, November and December 📅"
                : "Select which month you are paying for 📅";
        }
        if (seasonOnly) {
            const currentName = new Date().toLocaleString("default", { month: "long" });
            if (seasonMonths.includes(currentName)) monthEl.value = currentName;
            else if (!seasonMonths.includes(monthEl.value)) monthEl.value = "October";
        }
    }

    // Modal behavior
    function openModal() {
        if (isClosedChristmas2025(getFundContext())) {
            window.location.assign("index.html?fund=christmas-fund-2k26");
            return;
        }
        modal.style.display = "flex";
        modal.classList.add("insight-modal-visible");
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = "hidden";
        applySeasonMonthOptions();
        
        const success = loadMembers();
        
        // If not ready, start polling every 500ms for up to 5s
        if (!success) {
            let attempts = 0;
            if (memberLoadInterval) clearInterval(memberLoadInterval);
            memberLoadInterval = setInterval(() => {
                attempts++;
                const ready = loadMembers();
                if (ready || attempts > 10) {
                    clearInterval(memberLoadInterval);
                    memberLoadInterval = null;
                    if (!ready && selectExisting.innerHTML.includes("Syncing")) {
                        selectExisting.innerHTML = '<option value="">No members found yet</option>';
                    }
                }
            }, 500);
        }
    }
    
    function closeModal() {
        modal.classList.remove("insight-modal-visible");
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = "";
        if (memberLoadInterval) {
            clearInterval(memberLoadInterval);
            memberLoadInterval = null;
        }
        membersAlreadyLoaded = false;

        isNewMember = false;
        if (btnExisting) btnExisting.classList.add("active");
        if (btnNew) btnNew.classList.remove("active");
        if (fieldExisting) fieldExisting.style.display = "block";
        if (fieldNew) fieldNew.style.display = "none";
        if (selectExisting) selectExisting.value = "";
        if (inputNew) inputNew.value = "";
        if (inputAmount) inputAmount.value = "";
        if (inputEmail) inputEmail.value = "";
        if (inputPhone) inputPhone.value = "";
        if (proceedBtn) {
            proceedBtn.disabled = false;
            proceedBtn.innerText = "Proceed to Pay";
        }
        paymentInProgress = false;
        amountChips.forEach(c => c.classList.remove("selected"));
        const preview = document.getElementById('paymentStatusPreview');
        if (preview) preview.classList.remove('visible');
        const monthEl = document.getElementById('monthSelect');
        if (monthEl) monthEl.value = "";

        setTimeout(() => { modal.style.display = "none"; }, 300);
    }

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        openModal();
    });
    
    if(closeBtn) closeBtn.addEventListener("click", closeModal);
    if(backdrop) backdrop.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("insight-modal-visible")) closeModal();
    });

    // Toggles
    if (btnExisting && btnNew) {
        btnExisting.addEventListener("click", () => {
            isNewMember = false;
            btnExisting.classList.add("active");
            btnNew.classList.remove("active");
            fieldExisting.style.display = "block";
            fieldNew.style.display = "none";
        });

        btnNew.addEventListener("click", () => {
            isNewMember = true;
            btnNew.classList.add("active");
            btnExisting.classList.remove("active");
            fieldNew.style.display = "block";
            fieldExisting.style.display = "none";
            const preview = document.getElementById('paymentStatusPreview');
            if (preview) preview.classList.remove('visible');
        });

        // Dynamic Status Preview on name selection
        selectExisting.addEventListener("change", () => {
            const name = selectExisting.value;
            const preview = document.getElementById('paymentStatusPreview');
            const pills = document.getElementById('monthStatusPills');
            
            if (!name) {
                preview.classList.remove('visible');
                if (inputEmail) inputEmail.value = "";
                return;
            }

            // Auto-fill email if available
            if (inputEmail && window._memberEmails && window._memberEmails[name]) {
                inputEmail.value = window._memberEmails[name];
            } else if (inputEmail) {
                inputEmail.value = "";
            }

            // Auto-fill phone if available
            if (inputPhone && window._memberPhones && window._memberPhones[name]) {
                inputPhone.value = window._memberPhones[name];
            } else if (inputPhone) {
                inputPhone.value = "";
            }

            const contributions = window._currentContributions || [];
            const memberData = contributions.filter(c => (c.Member || "").toLowerCase() === name.toLowerCase());
            const monthsPaid = new Set();
            const currentYear = new Date().getFullYear();
            
            memberData.forEach(c => {
                const d = new Date(c.Date);
                if (d && d.getFullYear() === currentYear) monthsPaid.add(d.getMonth());
                // Also check notes for manual month labels
                const notes = (c.Notes || "").toLowerCase();
                const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
                monthNames.forEach((m, idx) => { if (notes.includes(m)) monthsPaid.add(idx); });
            });

            const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const seasonIndexes = isChristmas2k26Fund(getFundContext()) ? [9, 10, 11] : monthNamesShort.map((_, i) => i);
            pills.innerHTML = seasonIndexes.map(i => `
                <span class="month-pill" style="opacity: ${monthsPaid.has(i) ? '1' : '0.4'}; background: ${monthsPaid.has(i) ? 'var(--green, #5f8d4e)' : 'var(--bg-soft, #f4f2ec)'}; color: ${monthsPaid.has(i) ? '#fff' : 'var(--text-faint, #a09a8a)'}">
                    ${monthNamesShort[i]} ${monthsPaid.has(i) ? '✓' : ''}
                </span>
            `).join('');

            preview.classList.add('visible');
        });
    }

    // Chips
    amountChips.forEach(chip => {
        chip.addEventListener("click", () => {
            inputAmount.value = chip.getAttribute("data-val");
            // small visual feedback
            amountChips.forEach(c => c.classList.remove("selected"));
            chip.classList.add("selected");
        });
    });
    
    // Clear chips on manual input
    if (inputAmount) {
        inputAmount.addEventListener("input", () => {
            amountChips.forEach(c => c.classList.remove("selected"));
        });
    }

    // Proceed to Pay
    if (proceedBtn) {
        proceedBtn.addEventListener("click", async () => {
            if (paymentInProgress) return;

            let memberName = "";
            
            if (isNewMember) {
                memberName = inputNew.value.trim();
                if (!memberName) {
                    alert("Please enter your full name to continue.");
                    return;
                }
            } else {
                memberName = selectExisting.value;
                if (!memberName) {
                    alert("Please select your name from the list, or choose 'New Member'.");
                    return;
                }
            }

            const amtStr = inputAmount.value;
            const parsedAmount = Math.floor(Number(amtStr));
            if (!amtStr || isNaN(amtStr) || parsedAmount < 1 || parsedAmount > 500000) {
                alert("Please enter a valid amount (between ₹1 and ₹5,00,000).");
                return;
            }

            const email = inputEmail ? inputEmail.value.trim() : "";
            if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                alert("Please enter a valid email address to receive your receipt.");
                return;
            }

            const phone = inputPhone ? inputPhone.value.trim() : "";

            if (isClosedChristmas2025(getFundContext())) {
                window.location.assign("index.html?fund=christmas-fund-2k26");
                return;
            }

            const amount = parsedAmount;
            const fundName = canonicalFundSlug(getFundContext());
            const monthEl = document.getElementById('monthSelect');
            let selectedMonth = monthEl ? monthEl.value : '';
            if (isChristmas2k26Fund(fundName) && !selectedMonth) {
                const currentName = new Date().toLocaleString("default", { month: "long" });
                selectedMonth = ["October", "November", "December"].includes(currentName) ? currentName : "October";
            }

            paymentInProgress = true;
            const originalText = proceedBtn.innerText;
            proceedBtn.innerText = "Loading Secure Checkout...";
            proceedBtn.disabled = true;

            if (typeof Razorpay === 'undefined') {
                if (!window._razorpayLoadPromise) {
                    window._razorpayLoadPromise = new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                        script.onload = resolve;
                        script.onerror = () => {
                            window._razorpayLoadPromise = null;
                            reject();
                        };
                        document.body.appendChild(script);
                    });
                }
                try {
                    await window._razorpayLoadPromise;
                } catch {
                    alert("Failed to load secure checkout. Please check your connection.");
                    proceedBtn.innerText = originalText;
                    proceedBtn.disabled = false;
                    paymentInProgress = false;
                    return;
                }
            }

            if (typeof Razorpay === 'undefined') {
                proceedBtn.innerText = originalText;
                proceedBtn.disabled = false;
                paymentInProgress = false;
                return;
            }

            // Store info gracefully via Razorpay instance
            var options = {
                "key": RAZORPAY_TEST_KEY_ID,
                "amount": amount * 100, 
                "currency": "INR",
                "name": "LJM Church",
                "description": "Contribution towards " + fundDisplayName(fundName),
                "handler": function (response) {
                    paymentInProgress = false;
                    proceedBtn.innerText = originalText;
                    proceedBtn.disabled = false;
                    closeModal();
                    alert("Thank you! Payment successful. Payment ID: " + response.razorpay_payment_id + ". Your contribution will reflect shortly.");
                    
                    const ind = document.getElementById("updateIndicator");
                    if (ind) {
                        ind.style.display = "flex";
                        let count = 8;
                        const itv = setInterval(() => {
                            count--;
                            ind.innerHTML = `<span class='update-dot'></span> Verified! Syncing with Sheet... (${count}s)`;
                            if (count <= 0) {
                                clearInterval(itv);
                                window.location.reload();
                            }
                        }, 1000);
                    } else {
                        setTimeout(() => {
                            window.location.reload();
                        }, 8000);
                    }
                },
                "modal": {
                    "ondismiss": function() {
                        proceedBtn.innerText = originalText;
                        proceedBtn.disabled = false;
                        paymentInProgress = false;
                    }
                },
                "prefill": {
                    "name": memberName,
                    "email": email,
                    "contact": phone
                },
                "notes": {
                    "memberName": memberName,
                    "memberEmail": email,
                    "memberPhone": phone,
                    "fundName": fundName,
                    "month": selectedMonth || (new Date().toLocaleString('default', { month: 'long' }))
                },
                "theme": {
                    "color": "#3D6079"
                }
            };

            try {
                var rzp1 = new Razorpay(options);
                rzp1.on('payment.failed', function (response){
                        alert("Payment Failed. Reason: " + response.error.description);
                        proceedBtn.innerText = originalText;
                        proceedBtn.disabled = false;
                        paymentInProgress = false;
                });
                rzp1.open();
            } catch (err) {
                alert("Could not load secure checkout properly.");
                proceedBtn.innerText = originalText;
                proceedBtn.disabled = false;
                paymentInProgress = false;
            }
        });
    }
});
