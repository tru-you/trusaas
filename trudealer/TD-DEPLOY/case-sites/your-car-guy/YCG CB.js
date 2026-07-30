const ycgCatalog = [
            { id: "ford-ranger", brand: "FORD", model: "Ranger 2.0D Bi-Turbo Wildtrak 4x4", year: 2021, price: 499000, km: "80,000 km", type: "Bakkie Double Cab", fuel: "Diesel" },
            { id: "audi-s3", brand: "AUDI", model: "S3 Sportback", year: 2012, price: 255000, km: "141,000 km", type: "Hatchback", fuel: "Petrol" },
            { id: "ford-everest", brand: "FORD", model: "Everest 2.2 TDCi XLS A/T", year: 2018, price: 369000, km: "94,000 km", type: "SUV", fuel: "Diesel" },
            { id: "vw-polo", brand: "VOLKSWAGEN", model: "Polo Vivo 1.4 Trendline", year: 2020, price: 189000, km: "55,000 km", type: "Hatchback", fuel: "Petrol" },
            { id: "toyota-hilux", brand: "TOYOTA", model: "Hilux 2.8 GD-6 Legend 4x4", year: 2022, price: 589000, km: "45,000 km", type: "Bakkie Double Cab", fuel: "Diesel" }
        ];

        let visitorLead = {
            name: "Prospect Client",
            phone: "",
            vehicleInterest: "Browsing general",
            tradeInDetails: "",
            inspectionDate: "",
            testDriveDate: "",
            pathway: []
        };

        let activeSchedulerType = "";

        // Tab Swapping Controller
        function switchTab(evt, tabId) {
            const panel = evt.target.closest('.glass-panel');
            panel.querySelectorAll('.tab-trigger').forEach(btn => btn.classList.remove('active'));
            panel.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            evt.target.classList.add('active');
            document.getElementById(tabId).add?document.getElementById(tabId).classList.add('active'):null;
        }

        // Operational Hours Tracker
        function runHoursTracker() {
            const now = new Date();
            const day = now.getDay(); 
            const hr = now.getHours();
            const min = now.getMinutes();
            const totalMinutes = (hr * 60) + min;
            const badge = document.getElementById("showroom-status");

            if (day >= 1 && day <= 5) { // Mon - Fri: 07:30 to 17:30
                if (totalMinutes >= 450 && totalMinutes <= 1050) {
                    badge.innerHTML = `<span class="ycg-online-indicator"></span> Showroom Open (Newton Park)`;
                    badge.style.color = "var(--green)";
                    return;
                }
            } else if (day === 6) { // Sat: 07:30 to 13:00
                if (totalMinutes >= 450 && totalMinutes <= 780) {
                    badge.innerHTML = `<span class="ycg-online-indicator"></span> Showroom Open (Saturday)`;
                    badge.style.color = "var(--green)";
                    return;
                }
            }
            badge.innerHTML = `<span class="ycg-online-indicator" style="background:var(--red); box-shadow: 0 0 8px var(--red); animation: none;"></span> Showroom Closed (Offline)`;
            badge.style.color = "var(--red)";
        }

        // Toggle chat UI state
        function toggleChat(show) {
            const win = document.getElementById('ycg-chat-window');
            const launcher = document.getElementById('ycg-chat-launcher');
            const backdrop = document.getElementById('ycg-chat-backdrop');
            if (show) {
                win.style.display = 'flex';
                setTimeout(() => win.classList.add('open'), 20);
                backdrop.classList.add('show');
                launcher.style.opacity = '0';
                setTimeout(() => launcher.style.display = 'none', 300);
                logPathwayStep("Opened Showroom Assistant");
            } else {
                win.classList.remove('open');
                backdrop.classList.remove('show');
                setTimeout(() => {
                    win.style.display = 'none';
                    launcher.style.display = 'flex';
                    setTimeout(() => launcher.style.opacity = '1', 50);
                }, 400);
            }
        }

        function logPathwayStep(action) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            visitorLead.pathway.push({ action: action, time: timeStr });
            updateDashboardRow();
        }

        function updateDashboardRow() {
            let row = document.getElementById("lead-row-active");
            const tbody = document.querySelector("#leads-table-element tbody");

            if (!row) {
                row = document.createElement("tr");
                row.id = "lead-row-active";
                tbody.insertBefore(row, tbody.firstChild);
            }

            let bookingsHtml = "";
            if (visitorLead.testDriveDate) {
                bookingsHtml += `<div style="margin-bottom: 6px;"><span class="pill pill-booking">🚗 Test Drive: ${visitorLead.testDriveDate}</span></div>`;
            }
            if (visitorLead.tradeInDetails) {
                bookingsHtml += `<div class="crm-contact" style="margin-bottom: 4px;">Trade-in: ${visitorLead.tradeInDetails}</div>`;
                if (visitorLead.inspectionDate) {
                    bookingsHtml += `<div><span class="pill pill-inspection">🔄 Valuation: ${visitorLead.inspectionDate}</span></div>`;
                }
            }

            row.innerHTML = `
                <td>
                    <span class="crm-name" style="color:var(--gold);">${visitorLead.name} (You)</span>
                    <div class="crm-contact">${visitorLead.phone ? visitorLead.phone : 'Awaiting contact details...'} • Showroom visitor</div>
                </td>
                <td>
                    <span class="pill pill-interest">${visitorLead.vehicleInterest}</span>
                </td>
                <td>
                    ${bookingsHtml ? bookingsHtml : '<span style="color:var(--text-muted); font-style:italic; font-size:12px;">Configuring profile...</span>'}
                </td>
                <td>
                    <a class="action-button-whatsapp" onclick="dispatchLiveLead()">Handoff</a>
                    <button class="action-button-delete" onclick="deleteRow('active')">Delete</button>
                </td>
            `;
        }

        // Calendar Date Generation Utilities
        function getWorkingDays() {
            const days = [];
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            let today = new Date();

            while (days.length < 6) {
                today.setDate(today.getDate() + 1);
                if (today.getDay() !== 0) { // Exclude Sunday
                    days.push({
                        label: `${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]}`,
                        isSaturday: today.getDay() === 6
                    });
                }
            }
            return days;
        }

        function renderInlineScheduler(type) {
            activeSchedulerType = type;
            const history = document.getElementById('ycg-chat-history');
            const typing = document.getElementById('ycg-typing-indicator');
            const box = document.createElement('div');
            box.className = "inline-cal-box";
            
            const label = (type === 'test_drive') ? "Select Showroom Test Drive Date:" : "Select Inspection Date:";
            box.innerHTML = `<div class="inline-cal-title">${label}</div>`;

            const grid = document.createElement('div');
            grid.className = "inline-cal-grid";

            const dates = getWorkingDays();
            dates.forEach(date => {
                const btn = document.createElement('button');
                btn.className = "inline-cal-btn";
                btn.textContent = date.label;
                btn.onclick = () => {
                    box.querySelectorAll('.inline-cal-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    renderInlineTimeSlots(box, date.label, date.isSaturday);
                };
                grid.appendChild(btn);
            });

            box.appendChild(grid);

            const slotGrid = document.createElement('div');
            slotGrid.className = "inline-slots-grid";
            slotGrid.style.display = "none";
            box.appendChild(slotGrid);

            const confirmBtn = document.createElement('button');
            confirmBtn.className = "inline-confirm-btn";
            confirmBtn.style.display = "none";
            confirmBtn.textContent = "Confirm Booking Time";
            box.appendChild(confirmBtn);

            history.insertBefore(box, typing);
            history.scrollTop = history.scrollHeight;
        }

        function renderInlineTimeSlots(box, dateLabel, isSaturday) {
            const grid = box.querySelector('.inline-slots-grid');
            const confirm = box.querySelector('.inline-confirm-btn');
            grid.innerHTML = "";
            grid.style.display = "grid";

            const standardHours = ["09:00 AM", "11:00 AM", "02:00 PM", "04:00 PM"];
            const satHours = ["08:30 AM", "10:00 AM", "11:30 AM"];
            const hours = isSaturday ? satHours : standardHours;

            hours.forEach(hr => {
                const btn = document.createElement('button');
                btn.className = "inline-slot-btn";
                btn.textContent = hr;
                btn.onclick = () => {
                    box.querySelectorAll('.inline-slot-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    confirm.style.display = "block";
                    confirm.onclick = () => {
                        const finalTimestamp = `${dateLabel} @ ${hr}`;
                        box.style.pointerEvents = "none";
                        box.style.opacity = "0.7";
                        confirm.style.display = "none";

                        if (activeSchedulerType === 'test_drive') {
                            visitorLead.testDriveDate = finalTimestamp;
                            logPathwayStep(`Selected Test Drive: ${finalTimestamp}`);
                            addMessage(`Got it! I have scheduled your Test Drive on **${finalTimestamp}** at 17 Burt Drive, Newton Park.\n\nPlease share your phone number to complete.`);
                        } else {
                            visitorLead.inspectionDate = finalTimestamp;
                            logPathwayStep(`Selected Trade-In Inspection: ${finalTimestamp}`);
                            addMessage(`Awesome! Your Trade-In evaluation slot is confirmed for **${finalTimestamp}**.\n\nPlease drop your phone number here to finalize.`);
                        }
                    };
                };
                grid.appendChild(btn);
            });
        }

        // Base Chat Elements
        function addMessage(text, isUser = false, suggestions = []) {
            const history = document.getElementById('ycg-chat-history');
            const typing = document.getElementById('ycg-typing-indicator');
            const div = document.createElement('div');
            div.className = `ycg-message ${isUser ? 'user' : 'bot'}`;
            div.innerHTML = text.replace(/\n/g, '<br>');

            if (suggestions.length) {
                const sdiv = document.createElement('div');
                sdiv.className = 'ycg-suggestions';
                suggestions.forEach(s => {
                    const b = document.createElement('button');
                    b.className = 'ycg-suggestion-btn';
                    b.textContent = s;
                    b.onclick = () => {
                        addMessage(s, true);
                        processYcgInput(s);
                    };
                    sdiv.appendChild(b);
                });
                div.appendChild(sdiv);
            }

            history.insertBefore(div, typing);
            history.scrollTop = history.scrollHeight;
        }

        function handleSend() {
            const input = document.getElementById('ycg-user-input');
            const t = input.value.trim();
            if (!t) return;
            addMessage(t, true);
            input.value = '';
            processYcgInput(t);
        }

        function showTyping(show) {
            document.getElementById('ycg-typing-indicator').style.display = show ? 'flex' : 'none';
            const history = document.getElementById('ycg-chat-history');
            history.scrollTop = history.scrollHeight;
        }

        // Dialog Process
        function processYcgInput(text) {
            const lower = text.toLowerCase();
            showTyping(true);
            logPathwayStep(`Client: "${text}"`);

            setTimeout(() => {
                showTyping(false);

                // Phone parser
                const phoneMatched = text.match(/(?:\+27|0)\d{9}/);
                if (phoneMatched) {
                    visitorLead.phone = phoneMatched[0];
                    logPathwayStep(`Saved Phone: ${visitorLead.phone}`);
                    addMessage(`Thank you, I have registered your phone number (${visitorLead.phone}). \n\nOne of our showroom sales team members will follow up with you on WhatsApp shortly.`, false, ["Browse Catalog", "Address & Hours"]);
                    return;
                }

                // Name parser
                const nameMatched = text.match(/(?:my name is|i am|i'm|call me)\s+([a-zA-Z\s]{2,15})/i);
                if (nameMatched) {
                    visitorLead.name = nameMatched[1].trim();
                    logPathwayStep(`Identified Name: ${visitorLead.name}`);
                    addMessage(`Nice to connect with you, ${visitorLead.name}! How can I help you navigate our showroom portfolio?`, false, ["Browse Catalog", "I have a Trade-In"]);
                    return;
                }

                // Locations & Hours Info
                if (lower.includes('address') || lower.includes('location') || lower.includes('where') || lower.includes('hours') || lower.includes('open')) {
                    addMessage(`We look forward to welcoming you to our physical showroom:\n📍 **17 Burt Drive, Newton Park, Port Elizabeth**.\n\n*Working Hours:*\n• Mon–Fri: 07:30 – 17:30\n• Saturday: 07:30 – 13:00\n• Sunday: Closed`, false, ["Browse Catalog", "I have a Trade-In"]);
                    return;
                }

                // Catalog list trigger
                if (lower.includes('catalog') || lower.includes('stock') || lower.includes('inventory') || lower.includes('cars')) {
                    addMessage(`Here is a select range of pre-owned models currently available:`);
                    renderInlineCatalog(ycgCatalog);
                    return;
                }

                // Trade-In trigger
                if (lower.includes('trade-in') || lower.includes('sell my car') || lower.includes('valuation') || lower.includes('trade in')) {
                    addMessage(`We buy pre-owned vehicles daily. \n\nPlease describe your vehicle (Year, Make, Model, Mileage & General Condition):`);
                    visitorLead.tradeInDetails = "Awaiting input...";
                    return;
                }

                if (visitorLead.tradeInDetails === "Awaiting input...") {
                    visitorLead.tradeInDetails = text;
                    logPathwayStep(`Saved Trade-In specs: ${text}`);
                    addMessage(`Thank you for providing those vehicle details.\n\nLet's schedule a brief 15-minute physical valuation slot at our showroom:`);
                    setTimeout(() => { renderInlineScheduler('inspection'); }, 600);
                    return;
                }

                // Specific brand or model searches
                let matches = [];
                if (lower.includes('ranger') || lower.includes('ford') || lower.includes('everest')) {
                    matches = ycgCatalog.filter(c => c.brand === "FORD");
                } else if (lower.includes('hilux') || lower.includes('toyota')) {
                    matches = ycgCatalog.filter(c => c.brand === "TOYOTA");
                } else if (lower.includes('polo') || lower.includes('vw') || lower.includes('volkswagen')) {
                    matches = ycgCatalog.filter(c => c.brand === "VOLKSWAGEN");
                } else if (lower.includes('audi') || lower.includes('s3')) {
                    matches = ycgCatalog.filter(c => c.brand === "AUDI");
                }

                if (matches.length > 0) {
                    visitorLead.vehicleInterest = matches[0].brand + " " + matches[0].model;
                    logPathwayStep(`Matched: ${matches[0].brand} ${matches[0].model}`);
                    addMessage(`I found these matching options currently on our floor:`);
                    renderInlineCatalog(matches);
                    return;
                }

                // Default Fallback
                addYcgFallbackResponse(lower);

            }, 800);
        }

        function addYcgFallbackResponse(lower) {
            // Smart Fallback for Brands not currently in our database
            const alternatives = ["mercedes", "merc", "benz", "audi", "bmw", "isuzu", "nissan"];
            let detectedAlternative = alternatives.find(b => lower.includes(b));
            if (detectedAlternative) {
                addMessage(`We do not have any ${detectedAlternative.toUpperCase()} models in stock right now, but would you be interested in these premium pre-owned options?`);
                renderInlineCatalog(ycgCatalog.slice(0, 2));
                return;
            }

            addMessage(`I can guide you through our pre-owned stock, help you schedule showroom test drives, or arrange a valuation for a trade-in.\n\nWhat can we help you coordinate?`, false, ["Browse Catalog", "Trade-In Valuation"]);
        }

        function renderInlineCatalog(list) {
            const history = document.getElementById('ycg-chat-history');
            const typing = document.getElementById('ycg-typing-indicator');
            const container = document.createElement('div');
            container.style.width = "100%";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.gap = "8px";

            list.forEach(item => {
                const card = document.createElement('div');
                card.className = "showroom-item-card";
                card.innerHTML = `
                    <div class="showroom-item-title">${item.year} ${item.brand} ${item.model}</div>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Mileage: ${item.km} • ${item.fuel}</div>
                    <div class="showroom-item-price">R ${item.price.toLocaleString()}</div>
                    <div class="showroom-item-actions">
                        <button class="showroom-act-btn secondary" onclick="handleCardAction('${item.brand} ${item.model}', 'finance')">💰 Finance</button>
                        <button class="showroom-act-btn primary" onclick="handleCardAction('${item.brand} ${item.model}', 'test_drive')">🚗 Test Drive</button>
                    </div>
                `;
                container.appendChild(card);
            });

            history.insertBefore(container, typing);
            history.scrollTop = history.scrollHeight;
        }

        window.handleCardAction = function(carName, action) {
            visitorLead.vehicleInterest = carName;
            if (action === 'finance') {
                logPathwayStep(`Finance Query: ${carName}`);
                addMessage(`Estimating terms for the **${carName}**...\n\nStandard repayment terms are typically modeled over 60 or 72 months. Would you like our in-house finance department to set up a preliminary assessment?`, false, ["Yes, help with Finance", "Schedule Test Drive Instead"]);
            } else {
                logPathwayStep("Init Test Drive: " + carName);
                addMessage(`Let's book a showroom viewing for the **${carName}**.\n\nPlease pick an available date:`);
                setTimeout(() => { renderInlineScheduler('test_drive'); }, 600);
            }
        };

        const peShowroomNum = "27834659921";

        function dispatchMockLead(id) {
            let mockText = "";
            if (id === 1) {
                mockText = `🚗 *SHOWROOM TICKET: SIPHO NDLOVU* 🚗\n\n👤 *Client:* Sipho Ndlovu\n📞 *Phone:* 0824918823\n⭐ *Interest:* Ford Ranger Wildtrak\n\n🗓️ *Test Drive Booking:*\n👉 Mon 20 Jul @ 11:00 AM\n\n🔄 *Trade-in Valuation:*\n👉 2017 Nissan NP200\n🗓️ *Showroom Appointment:* Tue 21 Jul @ 09:00 AM`;
            } else if (id === 2) {
                mockText = `🚗 *SHOWROOM TICKET: SARAH BARKHUIZEN* 🚗\n\n👤 *Client:* Sarah Barkhuizen\n📞 *Phone:* 0735521904\n⭐ *Interest:* VW Polo Vivo 1.4\n\n🗓️ *Test Drive Booking:*\n👉 Wed 22 Jul @ 02:00 PM`;
            } else {
                mockText = `🚗 *SHOWROOM TICKET: JOHAN POTGIETER* 🚗\n\n👤 *Client:* Johan Potgieter\n📞 *Phone:* 0832217745\n⭐ *Interest:* Toyota Hilux Legend\n\n🔄 *Trade-in Valuation:*\n👉 2018 Toyota Hilux GD-6\n🗓️ *Showroom Appointment:* Mon 20 Jul @ 02:00 PM`;
            }
            window.open(`https://api.whatsapp.com/send?phone=${peShowroomNum}&text=${encodeURIComponent(mockText)}`, '_blank');
        }

        function dispatchLiveLead() {
            let msg = `🚗 *LIVE SHOWROOM TICKET* 🚗\n\n`;
            msg += `👤 *Client:* ${visitorLead.name}\n`;
            msg += `📞 *Phone:* ${visitorLead.phone ? visitorLead.phone : 'Not provided'}\n`;
            msg += `⭐ *Interest:* ${visitorLead.vehicleInterest}\n\n`;

            if (visitorLead.testDriveDate) {
                msg += `🗓️ *Test Drive Booking:*\n👉 ${visitorLead.testDriveDate}\n\n`;
            }
            if (visitorLead.tradeInDetails) {
                msg += `🔄 *Trade-In Details:*\n👉 ${visitorLead.tradeInDetails}\n`;
                if (visitorLead.inspectionDate) {
                    msg += `🗓️ *Valuation Slot:* ${visitorLead.inspectionDate}\n\n`;
                }
            }

            msg += `👣 *Client Pathway Traces:*\n`;
            visitorLead.pathway.forEach((step, idx) => {
                msg += `${idx + 1}. [${step.time}] ${step.action}\n`;
            });

            window.open(`https://api.whatsapp.com/send?phone=${peShowroomNum}&text=${encodeURIComponent(msg)}`, '_blank');
        }

        function deleteRow(id) {
            const row = document.getElementById(`lead-row-${id}`);
            if (row) row.remove();
        }

        window.onload = () => {
            runHoursTracker();
            setInterval(runHoursTracker, 30000);

            setTimeout(() => {
                addMessage(`Hello! I'm your virtual **Your Car Guy** showroom assistant. \n\nHow can I help you navigate our available stock, schedule a showroom test drive, or register a trade-in evaluation slot today?`, false, ["Browse Catalog", "Valuation / Trade-In", "Showroom Hours"]);
            }, 800);
        };