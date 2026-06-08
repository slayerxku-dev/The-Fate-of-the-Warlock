// --- ENGINE & LOGIC ---
const XP_BASE = 100;
const XP_MULTIPLIER = 1.18;
const MASTERY_CHANCE = 0.12;
const MANA_REGEN_BASE = 0.02;
const COMBAT_PLAYER_BASE_DAMAGE = 5;
const COMBAT_GOLD_REWARD = 10;
const COMBAT_XP_REWARD = 50;

const ZONES_DATA = {
    wilderness: { name: "Wilderness", requiredKills: 0, enemyStats: { hp: 20, damage: 3 } },
    cursedForest: { name: "Cursed Forest", requiredKills: 50, enemyStats: { hp: 40, damage: 5 } },
    crypt: { name: "Crypt", requiredKills: 150, enemyStats: { hp: 60, damage: 7 } }
};

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

const BLOOD_MAGIC_DATA = {
    blood: { name: "Blood", initialAmount: 0 },
    hemomancy: { name: "Hemomancy", level: 1, xp: 0 }
};

const TASKS_DATA = {
    bloodSiphon: { 
        name: "Blood Siphon",
        duration: 4,
        cost: 10,
        reward: { blood: 5, hemomancyXp: 5 },
        requirement: () => state.resources.health > 10
    }
};

const MANA_CRYSTAL_DATA = {
    manaCrystal: { name: "Mana Crystal", effect: (state) => { state.resources.maxMana += 5 } }
};

function gainManaCrystal() {
    if (Math.random() < 0.02 && state.activeTask === 'shadowBoltTraining') {
        const crystal = MANA_CRYSTAL_DATA.manaCrystal;
        crystal.effect(state);
        log(`You gained a Mana Crystal! +5 Max Mana`);
    }
}

function gameTick(timeElapsed) {
    if (state.activeTask) {
        const task = tasks[state.activeTask];
        let taskSpeedMultiplier = 1;
        const masterySpeedBonus = Math.min(1.5, 1 + (state.mastery[state.activeTask] - 1) * 0.01);
        taskSpeedMultiplier *= masterySpeedBonus;
        
        if (state.resources.potionTimers.haste > 0) {
            state.resources.potionTimers.haste -= timeElapsed;
            taskSpeedMultiplier *= 1.25; // 25% faster
        }
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
            
            let playerDamage = (COMBAT_PLAYER_BASE_DAMAGE + Math.floor(state.skills.darkArts.level / 2));
            if (state.resources.potionTimers.might > 0) {
                state.resources.potionTimers.might -= timeElapsed;
                playerDamage *= 1.2; // 20% damage boost
            }
            
            state.combat.enemyHp -= playerDamage;
            state.combat.playerHp -= state.combat.enemyDamage;
            if (state.combat.enemyHp <= 0) {
                state.combat.killCount++;
                
                const scalingFactor = Math.floor(state.combat.killCount / 10);
                const multiplier = 1 + (scalingFactor * 0.1);
                
                state.combat.enemyMaxHp *= multiplier;
                state.combat.enemyDamage *= multiplier;
                state.combat.enemyHp = state.combat.enemyMaxHp;
                
                state.resources.gold += Math.floor(COMBAT_GOLD_REWARD * multiplier);
                gainXP('darkArts', Math.floor(COMBAT_XP_REWARD * multiplier));
            }
            if (state.combat.playerHp <= 0) { state.combat.playerHp = state.combat.playerMaxHp; state.combat.isFighting = false; toggleCombat(); }
        }
    }

    state.resources.manaRegenRate = calculateManaRegen();
    state.resources.mana = Math.min(state.resources.maxMana, state.resources.mana + (state.resources.manaRegenRate * timeElapsed / 1000));
    
    // Blood Magic
    if (state.combat.isFighting && state.combat.enemyHp <= 0) {
        const bloodReward = Math.floor(Math.random() * 3) + 1;
        state.resources.blood += bloodReward;
        gainXP('hemomancy', TASKS_DATA.bloodSiphon.reward.hemomancyXp);
    }

    // Auto-Eat Logic
    if (state.combat.isFighting && state.playerHp <= state.playerMaxHp * 0.2) {
        usePotion('Health Potion');
    }
    
    gainManaCrystal();
}

