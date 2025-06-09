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
        { id: 'washing-machine', name: 'Máquina de Lavar Roupa', power: 600, count: 1, iconBW: 'icons/washing_machine_bw.png', iconColor: 'icons/washing_machine_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'vacuum-cleaner', name: 'Aspirador de Pó', power: 1000, count: 1, iconBW: 'icons/vacuum_bw.png', iconColor: 'icons/vacuum_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'iron', name: 'Ferro de Passar Roupa', power: 1500, count: 1, iconBW: 'icons/iron_bw.png', iconColor: 'icons/iron_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'air-fryer', name: 'Fritadeira Elétrica', power: 1500, count: 1, iconBW: 'icons/air_fryer_bw.png', iconColor: 'icons/air_fryer_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'electric-oven', name: 'Micro-ondas', power: 3000, count: 1, iconBW: 'icons/oven_bw.png', iconColor: 'icons/oven_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] }
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
        generateTips(initialScenario, adjustedScenario, selectedApps); // Pass initialScenario here
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

        const stackGroup = 'totalBill'; // All datasets belong to the same stack group

        // Data for the three parts: Fixed, Volumetric (Total), Demand (Total)
        // The order in this array determines the stacking order (bottom to top)
        const datasets = [
            {
                label: 'Taxa Fixa', // Bottom part
                data: [initialScen.fixedCharge, adjustedScen.fixedCharge],
                backgroundColor: 'rgba(153, 102, 255, 0.7)', // Example color: Purple
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
                stack: stackGroup
            },
            {
                label: 'Custo Volumétrico Total', // Middle part
                data: [initialScen.totalVolumetricCharge, adjustedScen.totalVolumetricCharge],
                backgroundColor: 'rgba(75, 192, 192, 0.7)', // Example color: Teal/Green
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                stack: stackGroup
            },
            {
                label: 'Custo de Demanda Total', // Top part
                data: [initialScen.totalDemandCharge, adjustedScen.totalDemandCharge],
                backgroundColor: 'rgba(255, 99, 132, 0.7)', // Example color: Red
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                stack: stackGroup
            }
        ];

        costComparisonChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Cenário Inicial', 'Cenário Ajustado'],
                datasets: datasets // Use the modified datasets array
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

    function generateTips(initialScenario, adjustedScenario, selectedApps) {
        // --- General Tips ---
        const generalTipsListElement = document.getElementById('tips-list');
        if (!generalTipsListElement) {
            console.error("Element with ID 'tips-list' not found for general tips.");
        } else {
            generalTipsListElement.innerHTML = ''; // Clear previous general tips

            let generalTipsHtml = `<h3>💡 Dicas Gerais para Economizar Energia:</h3><ul>`;
            generalTipsHtml += `<li>🌙 Sempre que possível, tente usar mais os aparelhos entre 0h e 6h, quando a tarifa de energia é menor (R$ ${VOLUMETRIC_RATE_0_6.toFixed(2)}/kWh).</li>`;
            generalTipsHtml += `<li>No caso de chuveiros elétricos, utilize a chave na posição 'verão' (ou menos potente) em dias mais quentes para reduzir o consumo.</li>`;
            generalTipsHtml += `<li>Acumule uma quantidade maior de roupas para utilizar a máquina de lavar e o ferro de passar de uma só vez, otimizando o uso desses aparelhos.</li>`;
            generalTipsHtml += `</ul>`;
            generalTipsListElement.innerHTML = generalTipsHtml;
        }

        // --- Scenario-Specific Tips ---
        const scenarioTipsContainerElement = document.getElementById('scenario-specific-tips-container');
        if (!scenarioTipsContainerElement) {
            console.error("Element with ID 'scenario-specific-tips-container' not found for scenario tips.");
            return; // If this container is missing, can't proceed
        }
        scenarioTipsContainerElement.innerHTML = ''; // Clear previous content from the container

        if (selectedApps.length === 0) {
            // If no appliances are selected, show a placeholder message in the scenario tips area
            scenarioTipsContainerElement.innerHTML = `<h3>📈 Dicas para seu Cenário Ajustado:</h3><p><em>Selecione eletrodomésticos e ajuste os horários de uso para ver dicas específicas para o seu novo cenário.</em></p>`;
            return;
        }

        // If apps are selected, proceed to generate and display conditional/scenario-specific tips
        let conditionalTipsHtml = `<h3>📈 Dicas para seu Cenário Ajustado:</h3><ul>`;
        let scenarioTipsFound = false;
        let specificAdviceGiven = false; // To track if more than generic advice was given

        const baseDemandKw = BASE_DEMAND_WATTS / 1000;
        const currencyFormat = { style: 'currency', currency: 'BRL' };

        // 1. Compare total costs
        if (initialScenario && adjustedScenario.totalCost < initialScenario.totalCost) {
            const savings = initialScenario.totalCost - adjustedScenario.totalCost;
            conditionalTipsHtml += `<li>🎉 <strong>Parabéns!</strong> Com os ajustes, você simulou uma economia de <strong>${savings.toLocaleString('pt-BR', currencyFormat)}</strong> em relação ao cenário inicial (de ${initialScenario.totalCost.toLocaleString('pt-BR', currencyFormat)} para ${adjustedScenario.totalCost.toLocaleString('pt-BR', currencyFormat)}).</li>`;
            scenarioTipsFound = true;
            specificAdviceGiven = true;
        } else if (initialScenario && adjustedScenario.totalCost > initialScenario.totalCost) {
            const increase = adjustedScenario.totalCost - initialScenario.totalCost;
            conditionalTipsHtml += `<li>⚠️ Seu cenário ajustado resultou em um custo <strong>maior</strong> de ${increase.toLocaleString('pt-BR', currencyFormat)}. Revise os horários de uso e os picos de demanda.</li>`;
            scenarioTipsFound = true;
            specificAdviceGiven = true;
        } else if (initialScenario && adjustedScenario.totalCost === initialScenario.totalCost && selectedApps.length > 0) {
             conditionalTipsHtml += `<li>⚖️ O custo do seu cenário ajustado (<strong>${adjustedScenario.totalCost.toLocaleString('pt-BR', currencyFormat)}</strong>) é o mesmo do cenário inicial. Explore diferentes horários para buscar economia.</li>`;
             scenarioTipsFound = true;
        }

        // 3. Demand Charge Focus
        const demandChargePercentage = adjustedScenario.totalCost > 0 ? (adjustedScenario.totalDemandCharge / adjustedScenario.totalCost) * 100 : 0;
        if (demandChargePercentage > 35 && adjustedScenario.totalDemandCharge > (TARIFF_FIXED_CHARGE * 0.5)) {
            conditionalTipsHtml += `<li>⚠️ Aproximadamente <strong>${demandChargePercentage.toFixed(0)}%</strong> do seu custo ajustado é devido à <strong>taxa de demanda</strong>. Reduzir o uso simultâneo de aparelhos potentes, especialmente nos horários de pico, pode gerar economias consideráveis.</li>`;
            scenarioTipsFound = true;
            specificAdviceGiven = true;
        }

        // 4. Peak Demand Warnings
        if (adjustedScenario.peakDemandByToU['18-20'] > baseDemandKw) {
            conditionalTipsHtml += `<li>🔴 <strong>Atenção ao pico de demanda entre 18:00-20:59!</strong> Seu pico é de <strong>${adjustedScenario.peakDemandByToU['18-20'].toFixed(2)} kW</strong>. Esta é a faixa com a <strong>taxa de demanda mais cara</strong> (${DEMAND_RATE_18_20.toLocaleString('pt-BR', currencyFormat)}/kW). Evite ao máximo o uso simultâneo de aparelhos de alta potência neste período.</li>`;
            specificAdviceGiven = true; scenarioTipsFound = true;
        } else if (initialScenario && initialScenario.peakDemandByToU['18-20'] > baseDemandKw && adjustedScenario.peakDemandByToU['18-20'] <= baseDemandKw) {
             conditionalTipsHtml += `<li>✅ Ótimo! Você conseguiu eliminar picos de demanda acima da carga base no horário de ponta crítico (18:00-20:59) no seu plano ajustado.</li>`;
             specificAdviceGiven = true; scenarioTipsFound = true;
        }

        if (adjustedScenario.peakDemandByToU['17_21'] > baseDemandKw) {
            conditionalTipsHtml += `<li>🟠 Seu pico de demanda às <strong>17:00-17:59 ou 21:00-21:59</strong> é de <strong>${adjustedScenario.peakDemandByToU['17_21'].toFixed(2)} kW</strong>. A taxa de demanda neste horário é de ${DEMAND_RATE_17_21.toLocaleString('pt-BR', currencyFormat)}/kW. Ainda é um horário caro para picos.</li>`;
            specificAdviceGiven = true; scenarioTipsFound = true;
        }

        if (adjustedScenario.peakDemandByToU['other'] > baseDemandKw && DEMAND_RATE_OTHER > DEMAND_RATE_0_6) {
            conditionalTipsHtml += `<li>🟡 Seu pico de demanda no posto <strong>"Fora da Ponta"</strong> (fora da madrugada e dos picos 17-21h) é de <strong>${adjustedScenario.peakDemandByToU['other'].toFixed(2)} kW</strong>, com taxa de ${DEMAND_RATE_OTHER.toLocaleString('pt-BR', currencyFormat)}/kW. Se possível, tente deslocar esse pico para a madrugada.</li>`;
            specificAdviceGiven = true; scenarioTipsFound = true;
        }

        // 6. Multiple uses of the same appliance
        const peakStartMinutes = 18 * 60; // 18:00
        const peakEndMinutes = 21 * 60;   // 21:00 (exclusive end for 18:00-20:59 window)

        selectedApps.forEach(app => {
            if (app.selected && (app.count || 1) > 1 && app.adjustedUsageSlots && app.adjustedUsageSlots.length > 1) {
                conditionalTipsHtml += `<li>🔄 Você está usando <strong>'${app.name}' ${app.count} vezes</strong>. Certifique-se de que os horários de uso estão bem espaçados para minimizar a demanda simultânea, especialmente durante os horários de pico de custo de demanda (17:00-21:59).</li>`;
                scenarioTipsFound = true;
                let usesInCriticalPeak = 0;
                app.adjustedUsageSlots.forEach(slot => {
                    if (!slot) return;
                    const slotEnd = slot.start + slot.duration;
                    // Check if the slot overlaps with the 18:00-20:59 critical peak
                    if (slot.start < peakEndMinutes && slotEnd > peakStartMinutes) {
                         usesInCriticalPeak++;
                    }
                });
                if (usesInCriticalPeak >= 2) {
                     conditionalTipsHtml += `<li><span style="color:red;">❗ Múltiplos usos de '${app.name}' (${usesInCriticalPeak}x) ocorrem ou se sobrepõem ao horário de ponta máximo (18:00-20:59). Considere fortemente reagendar alguns para fora deste período ou garantir que não são simultâneos.</span></li>`;
                     specificAdviceGiven = true;
                }
            }
        });

        // 7. Overlapping high-power appliances
        const highPowerApps = selectedApps.filter(app => app.selected && app.power >= 1500 && app.adjustedUsageSlots && app.adjustedUsageSlots.length > 0);
        if (highPowerApps.length > 1) {
            let overlappingHighPowerInExpensiveHours = false;
            let detailOverlapMessages = []; // To collect detailed messages

            for (let t_idx = 0; t_idx < adjustedScenario.loadProfileWatts.length; t_idx++) {
                const intervalStartMinutes = MIN_TIME_MINUTES + (t_idx * TIME_STEP_MINUTES);
                const intervalEndMinutes = intervalStartMinutes + TIME_STEP_MINUTES;
                const hourOfIntervalStart = Math.floor(intervalStartMinutes / 60);
                const touPeriod = getTouPeriod(hourOfIntervalStart);

                if (touPeriod === '18-20' || touPeriod === '17_21') {
                    let concurrentHighPowerAppsInInterval = 0;
                    let contributingAppNames = [];
                    highPowerApps.forEach(app => {
                        for (const slot of app.adjustedUsageSlots) {
                            if (!slot) continue;
                            const slotEnd = slot.start + slot.duration;
                            if (slot.start < intervalEndMinutes && slotEnd > intervalStartMinutes) { // Check for overlap
                                if (!contributingAppNames.includes(app.name)) {
                                    contributingAppNames.push(app.name);
                                }
                            }
                        }
                    });
                    if (contributingAppNames.length > 1) { // If more than one unique high-power app is active
                        overlappingHighPowerInExpensiveHours = true;
                        const messageKey = `${contributingAppNames.sort().join("-")}_${formatTime(intervalStartMinutes)}`; // Avoid duplicate messages for same combo/time
                        if (!detailOverlapMessages.find(m => m.key === messageKey)) {
                            detailOverlapMessages.push({
                                key: messageKey,
                                msg: `<li><span style="color:red;">❗ Alerta de Demanda Elevada:</span> Detectamos o uso simultâneo de <strong>${contributingAppNames.join(" e ")}</strong> no posto ${touPeriod === '18-20' ? 'ponta máximo' : 'intermediário'} (${formatTime(intervalStartMinutes)}). Isso aumenta significativamente sua demanda e custos. Tente distribuir o uso desses aparelhos.</li>`
                            });
                        }
                    }
                }
            }
            if (overlappingHighPowerInExpensiveHours) {
                detailOverlapMessages.forEach(dm => conditionalTipsHtml += dm.msg);
                specificAdviceGiven = true; scenarioTipsFound = true;
            } else if ((adjustedScenario.peakDemandByToU['18-20'] > baseDemandKw || adjustedScenario.peakDemandByToU['17_21'] > baseDemandKw) && highPowerApps.length > 0) {
                 conditionalTipsHtml += `<li>Apesar de não haver sobreposição direta de múltiplos aparelhos de alta potência nos picos mais caros, sua demanda ainda está elevada nesses períodos. Revise o uso individual de cada aparelho potente (${highPowerApps.map(a=>a.name).join(', ')}).</li>`;
                 scenarioTipsFound = true;
             }
        }

        // 8. Appliance-Specific: Electric Shower
        const electricShowerApp = selectedApps.find(app => app.id === 'electric-shower' && app.selected);
        if (electricShowerApp && electricShowerApp.adjustedUsageSlots) {
            let showerTipAdded = false;
            electricShowerApp.adjustedUsageSlots.forEach(slot => {
                if (!slot) return;
                const slotStartHour = Math.floor(slot.start / 60);
                if (slotStartHour >= 18 && slotStartHour < 21) { // Shower between 18:00 and 20:59
                    conditionalTipsHtml += `<li>🚿 O <strong>chuveiro elétrico</strong> (alta potência: ${electricShowerApp.power}W) está sendo usado no horário de ponta (18:00-20:59). Banhos nesse período impactam fortemente tanto o custo de demanda quanto o de consumo. Se possível, prefira horários alternativos.</li>`;
                    specificAdviceGiven = true; showerTipAdded = true;
                } else if (slotStartHour === 17 || slotStartHour === 21) { // Shower at 17:xx or 21:xx
                    conditionalTipsHtml += `<li>🚿 O <strong>chuveiro elétrico</strong> está sendo usado no posto intermediário (${slotStartHour}:00). Considerar horários mais baratos (madrugada, outras horas) pode reduzir custos.</li>`;
                    specificAdviceGiven = true; showerTipAdded = true;
                }
            });
            if (showerTipAdded) scenarioTipsFound = true;
        }

        // Fallback messages (from original logic, slightly adapted for clarity)
        if (!scenarioTipsFound && selectedApps.length > 0) {
            conditionalTipsHtml += "<li>Analise os horários de uso dos seus aparelhos no cenário ajustado. Tente deslocar o consumo para horários de tarifa mais baixa e evite picos de demanda simultânea.</li>";
        } else if (selectedApps.length > 0 && !specificAdviceGiven && initialScenario && adjustedScenario.totalCost <= initialScenario.totalCost) {
            conditionalTipsHtml += `<li>✅ Seu plano ajustado parece bem otimizado em relação aos pontos críticos de custo! Continue explorando para encontrar o melhor equilíbrio entre conforto e economia.</li>`;
        } else if (selectedApps.length > 0 && scenarioTipsFound && !specificAdviceGiven && initialScenario && adjustedScenario.totalCost > initialScenario.totalCost) {
            // This is a fallback if the main "cost is higher" tip didn't set specificAdviceGiven for some reason.
            conditionalTipsHtml += `<li>Revise os picos de demanda e o consumo nos horários mais caros para tentar reduzir o custo, pois seu cenário ajustado está mais caro que o inicial.</li>`;
        }

        conditionalTipsHtml += `</ul>`;
        scenarioTipsContainerElement.innerHTML = conditionalTipsHtml;
    }

    // Initial setup
    updateAllTimesSliders();
    recalculateAndDisplayAllScenarios();
});