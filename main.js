const COMPONENTS = {
            battery_9v: {
                name: "9V Battery",
                desc: "Standard alkaline battery",
                width: 50, height: 80,
                properties: { label: "9V Battery", voltage: 9, capacity: 500, mass: 45 },
                pins: [
                    { id: 'pos', label: '+', x: 10, y: 10, type: 'POWER' },
                    { id: 'neg', label: '-', x: 40, y: 10, type: 'GROUND' }
                ]
            },
            lipo_2s: {
                name: "2S LiPo",
                desc: "Lithium polymer battery",
                width: 60, height: 100,
                properties: { label: "2S LiPo", voltage: 7.4, capacity: 1000, mass: 85 },
                pins: [
                    { id: 'pos', label: '+', x: 15, y: 10, type: 'POWER' },
                    { id: 'neg', label: '-', x: 45, y: 10, type: 'GROUND' }
                ]
            },
            power_switch: {
                name: "Power Switch",
                desc: "Main power control",
                width: 60, height: 40,
                properties: { label: "Main Switch", mass: 5 },
                pins: [
                    { id: 'in', label: 'IN', x: 10, y: 20, type: 'ANY' },
                    { id: 'out', label: 'OUT', x: 50, y: 20, type: 'ANY' }
                ]
            },
            altimeter: {
                name: "Flight Computer",
                desc: "Altitude sensing & control",
                width: 120, height: 80,
                properties: { label: "Altimeter", operatingVoltage: 5, mass: 15 },
                pins: [
                    { id: 'pwr_in', label: 'PWR', x: 10, y: 20, type: 'POWER' },
                    { id: 'gnd', label: 'GND', x: 10, y: 60, type: 'GROUND' },
                    { id: 'apogee', label: 'APG', x: 110, y: 20, type: 'SIGNAL' },
                    { id: 'main', label: 'MAIN', x: 110, y: 60, type: 'SIGNAL' }
                ]
            },
            servo: {
                name: "Servo Motor",
                desc: "Precision actuator",
                width: 80, height: 50,
                properties: { label: "Airbrake Servo", operatingVoltage: 5, mass: 9 },
                pins: [
                    { id: 'pwr', label: 'PWR', x: 10, y: 25, type: 'POWER' },
                    { id: 'gnd', label: 'GND', x: 40, y: 25, type: 'GROUND' },
                    { id: 'sig', label: 'SIG', x: 70, y: 25, type: 'SIGNAL' }
                ]
            },
            terminal_block: {
                name: "Terminal Block",
                desc: "Connection hub",
                width: 100, height: 40,
                properties: { label: "Power Bus", mass: 10 },
                pins: [
                    { id: 't1', label: '1', x: 15, y: 20, type: 'ANY' },
                    { id: 't2', label: '2', x: 40, y: 20, type: 'ANY' },
                    { id: 't3', label: '3', x: 65, y: 20, type: 'ANY' },
                    { id: 't4', label: '4', x: 90, y: 20, type: 'ANY' }
                ]
            },
            robot_brain: {
                name: "Robot Brain",
                desc: "Main robotics controller",
                width: 120, height: 100,
                properties: { label: "Main Controller", operatingVoltage: 12, mass: 250 },
                pins: [
                    { id: 'pwr', label: 'PWR', x: 10, y: 25, type: 'POWER' },
                    { id: 'gnd', label: 'GND', x: 10, y: 75, type: 'GROUND' },
                    { id: 's1', label: 'S1', x: 110, y: 25, type: 'SIGNAL' },
                    { id: 's2', label: 'S2', x: 110, y: 75, type: 'SIGNAL' }
                ]
            },
            smart_motor: {
                name: "Smart Motor",
                desc: "Programmable actuator",
                width: 80, height: 60,
                properties: { label: "Drive Motor", operatingVoltage: 12, mass: 150 },
                pins: [
                    { id: 'pwr', label: 'PWR', x: 10, y: 20, type: 'POWER' },
                    { id: 'gnd', label: 'GND', x: 10, y: 40, type: 'GROUND' },
                    { id: 'sig', label: 'SIG', x: 70, y: 30, type: 'SIGNAL' }
                ]
            },
            led_indicator: {
                name: "LED Indicator",
                desc: "Status light",
                width: 40, height: 40,
                properties: { label: "Status LED", operatingVoltage: 3, mass: 2 },
                pins: [
                    { id: 'in', label: 'IN', x: 10, y: 20, type: 'SIGNAL' },
                    { id: 'gnd', label: 'GND', x: 30, y: 20, type: 'GROUND' }
                ]
            },
            resistor: {
                name: "Resistor",
                desc: "Current limiting",
                width: 60, height: 20,
                properties: { label: "330Ω", mass: 1 },
                pins: [
                    { id: 'p1', label: '1', x: 10, y: 10, type: 'ANY' },
                    { id: 'p2', label: '2', x: 50, y: 10, type: 'ANY' }
                ]
            }
        };

        class CircuitSpace {
            constructor() {
                this.state = {
                    components: [],
                    wires: [],
                    nextId: 0,
                    selectedId: null,
                    massTracking: false,
                    wiring: { active: false, sourcePin: null, tempLine: null },
                    view: { scale: 1, panX: 0, panY: 0 }
                };
                
                this.elements = {
                    canvas: document.getElementById('drawing-canvas'),
                    componentsList: document.getElementById('components-list'),
                    propertiesContent: document.getElementById('properties-content'),
                    statusList: document.getElementById('status-list'),
                    massToggle: document.getElementById('mass-toggle'),
                    massDisplay: document.getElementById('mass-display'),
                    massValue: document.getElementById('mass-value'),
                    zoomDisplay: document.getElementById('zoom-display'),
                    bomModal: document.getElementById('bom-modal'),
                    bomTableBody: document.getElementById('bom-table-body')
                };

                this.dragInfo = null;
                this.panInfo = null;
                
                this.init();
            }

            init() {
                this.setupComponents();
                this.setupEventListeners();
                this.render();
                this.validate();
            }

            setupComponents() {
                Object.entries(COMPONENTS).forEach(([type, def]) => {
                    const item = document.createElement('div');
                    item.className = 'component-item';
                    item.draggable = true;
                    item.dataset.type = type;
                    item.innerHTML = `
                        <div class="component-name">${def.name}</div>
                        <div class="component-desc">${def.desc}</div>
                    `;
                    this.elements.componentsList.appendChild(item);
                });
            }

            setupEventListeners() {
                this.elements.componentsList.addEventListener('dragstart', (e) => {
                    if (e.target.classList.contains('component-item')) {
                        e.dataTransfer.setData('text/plain', e.target.dataset.type);
                    }
                });

                this.elements.canvas.addEventListener('dragover', e => e.preventDefault());
                this.elements.canvas.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const type = e.dataTransfer.getData('text/plain');
                    const pos = this.getMousePosition(e);
                    this.addComponent(type, pos.x, pos.y);
                });

                this.elements.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                this.elements.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
                this.elements.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
                this.elements.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

                this.elements.massToggle.addEventListener('click', () => this.toggleMassTracking());

                document.getElementById('zoom-in-btn').addEventListener('click', () => this.zoom(1.2));
                document.getElementById('zoom-out-btn').addEventListener('click', () => this.zoom(1/1.2));
                document.getElementById('export-svg-btn').addEventListener('click', () => this.exportSVG());
                document.getElementById('generate-bom-btn').addEventListener('click', () => this.showBOM());
                document.getElementById('clear-all-btn').addEventListener('click', () => this.clearAll());
                document.getElementById('modal-close').addEventListener('click', () => this.hideBOM());

                window.addEventListener('click', (e) => {
                    if (e.target === this.elements.bomModal) this.hideBOM();
                });
            }

            getMousePosition(evt) {
                const CTM = this.elements.canvas.getScreenCTM();
                return {
                    x: (evt.clientX - CTM.e) / this.state.view.scale - this.state.view.panX,
                    y: (evt.clientY - CTM.f) / this.state.view.scale - this.state.view.panY
                };
            }

            addComponent(type, x, y) {
                const def = COMPONENTS[type];
                if (!def) return;

                const component = {
                    id: this.state.nextId++,
                    type,
                    x, y,
                    width: def.width,
                    height: def.height,
                    properties: { ...def.properties },
                    pins: [...def.pins]
                };

                this.state.components.push(component);
                this.selectComponent(component.id);
                this.updateMass();
                this.render();
            }

            removeComponent(id) {
                this.state.wires = this.state.wires.filter(w => 
                    w.source.componentId !== id && w.target.componentId !== id
                );
                this.state.components = this.state.components.filter(c => c.id !== id);
                
                if (this.state.selectedId === id) {
                    this.state.selectedId = null;
                    this.updateProperties();
                }
                
                this.updateMass();
                this.validate();
                this.render();
            }

            selectComponent(id) {
                this.state.selectedId = id;
                this.updateProperties();
                this.render();
            }

            findComponent(id) {
                return this.state.components.find(c => c.id === id);
            }

            findPin(component, pinId) {
                return component.pins.find(p => p.id === pinId);
            }

            handleMouseDown(e) {
                if (e.target.classList.contains('pin')) {
                    this.startWiring(e);
                    return;
                }

                const group = e.target.closest('.draggable-group');
                if (group) {
                    const id = parseInt(group.dataset.id);
                    this.selectComponent(id);
                    const pos = this.getMousePosition(e);
                    const comp = this.findComponent(id);
                    
                    this.dragInfo = {
                        component: comp,
                        offsetX: pos.x - comp.x,
                        offsetY: pos.y - comp.y
                    };
                } else {
                    this.selectComponent(null);
                    this.startPanning(e);
                }
            }

            handleMouseMove(e) {
                if (this.state.wiring.active) {
                    this.updateWiring(e);
                } else if (this.dragInfo) {
                    this.updateDrag(e);
                } else if (this.panInfo && this.panInfo.active) {
                    this.updatePan(e);
                }
            }

            handleMouseUp(e) {
                if (this.state.wiring.active) {
                    this.finishWiring(e);
                }
                this.dragInfo = null;
                if (this.panInfo) this.panInfo.active = false;
            }

            handleWheel(e) {
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
                this.zoom(factor);
            }

            startWiring(e) {
                this.state.wiring.active = true;
                const componentId = parseInt(e.target.dataset.componentId);
                const pinId = e.target.dataset.pinId;
                this.state.wiring.sourcePin = { componentId, pinId };

                const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tempLine.setAttribute('class', 'wire temp');
                this.state.wiring.tempLine = tempLine;
                
                e.stopPropagation();
            }

            updateWiring(e) {
                const pos = this.getMousePosition(e);
                const sourceComp = this.findComponent(this.state.wiring.sourcePin.componentId);
                const sourcePin = this.findPin(sourceComp, this.state.wiring.sourcePin.pinId);

                this.state.wiring.tempLine.setAttribute('x1', sourceComp.x + sourcePin.x);
                this.state.wiring.tempLine.setAttribute('y1', sourceComp.y + sourcePin.y);
                this.state.wiring.tempLine.setAttribute('x2', pos.x);
                this.state.wiring.tempLine.setAttribute('y2', pos.y);

                const transformGroup = this.elements.canvas.querySelector('g');
                if (transformGroup && !this.state.wiring.tempLine.parentElement) {
                    transformGroup.appendChild(this.state.wiring.tempLine);
                }
            }

            finishWiring(e) {
                if (this.state.wiring.tempLine.parentElement) {
                    this.state.wiring.tempLine.remove();
                }

                if (e.target.classList.contains('pin')) {
                    const targetComponentId = parseInt(e.target.dataset.componentId);
                    const targetPinId = e.target.dataset.pinId;
                    
                    if (this.state.wiring.sourcePin.componentId !== targetComponentId) {
                        this.state.wires.push({
                            source: this.state.wiring.sourcePin,
                            target: { componentId: targetComponentId, pinId: targetPinId }
                        });
                        this.validate();
                        this.render();
                    }
                }

                this.state.wiring.active = false;
                this.state.wiring.sourcePin = null;
                this.state.wiring.tempLine = null;
            }

            startPanning(e) {
                this.panInfo = {
                    active: true,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialPanX: this.state.view.panX,
                    initialPanY: this.state.view.panY
                };
            }

            updateDrag(e) {
                const pos = this.getMousePosition(e);
                this.dragInfo.component.x = pos.x - this.dragInfo.offsetX;
                this.dragInfo.component.y = pos.y - this.dragInfo.offsetY;
                this.render();
            }

            updatePan(e) {
                const dx = (e.clientX - this.panInfo.startX) / this.state.view.scale;
                const dy = (e.clientY - this.panInfo.startY) / this.state.view.scale;
                this.state.view.panX = this.panInfo.initialPanX + dx;
                this.state.view.panY = this.panInfo.initialPanY + dy;
                this.render();
            }

            zoom(factor) {
                const newScale = Math.max(0.2, Math.min(5, this.state.view.scale * factor));
                this.state.view.scale = newScale;
                this.updateZoomDisplay();
                this.render();
            }

            updateZoomDisplay() {
                const percentage = Math.round(this.state.view.scale * 100);
                this.elements.zoomDisplay.textContent = `${percentage}%`;
            }

            toggleMassTracking() {
                this.state.massTracking = !this.state.massTracking;
                this.elements.massToggle.classList.toggle('active', this.state.massTracking);
                this.elements.massDisplay.classList.toggle('hidden', !this.state.massTracking);
                this.updateProperties();
                this.updateMass();
            }

            updateMass() {
                if (this.state.massTracking) {
                    const total = this.state.components.reduce((sum, comp) => sum + (comp.properties.mass || 0), 0);
                    this.elements.massValue.textContent = `${total.toFixed(2)}g`;
                }
            }

            updateProperties() {
                const component = this.findComponent(this.state.selectedId);
                if (!component) {
                    this.elements.propertiesContent.innerHTML = '<div class="placeholder">Select a component to edit properties</div>';
                    return;
                }

                let html = '';
                Object.entries(component.properties).forEach(([key, value]) => {
                    if (key === 'mass' && !this.state.massTracking) return;
                    
                    const label = key.charAt(0).toUpperCase() + key.slice(1);
                    html += `
                        <div class="property-group">
                            <label class="property-label" for="prop-${key}">${label}</label>
                            <input 
                                type="${typeof value === 'number' ? 'number' : 'text'}" 
                                id="prop-${key}" 
                                class="property-input"
                                data-key="${key}" 
                                value="${value}"
                            >
                        </div>
                    `;
                });

                html += '<button class="btn btn-danger" id="delete-btn" style="width: 100%; margin-top: 16px;">Delete Component</button>';
                this.elements.propertiesContent.innerHTML = html;

                this.elements.propertiesContent.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        const key = e.target.dataset.key;
                        const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
                        component.properties[key] = value;
                        
                        if (key === 'label') this.render();
                        if (key === 'mass') this.updateMass();
                        this.validate();
                    });
                });

                document.getElementById('delete-btn').addEventListener('click', () => {
                    if (confirm('Delete this component?')) {
                        this.removeComponent(this.state.selectedId);
                    }
                });
            }

            validate() {
                this.elements.statusList.innerHTML = '';
                const issues = [];

                this.state.components.forEach(comp => {
                    comp.pins.forEach(pin => {
                        if (pin.type !== 'ANY' && !this.isPinConnected(comp.id, pin.id)) {
                            issues.push({
                                type: 'warning',
                                message: `${comp.properties.label}: Unconnected ${pin.type} pin (${pin.label})`
                            });
                        }
                    });
                });

                const powerSources = this.state.components.filter(c => c.type.includes('battery'));
                powerSources.forEach(source => {
                    const posPin = source.pins.find(p => p.type === 'POWER');
                    const negPin = source.pins.find(p => p.type === 'GROUND');
                    if (posPin && negPin && this.hasPath(source.id, posPin.id, source.id, negPin.id, [])) {
                        issues.push({
                            type: 'error',
                            message: `SHORT CIRCUIT: ${source.properties.label}`
                        });
                    }
                });

                this.state.wires.forEach(wire => {
                    const sourceComp = this.findComponent(wire.source.componentId);
                    const sourcePin = this.findPin(sourceComp, wire.source.pinId);
                    const targetComp = this.findComponent(wire.target.componentId);
                    const targetPin = this.findPin(targetComp, wire.target.pinId);

                    if (sourcePin.type === 'POWER' && targetComp.properties.operatingVoltage) {
                        const sourceV = sourceComp.properties.voltage;
                        const targetV = targetComp.properties.operatingVoltage;
                        if (sourceV && targetV && Math.abs(sourceV - targetV) > 1) {
                            issues.push({
                                type: 'error',
                                message: `Voltage mismatch: ${targetComp.properties.label} expects ${targetV}V, getting ${sourceV}V`
                            });
                        }
                    }
                });

                if (issues.length === 0) {
                    this.elements.statusList.innerHTML = '<li class="status-item status-ok"><div class="status-indicator"></div>System OK</li>';
                } else {
                    issues.forEach(issue => {
                        const li = document.createElement('li');
                        li.className = `status-item status-${issue.type}`;
                        li.innerHTML = `<div class="status-indicator"></div>${issue.message}`;
                        this.elements.statusList.appendChild(li);
                    });
                }
            }

            isPinConnected(componentId, pinId) {
                return this.state.wires.some(w =>
                    (w.source.componentId === componentId && w.source.pinId === pinId) ||
                    (w.target.componentId === componentId && w.target.pinId === pinId)
                );
            }

            hasPath(sourceCompId, sourcePinId, targetCompId, targetPinId, visited) {
                const connections = this.getConnections(sourceCompId, sourcePinId);
                for (const conn of connections) {
                    if (conn.componentId === targetCompId && conn.pinId === targetPinId) return true;
                    
                    const visitKey = `${conn.componentId}-${conn.pinId}`;
                    if (visited.includes(visitKey)) continue;
                    visited.push(visitKey);
                    
                    const connComp = this.findComponent(conn.componentId);
                    if (connComp.type === 'terminal_block' || connComp.type === 'power_switch') {
                        for (const otherPin of connComp.pins) {
                            if (otherPin.id !== conn.pinId) {
                                if (this.hasPath(conn.componentId, otherPin.id, targetCompId, targetPinId, [...visited])) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
            }

            getConnections(componentId, pinId) {
                const connections = [];
                this.state.wires.forEach(w => {
                    if (w.source.componentId === componentId && w.source.pinId === pinId) {
                        connections.push(w.target);
                    }
                    if (w.target.componentId === componentId && w.target.pinId === pinId) {
                        connections.push(w.source);
                    }
                });
                return connections;
            }

            render() {
                this.elements.canvas.innerHTML = '';

                const transformGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                transformGroup.setAttribute('transform', 
                    `scale(${this.state.view.scale}) translate(${this.state.view.panX}, ${this.state.view.panY})`
                );
                this.elements.canvas.appendChild(transformGroup);

                this.state.wires.forEach(wire => {
                    const sourceComp = this.findComponent(wire.source.componentId);
                    const targetComp = this.findComponent(wire.target.componentId);
                    if (!sourceComp || !targetComp) return;

                    const sourcePin = this.findPin(sourceComp, wire.source.pinId);
                    const targetPin = this.findPin(targetComp, wire.target.pinId);
                    if (!sourcePin || !targetPin) return;

                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', sourceComp.x + sourcePin.x);
                    line.setAttribute('y1', sourceComp.y + sourcePin.y);
                    line.setAttribute('x2', targetComp.x + targetPin.x);
                    line.setAttribute('y2', targetComp.y + targetPin.y);
                    
                    const wireType = sourcePin.type === 'ANY' ? targetPin.type : sourcePin.type;
                    line.setAttribute('class', `wire ${wireType}`);
                    transformGroup.appendChild(line);
                });

                this.state.components.forEach(comp => {
                    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    group.setAttribute('class', 'draggable-group');
                    group.setAttribute('transform', `translate(${comp.x}, ${comp.y})`);
                    group.dataset.id = comp.id;

                    const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    body.setAttribute('width', comp.width);
                    body.setAttribute('height', comp.height);
                    body.setAttribute('rx', 8);
                    body.setAttribute('class', `component-body ${comp.id === this.state.selectedId ? 'selected' : ''}`);
                    group.appendChild(body);

                    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    label.setAttribute('x', comp.width / 2);
                    label.setAttribute('y', -10);
                    label.setAttribute('class', 'component-label');
                    label.textContent = comp.properties.label;
                    group.appendChild(label);

                    comp.pins.forEach(pin => {
                        const pinCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        pinCircle.setAttribute('cx', pin.x);
                        pinCircle.setAttribute('cy', pin.y);
                        pinCircle.setAttribute('r', 6);
                        pinCircle.setAttribute('class', 'pin');
                        pinCircle.dataset.componentId = comp.id;
                        pinCircle.dataset.pinId = pin.id;
                        group.appendChild(pinCircle);

                        const pinLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        pinLabel.setAttribute('x', pin.x);
                        pinLabel.setAttribute('y', pin.y - 10);
                        pinLabel.setAttribute('class', 'pin-label');
                        pinLabel.textContent = pin.label;
                        group.appendChild(pinLabel);
                    });

                    transformGroup.appendChild(group);
                });
            }

            showBOM() {
                this.elements.bomTableBody.innerHTML = '';
                const counts = {};

                this.state.components.forEach(comp => {
                    const key = `${comp.type}-${comp.properties.label}`;
                    if (!counts[key]) {
                        counts[key] = {
                            name: COMPONENTS[comp.type].name,
                            label: comp.properties.label,
                            quantity: 0
                        };
                    }
                    counts[key].quantity++;
                });

                Object.values(counts).forEach(item => {
                    const row = this.elements.bomTableBody.insertRow();
                    row.insertCell(0).textContent = item.name;
                    row.insertCell(1).textContent = item.label;
                    row.insertCell(2).textContent = item.quantity;
                });

                this.elements.bomModal.classList.add('show');
            }

            hideBOM() {
                this.elements.bomModal.classList.remove('show');
            }

            exportSVG() {
                const selected = this.elements.canvas.querySelector('.selected');
                if (selected) selected.classList.remove('selected');

                const svgData = new XMLSerializer().serializeToString(this.elements.canvas);
                if (selected) selected.classList.add('selected');

                const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'circuit-diagram.svg';
                link.click();
                URL.revokeObjectURL(url);
            }

            clearAll() {
                if (confirm('Clear all components and connections?')) {
                    this.state.components = [];
                    this.state.wires = [];
                    this.state.selectedId = null;
                    this.updateProperties();
                    this.updateMass();
                    this.validate();
                    this.render();
                }
            }
        }

        new CircuitSpace();