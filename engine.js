// --- ENGINE & LOGIC ---
const XP_BASE = 100;
const XP_MULTIPLIER = 1.18;
const MASTERY_CHANCE = 0.12;
const MANA_REGEN_BASE = 0.02;
const COMBAT_PLAYER_BASE_DAMAGE = 5;
const COMBAT_GOLD_REWARD = 10;
const COMBAT_XP_REWARD = 50;

const UPGRADES_DATA = {
    quickCasting: { name: "Quick Casting", cost: 1 },
    manaInfusion: { name: "Mana Infusion", cost: 2 },
    soulHarvestBoost: { name: "Soul Harvest Boost", cost: 3 },
    combatEfficiency: { name: "Combat Efficiency", cost: 4 }
};

const ITEMS_DATA = {
    basicWand: { id: 'basicWand', name: 'Basic Wand', type: 'wand', damageBonus: 2 },
    tatteredGrimoire: { id: 'tatteredGrimoire', name: 'Tattered Grimoire', type: 'grimoire', manaRegenBonus: 0.05 }
};

const getXPForLevel = (lv) => lv <= 1 ? 0 : Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, lv - 1));

function calculateManaRegen() {
    let regen = MANA_REGEN_BASE * state.skills.darkArts.level * state.resources.prestigeMultiplier;
    if (state.equipment.grimoire) regen += state.equipment.grimoire.manaRegenBonus || 0;
    if (state.resources.witchsBrewTimer > 0) regen *= 2.0;
    return regen;
}

function gainXP(skillName, amount) {
    const skill = state.skills[skillName];
    skill.xp += amount;
    while (skill.xp >= getXPForLevel(skill.level + 1)) {
        skill.level++; state.resources.knowledge += 1;
        log(`Level Up! ${skill.name} is Lv. ${skill.level}.`);
        updateUnlocks();
    }
}

function incrementMastery(taskId) {
    if (Math.random() < MASTERY_CHANCE) {
        state.mastery[taskId]++;
        log(`Mastery for ${taskId} is now ${state.mastery[taskId]}!`);
    }
}

function toggleCombat() {
    state.combat.isFighting = !state.combat.isFighting;
    document.getElementById('btn-combat').innerText = state.combat.isFighting ? "Retreat" : "Venture into Wilderness";
}

function buyUpgrade(upgradeId, cost) {
    if (state.resources.knowledge >= cost && !state.upgrades[upgradeId]) {
        state.resources.knowledge -= cost;
        state.upgrades[upgradeId] = true;
        log("Upgrade purchased.");
        updateUI();
    }
}

function handleTaskClick(taskId) { state.activeTask === taskId ? stopTask() : startTask(taskId); }

function startTask(taskId) {
    if (tasks[taskId].requirement && !tasks[taskId].requirement()) return;
    stopTask(); state.activeTask = taskId;
    const btn = document.getElementById(`btn-${taskId}`); if (btn) btn.innerText = "Stop";
}

function stopTask() {
    if (state.activeTask) {
        const btn = document.getElementById(`btn-${state.activeTask}`); if (btn) btn.innerText = "Begin";
        const bar = document.getElementById(`${state.activeTask}-progress`); if (bar) bar.style.width = "0%";
    }
    state.activeTask = null; state.currentTaskProgress = 0;
}

function performRitual() {
    if (state.skills.darkArts.level < 10) return;
    state.resources.prestigeMultiplier += (Object.values(state.skills).reduce((s, x) => s + x.level, 0) * 0.05);
    // Simplified reset
    for (let s in state.skills) { state.skills[s].xp = 0; state.skills[s].level = 1; }
    saveGame(); location.reload();
}

function gameTick(timeElapsed) {
    if (state.activeTask) {
        const task = tasks[state.activeTask];
        let taskSpeedMultiplier = 1;
        const masterySpeedBonus = Math.min(1.5, 1 + (state.mastery[state.activeTask] - 1) * 0.01);
        taskSpeedMultiplier *= masterySpeedBonus;
        if (state.upgrades.quickCasting) taskSpeedMultiplier *= 1.15;

        state.currentTaskProgress += (100 / task.duration) * taskSpeedMultiplier * timeElapsed;
        while (state.currentTaskProgress >= 100) {
            state.currentTaskProgress -= 100; task.onComplete();
            if (task.requirement && !task.requirement()) { stopTask(); break; }
        }
        const bar = document.getElementById(`${state.activeTask}-progress`);
        if (bar) bar.style.width = `${state.currentTaskProgress}%`;
    }

    if (state.resources.witchsBrewTimer > 0) {
        state.resources.witchsBrewTimer -= timeElapsed;
    }

    if (state.combat.isFighting) {
        state.combat.combatTickCounter += timeElapsed;
        if (state.combat.combatTickCounter >= state.combat.combatTickInterval) {
            state.combat.combatTickCounter = 0;
            state.combat.enemyHp -= (COMBAT_PLAYER_BASE_DAMAGE + Math.floor(state.skills.darkArts.level / 2));
            state.combat.playerHp -= state.combat.enemyDamage;
            if (state.combat.enemyHp <= 0) {
                state.combat.killCount++; state.combat.enemyHp = state.combat.enemyMaxHp;
                state.resources.gold += COMBAT_GOLD_REWARD; gainXP('darkArts', COMBAT_XP_REWARD);
            }
            if (state.combat.playerHp <= 0) { state.combat.playerHp = state.combat.playerMaxHp; state.combat.isFighting = false; toggleCombat(); }
        }
    }

    state.resources.manaRegenRate = calculateManaRegen();
    state.resources.mana = Math.min(state.resources.maxMana, state.resources.mana + (state.resources.manaRegenRate * timeElapsed / 1000));
}

function mainLoop() {
    const currentTime = Date.now();
    gameTick(currentTime - state.lastTickTime);
    state.lastTickTime = currentTime;
    updateUI();
}

function equipItem(item) {
    if (state.equipment[item.type]) state.inventory.push(state.equipment[item.type]);
    state.equipment[item.type] = item;
    state.inventory = state.inventory.filter(i => i.id !== item.id);
    updateUI();
}

window.onload = () => { 
    loadGame(); 
    setInterval(mainLoop, state.updateInterval); 
    setInterval(saveGame, 30000); 
};

if (typeof module !== 'undefined') { module.exports = { state, tasks, items: ITEMS_DATA }; }