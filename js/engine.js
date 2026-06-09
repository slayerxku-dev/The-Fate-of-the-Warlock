// --- ENGINE & LOGIC ---
const XP_BASE = 100;
const XP_MULTIPLIER = 1.18;
const MANA_REGEN_BASE = 0.02;
const COMBAT_PLAYER_BASE_DAMAGE = 5;
const COMBAT_GOLD_REWARD = 10;
const COMBAT_XP_REWARD = 50;

const UPGRADES_DATA = {
    quickCasting: { name: "Quick Casting", cost: 1 },
    manaInfusion: { name: "Mana Infusion", cost: 2 },
    soulHarvestBoost: { name: "Soul Harvest Boost", cost: 3 },
    combatEfficiency: { name: "Combat Efficiency", cost: 4 },
    necromancy: { name: "Necromancy", cost: 5 } // New Necromancy upgrade
};

const ITEMS_DATA = {
    basicWand: { id: 'basicWand', name: 'Basic Wand', type: 'wand', damageBonus: 2 },
    tatteredGrimoire: { id: 'tatteredGrimoire', name: 'Tattered Grimoire', type: 'grimoire', manaRegenBonus: 0.05 }
};

const TASKS_DATA = {
    bloodSiphon: { 
        name: "Blood Siphon",
        duration: 4,
        cost: 10,
        reward: { blood: 5, hemomancyXp: 5 },
        requirement: () => state.combat.playerHp > 10
    },
    bloodTithe: {
        name: "Blood Tithe",
        duration: 2,
        cost: 0,
        reward: (state) => {
            const goldReward = Math.floor(state.combat.playerHp * 0.2);
            state.resources.gold += goldReward;
            gainXP('hemomancy', TASKS_DATA.bloodTithe.reward.hemomancyXp);
        },
        requirement: () => state.combat.playerHp > 0
    }
};

function getXPForLevel(lv) { 
    return Math.floor(XP_BASE * Math.pow(XP_MULTIPLIER, lv - 1)); 
}

function gainXP(skillId, amount) {
    const skill = state.skills[skillId];
    if (!skill) return;
    skill.xp += amount * (state.resources.prestigeMultiplier || 1);
    while (skill.xp >= getXPForLevel(skill.level + 1)) {
        skill.level++;
        log(`${skill.name} reached level ${skill.level}!`);
        if (typeof showToast === 'function') showToast(`${skill.name} Level ${skill.level}!`);
        checkMilestones(skillId, skill.level);
    }
}

function calculateManaRegen() {
    let regen = MANA_REGEN_BASE;
    if (state.resources.witchsBrewTimer > 0) regen *= 2;
    if (state.equipment.grimoire) regen += (state.equipment.grimoire.manaRegenBonus || 0);
    return regen;
}

function checkMilestones(skillId, level) {
    if (skillId === 'darkArts' && level === 10) {
        state.resources.maxMana += 20;
        log("Milestone: Dark Arts Lv10! +20 Max Mana.");
    } else if (skillId === 'soulReaping' && level === 10) {
        log("Milestone: Soul Reaping Lv10! Soul harvesting is now more efficient.");
    } else if (skillId === 'alchemy' && level === 10) {
        log("Milestone: Alchemy Lv10! Potions now last longer.");
    }
}

const MANA_CRYSTAL_DATA = {
    manaCrystal: { name: "Mana Crystal", effect: (state) => { state.resources.maxMana += 5 } }
};

function gainManaCrystal() {
    if (Math.random() < 0.02 && state.activeTask === 'shadowbolt') {
        const crystal = MANA_CRYSTAL_DATA.manaCrystal;
        crystal.effect(state);
        log(`You gained a Mana Crystal! +5 Max Mana`);
    }
}

