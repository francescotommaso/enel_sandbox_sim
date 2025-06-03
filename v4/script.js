// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Tariff Constants ---
    const TARIFF_FIXED_CHARGE = 8.68;

    // Volumetric Charges (per kWh)
    const VOLUMETRIC_RATE_0_6 = 0.27;    // 00:00 - 05:59
    const VOLUMETRIC_RATE_17_21 = 0.46;  // 17:00 - 17:59 and 21:00 - 21:59
    const VOLUMETRIC_RATE_18_20 = 0.86;  // 18:00 - 20:59
    const VOLUMETRIC_RATE_OTHER = 0.31;  // Other hours

    // Demand Charges (per kW of peak hourly demand in the window)
    const DEMAND_RATE_0_6 = 1.31;        // 00:00 - 05:59
    const DEMAND_RATE_17_21 = 7.85;      // 17:00 - 17:59 and 21:00 - 21:59
    const DEMAND_RATE_18_20 = 15.70;      // 18:00 - 20:59
    const DEMAND_RATE_OTHER = 2.62;     // Other hours

    const DAYS_IN_MONTH = 30;
    const BASE_DEMAND_WATTS = 200; // <--- NEW: Constant Base Demand

    // --- Time Constants ---
    const MIN_TIME_MINUTES = 0 * 60; // 00:00
    const MAX_TIME_MINUTES = 24 * 60; // 24:00 (exclusive for loops, represents up to 23:59:59)
    const TIME_STEP_MINUTES = 15;
    const DEFAULT_DURATION_MINUTES = 30;
    const MIN_DURATION_MINUTES = 5;
    const MAX_DURATION_MINUTES = 120;
    const DURATION_STEP_MINUTES = 5;
    const MIN_APPLIANCE_COUNT = 1;
    const MAX_APPLIANCE_COUNT = 5;

    // --- Appliance Definitions ---
    const appliances = [
        { id: 'electric-shower', name: 'Chuveiro Elétrico', power: 5500, count: 1, iconBW: 'icons/shower_bw.png', iconColor: 'icons/shower_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'washing-machine', name: 'Máquina de Lavar', power: 600, count: 1, iconBW: 'icons/washing_machine_bw.png', iconColor: 'icons/washing_machine_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'vacuum-cleaner', name: 'Aspirador de Pó', power: 1000, count: 1, iconBW: 'icons/vacuum_bw.png', iconColor: 'icons/vacuum_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'iron', name: 'Ferro de Passar', power: 1500, count: 1, iconBW: 'icons/iron_bw.png', iconColor: 'icons/iron_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'air-fryer', name: 'Fritadeira Elétrica', power: 1500, count: 1, iconBW: 'icons/air_fryer_bw.png', iconColor: 'icons/air_fryer_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'electric-oven', name: 'Forno de Micro-ondas', power: 3000, count: 1, iconBW: 'icons/oven_bw.png', iconColor: 'icons/oven_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] }
    ];

    // --- DOM Element References ---
    const applianceGrid = document.querySelector('.appliance-grid');
    const initialTimeSlidersContainer = document.getElementById('initial-time-sliders-container');
    const adjustedTimeSlidersContainer = document.getElementById('adjusted-time-sliders-container');

    // --- Chart Instances ---
    let initialLoadCurveChartInstance = null;
    let updatedLoadCurveChartInstance = null;
    let costComparisonChartInstance = null;

    // --- Initialize Appliance Icons ---
    appliances.forEach(app => {
        const item = document.createElement('div');
        item.classList.add('appliance-item');
        item.dataset.appliance = app.id;
        const img = document.createElement('img');
        img.src = app.iconBW; img.alt = app.name; img.dataset.bw = app.iconBW; img.dataset.color = app.iconColor;
        const p = document.createElement('p');
        p.textContent = app.name;
        item.appendChild(img); item.appendChild(p);
        applianceGrid.appendChild(item);
        item.addEventListener('click', () => toggleApplianceSelection(item, app));
    });

    function clearAdjustedReferences(appObject) {
        appObject.adjustedTicks = [];
        appObject.adjustedStartSliders = [];
        appObject.adjustedStartValueSpans = [];
        appObject.adjustedDurationValueSpans = [];
        appObject.adjustedEndValueSpans = [];
    }

    function updateInitialStartTick(tickElement, initialStartTime, sliderMin, sliderMax) {
        if (!tickElement) return;
        if (initialStartTime >= sliderMin && initialStartTime <= sliderMax) {
            const sliderRange = sliderMax - sliderMin;
            if (sliderRange > 0) {
                const tickPositionPercent = ((initialStartTime - sliderMin) / sliderRange) * 100;
                tickElement.style.left = `${tickPositionPercent}%`;
                tickElement.style.display = 'block';
            } else {
                if (initialStartTime === sliderMin) {
                    tickElement.style.left = '0%';
                    tickElement.style.display = 'block';
                } else {
                    tickElement.style.display = 'none';
                }
            }
        } else {
            tickElement.style.display = 'none';
        }
    }

    function manageApplianceSlots(appliance, slotArrayKey) {
        const slots = appliance[slotArrayKey];
        if (!slots) {
            appliance[slotArrayKey] = [];
        }
        const desiredSlots = appliance.count || MIN_APPLIANCE_COUNT;
        const createNewSlot = (start = MIN_TIME_MINUTES, duration = DEFAULT_DURATION_MINUTES) => {
            let constrainedStart = Math.max(MIN_TIME_MINUTES, Math.min(start, MAX_TIME_MINUTES - duration));
            let constrainedDuration = duration;
            if (constrainedStart + constrainedDuration > MAX_TIME_MINUTES) {
                 constrainedDuration = MAX_TIME_MINUTES - constrainedStart;
            }
            if (constrainedDuration < MIN_DURATION_MINUTES) {
                constrainedDuration = MIN_DURATION_MINUTES;
                if (constrainedStart + constrainedDuration > MAX_TIME_MINUTES) {
                    constrainedStart = MAX_TIME_MINUTES - constrainedDuration;
                }
            }
            constrainedStart = Math.max(MIN_TIME_MINUTES, constrainedStart);
            return { start: constrainedStart, duration: constrainedDuration, end: constrainedStart + constrainedDuration };
        };
        while (slots.length < desiredSlots) slots.push(createNewSlot());
        if (slots.length > desiredSlots) slots.length = desiredSlots;
        slots.forEach(slot => {
            slot.duration = slot.duration !== undefined ? slot.duration : DEFAULT_DURATION_MINUTES;
            slot.start = slot.start !== undefined ? slot.start : MIN_TIME_MINUTES;
            slot.start = Math.max(MIN_TIME_MINUTES, Math.min(slot.start, MAX_TIME_MINUTES - MIN_DURATION_MINUTES));
            if (slot.start + slot.duration > MAX_TIME_MINUTES) {
                slot.duration = MAX_TIME_MINUTES - slot.start;
            }
            if (slot.duration < MIN_DURATION_MINUTES) {
                slot.duration = MIN_DURATION_MINUTES;
                if (slot.start + slot.duration > MAX_TIME_MINUTES) {
                    slot.start = MAX_TIME_MINUTES - slot.duration;
                }
            }
            slot.start = Math.max(MIN_TIME_MINUTES, slot.start);
            slot.end = slot.start + slot.duration;
        });
    }

    function toggleApplianceSelection(itemElement, appObject) {
        appObject.selected = !appObject.selected;
        itemElement.classList.toggle('selected');
        const img = itemElement.querySelector('img');
        img.src = appObject.selected ? appObject.iconColor : appObject.iconBW;
        clearAdjustedReferences(appObject);
        if (appObject.selected) {
            if (typeof appObject.count === 'undefined') appObject.count = MIN_APPLIANCE_COUNT;
            manageApplianceSlots(appObject, 'usageSlots');
            appObject.adjustedUsageSlots = JSON.parse(JSON.stringify(appObject.usageSlots));
        } else {
            appObject.usageSlots.length = 0;
            appObject.adjustedUsageSlots.length = 0;
        }
        updateAllTimesSliders();
        recalculateAndDisplayAllScenarios();
    }

    function updateAllTimesSliders() {
        appliances.forEach(app => clearAdjustedReferences(app));
        updateSpecificTimesSliders(initialTimeSlidersContainer, 'usageSlots', 'Initial');
        updateSpecificTimesSliders(adjustedTimeSlidersContainer, 'adjustedUsageSlots', 'Adjusted');
    }

    function updateSpecificTimesSliders(container, slotArrayKey, scenarioLabelPrefix) {
        container.innerHTML = '';
        appliances.forEach(app => {
            if (app.selected) {
                manageApplianceSlots(app, slotArrayKey);
                if (slotArrayKey === 'adjustedUsageSlots' && app.usageSlots.length === app.adjustedUsageSlots.length) {
                     app.adjustedUsageSlots.forEach((adjSlot, index) => {
                        const initialSlot = app.usageSlots[index];
                        if (initialSlot) {
                            adjSlot.duration = initialSlot.duration;
                            adjSlot.start = adjSlot.start !== undefined ? adjSlot.start : initialSlot.start;
                            if (adjSlot.start + adjSlot.duration > MAX_TIME_MINUTES) {
                                adjSlot.start = MAX_TIME_MINUTES - adjSlot.duration;
                            }
                            adjSlot.start = Math.max(MIN_TIME_MINUTES, adjSlot.start);
                            adjSlot.end = adjSlot.start + adjSlot.duration;
                        }
                    });
                }
                createTimeControlsForAppliance(app, slotArrayKey, container, scenarioLabelPrefix);
            }
        });
    }

    function createTimeControlsForAppliance(appliance, slotArrayKey, parentContainer, scenarioLabelPrefix) {
        const applianceControlDiv = document.createElement('div');
        applianceControlDiv.classList.add('appliance-time-controls');
        applianceControlDiv.dataset.applianceId = appliance.id;

        if (slotArrayKey === 'usageSlots') {
            const countControlDiv = document.createElement('div');
            countControlDiv.classList.add('appliance-count-control');
            const countInputId = `${appliance.id}-count-input`;
            countControlDiv.innerHTML = `
                <label for="${countInputId}">Número de usos de ${appliance.name}:</label>
                <input type="number" id="${countInputId}" value="${appliance.count || MIN_APPLIANCE_COUNT}" min="${MIN_APPLIANCE_COUNT}" max="${MAX_APPLIANCE_COUNT}">
            `;
            applianceControlDiv.appendChild(countControlDiv);
            const countInputEl = countControlDiv.querySelector(`#${countInputId}`);
            countInputEl.addEventListener('change', () => {
                let newCount = parseInt(countInputEl.value) || MIN_APPLIANCE_COUNT;
                newCount = Math.max(MIN_APPLIANCE_COUNT, Math.min(newCount, MAX_APPLIANCE_COUNT));
                countInputEl.value = newCount;
                appliance.count = newCount;
                clearAdjustedReferences(appliance);
                manageApplianceSlots(appliance, 'usageSlots');
                appliance.adjustedUsageSlots = JSON.parse(JSON.stringify(appliance.usageSlots));
                manageApplianceSlots(appliance, 'adjustedUsageSlots');
                updateAllTimesSliders();
                recalculateAndDisplayAllScenarios();
            });
        }

        let mainTitleText = appliance.name;
        const currentApplianceCount = appliance.count || MIN_APPLIANCE_COUNT;
        if (currentApplianceCount > 1) mainTitleText = `${appliance.name} (${currentApplianceCount} ${currentApplianceCount > 1 ? 'usos' : 'uso'})`;
        const mainTitleElement = document.createElement('h3');
        mainTitleElement.textContent = mainTitleText;
        applianceControlDiv.appendChild(mainTitleElement);

        const currentSlots = appliance[slotArrayKey];
        if (!currentSlots) return;

        currentSlots.forEach((slot, index) => {
            if (!slot) return;
            const initialSlotForAdjusted = (slotArrayKey === 'adjustedUsageSlots' && appliance.usageSlots && appliance.usageSlots[index])
                                         ? appliance.usageSlots[index]
                                         : null;

            let slotDurationToUse;
            if (slotArrayKey === 'adjustedUsageSlots' && initialSlotForAdjusted) {
                slotDurationToUse = initialSlotForAdjusted.duration;
                slot.duration = slotDurationToUse;
            } else {
                slotDurationToUse = slot.duration !== undefined ? slot.duration : DEFAULT_DURATION_MINUTES;
            }

            slot.start = slot.start !== undefined ? slot.start : MIN_TIME_MINUTES;
            if (slot.start + slotDurationToUse > MAX_TIME_MINUTES) {
                slot.start = MAX_TIME_MINUTES - slotDurationToUse;
            }
            slot.start = Math.max(MIN_TIME_MINUTES, slot.start);
            slot.end = slot.start + slotDurationToUse;

            const slotDiv = document.createElement('div');
            slotDiv.classList.add('time-slot-controls');
            let slotTitleText = `Horário de Uso`;
            if (currentApplianceCount > 1) slotTitleText = `Horário de Uso ${appliance.name} ${index + 1}`;
            const slotTitleElement = document.createElement('h4');
            slotTitleElement.textContent = slotTitleText;
            slotDiv.appendChild(slotTitleElement);

            const finalSlotDuration = slotDurationToUse;
            const ids = {
                startSlider: `${appliance.id}-${slotArrayKey}-start-${index}`,
                startValue: `${appliance.id}-${slotArrayKey}-start-value-${index}`,
                durationValue: `${appliance.id}-${slotArrayKey}-duration-value-${index}`,
                durationSelect: `${appliance.id}-${slotArrayKey}-duration-${index}`,
                endValue: `${appliance.id}-${slotArrayKey}-end-value-${index}`
            };

            const maxStartSliderValue = MAX_TIME_MINUTES - Math.max(finalSlotDuration, MIN_DURATION_MINUTES);
            let controlsHTML = `
                <div class="control-row">
                    <div class="label-group">
                        <label for="${ids.startSlider}">Hora de Início:</label>
                        <span id="${ids.startValue}" class="time-value">${formatTime(slot.start)}</span>
                    </div>
                    <div class="input-wrapper">
                        <input type="range" id="${ids.startSlider}"
                               min="${MIN_TIME_MINUTES}"
                               max="${maxStartSliderValue}"
                               value="${slot.start}"
                               step="${TIME_STEP_MINUTES}">
                    </div>
                </div>
            `;

            if (slotArrayKey === 'usageSlots') {
                controlsHTML += `
                    <div class="control-row">
                        <div class="label-group">
                            <label for="${ids.durationSelect}">Duração:</label>
                            <span id="${ids.durationValue}" class="duration-value">${slot.duration} min</span>
                        </div>
                        <div class="input-wrapper">
                            <select id="${ids.durationSelect}">`;
                for (let d = MIN_DURATION_MINUTES; d <= MAX_DURATION_MINUTES; d += DURATION_STEP_MINUTES) {
                    controlsHTML += `<option value="${d}" ${d === slot.duration ? 'selected' : ''}>${d} min</option>`;
                }
                controlsHTML += `</select>
                        </div>
                    </div>
                `;
            } else {
                controlsHTML += `
                    <div class="control-row">
                        <div class="label-group">
                            <label>Duração:</label>
                            <span id="${ids.durationValue}" class="duration-value">${finalSlotDuration} min</span>
                        </div>
                        <div class="input-wrapper"> </div>
                    </div>
                `;
            }
            controlsHTML += `
                <div class="control-row">
                    <div class="label-group">
                        <label>Hora de Término:</label>
                        <span id="${ids.endValue}" class="time-value">${formatTime(slot.end)}</span>
                    </div>
                </div>
            `;
            slotDiv.innerHTML += controlsHTML;

            const startSliderEl = slotDiv.querySelector(`#${ids.startSlider}`);
            const startValueEl = slotDiv.querySelector(`#${ids.startValue}`);
            const durationValueEl = slotDiv.querySelector(`#${ids.durationValue}`);
            const endValueEl = slotDiv.querySelector(`#${ids.endValue}`);
            const durationSelectEl = (slotArrayKey === 'usageSlots') ? slotDiv.querySelector(`#${ids.durationSelect}`) : null;
            let initialStartTickEl = null;
            let referenceP = null;

            if (slotArrayKey === 'adjustedUsageSlots') {
                appliance.adjustedStartSliders[index] = startSliderEl;
                appliance.adjustedStartValueSpans[index] = startValueEl;
                appliance.adjustedDurationValueSpans[index] = durationValueEl;
                appliance.adjustedEndValueSpans[index] = endValueEl;
                if (initialSlotForAdjusted) {
                    const inputWrapperForStartSlider = startSliderEl.closest('.input-wrapper');
                    if (inputWrapperForStartSlider) {
                        initialStartTickEl = document.createElement('div');
                        initialStartTickEl.classList.add('initial-start-tick');
                        inputWrapperForStartSlider.appendChild(initialStartTickEl);
                        appliance.adjustedTicks[index] = initialStartTickEl;
                        updateInitialStartTick(initialStartTickEl, initialSlotForAdjusted.start, parseInt(startSliderEl.min), parseInt(startSliderEl.max));
                    }
                    referenceP = document.createElement('p');
                    referenceP.classList.add('initial-slot-reference');
                    referenceP.innerHTML = `<em>Ref. Inicial: Início ${formatTime(initialSlotForAdjusted.start)}, Duração ${initialSlotForAdjusted.duration} min (Término ${formatTime(initialSlotForAdjusted.start + initialSlotForAdjusted.duration)})</em>`;
                    slotDiv.appendChild(referenceP);
                }
            }
            if (index < currentSlots.length - 1) slotDiv.appendChild(document.createElement('hr'));
            applianceControlDiv.appendChild(slotDiv);

            if (slotArrayKey === 'usageSlots') { // Event Listeners for INITIAL SLOTS
                startSliderEl.addEventListener('input', () => {
                    slot.start = parseInt(startSliderEl.value);
                    slot.end = slot.start + slot.duration;
                    startValueEl.textContent = formatTime(slot.start);
                    endValueEl.textContent = formatTime(slot.end);

                    const tickToUpdate = appliance.adjustedTicks[index];
                    const relevantAdjustedSlider = appliance.adjustedStartSliders[index];
                    if (tickToUpdate && relevantAdjustedSlider) {
                        updateInitialStartTick(tickToUpdate, slot.start, parseInt(relevantAdjustedSlider.min), parseInt(relevantAdjustedSlider.max));
                    }
                    const adjustedSlotControls = relevantAdjustedSlider?.closest('.time-slot-controls');
                    const adjustedRefP = adjustedSlotControls?.querySelector('.initial-slot-reference');
                    if (adjustedRefP) {
                        adjustedRefP.innerHTML = `<em>Ref. Inicial: Início ${formatTime(slot.start)}, Duração ${slot.duration} min (Término ${formatTime(slot.end)})</em>`;
                    }
                    recalculateAndDisplayAllScenarios();
                });

                durationSelectEl.addEventListener('change', () => {
                    const newDuration = parseInt(durationSelectEl.value);
                    slot.duration = newDuration;
                    if (slot.start + newDuration > MAX_TIME_MINUTES) {
                        slot.start = MAX_TIME_MINUTES - newDuration;
                    }
                    slot.start = Math.max(MIN_TIME_MINUTES, slot.start);
                    slot.end = slot.start + newDuration;

                    startSliderEl.max = MAX_TIME_MINUTES - newDuration;
                    startSliderEl.value = slot.start;
                    durationValueEl.textContent = `${newDuration} min`;
                    startValueEl.textContent = formatTime(slot.start);
                    endValueEl.textContent = formatTime(slot.end);

                    const adjustedSlotData = appliance.adjustedUsageSlots[index];
                    const adjSlider = appliance.adjustedStartSliders[index];
                    const adjTick = appliance.adjustedTicks[index];
                    const adjStartSpan = appliance.adjustedStartValueSpans[index];
                    const adjDurSpan = appliance.adjustedDurationValueSpans[index];
                    const adjEndSpan = appliance.adjustedEndValueSpans[index];
                    const adjustedSlotControls = adjSlider?.closest('.time-slot-controls');
                    const adjRefP = adjustedSlotControls?.querySelector('.initial-slot-reference');

                    if (adjustedSlotData && adjSlider && adjDurSpan && adjStartSpan && adjEndSpan) {
                        adjustedSlotData.duration = newDuration;
                        adjSlider.max = MAX_TIME_MINUTES - newDuration;
                        if (adjustedSlotData.start + newDuration > MAX_TIME_MINUTES) {
                            adjustedSlotData.start = MAX_TIME_MINUTES - newDuration;
                        }
                        adjustedSlotData.start = Math.max(MIN_TIME_MINUTES, adjustedSlotData.start);

                        if (parseInt(adjSlider.value) > parseInt(adjSlider.max)) {
                             adjustedSlotData.start = parseInt(adjSlider.max);
                        } else if (parseInt(adjSlider.value) < parseInt(adjSlider.min)) {
                             adjustedSlotData.start = parseInt(adjSlider.min);
                        }
                        adjSlider.value = adjustedSlotData.start;
                        adjustedSlotData.end = adjustedSlotData.start + newDuration;

                        adjDurSpan.textContent = `${newDuration} min`;
                        adjStartSpan.textContent = formatTime(adjustedSlotData.start);
                        adjEndSpan.textContent = formatTime(adjustedSlotData.end);
                        if (adjTick) {
                            updateInitialStartTick(adjTick, slot.start, parseInt(adjSlider.min), parseInt(adjSlider.max));
                        }
                         if (adjRefP) {
                             adjRefP.innerHTML = `<em>Ref. Inicial: Início ${formatTime(slot.start)}, Duração ${newDuration} min (Término ${formatTime(slot.end)})</em>`;
                        }
                    }
                    recalculateAndDisplayAllScenarios();
                });
            } else { // Event Listeners for ADJUSTED SLOTS
                startSliderEl.addEventListener('input', () => {
                    slot.start = parseInt(startSliderEl.value);
                    const initialSlot = appliance.usageSlots[index];
                    if (initialSlot) {
                        slot.duration = initialSlot.duration;
                    } else {
                        slot.duration = slot.duration || DEFAULT_DURATION_MINUTES;
                    }
                    slot.end = slot.start + slot.duration;
                    startValueEl.textContent = formatTime(slot.start);
                    endValueEl.textContent = formatTime(slot.end);
                    recalculateAndDisplayAllScenarios();
                });
            }
        });
        parentContainer.appendChild(applianceControlDiv);
    }

    function formatTime(minutesFromMidnight) {
        const totalMinutes = minutesFromMidnight % (24 * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function getTouPeriod(hour) {
        if (hour >= 0 && hour < 6) return '0-6';
        if (hour === 17 || hour === 21) return '17_21';
        if (hour >= 18 && hour < 21) return '18-20';
        return 'other';
    }

    function calculateScenarioData(selectedAppliances, slotArrayKey) {
        const timeLabels = [];
        const powerProfileWatts = [];
        const timeIntervalMinutes = TIME_STEP_MINUTES;
        const timeIntervalHours = timeIntervalMinutes / 60; // 0.25 hours
        const baseDemandKWhPerInterval = (BASE_DEMAND_WATTS / 1000) * timeIntervalHours;

        const dailyEnergyKWhByPeriod = {
            '0-6': 0,
            '17_21': 0,
            '18-20': 0,
            'other': 0
        };

        // Initialize power profile with base demand and calculate base demand energy
        for (let t_mins = MIN_TIME_MINUTES; t_mins < MAX_TIME_MINUTES; t_mins += timeIntervalMinutes) {
            timeLabels.push(formatTime(t_mins));
            powerProfileWatts.push(BASE_DEMAND_WATTS); // Start each interval with base demand

            // Add base demand energy to the correct ToU period
            const hourOfIntervalStart = Math.floor(t_mins / 60);
            const touPeriod = getTouPeriod(hourOfIntervalStart);
            dailyEnergyKWhByPeriod[touPeriod] += baseDemandKWhPerInterval;
        }

        // Add appliance consumption to power profile and energy
        selectedAppliances.forEach(app => {
            if (app.selected && app[slotArrayKey]) {
                const slots = app[slotArrayKey];
                slots.forEach(slot => {
                    if (!slot || typeof slot.start === 'undefined' || typeof slot.duration === 'undefined' || slot.duration === 0) return;
                    const currentSlotStart = slot.start;
                    const currentSlotEnd = slot.start + slot.duration;

                    for (let t_idx = 0; t_idx < powerProfileWatts.length; t_idx++) {
                        const intervalStartMinutes = MIN_TIME_MINUTES + (t_idx * timeIntervalMinutes);
                        const intervalEndMinutes = intervalStartMinutes + timeIntervalMinutes;

                        if (currentSlotStart < intervalEndMinutes && currentSlotEnd > intervalStartMinutes) {
                            powerProfileWatts[t_idx] += app.power; // Add appliance power to base demand

                            // Calculate additional energy from this appliance for this interval
                            const appliancePowerKw = app.power / 1000;
                            const applianceEnergyInIntervalKWh = appliancePowerKw * timeIntervalHours;
                            const hourOfIntervalStart = Math.floor(intervalStartMinutes / 60);
                            const touPeriod = getTouPeriod(hourOfIntervalStart);
                            dailyEnergyKWhByPeriod[touPeriod] += applianceEnergyInIntervalKWh;
                        }
                    }
                });
            }
        });

        let totalMonthlyVolumetricCharge = 0;
        totalMonthlyVolumetricCharge += (dailyEnergyKWhByPeriod['0-6'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_0_6);
        totalMonthlyVolumetricCharge += (dailyEnergyKWhByPeriod['17_21'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_17_21);
        totalMonthlyVolumetricCharge += (dailyEnergyKWhByPeriod['18-20'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_18_20);
        totalMonthlyVolumetricCharge += (dailyEnergyKWhByPeriod['other'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_OTHER);

        const hourlyDemandsKw = [];
        const intervalsPerHour = 60 / timeIntervalMinutes;
        for (let hour = 0; hour < (MAX_TIME_MINUTES / 60); hour++) {
            let sumOfPowerInHourWatts = 0;
            let countOfIntervalsInHour = 0;
            const startIntervalIndex = hour * intervalsPerHour;
            const endIntervalIndex = startIntervalIndex + intervalsPerHour;
            for (let i = startIntervalIndex; i < endIntervalIndex && i < powerProfileWatts.length; i++) {
                sumOfPowerInHourWatts += powerProfileWatts[i];
                countOfIntervalsInHour++;
            }
            if (countOfIntervalsInHour > 0) {
                hourlyDemandsKw.push((sumOfPowerInHourWatts / countOfIntervalsInHour) / 1000);
            } else {
                // This case should ideally not happen if powerProfileWatts covers all intervals
                // If it does, it implies an issue with loop bounds or MAX_TIME_MINUTES.
                // For safety, push the base demand in kW if no appliance activity.
                hourlyDemandsKw.push(BASE_DEMAND_WATTS / 1000);
            }
        }

        let totalDemandCharge = 0;
        const peakDemandByPeriod = {
            '0-6': 0,
            '17_21': 0,
            '18-20': 0,
            'other': 0
        };

        for (let hour = 0; hour < hourlyDemandsKw.length; hour++) {
            const demandThisHourKw = hourlyDemandsKw[hour];
            const touPeriod = getTouPeriod(hour);
            if (demandThisHourKw > peakDemandByPeriod[touPeriod]) {
                peakDemandByPeriod[touPeriod] = demandThisHourKw;
            }
        }
        // Ensure base demand is at least considered if no appliances push it higher in a period
        for (const period in peakDemandByPeriod) {
            if (peakDemandByPeriod[period] < (BASE_DEMAND_WATTS / 1000)) {
                 peakDemandByPeriod[period] = (BASE_DEMAND_WATTS / 1000);
            }
        }


        totalDemandCharge += (peakDemandByPeriod['0-6'] * DEMAND_RATE_0_6);
        totalDemandCharge += (peakDemandByPeriod['17_21'] * DEMAND_RATE_17_21);
        totalDemandCharge += (peakDemandByPeriod['18-20'] * DEMAND_RATE_18_20);
        totalDemandCharge += (peakDemandByPeriod['other'] * DEMAND_RATE_OTHER);

        const overallPeakHourlyDemandKw = hourlyDemandsKw.length > 0 ? Math.max(0, ...hourlyDemandsKw.filter(d => !isNaN(d) && isFinite(d))) : 0;
        const totalCost = TARIFF_FIXED_CHARGE + totalMonthlyVolumetricCharge + totalDemandCharge;

        const volumetricChargeBreakdown = {
            '0-6': dailyEnergyKWhByPeriod['0-6'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_0_6,
            '17_21': dailyEnergyKWhByPeriod['17_21'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_17_21,
            '18-20': dailyEnergyKWhByPeriod['18-20'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_18_20,
            'other': dailyEnergyKWhByPeriod['other'] * DAYS_IN_MONTH * VOLUMETRIC_RATE_OTHER,
        };
        const demandChargeBreakdown = {
            '0-6': peakDemandByPeriod['0-6'] * DEMAND_RATE_0_6,
            '17_21': peakDemandByPeriod['17_21'] * DEMAND_RATE_17_21,
            '18-20': peakDemandByPeriod['18-20'] * DEMAND_RATE_18_20,
            'other': peakDemandByPeriod['other'] * DEMAND_RATE_OTHER,
        };
         // Recalculate total energy from the daily breakdown for accuracy
        let totalDailyKWh = Object.values(dailyEnergyKWhByPeriod).reduce((sum, val) => sum + val, 0);


        return {
            loadProfileWatts: powerProfileWatts,
            hourlyDemandsKw,
            peakHourlyDemandKw: overallPeakHourlyDemandKw,
            peakDemandByToU: peakDemandByPeriod,
            totalCost,
            fixedCharge: TARIFF_FIXED_CHARGE,
            totalVolumetricCharge: totalMonthlyVolumetricCharge,
            volumetricChargeBreakdown,
            totalDemandCharge: totalDemandCharge,
            demandChargeBreakdown,
            dailyEnergyKWhByPeriod, // This now includes base load energy
            totalDailyKWh, // Total daily energy consumption
            timeLabels
        };
    }


    function recalculateAndDisplayAllScenarios() {
        const selectedApps = appliances.filter(a => a.selected);
        const initialScenario = calculateScenarioData(selectedApps, 'usageSlots');
        const adjustedScenario = calculateScenarioData(selectedApps, 'adjustedUsageSlots');

        const chartXAxisLabel = `Horário (00:00-${formatTime(MAX_TIME_MINUTES - TIME_STEP_MINUTES)})`;

        plotLoadCurve(initialScenario.loadProfileWatts, initialScenario.timeLabels, 'initialLoadCurveChart', 'initialLoadCurveChartInstance', 'Perfil de Demanda Inicial (Watts)', chartXAxisLabel);
        document.getElementById('initial-cost').textContent = `R$${initialScenario.totalCost.toFixed(2)}`;

        plotUpdatedLoadCurvesComparison(initialScenario.loadProfileWatts, adjustedScenario.loadProfileWatts, initialScenario.timeLabels, chartXAxisLabel);
        document.getElementById('new-cost').textContent = `R$${adjustedScenario.totalCost.toFixed(2)}`;

        plotCostComparisonStacked(initialScenario, adjustedScenario);
        generateTips(adjustedScenario, selectedApps); // Pass the whole scenario object
    }

    function plotLoadCurve(loadDataWatts, labelsArray, canvasId, instanceVarName, datasetLabel, xAxisLabel) {
        const canvas = document.getElementById(canvasId); if (!canvas) return; const ctx = canvas.getContext('2d');
        if (window[instanceVarName]) window[instanceVarName].destroy();
        window[instanceVarName] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labelsArray,
                datasets: [{
                    label: datasetLabel,
                    data: loadDataWatts,
                    borderColor: 'rgb(75,192,192)',
                    backgroundColor: 'rgba(75,192,192,0.2)',
                    tension: 0.1,
                    fill: true,
                    pointRadius: 0, // Hide points for base load curve
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Potência (Watts)' } }, // beginAtZero: false to better see base load
                    x: { title: { display: true, text: xAxisLabel } }
                },
                animation: { duration: 0 }
            }
        });
    }

    function plotUpdatedLoadCurvesComparison(initialProfileWatts, adjustedProfileWatts, labelsArray, xAxisLabel) {
        const canvas = document.getElementById('updatedLoadCurveChart'); if (!canvas) return; const ctx = canvas.getContext('2d');
        if (window.updatedLoadCurveChartInstance) window.updatedLoadCurveChartInstance.destroy();
        window.updatedLoadCurveChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labelsArray,
                datasets: [
                    { label: 'Demanda Inicial (Watts)', data: initialProfileWatts, borderColor: 'rgba(255,99,132,1)', backgroundColor: 'rgba(255,99,132,0.1)', tension: 0.1, fill: false, pointRadius: 2, borderWidth: 1.5 },
                    { label: 'Demanda Ajustada (Watts)', data: adjustedProfileWatts, borderColor: 'rgba(54,162,235,1)', backgroundColor: 'rgba(54,162,235,0.1)', tension: 0.1, fill: false, pointRadius: 2, borderWidth: 1.5 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Potência (Watts)' } }, // beginAtZero: false
                    x: { title: { display: true, text: xAxisLabel } }
                },
                animation: { duration: 0 }
            }
        });
    }

    function plotCostComparisonStacked(initialScen, adjustedScen) {
        const canvas = document.getElementById('costComparisonChart'); if (!canvas) return; const ctx = canvas.getContext('2d');
        if (costComparisonChartInstance) costComparisonChartInstance.destroy();

        // Assign all datasets to the same stack group, e.g., 'totalBill'
        const stackGroup = 'totalBill';

        const datasets = [
            { label: 'Taxa Fixa', data: [initialScen.fixedCharge, adjustedScen.fixedCharge], backgroundColor: 'rgba(153, 102, 255, 0.7)', borderColor: 'rgba(153, 102, 255, 1)', borderWidth: 1, stack: stackGroup },
            { label: 'Consumo Madrugada', data: [initialScen.volumetricChargeBreakdown['0-6'], adjustedScen.volumetricChargeBreakdown['0-6']], backgroundColor: 'rgba(54, 162, 235, 0.5)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1, stack: stackGroup },
            { label: 'Consumo Intermediário', data: [initialScen.volumetricChargeBreakdown['17_21'], adjustedScen.volumetricChargeBreakdown['17_21']], backgroundColor: 'rgba(255, 159, 64, 0.7)', borderColor: 'rgba(255, 159, 64, 1)', borderWidth: 1, stack: stackGroup },
            { label: 'Consumo Ponta', data: [initialScen.volumetricChargeBreakdown['18-20'], adjustedScen.volumetricChargeBreakdown['18-20']], backgroundColor: 'rgba(255, 99, 132, 0.7)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1, stack: stackGroup },
            { label: 'Consumo Fora Ponta', data: [initialScen.volumetricChargeBreakdown['other'], adjustedScen.volumetricChargeBreakdown['other']], backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, stack: stackGroup },
            { label: 'Demanda Madrugada', data: [initialScen.demandChargeBreakdown['0-6'], adjustedScen.demandChargeBreakdown['0-6']], backgroundColor: 'rgba(54, 162, 235, 0.3)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1, stack: stackGroup}, // Ensuring same stack group
            { label: 'Demanda Intermediário', data: [initialScen.demandChargeBreakdown['17_21'], adjustedScen.demandChargeBreakdown['17_21']], backgroundColor: 'rgba(255, 159, 64, 0.5)', borderColor: 'rgba(255, 159, 64, 1)', borderWidth: 1, stack: stackGroup },
            { label: 'Demanda Ponta', data: [initialScen.demandChargeBreakdown['18-20'], adjustedScen.demandChargeBreakdown['18-20']], backgroundColor: 'rgba(255, 99, 132, 0.5)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1, stack: stackGroup },
            { label: 'Demanda Fora da Ponta', data: [initialScen.demandChargeBreakdown['other'], adjustedScen.demandChargeBreakdown['other']], backgroundColor: 'rgba(75, 192, 192, 0.4)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1, stack: stackGroup }
        ];


        costComparisonChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Cenário Inicial', 'Cenário Ajustado'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x', // Bars are vertical, categories on X-axis
                scales: {
                    x: { stacked: true }, // Stacking occurs for each category on the x-axis
                    y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Custo (R$)' } } // Values are stacked on the y-axis
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: chartCtx => `${chartCtx.dataset.label}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chartCtx.parsed.y)}`
                        }
                    }
                }
            }
        });
    }

    function generateTips(adjustedScenario, selectedApps) {
        const tipsList = document.getElementById('tips-list');
        tipsList.innerHTML = '';
        let tipsFound = false;

        const adjustedPeakKwOverall = adjustedScenario.peakHourlyDemandKw;
        // We need initial peak to compare, assuming it's available or we fetch it.
        // For simplicity, let's assume initial peak is part of a broader context or we only comment on adjusted.
        // const initialPeakKwOverall = initialScenario.peakHourlyDemandKw; // If initialScenario is available here

        const adjustedPeakDemandByToU = adjustedScenario.peakDemandByToU;

        // General tip about the base load
        tipsList.innerHTML += `<li>Lembre-se que há uma carga base constante de ${BASE_DEMAND_WATTS}W (equivalente a ${((BASE_DEMAND_WATTS/1000)*24*DAYS_IN_MONTH).toFixed(1)} kWh/mês) incluída nos cálculos.</li>`;
        tipsFound = true;


        // Tips for specific ToU peak demands
        if (adjustedPeakDemandByToU['18-20'] > (BASE_DEMAND_WATTS / 1000)) { // Only show if peak is above base
            tipsList.innerHTML += `<li>Atenção ao pico de demanda entre 18h-20h: ${adjustedPeakDemandByToU['18-20'].toFixed(2)} kW. Esta é a faixa de maior custo de demanda (R$${DEMAND_RATE_18_20.toFixed(2)}/kW). Tente reduzir o uso simultâneo de aparelhos neste período.</li>`;
            tipsFound = true;
        }
        if (adjustedPeakDemandByToU['17_21'] > (BASE_DEMAND_WATTS / 1000)) {
             tipsList.innerHTML += `<li>Seu pico de demanda às 17h ou 21h é de ${adjustedPeakDemandByToU['17_21'].toFixed(2)} kW. O custo de demanda neste horário é de R$${DEMAND_RATE_17_21.toFixed(2)}/kW.</li>`;
            tipsFound = true;
        }
         if (adjustedPeakDemandByToU['other'] > (BASE_DEMAND_WATTS / 1000) && DEMAND_RATE_OTHER > DEMAND_RATE_0_6) { // If 'other' is more expensive than '0-6'
             tipsList.innerHTML += `<li>O pico de demanda nas "Outras Horas" (fora da madrugada e dos picos principais) é de ${adjustedPeakDemandByToU['other'].toFixed(2)} kW, com custo de R$${DEMAND_RATE_OTHER.toFixed(2)}/kW.</li>`;
            tipsFound = true;
        }


        selectedApps.forEach(app => { if ((app.count || 1) > 1 && app.adjustedUsageSlots && app.adjustedUsageSlots.length > 1) { tipsList.innerHTML += `<li>Com múltiplos usos de '${app.name}' em seu plano ajustado, certifique-se de que os horários sejam escalonados para minimizar a demanda simultânea, especialmente nos horários de pico de custo.</li>`; tipsFound = true; }});

        let overlappingHighPowerInExpensiveHours = false;
        const highPowerApps = selectedApps.filter(app => app.power >= 1500);

        if (highPowerApps.length > 1) {
            for (let i = 0; i < adjustedScenario.loadProfileWatts.length; i++) {
                let concurrentHighPowerAppsInInterval = 0;
                const intervalStartMinutes = MIN_TIME_MINUTES + (i * TIME_STEP_MINUTES);
                const intervalEndMinutes = intervalStartMinutes + TIME_STEP_MINUTES;
                const hourOfIntervalStart = Math.floor(intervalStartMinutes / 60);
                const touPeriod = getTouPeriod(hourOfIntervalStart);

                if (touPeriod === '18-20' || touPeriod === '17_21' || touPeriod === 'other') {
                    highPowerApps.forEach(app => {
                        if (app.adjustedUsageSlots) {
                            const slots = app.adjustedUsageSlots;
                            for (const slot of slots) {
                                if (!slot) continue;
                                const slotEnd = slot.start + slot.duration;
                                if (slot.start < intervalEndMinutes && slotEnd > intervalStartMinutes) {
                                    concurrentHighPowerAppsInInterval++;
                                    break;
                                }
                            }
                        }
                    });
                    // Check if the sum of power of these concurrent apps significantly exceeds base load
                    // This check is a bit complex here as we only have count, not their combined power easily
                    if (concurrentHighPowerAppsInInterval > 1) {
                        overlappingHighPowerInExpensiveHours = true;
                        break;
                    }
                }
            }
        }

        if (overlappingHighPowerInExpensiveHours) {
            tipsList.innerHTML += `<li>Considere escalonar o uso de aparelhos de alta potência (ex: fornos, chuveiros) em seu plano ajustado, especialmente durante os horários de maior custo de demanda (17h-21h e outras horas fora da madrugada), para reduzir o pico de demanda.</li>`;
            tipsFound = true;
        }

        const energyInExpensiveVolumetricHours = adjustedScenario.dailyEnergyKWhByPeriod['18-20'] + adjustedScenario.dailyEnergyKWhByPeriod['17_21'] + adjustedScenario.dailyEnergyKWhByPeriod['other'];
        const energyInCheapestVolumetricHours = adjustedScenario.dailyEnergyKWhByPeriod['0-6'];
        const baseLoadEnergyInCheapestHours = ((BASE_DEMAND_WATTS / 1000) * 6 * (TIME_STEP_MINUTES / 60) * (60/TIME_STEP_MINUTES) ); // Energy of base load from 0-6h

        // Check if there's significant appliance energy that could be shifted
        if (energyInExpensiveVolumetricHours > (energyInCheapestVolumetricHours + 0.5) && (energyInCheapestVolumetricHours - baseLoadEnergyInCheapestHours) < 1.0) { // Example: if appliance energy in cheap hours is less than 1 kWh
             tipsList.innerHTML += `<li>Tente deslocar mais consumo de energia de aparelhos para o período da madrugada (0h-6h), onde a tarifa volumétrica é mais baixa (R$${VOLUMETRIC_RATE_0_6.toFixed(2)}/kWh).</li>`;
             tipsFound = true;
        }


        if (!tipsFound) tipsList.innerHTML += "<li>Seu plano ajustado parece bom! Continue experimentando com os horários de uso para otimizar. Lembre-se de manter a demanda de pico o mais baixa possível, especialmente nos horários de ponta da sua concessionária.</li>";
        else if (tipsList.innerHTML.length > 0 && !overlappingHighPowerInExpensiveHours && (energyInExpensiveVolumetricHours <= (energyInCheapestVolumetricHours + 0.5))) {
             tipsList.innerHTML += `<li>Seu consumo já parece bem distribuído. Verifique se os picos de demanda nos horários caros estão minimizados.</li>`;
        }
    }

    // Initial setup
    updateAllTimesSliders();
    recalculateAndDisplayAllScenarios();
});