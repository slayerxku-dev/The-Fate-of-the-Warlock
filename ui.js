// --- UI & PERSISTENCE ---
function log(message) {
    const logContainer = document.getElementById('log-entries');
    const entry = document.createElement('div'); entry.className = 'log-entry';
    entry.innerText = `> ${message}`;
    logContainer.prepend(entry);
    if (logContainer.children.length > 8) logContainer.lastChild.remove();
}

function updateUI() {
    const manaVal = Math.floor(state.resources.mana);
    document.getElementById('mana-count').innerText = manaVal;
    document.getElementById('max-mana').innerText = state.resources.maxMana;
    document.getElementById('mana-bar-fill').style.width = `${(manaVal / state.resources.maxMana) * 100}%`;
    document.getElementById('mana-regen-rate').innerText = (state.resources.manaRegenRate * 1000).toFixed(2);
    
    document.getElementById('soul-count').innerText = Math.floor(state.resources.souls);
    document.getElementById('gold-count').innerText = Math.floor(state.resources.gold);
    document.getElementById('knowledge-count').innerText = state.resources.knowledge;

    document.getElementById('player-hp').innerText = Math.floor(state.combat.playerHp);
    document.getElementById('enemy-hp').innerText = Math.floor(state.combat.enemyHp);
    document.getElementById('enemy-hp-fill').style.width = `${(state.combat.enemyHp / state.combat.enemyMaxHp) * 100}%`;
    document.getElementById('combat-kills').innerText = state.combat.killCount;

    for (const [key, skill] of Object.entries(state.skills)) {
        const lvEl = document.getElementById(`${key}-lv`); if (lvEl) lvEl.innerText = skill.level;
        const mBar = document.getElementById(`${key}-mini-progress`);
        if (mBar) {
            const cur = getXPForLevel(skill.level), nxt = getXPForLevel(skill.level + 1);
            mBar.style.width = `${((skill.xp - cur) / (nxt - cur)) * 100}%`;
        }
    }
    for (const id in state.mastery) {
        const mEl = document.getElementById(`mastery-${id}`); if (mEl) mEl.innerText = state.mastery[id];
    }

    document.getElementById('equipped-wand').innerText = state.equipment.wand ? state.equipment.wand.name : 'None';
    document.getElementById('equipped-grimoire').innerText = state.equipment.grimoire ? state.equipment.grimoire.name : 'None';

    const meditateGainEl = document.getElementById('meditate-gain');
    if (meditateGainEl) {
        let gain = (5 + Math.floor(state.skills.darkArts.level / 5)) * state.mastery.meditate;
        if (state.upgrades.manaInfusion) gain *= 1.5;
        if (state.equipment.grimoire) gain *= (1 + state.equipment.grimoire.manaGainBonus || 0);
        meditateGainEl.innerText = Math.floor(gain);
    }
}

function showTab(id) { 
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(id).classList.add('active');
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

function loadGame() {
    const s = localStorage.getItem('warlock_v1');
    if (s) { Object.assign(state, JSON.parse(s)); updateUI(); updateUnlocks(); }
    
    const currentTime = Date.now();
    const offlineTimeElapsed = currentTime - state.lastSaveTime;
    if (offlineTimeElapsed > 0) {
        log(`Welcome back! Away for ${Math.floor(offlineTimeElapsed / 1000)}s.`);
        gameTick(offlineTimeElapsed);
    }
    state.lastTickTime = currentTime;
}