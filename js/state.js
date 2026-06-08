// --- INITIAL STATE ---
const state = {
    resources: {
        mana: 10,
        manaRegenRate: 0,
        maxMana: 100,
        souls: 0,
        gold: 0,
        knowledge: 0,
        imps: 0,
        witchsBrewTimer: 0,
        prestigeMultiplier: 1.0
    },
    skills: {
        darkArts: { xp: 0, level: 1, name: "Dark Arts" },
        soulReaping: { xp: 0, level: 1, name: "Soul Reaping" },
        alchemy: { xp: 0, level: 1, name: "Alchemy" },
        demonology: { xp: 0, level: 1, name: "Demonology" }
    },
    mastery: {
        meditate: 1,
        shadowbolt: 1,
        harvest: 1,
        transmute: 1,
        summonImp: 1,
        witchsBrew: 1
    },
    upgrades: {
        quickCasting: false,
        manaInfusion: false,
        soulHarvestBoost: false,
        combatEfficiency: false
    },
    combat: {
        isFighting: false,
        playerHp: 100,
        playerMaxHp: 100,
        enemyHp: 50,
        enemyMaxHp: 50,
        enemyDamage: 5,
        enemyName: "Inquisitor Scout",
        killCount: 0,
        combatTickCounter: 0,
        combatTickInterval: 2000
    },
    inventory: [],
    equipment: {
        wand: null,
        grimoire: null
    },
    activeTask: null,
    updateInterval: 50,
    currentTaskProgress: 0,
    lastSaveTime: Date.now(),
    lastTickTime: Date.now()
};