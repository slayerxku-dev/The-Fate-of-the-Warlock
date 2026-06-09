// --- TASK DEFINITIONS ---
const tasks = {
    meditate: {
        id: 'meditate', skill: 'darkArts', duration: 2, levelReq: 1,
        onComplete: () => {
            let gain = (5 + Math.floor(state.skills.darkArts.level / 5)) * state.mastery.meditate * state.resources.prestigeMultiplier;
            if (state.upgrades.manaInfusion) gain *= 1.5;
            if (state.equipment.grimoire) gain *= (1 + (state.equipment.grimoire.manaGainBonus || 0));
            state.resources.mana = Math.min(state.resources.maxMana, state.resources.mana + gain);
            gainXP('darkArts', 10); incrementMastery('meditate');
            log(`You meditated and gained ${Math.floor(gain)} Mana.`);
        }
    },
    shadowbolt: {
        id: 'shadowbolt', skill: 'darkArts', duration: 3.5, levelReq: 5,
        requirement: () => state.resources.mana >= 10,
        onComplete: () => {
            state.resources.mana -= 10; gainXP('darkArts', 45); incrementMastery('shadowbolt'); log("You practiced Shadow Bolt.");
        }
    },
    harvest: {
        id: 'harvest', skill: 'soulReaping', duration: 5, levelReq: 1,
        onComplete: () => {
            let soulsGained = 1;
            if (state.upgrades.soulHarvestBoost) soulsGained += 1;
            state.resources.souls += soulsGained; gainXP('soulReaping', 25); incrementMastery('harvest'); log(`You harvested ${soulsGained} Souls.`);
        }
    },
    transmute: {
        id: 'transmute', skill: 'alchemy', duration: 4, levelReq: 1,
        requirement: () => state.resources.souls >= 5,
        onComplete: () => {
            state.resources.souls -= 5; state.resources.gold += (15 + Math.floor(state.skills.alchemy.level / 2)); gainXP('alchemy', 35); incrementMastery('transmute'); log("You transmuted Souls into Gold.");
        }
    },
    summonImp: {
        id: 'summonImp', skill: 'demonology', duration: 8, levelReq: 1,
        requirement: () => state.resources.mana >= 20,
        onComplete: () => {
            state.resources.mana -= 20; state.resources.imps += 1; gainXP('demonology', 60); incrementMastery('summonImp');
            log(`A Lesser Imp has been bound to your service. Total Imps: ${state.resources.imps}`);
        }
    },
    witchsBrew: {
        id: 'witchsBrew', skill: 'alchemy', duration: 6, levelReq: 3,
        requirement: () => state.resources.souls >= 2 && state.resources.gold >= 50,
        onComplete: () => {
            state.resources.souls -= 2; state.resources.gold -= 50; state.resources.witchsBrewTimer = 60;
            gainXP('alchemy', 50); incrementMastery('witchsBrew'); log("You brewed a Witch's Brew.");
        }
    },
    bloodSiphon: { 
        id: 'bloodSiphon', skill: 'hemomancy', duration: 4, levelReq: 1,
        requirement: () => state.combat.playerHp > 10,
        onComplete: () => {
            state.combat.playerHp -= 10; state.resources.blood += 5;
            gainXP('hemomancy', 25); incrementMastery('bloodSiphon'); log("You siphoned your own life force.");
        }
    },
    bloodTithe: {
        id: 'bloodTithe', skill: 'hemomancy', duration: 2, levelReq: 5,
        requirement: () => state.combat.playerHp > 20,
        onComplete: () => {
            const goldReward = Math.floor(state.combat.playerHp * 0.2);
            state.combat.playerHp -= 20; state.resources.gold += goldReward;
            gainXP('hemomancy', 40); incrementMastery('bloodTithe'); log(`You sacrificed health for ${goldReward} Gold.`);
        }
    }
};