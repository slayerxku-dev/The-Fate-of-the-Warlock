// --- UI & PERSISTENCE ---

// DOM Cache to prevent expensive lookups every 50ms
const uiCache = {};
function getEl(id) {
    if (!uiCache[id]) uiCache[id] = document.getElementById(id);
    return uiCache[id];
}

function log(message) {
    const logContainer = getEl('log-entries');
    const entry = document.createElement('div'); entry.className = 'log-entry';
    entry.innerText = `> ${message}`;
    logContainer.prepend(entry);
    if (logContainer.children.length > 8) logContainer.lastChild.remove();
}

function updateUI() {
    const manaVal = Math.floor(state.resources.mana);
    getEl('mana-count').innerText = manaVal;
    getEl('max-mana').innerText = state.resources.maxMana;
    getEl('mana-bar-fill').style.width = `${(manaVal / state.resources.maxMana) * 100}%`;
    getEl('mana-regen-rate').innerText = (state.resources.manaRegenRate * 1000).toFixed(2);
    
    getEl('soul-count').innerText = Math.floor(state.resources.souls);
    getEl('gold-count').innerText = Math.floor(state.resources.gold);
    getEl('knowledge-count').innerText = state.resources.knowledge;

    getEl('player-hp').innerText = Math.floor(state.combat.playerHp);
    getEl('enemy-hp').innerText = Math.floor(state.combat.enemyHp);
    getEl('enemy-max-hp').innerText = Math.floor(state.combat.enemyMaxHp);
    getEl('enemy-hp-fill').style.width = `${(state.combat.enemyHp / state.combat.enemyMaxHp) * 100}%`;
    getEl('combat-kills').innerText = state.combat.killCount;

    // Enemy Scaling UI
    const scalingFactor = Math.floor(state.combat.killCount / 10);
    const multiplier = 1 + (scalingFactor * 0.1);
    getEl('enemy-scaling').innerText = multiplier.toFixed(1);
    getEl('enemy-damage').innerText = Math.floor(state.combat.enemyDamage);

    // Potion UI
    getEl('haste-count').innerText = state.resources.potions.haste;
    getEl('might-count').innerText = state.resources.potions.might;
    
    getEl('haste-timer').innerText = state.resources.potionTimers.haste > 0 ? Math.ceil(state.resources.potionTimers.haste / 1000) + "s" : "Off";
    getEl('might-timer').innerText = state.resources.potionTimers.might > 0 ? Math.ceil(state.resources.potionTimers.might / 1000) + "s" : "Off";

    for (const [key, skill] of Object.entries(state.skills)) {
        const lvEl = getEl(`${key}-lv`); if (lvEl) lvEl.innerText = skill.level;
        const mBar = getEl(`${key}-mini-progress`);
        if (mBar) {
            const cur = getXPForLevel(skill.level), nxt = getXPForLevel(skill.level + 1);
            mBar.style.width = `${((skill.xp - cur) / (nxt - cur)) * 100}%`;
        }
    }
    for (const id in state.mastery) {
        const mEl = getEl(`mastery-${id}`); if (mEl) mEl.innerText = state.mastery[id];
    }

    getEl('equipped-wand').innerText = state.equipment.wand ? state.equipment.wand.name : 'None';
    getEl('equipped-grimoire').innerText = state.equipment.grimoire ? state.equipment.grimoire.name : 'None';
    updateUnlocks();

    if (getEl('stat-total-gold')) getEl('stat-total-gold').innerText = Math.floor(state.stats?.totalGold || 0);
    if (getEl('stat-total-souls')) getEl('stat-total-souls').innerText = Math.floor(state.stats?.totalSouls || 0);
    if (getEl('stat-total-kills')) getEl('stat-total-kills').innerText = state.stats?.totalKills || state.combat.killCount;

    const meditateGainEl = getEl('meditate-gain');
    if (meditateGainEl) {
        let gain = (5 + Math.floor(state.skills.darkArts.level / 5)) * state.mastery.meditate;
        if (state.upgrades.manaInfusion) gain *= 1.5;
        if (state.equipment.grimoire) gain *= (1 + state.equipment.grimoire.manaGainBonus || 0);
        meditateGainEl.innerText = Math.floor(gain);
    }
}

// --- TOOLTIP SYSTEM (TASK-023) ---
function initTooltips() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('mouseenter', (e) => {
            const taskId = btn.id.replace('btn-', '');
            showTaskTooltip(e, taskId);
        });
        btn.addEventListener('mouseleave', hideTooltip);
    });
}