let lastStateHash = null;

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

        state.currentTaskProgress += (100 / task.duration) * taskSpeedMultiplier * (timeElapsed / 1000);
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
                
                state.combat.enemyMaxHp = 50 * multiplier;
                state.combat.enemyDamage = 5 * multiplier;
                state.combat.enemyHp = state.combat.enemyMaxHp;
                
                state.resources.gold += Math.floor(COMBAT_GOLD_REWARD * multiplier);
                gainXP('darkArts', Math.floor(COMBAT_XP_REWARD * multiplier));

                // Kill Rewards (Blood Magic)
                const bloodReward = Math.floor(Math.random() * 3) + 1;
                state.resources.blood += bloodReward;
                gainXP('hemomancy', 5);
            }
            if (state.combat.playerHp <= 0) { state.combat.playerHp = state.combat.playerMaxHp; state.combat.isFighting = false; toggleCombat(); }
        }
    }

    state.resources.manaRegenRate = calculateManaRegen();
    state.resources.mana = Math.min(state.resources.maxMana, state.resources.mana + (state.resources.manaRegenRate * timeElapsed / 1000));

    // Auto-Eat Logic
    if (state.combat.isFighting && state.combat.playerHp <= state.combat.playerMaxHp * 0.2) {
        usePotion('health');
        updateUI();
    }

    impResearchTick(timeElapsed);
    gainManaCrystal();
}

function hashState(state) {
    // Include resources in the hash so UI updates when mana/progress changes
    return JSON.stringify({ r: state.resources, t: state.activeTask, p: state.currentTaskProgress, c: state.combat });
}

let lastFrameTime = null;

function animate(currentTime) {
    if (!lastFrameTime) {
        lastFrameTime = currentTime;
        requestAnimationFrame(animate);
        return;
    }

    const timeElapsed = currentTime - lastFrameTime;
    gameTick(timeElapsed);

    if (hashState(state) !== lastStateHash) {
        updateUI();
        lastStateHash = hashState(state);
    }

    lastFrameTime = currentTime;
    requestAnimationFrame(animate);
}

requestAnimationFrame(animate);

// --- IMP RESEARCH ---
function impResearchTick() {
    if (state.resources.imps > 0 && Math.random() < (0.0167 * (state.updateInterval / 1000))) {
        state.resources.knowledge += 1;
        log(`Imp generated 1 Knowledge point!`);
    }
}

function stopTask() {
    if (state.activeTask) {
        const bar = document.getElementById(`${state.activeTask}-progress`);
        if (bar) bar.style.width = '0%';
    }
    state.activeTask = null;
    state.currentTaskProgress = 0;
    updateUI();
}

function toggleCombat() {
    state.combat.isFighting = !state.combat.isFighting;
    if (state.combat.isFighting) spawnEnemies('wilderness');
    updateUI();
}

function buyPotion(type, cost) {
    if (state.resources.gold >= cost) {
        state.resources.gold -= cost;
        state.resources.potions[type]++;
        log(`Bought Potion of ${type}.`);
        updateUI();
    } else {
        log("Not enough gold!");
    }
}