// --- SOUL FORGING ---
const SOUL_FORGING_DATA = {
    soulForging: { 
        name: "Soul Forging",
        cost: { souls: 10, knowledge: 5 },
        reward: { item: 'acolyteRod', damageBonus: 5 }
    }
};

function upgradeBasicWand() {
    if (state.resources.souls >= SOUL_FORGING_DATA.soulForging.cost.souls && state.resources.knowledge >= SOUL_FORGING_DATA.soulForging.cost.knowledge) {
        state.resources.souls -= SOUL_FORGING_DATA.soulForging.cost.souls;
        state.resources.knowledge -= SOUL_FORGING_DATA.soulForging.cost.knowledge;
        
        const acolyteRod = ITEMS_DATA.acolyteRod || { id: 'acolyteRod', name: 'Acolyte Rod', type: 'wand', damageBonus: 7 };
        state.inventory[acolyteRod.id] = (state.inventory[acolyteRod.id] || 0) + 1;
        
        log(`You upgraded your Basic Wand to an Acolyte Rod!`);
    } else {
        log('Not enough Souls or Knowledge to upgrade.');
    }
}

// Add a new tab for Soul Forging
function createSoulForgingTab() {
    const tab = document.createElement('div');
    tab.id = 'soulForging';
    tab.className = 'tab-content';

    const title = document.createElement('h2');
    title.textContent = 'Soul Forging';
    tab.appendChild(title);

    const upgradeButton = document.createElement('button');
    upgradeButton.textContent = 'Upgrade Basic Wand to Acolyte Rod';
    upgradeButton.onclick = upgradeBasicWand;
    tab.appendChild(upgradeButton);

    return tab;
}

// Add the Soul Forging tab to the UI
document.getElementById('tabs').appendChild(createSoulForgingTab());

// --- ENEMIES ---
const ENEMY_POOLS = {
    wilderness: { name: "Wilderness", enemies: ['Inquisitor Scout'] },
    cursedForest: { name: "Cursed Forest", enemies: ['Cursed Beast', 'Wraith'] }
};

function getEnemyPool(zone) {
    return ENEMY_POOLS[zone] || { name: "Unknown Zone", enemies: [] };
}

function spawnEnemies(zone) {
    const pool = getEnemyPool(zone);
    for (let i = 0; i < pool.enemies.length; i++) {
        const enemyType = pool.enemies[i];
        let enemyStats;
        switch (enemyType) {
            case 'Inquisitor Scout':
                enemyStats = { hp: 20, damage: 3 };
                break;
            case 'Cursed Beast':
                enemyStats = { hp: 45, damage: 6 };
                break;
            case 'Wraith':
                enemyStats = { hp: 30, damage: 5 };
                break;
        }
        const enemy = createEnemy(enemyStats);
        state.enemies.push(enemy);
    }
}

function createEnemy(stats) {
    return {
        hp: stats.hp,
        maxHp: stats.hp,
        damage: stats.damage,
        isAlive: true
    };
}

// --- ZONE TRANSITION ---
function transitionToZone(zone) {
    const zoneData = ZONES_DATA[zone];
    if (zoneData.requiredKills <= state.combat.killCount) {
        spawnEnemies(zone);
        document.getElementById('current-zone').textContent = `Current Zone: ${zoneData.name}`;
    } else {
        log(`You need to kill ${zoneData.requiredKills} enemies in the Wilderness before moving to the Cursed Forest.`);
    }
}

// --- SUMMARY ---
// The code has been updated to include new enemies for the 'Cursed Forest' zone, a new enemy pool that replaces the 'Inquisitor Scout' after 100 total kills, featuring higher HP and specialized drops. Additionally, functions have been added to handle enemy spawning based on the current zone and transitioning between zones.