function showTaskTooltip(event, taskId) {
    const task = tasks[taskId];
    if (!task) return;

    const tooltip = getEl('global-tooltip');
    const masteryBonus = Math.min(1.5, 1 + (state.mastery[taskId] - 1) * 0.01);
    const hasteBonus = state.resources.potionTimers.haste > 0 ? 1.25 : 1.0;
    const quickCastingBonus = state.upgrades.quickCasting ? 1.15 : 1.0;
    const totalMult = (masteryBonus * hasteBonus * quickCastingBonus).toFixed(2);

    tooltip.innerHTML = `
        <span class="tooltip-title">${task.name}</span>
        <div class="multiplier-line"><span>Base Duration:</span> <span>${task.duration}s</span></div>
        <div class="multiplier-line"><span>Mastery:</span> <span class="mult-val">x${masteryBonus.toFixed(2)}</span></div>
        <div class="multiplier-line"><span>Haste Potion:</span> <span class="mult-val">x${hasteBonus.toFixed(2)}</span></div>
        <div class="multiplier-line"><span>Upgrades:</span> <span class="mult-val">x${quickCastingBonus.toFixed(2)}</span></div>
        <div class="multiplier-line" style="border-top:1px solid #444; margin-top:5px; padding-top:5px;">
            <span>Total Speed:</span> <span class="mult-val">x${totalMult}</span>
        </div>
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 15) + 'px';
    tooltip.style.top = (event.pageY + 15) + 'px';
}

function hideTooltip() { getEl('global-tooltip').style.display = 'none'; }

function showTab(id) { 
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    state.settings = state.settings || {};
    state.settings.theme = theme;
    saveGame();
}

function updateUnlocks() {
    Object.values(tasks).forEach(t => {
        const card = document.getElementById(`card-${t.id}`);
        if (card) t.levelReq <= state.skills[t.skill].level ? card.classList.remove('locked') : card.classList.add('locked');
    });
}

function saveGame() {
    state.lastSaveTime = Date.now();
    localStorage.setItem('warlock_v1', JSON.stringify(state));
    log("Game saved!");
}

function hardReset() {
    if (confirm("Are you absolutely sure you want to delete all progress? This cannot be undone.")) {
        localStorage.removeItem('warlock_v1');
        location.reload();
    }
}

function loadGame() {
    const s = localStorage.getItem('warlock_v1');
    if (s) { Object.assign(state, JSON.parse(s)); updateUI(); updateUnlocks(); }
    
    // Apply saved theme
    if (state.settings?.theme) setTheme(state.settings.theme);

    const currentTime = Date.now();
    const offlineTimeElapsed = (state.lastSaveTime) ? (currentTime - state.lastSaveTime) : 0;
    if (offlineTimeElapsed > 500) {
        log(`Welcome back! Away for ${Math.floor(offlineTimeElapsed / 1000)}s.`);
        
        // Capture resource counts before gameTick
        const beforeCounts = { ...state.resources };
        
        gameTick(offlineTimeElapsed);
        
        // Compare 'before' and 'after' counts
        const afterCounts = state.resources;
        const differences = {};
        for (const key in beforeCounts) {
            if (beforeCounts[key] !== afterCounts[key]) {
                differences[key] = { before: beforeCounts[key], after: afterCounts[key] };
            }
        }
        
        // Update the modal with the differences and make it visible
        const offlineModal = document.getElementById('offline-progress-modal');
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = '';
        for (const [resource, diff] of Object.entries(differences)) {
            const entry = document.createElement('div'); entry.className = 'modal-entry';
            entry.innerText = `${resource}: ${diff.before} -> ${diff.after}`;
            modalContent.appendChild(entry);
        }
        offlineModal.style.display = 'block';
    }
    state.lastTickTime = currentTime;
}

// --- NEW FUNCTION FOR TOAST NOTIFICATIONS ---
function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div'); toast.className = 'toast';
    toast.innerText = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration);
}

// --- VOID PARTICLE SYSTEM (TASK-051) ---
let particles = [];
function initVoidParticles() {
    const canvas = getEl('void-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Create initial particles
    for(let i = 0; i < 40; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 0.3 + 0.1,
            opacity: Math.random() * 0.5 + 0.1
        });
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#8a2be2'; // Deep void purple
        particles.forEach(p => {
            ctx.globalAlpha = p.opacity;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            p.y -= p.speed;
            if (p.y < -10) p.y = canvas.height + 10;
        });
        requestAnimationFrame(animateParticles);
    }
    animateParticles();
}

// --- INITIALIZATION ---
window.onload = () => {
    loadGame();
    initTooltips();
    initVoidParticles();
    // Logic loop is handled by requestAnimationFrame in engine.js
};