function usePotion(type) {
    if (state.resources.potions[type] > 0) {
        state.resources.potions[type]--;
        if (type === 'health') {
            state.combat.playerHp = Math.min(state.combat.playerMaxHp, state.combat.playerHp + 50);
        } else {
            state.resources.potionTimers[type] = 300000; // 5 mins
        }
        log(`Used ${type} potion.`);
    }
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

// --- NECROMANCY ---
const NECROMANCY_DATA = {
    raiseSkeleton: { 
        name: "Raise Skeleton",
        cost: 5,
        reward: { skeletonId: 'skeleton', damageBonus: 3 },
        requirement: () => state.resources.souls >= 10
    }
};

function handleNecromancyClick() {
    if (state.resources.souls >= NECROMANCY_DATA.raiseSkeleton.cost) {
        state.resources.souls -= NECROMANCY_DATA.raiseSkeleton.cost;
        
        const skeleton = { id: 'skeleton', name: 'Skeleton', type: 'minion', damageBonus: NECROMANCY_DATA.raiseSkeleton.reward.damageBonus };
        state.inventory[skeleton.id] = (state.inventory[skeleton.id] || 0) + 1;
        
        log(`You raised a Skeleton!`);
    } else {
        log('Not enough Souls to raise a Skeleton.');
    }
}

// --- ENEMIES ---
const ENEMY_POOLS = {
    wilderness: { name: "Wilderness", enemies: ['Inquisitor Scout'] },
    cursedForest: { name: "Cursed Forest", enemies: ['Cursed Beast', 'Wraith'] }
};

function getEnemyPool(zone) {
    return ENEMY_POOLS[zone] || { name: "Unknown Zone", enemies: [] };
}

function spawnEnemies(zone) {
    const pool = ENEMY_POOLS[zone] || ENEMY_POOLS.wilderness;
    // Pick a random enemy from the pool
    const enemyType = pool.enemies[Math.floor(Math.random() * pool.enemies.length)];
    
    const scalingFactor = Math.floor(state.combat.killCount / 10);
    const mult = 1 + (scalingFactor * 0.1);

    // Define base stats if not present in a global lookup
    const statsMap = {
        'Inquisitor Scout': { hp: 20, damage: 3 },
        'Cursed Beast': { hp: 45, damage: 6 },
        'Wraith': { hp: 30, damage: 5 }
    };

    const base = statsMap[enemyType] || { hp: 20, damage: 3 };
    
    state.combat.enemyMaxHp = Math.floor(base.hp * mult);
    state.combat.enemyHp = state.combat.enemyMaxHp;
    state.combat.enemyDamage = Math.floor(base.damage * mult);
    state.combat.enemyName = enemyType;
}

function handleTaskClick(taskId) {
    if (state.activeTask === taskId) {
        stopTask();
    } else {
        // Check requirements before starting
        const task = tasks[taskId];
        if (task && task.requirement && !task.requirement()) {
            log(`Cannot start ${task.id}: Requirements not met.`);
            return;
        }
        state.activeTask = taskId;
        state.currentTaskProgress = 0;
        log(`Started: ${taskId}`);
    }
    updateUI();
}

// --- WARLOCK APPRENTICE MINI-BOSSES ---
const MINIBOSS_DATA = {
    warlockApprentice: { 
        name: "Warlock Apprentice",
        hp: 100,
        damage: 15,
        requiredKills: 50,
        reward: { item: 'etherealThread', amount: 1 }
    }
};

function checkForMiniBoss() {
    if (state.combat.killCount > 0 && state.combat.killCount % MINIBOSS_DATA.warlockApprentice.requiredKills === 0) {
        const boss = MINIBOSS_DATA.warlockApprentice;
        state.combat.enemyName = boss.name;
        state.combat.enemyMaxHp = boss.hp;
        state.combat.enemyHp = boss.hp;
        state.combat.enemyDamage = boss.damage;
        log(`A Warlock Apprentice appears!`);
    }
}

function incrementMastery(id) {
    if (state.mastery[id]) {
        state.mastery[id] = Number((state.mastery[id] + 0.01).toFixed(3));
        if (state.mastery[id] > 1.5) state.mastery[id] = 1.5;
    }
}

function buyUpgrade(id, cost) {
    if (!state.upgrades[id] && state.resources.knowledge >= cost) {
        state.resources.knowledge -= cost;
        state.upgrades[id] = true;
        const card = document.getElementById(`upg-${id}`);
        if (card) card.classList.add('purchased');
        log(`Researched ${UPGRADES_DATA[id].name}.`);
        updateUI();
    } else {
        log("Not enough Knowledge to research this upgrade.");
    }
}

function performRitual() {
    if (state.skills.darkArts.level >= 10) {
        const multiplierAdd = (state.skills.darkArts.level * 0.1);
        state.resources.prestigeMultiplier += multiplierAdd;
        
        // Reset progress but keep prestige and some essentials
        state.resources.mana = 10;
        state.resources.gold = 0;
        state.resources.souls = 0;
        state.combat.killCount = 0;
        Object.keys(state.skills).forEach(s => { state.skills[s].level = 1; state.skills[s].xp = 0; });
        
        log(`Ritual complete! Prestige Multiplier is now x${state.resources.prestigeMultiplier.toFixed(2)}`);
        saveGame();
        location.reload();
    } else {
        log("You need Dark Arts level 10 to perform the ritual.");
    }
}