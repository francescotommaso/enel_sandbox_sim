document.addEventListener('DOMContentLoaded', () => {
    Chart.register(ChartDataLabels); 
    Chart.defaults.plugins.datalabels.display = false;

    const TARIFF_FIXED_CHARGE = 9.00;

    const VOLUMETRIC_RATE_0_6 = 0.33;    
    const VOLUMETRIC_RATE_17_21 = 0.65;  
    const VOLUMETRIC_RATE_18_20 = 1.22;  
    const VOLUMETRIC_RATE_OTHER = 0.39;  

    const DEMAND_RATE_0_6 = 1.09;        
    const DEMAND_RATE_17_21 = 6.55;      
    const DEMAND_RATE_18_20 = 13.11;      
    const DEMAND_RATE_OTHER = 2.18;     

    const DAYS_IN_MONTH = 30;
    const BASE_DEMAND_WATTS = 200; 

    const MIN_TIME_MINUTES = 0 * 60;
    const MAX_TIME_MINUTES = 24 * 60; 
    const TIME_STEP_MINUTES = 15;
    const DEFAULT_DURATION_MINUTES = 30;
    const MIN_DURATION_MINUTES = 5;
    const MAX_DURATION_MINUTES = 240;
    const DURATION_STEP_MINUTES = 5;
    const MIN_APPLIANCE_COUNT = 1;
    const MAX_APPLIANCE_COUNT = 5;

    const appliances = [
        { id: 'electric-shower', name: 'Chuveiro Elétrico (Potência 5500W)', power: 5500, count: 1, iconBW: 'icons/shower_bw.png', iconColor: 'icons/shower_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'washing-machine', name: 'Máquina de Lavar Roupa (Potência 600W)', power: 600, count: 1, iconBW: 'icons/washing_machine_bw.png', iconColor: 'icons/washing_machine_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'vacuum-cleaner', name: 'Aspirador de Pó (Potência 1000W)', power: 1000, count: 1, iconBW: 'icons/vacuum_bw.png', iconColor: 'icons/vacuum_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'iron', name: 'Ferro de Passar Roupa (Potência 1500W)', power: 1500, count: 1, iconBW: 'icons/iron_bw.png', iconColor: 'icons/iron_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'air-fryer', name: 'Fritadeira Elétrica (Potência 1500W)', power: 1500, count: 1, iconBW: 'icons/air_fryer_bw.png', iconColor: 'icons/air_fryer_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'electric-oven', name: 'Micro-ondas (Potência 1000W)', power: 1000, count: 1, iconBW: 'icons/oven_bw.png', iconColor: 'icons/oven_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'air-conditioner', name: 'Ar Condicionado (Potência 2000W)', power: 2000, count: 1, iconBW: 'icons/ac_bw.png', iconColor: 'icons/ac_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] },
        { id: 'air-heater', name: 'Aquecedor de Ar (Potência 1800W)', power: 1800, count: 1, iconBW: 'icons/air_heater_bw.png', iconColor: 'icons/air_heater_color.png', selected: false, usageSlots: [], adjustedUsageSlots: [], adjustedTicks: [], adjustedStartSliders: [], adjustedStartValueSpans: [], adjustedDurationValueSpans: [], adjustedEndValueSpans: [] }
    ];

    const applianceGrid = document.querySelector('.appliance-grid');
    const initialTimeSlidersContainer = document.getElementById('initial-time-sliders-container');
    const adjustedTimeSlidersContainer = document.getElementById('adjusted-time-sliders-container');

    let initialLoadCurveChartInstance = null;
    let updatedLoadCurveChartInstance = null;
    let costComparisonChartInstance = null;

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
                            <label for="${ids.durationSelect}">Tempo de Uso:</label>
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
                            <label>Tempo de Uso:</label>
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
                    referenceP.innerHTML = `<em>Ref. Inicial: Início ${formatTime(initialSlotForAdjusted.start)}, Tempo de Uso ${initialSlotForAdjusted.duration} min (Término ${formatTime(initialSlotForAdjusted.start + initialSlotForAdjusted.duration)})</em>`;
                    slotDiv.appendChild(referenceP);
                }
            }
            if (index < currentSlots.length - 1) slotDiv.appendChild(document.createElement('hr'));
            applianceControlDiv.appendChild(slotDiv);

            if (slotArrayKey === 'usageSlots') { 
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
                        adjustedRefP.innerHTML = `<em>Ref. Inicial: Início ${formatTime(slot.start)}, Tempo de Uso ${slot.duration} min (Término ${formatTime(slot.end)})</em>`;
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
                             adjRefP.innerHTML = `<em>Ref. Inicial: Início ${formatTime(slot.start)}, Tempo de Uso ${newDuration} min (Término ${formatTime(slot.end)})</em>`;
                        }
                    }
                    recalculateAndDisplayAllScenarios();
                });
            } else { 
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
        const timeIntervalHours = timeIntervalMinutes / 60; 
        const baseDemandKWhPerInterval = (BASE_DEMAND_WATTS / 1000) * timeIntervalHours;

        const dailyEnergyKWhByPeriod = {
            '0-6': 0,
            '17_21': 0,
            '18-20': 0,
            'other': 0
        };

        for (let t_mins = MIN_TIME_MINUTES; t_mins < MAX_TIME_MINUTES; t_mins += timeIntervalMinutes) {
            timeLabels.push(formatTime(t_mins));
            powerProfileWatts.push(BASE_DEMAND_WATTS); 

            const hourOfIntervalStart = Math.floor(t_mins / 60);
            const touPeriod = getTouPeriod(hourOfIntervalStart);
            dailyEnergyKWhByPeriod[touPeriod] += baseDemandKWhPerInterval;
        }

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
                            powerProfileWatts[t_idx] += app.power; 

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
            const startIntervalIndex = hour * intervalsPerHour;
            const endIntervalIndex = startIntervalIndex + intervalsPerHour;
            
            // Get the slice of the power profile for the current hour
            const powerIntervalsForHour = powerProfileWatts.slice(startIntervalIndex, endIntervalIndex);
            
            let maxPowerInHourWatts = 0;
            if (powerIntervalsForHour.length > 0) {
                // Find the MAXIMUM power value in that hour's intervals
                maxPowerInHourWatts = Math.max(...powerIntervalsForHour);
            } else {
                // If no intervals, use the base demand
                maxPowerInHourWatts = BASE_DEMAND_WATTS;
            }

            // Convert the peak power in Watts to kilowatts
            hourlyDemandsKw.push(maxPowerInHourWatts / 1000);
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
            dailyEnergyKWhByPeriod, 
            totalDailyKWh, 
            timeLabels
        };
    }

    function recalculateAndDisplayAllScenarios() {
        const selectedApps = appliances.filter(a => a.selected);
        const initialScenario = calculateScenarioData(selectedApps, 'usageSlots');
        const adjustedScenario = calculateScenarioData(selectedApps, 'adjustedUsageSlots');
        const netCost = initialScenario.totalCost - adjustedScenario.totalCost;

        const chartXAxisLabel = `Horário (00:00-${formatTime(MAX_TIME_MINUTES - TIME_STEP_MINUTES)})`;

        plotLoadCurve(initialScenario.loadProfileWatts, initialScenario.timeLabels, 'initialLoadCurveChart', 'initialLoadCurveChartInstance', 'Perfil de Consumo Inicial (Watts)', chartXAxisLabel);
        document.getElementById('initial-cost').textContent = `R$${initialScenario.totalCost.toFixed(2)}`;
        document.getElementById('initial-cost-bottom').textContent = `R$${initialScenario.totalCost.toFixed(2)}`;

        plotUpdatedLoadCurvesComparison(initialScenario.loadProfileWatts, adjustedScenario.loadProfileWatts, initialScenario.timeLabels, chartXAxisLabel);
        document.getElementById('new-cost').textContent = `R$${adjustedScenario.totalCost.toFixed(2)}`;

        document.getElementById('net-cost').textContent = `R$${netCost.toFixed(2)}`;

        plotCostComparisonStacked(initialScenario, adjustedScenario);
        generateTips(initialScenario, adjustedScenario, selectedApps); 
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
                    borderColor: 'rgb(0,140,90)',
                    backgroundColor: 'rgba(85,190,90,0.2)',
                    tension: 0.1,
                    fill: true,
                    pointRadius: 0, 
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Potência (Watts)' } }, 
                    x: { title: { display: true, text: xAxisLabel } }
                },
                animation: { duration: 0 },
                plugins: {
                    datalabels: {
                        display: false
                    }
                }
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
                    { label: 'Consumo Inicial', data: initialProfileWatts, borderColor: 'rgba(255,204,41,1)', backgroundColor: 'rgba(255,99,132,0.1)', tension: 0.1, fill: false, pointRadius: 2, borderWidth: 1.5 },
                    { label: 'Consumo Ajustado', data: adjustedProfileWatts, borderColor: 'rgba(0,140,90,1)', backgroundColor: 'rgba(54,162,235,0.1)', tension: 0.1, fill: false, pointRadius: 2, borderWidth: 1.5 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Potência (Watts)' } }, 
                    x: { title: { display: true, text: xAxisLabel } }
                },
                animation: { duration: 0 }
            }
        });
    }

    function plotCostComparisonStacked(initialScen, adjustedScen) {

        const showStackTotalsPlugin = {
            id: 'showStackTotals',
            afterDatasetsDraw(chart) {
                const { ctx, data, scales: { x, y } } = chart;
                ctx.save();
                ctx.font = 'bold 12px sans-serif';
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';

                data.labels.forEach((_, idx) => {
                    const total = data.datasets
                        .reduce((sum, ds) => sum + (ds.data[idx] || 0), 0);
                    const xPos = x.getPixelForValue(idx);
                    const yPos = y.getPixelForValue(total);

                    ctx.fillText(
                        new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                        }).format(total),
                        xPos,
                        yPos - 6
                    );
                });

                ctx.restore();
            }
        };

        const canvas = document.getElementById('costComparisonChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (costComparisonChartInstance) costComparisonChartInstance.destroy();

        const stackGroup = 'totalBill';
        const datasets = [

            {
                label: 'Parcela Fixa',
                data: [initialScen.fixedCharge, adjustedScen.fixedCharge],
                backgroundColor: 'rgba(255, 204, 41, 0.7)',
                borderColor: 'rgba(255, 204, 41, 0.7)',
                borderWidth: 1,
                stack: stackGroup
            },
            {
                label: 'Parcela de Consumo (kWh)',
                data: [initialScen.totalVolumetricCharge, adjustedScen.totalVolumetricCharge],
                backgroundColor: 'rgba(0, 140, 90, 0.7)',
                borderColor: 'rgba(0, 140, 90, 0.7)',
                borderWidth: 1,
                stack: stackGroup
            },
            {
                label: 'Parcela de Demanda (kW)',
                data: [initialScen.totalDemandCharge, adjustedScen.totalDemandCharge],
                backgroundColor: 'rgba(230, 20, 0, 0.7)',
                borderColor: 'rgba(230, 20, 0, 1)',
                borderWidth: 1,
                stack: stackGroup
            }
        ];

        costComparisonChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Cenário Inicial', 'Cenário Ajustado'],
                datasets: datasets
            },

            plugins: [showStackTotalsPlugin], 
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'x',
                scales: {
                    x: { stacked: true },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: { display: true, text: 'Custo (R$)' }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Simulação - Tarifa Flex (Estimativa de Fatura Mensal Sem tributos)',
                        font: { size: 16 }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx =>
                                `${ctx.dataset.label}: ${new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                }).format(ctx.parsed.y)}`
                        }
                    },
                    datalabels: {

                        display: true, 
                        color: '#000',
                        anchor: 'center',
                        align: 'center',
                        formatter: value =>
                            new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                            }).format(value),
                        font: { weight: 'bold' }
                    }
                }
            }
        });
    }

    function generateTips(initialScenario, adjustedScenario, selectedApps) {

        const generalTipsListElement = document.getElementById('tips-list');
        if (!generalTipsListElement) {
            console.error("Element with ID 'tips-list' not found for general tips.");
        } else {
            generalTipsListElement.innerHTML = ''; 

            let generalTipsHtml = `<h3>💡 Dicas Gerais para Economizar Energia:</h3><ul>`;
            generalTipsHtml += `<li>🌙 Sempre que possível, tente usar mais os aparelhos entre 0h e 17h, e após as 22h, quando as tarifas de energia são mais econoômicas.</li>`;
            generalTipsHtml += `<li>No caso de chuveiros elétricos, utilize a chave na posição 'verão' (ou menos potente) em dias mais quentes para reduzir o consumo.</li>`;
            generalTipsHtml += `<li>Acumule uma quantidade maior de roupas para utilizar a máquina de lavar e o ferro de passar de uma só vez, otimizando o uso desses aparelhos.</li>`;
            generalTipsHtml += `</ul>`;
            generalTipsListElement.innerHTML = generalTipsHtml;
        }

        const scenarioTipsContainerElement = document.getElementById('scenario-specific-tips-container');
        if (!scenarioTipsContainerElement) {
            console.error("Element with ID 'scenario-specific-tips-container' not found for scenario tips.");
            return; 
        }
        scenarioTipsContainerElement.innerHTML = ''; 

        if (selectedApps.length === 0) {

            scenarioTipsContainerElement.innerHTML = `<h3>📈 Dicas para seu Cenário Ajustado:</h3><p><em>Selecione eletrodomésticos e ajuste os horários de uso para ver dicas específicas para o seu novo cenário.</em></p>`;
            return;
        }

        let conditionalTipsHtml = `<h3>📈 Dicas para seu Cenário Ajustado:</h3><ul>`;
        let scenarioTipsFound = false;
        let specificAdviceGiven = false; 

        const baseDemandKw = BASE_DEMAND_WATTS / 1000;
        const currencyFormat = { style: 'currency', currency: 'BRL' };

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

        const demandChargePercentage = adjustedScenario.totalCost > 0 ? (adjustedScenario.totalDemandCharge / adjustedScenario.totalCost) * 100 : 0;
        if (demandChargePercentage > 35 && adjustedScenario.totalDemandCharge > (TARIFF_FIXED_CHARGE * 0.5)) {
            conditionalTipsHtml += `<li>⚠️ Aproximadamente <strong>${demandChargePercentage.toFixed(0)}%</strong> do seu custo ajustado é devido à <strong>tarifa de demanda</strong>. Reduzir o uso simultâneo de aparelhos potentes, especialmente nos horários de pico, pode gerar economias consideráveis.</li>`;
            scenarioTipsFound = true;
            specificAdviceGiven = true;
        }

        if (adjustedScenario.peakDemandByToU['18-20'] > baseDemandKw) {
            conditionalTipsHtml += `<li>🔴 <strong>Atenção ao pico de demanda entre 18:00-21:00!</strong> Sua demanda estimada é de <strong>${adjustedScenario.peakDemandByToU['18-20'].toFixed(2)} kW</strong>. Esta é a faixa horária com a <strong>tarifa mais elevada</strong> (${DEMAND_RATE_18_20.toLocaleString('pt-BR', currencyFormat)}/kW). Evite ao máximo o uso simultâneo de aparelhos de alta potência neste período e no mesmo horário.</li>`;
            specificAdviceGiven = true; scenarioTipsFound = true;
        } else if (initialScenario && initialScenario.peakDemandByToU['18-20'] > baseDemandKw && adjustedScenario.peakDemandByToU['18-20'] <= baseDemandKw) {
             conditionalTipsHtml += `<li>✅ Ótimo! Você conseguiu eliminar picos de consumo no horário de pico (18:00-21:00) no seu plano ajustado.</li>`;
             specificAdviceGiven = true; scenarioTipsFound = true;
        }

        if (adjustedScenario.peakDemandByToU['17_21'] > baseDemandKw) {
            conditionalTipsHtml += `<li>🟠 Na faixa horária intermediária (17h as 18h e 21h as 22h), sua demanda estimada </strong> é de <strong>${adjustedScenario.peakDemandByToU['17_21'].toFixed(2)} kW</strong>. A tarifa de demanda neste horário é de ${DEMAND_RATE_17_21.toLocaleString('pt-BR', currencyFormat)}/kW. Procure deslocar seu consumo para antes das 17h ou após as 22h.</li>`;
            specificAdviceGiven = true; scenarioTipsFound = true;
        }

        if (adjustedScenario.peakDemandByToU['other'] > baseDemandKw && DEMAND_RATE_OTHER > DEMAND_RATE_0_6) {
            conditionalTipsHtml += `<li>🟡 Seu pico de demanda no posto <strong> econômico </strong> é de <strong>${adjustedScenario.peakDemandByToU['other'].toFixed(2)} kW</strong>, com tarifa de ${DEMAND_RATE_OTHER.toLocaleString('pt-BR', currencyFormat)}/kW. Se possível, tente reduzir a demanda distribuindo o consumo nos hoŕarios econômico e mais econômico.</li>`;
            specificAdviceGiven = true; scenarioTipsFound = true;
        }

        const peakStartMinutes = 18 * 60; 
        const peakEndMinutes = 21 * 60;   

        selectedApps.forEach(app => {
            if (app.selected && (app.count || 1) > 1 && app.adjustedUsageSlots && app.adjustedUsageSlots.length > 1) {
                conditionalTipsHtml += `<li>🔄 Você está usando <strong>'${app.name}' ${app.count} vezes</strong>. Certifique-se de que os horários de uso estão bem espaçados para minimizar o consumo simultâneo, especialmente durante os horários de pico e intermediário (17:00-22:00).</li>`;
                scenarioTipsFound = true;
                let usesInCriticalPeak = 0;
                app.adjustedUsageSlots.forEach(slot => {
                    if (!slot) return;
                    const slotEnd = slot.start + slot.duration;

                    if (slot.start < peakEndMinutes && slotEnd > peakStartMinutes) {
                         usesInCriticalPeak++;
                    }
                });
                if (usesInCriticalPeak >= 2) {
                     conditionalTipsHtml += `<li><span style="color:red;">❗ Múltiplos usos de '${app.name}' (${usesInCriticalPeak}x) ocorrem ou se sobrepõem ao horário de pico (18:00-21:00). Considere distribuir alguns para fora deste período ou, pelo menos, evitar que sejam simultâneos.</span></li>`;
                     specificAdviceGiven = true;
                }
            }
        });

        const highPowerApps = selectedApps.filter(app => app.selected && app.power >= 1500 && app.adjustedUsageSlots && app.adjustedUsageSlots.length > 0);
        if (highPowerApps.length > 1) {
            let overlappingHighPowerInExpensiveHours = false;
            let detailOverlapMessages = []; 

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
                            if (slot.start < intervalEndMinutes && slotEnd > intervalStartMinutes) { 
                                if (!contributingAppNames.includes(app.name)) {
                                    contributingAppNames.push(app.name);
                                }
                            }
                        }
                    });
                    if (contributingAppNames.length > 1) { 
                        overlappingHighPowerInExpensiveHours = true;
                        const messageKey = `${contributingAppNames.sort().join("-")}_${formatTime(intervalStartMinutes)}`; 
                        if (!detailOverlapMessages.find(m => m.key === messageKey)) {
                            detailOverlapMessages.push({
                                key: messageKey,
                                msg: `<li><span style="color:red;">❗ Alerta de Demanda Elevada:</span> Há uso simultâneo de <strong>${contributingAppNames.join(" e ")}</strong> no posto ${touPeriod === '18-20' ? 'pico' : 'intermediário'} (${formatTime(intervalStartMinutes)}). Isso aumenta significativamente sua demanda e custos. Tente distribuir o uso desses aparelhos.</li>`
                            });
                        }
                    }
                }
            }
            if (overlappingHighPowerInExpensiveHours) {
                detailOverlapMessages.forEach(dm => conditionalTipsHtml += dm.msg);
                specificAdviceGiven = true; scenarioTipsFound = true;
            } else if ((adjustedScenario.peakDemandByToU['18-20'] > baseDemandKw || adjustedScenario.peakDemandByToU['17_21'] > baseDemandKw) && highPowerApps.length > 0) {
                 conditionalTipsHtml += `<li>Apesar de não haver uso simultâneo de múltiplos aparelhos de alta potência nos horários com tarifa mais elevada, sua demanda pode estar elevada nesses períodos. Revise o uso individual de cada aparelho e busque distribuir seu consumo em diferentes horários.</li>`;
                 scenarioTipsFound = true;
             }
        }

        const electricShowerApp = selectedApps.find(app => app.id === 'electric-shower' && app.selected);
        if (electricShowerApp && electricShowerApp.adjustedUsageSlots) {
            let showerTipAdded = false;
            electricShowerApp.adjustedUsageSlots.forEach(slot => {
                if (!slot) return;
                const slotStartHour = Math.floor(slot.start / 60);
                if (slotStartHour >= 18 && slotStartHour < 21) { 
                    conditionalTipsHtml += `<li>🚿 O <strong>chuveiro elétrico</strong> (alta potência: ${electricShowerApp.power}W) está sendo usado no horário de pico (18:00-21:00). Banhos nesse período impactam fortemente tanto o custo de demanda quanto o de consumo. Se possível, prefira horários alternativos.</li>`;
                    specificAdviceGiven = true; showerTipAdded = true;
                } else if (slotStartHour === 17 || slotStartHour === 21) { 
                    conditionalTipsHtml += `<li>🚿 O <strong>chuveiro elétrico</strong> está sendo usado no posto intermediário (${slotStartHour}:00). Considerar os horários "mais econômico" e "econômico" pode reduzir custos.</li>`;
                    specificAdviceGiven = true; showerTipAdded = true;
                }
            });
            if (showerTipAdded) scenarioTipsFound = true;
        }

        if (!scenarioTipsFound && selectedApps.length > 0) {
            conditionalTipsHtml += "<li>Analise os horários de uso dos seus aparelhos no cenário ajustado. Tente deslocar o consumo para horários de tarifa mais baixa e evite picos de demanda simultânea.</li>";
        } else if (selectedApps.length > 0 && !specificAdviceGiven && initialScenario && adjustedScenario.totalCost <= initialScenario.totalCost) {
            conditionalTipsHtml += `<li>✅ Seu plano ajustado parece bem otimizado em relação aos pontos críticos de custo! Continue explorando para encontrar o melhor equilíbrio entre conforto e economia.</li>`;
        } else if (selectedApps.length > 0 && scenarioTipsFound && !specificAdviceGiven && initialScenario && adjustedScenario.totalCost > initialScenario.totalCost) {

            conditionalTipsHtml += `<li>Revise os picos de demanda e o consumo nos horários mais caros para tentar reduzir o custo, pois seu cenário ajustado está mais caro que o inicial.</li>`;
        }

        conditionalTipsHtml += `</ul>`;
        scenarioTipsContainerElement.innerHTML = conditionalTipsHtml;
    }

    updateAllTimesSliders();
    recalculateAndDisplayAllScenarios();
});