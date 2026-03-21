/**
 * RAZORPAY CHECKOUT LOGIC & PREMIUM MODAL
 */

const RAZORPAY_TEST_KEY_ID = "rzp_live_STrG9mXFNPWfMM";

function getFundContext() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("fund") || "tech-contributions";
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
    const amountChips = document.querySelectorAll(".amount-chip");
    
    const proceedBtn = document.getElementById("proceedToPayBtn");
    
    let isNewMember = false;

    if (!btn || !modal) return;

    // Show main button after a sec
    setTimeout(() => {
        btn.style.display = "inline-block";
    }, 1000);

    // Load existing members
    function loadMembers() {
        // Try getting members from existing script.js function if available
        let members = [];
        if (typeof getCachedMembersList === 'function') {
            members = getCachedMembersList() || [];
        }
        
        // Populate select
        selectExisting.innerHTML = '<option value="">-- Select your name --</option>';
        if (members && members.length > 0) {
            // alphabetical sort
            members.sort().forEach(m => {
                const opt = document.createElement("option");
                opt.value = m;
                opt.textContent = m;
                selectExisting.appendChild(opt);
            });
        } else {
            selectExisting.innerHTML = '<option value="">No members found yet</option>';
        }
    }

    // Modal behavior
    function openModal() {
        modal.style.display = "flex";
        modal.classList.add("insight-modal-visible");
        loadMembers();
    }
    
    function closeModal() {
        modal.classList.remove("insight-modal-visible");
        setTimeout(() => { modal.style.display = "none"; }, 300);
    }

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        openModal();
    });
    
    if(closeBtn) closeBtn.addEventListener("click", closeModal);
    if(backdrop) backdrop.addEventListener("click", closeModal);

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
            if (!amtStr || isNaN(amtStr) || Number(amtStr) <= 0) {
                alert("Please enter a valid amount.");
                return;
            }

            const amount = Number(amtStr);
            const fundName = getFundContext();
            
            // Visual feedback
            const originalText = proceedBtn.innerText;
            proceedBtn.innerText = "Loading Secure Checkout...";
            proceedBtn.disabled = true;

            // Lazy Load Razorpay to avoid continuous background network calls
            if (typeof Razorpay === 'undefined') {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.body.appendChild(script);
                }).catch(() => {
                    alert("Failed to load secure checkout. Please check your connection.");
                    proceedBtn.innerText = originalText;
                    proceedBtn.disabled = false;
                });
            }

            if (typeof Razorpay === 'undefined') return;

            // Store info gracefully via Razorpay instance
            var options = {
                "key": RAZORPAY_TEST_KEY_ID,
                "amount": amount * 100, 
                "currency": "INR",
                "name": "LJM Church",
                "description": "Contribution towards " + (fundName.includes("tech") ? "Tech Fund" : "Christmas Fund"),
                "handler": function (response) {
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
                    }
                },
                "prefill": {
                    "name": memberName,
                    "email": "",
                    "contact": ""
                },
                "notes": {
                    "memberName": memberName,
                    "fundName": fundName
                },
                "theme": {
                    "color": "#673ab7"
                }
            };

            try {
                var rzp1 = new Razorpay(options);
                rzp1.on('payment.failed', function (response){
                        alert("Payment Failed. Reason: " + response.error.description);
                        proceedBtn.innerText = originalText;
                        proceedBtn.disabled = false;
                });
                rzp1.open();
            } catch (err) {
                alert("Could not load secure checkout properly.");
                proceedBtn.innerText = originalText;
                proceedBtn.disabled = false;
            }
        });
    }
});
