// ============================================
// Word Swap Roguelike - Minimal Playable Prototype
// Architecture v2: Token Pool driven
// Full juice pass: animations, feedback, step-by-step combat
// ============================================

// =============================================================
// DATA TABLES
// =============================================================

const ADJECTIVES = {
    "锋利的": { atk: 5, def: 0, tag: null },
    "生锈的": { atk: -3, def: -2, tag: null },
    "燃烧的": { atk: 3, def: -1, tag: "火焰" },
    "冰冻的": { atk: 2, def: 2, tag: "冰霜" },
    "诅咒的": { atk: 7, def: -4, tag: "暗影" },
    "神圣的": { atk: 4, def: 4, tag: "光明" },
    "干燥的": { atk: 0, def: 0, tag: null },
    "潮湿的": { atk: -1, def: 1, tag: null },
    "剧毒的": { atk: 4, def: -2, tag: "毒" },
    "坚固的": { atk: 0, def: 5, tag: null },
    "扭曲的": { atk: -2, def: -3, tag: "噪音" },
    "未知的": { atk: 0, def: 0, tag: null },
};

const COMBO_RULES = [
    {
        condition: (adj, noun) => ADJECTIVES[adj]?.tag === "火焰" && ["草地", "森林", "枯木"].includes(noun),
        effect: "burn",
        label: "\ud83d\udd25 场地燃烧",
        description: "火焰点燃了{noun}！每回合所有人受3点伤害",
        apply: (gs) => { gs.fieldEffect = { type: "burn", damage: 3 }; }
    },
    {
        condition: (adj, noun) => ADJECTIVES[adj]?.tag === "冰霜" && ["河流", "水面", "池塘"].includes(noun),
        effect: "frozen",
        label: "\ud83e\uddca 冻结通道",
        description: "冰霜冻结了{noun}！敌人下回合无法行动",
        apply: (gs) => { gs.enemyFrozen = true; }
    },
    {
        condition: (adj, noun) => ADJECTIVES[adj]?.tag === "毒" && ["匕首", "箭矢", "荆棘"].includes(noun),
        effect: "poison",
        label: "\u2620\ufe0f 淬毒武器",
        description: "剧毒浸入了{noun}！额外造成5点毒伤",
        apply: (gs) => { gs.bonusDamage = (gs.bonusDamage || 0) + 5; }
    },
];

// --- Layer 1: Tutorial enemies (teach basics) ---
const ENEMIES_LAYER1 = [
    { name: "哥布林", hp: 12, weaponAdj: "生锈的", weaponNoun: "匕首", baseDamage: 4, intentWeights: { attack: 6, defend: 2, lock: 0, buff: 1, cleanse: 0 }, special: null, lootToken: { type: "adjective", value: "生锈的" } },
    { name: "毒蛇", hp: 8, weaponAdj: "剧毒的", weaponNoun: "毒牙", baseDamage: 2, intentWeights: { attack: 3, defend: 0, lock: 0, buff: 0, cleanse: 0, poison: 6 }, special: "poison", lootToken: { type: "adjective", value: "剧毒的" } },
    { name: "石壳虫", hp: 15, weaponAdj: "坚固的", weaponNoun: "甲壳", baseDamage: 3, intentWeights: { attack: 5, defend: 4, lock: 0, buff: 0, cleanse: 0 }, special: "armor", lootToken: { type: "adjective", value: "坚固的" } },
];

// --- Layer 2: Combination enemies (resource decisions) ---
const ENEMIES_LAYER2 = [
    { name: "盗贼", hp: 14, weaponAdj: "锋利的", weaponNoun: "匕首", baseDamage: 5, intentWeights: { attack: 5, defend: 2, lock: 1, buff: 1, cleanse: 0, seal: 3 }, special: "seal", lootToken: { type: "adjective", value: "锋利的" } },
    { name: "巫师", hp: 12, weaponAdj: "燃烧的", weaponNoun: "法杖", baseDamage: 3, intentWeights: { attack: 3, defend: 2, lock: 1, buff: 5, cleanse: 0 }, special: "stacking", lootToken: { type: "adjective", value: "燃烧的" } },
    { name: "石壳虫", hp: 15, weaponAdj: "坚固的", weaponNoun: "甲壳", baseDamage: 3, intentWeights: { attack: 5, defend: 4, lock: 0, buff: 0, cleanse: 0 }, special: "armor", lootToken: { type: "adjective", value: "坚固的" } },
];

// --- Layer 3: Elite enemies (skill + swap needed) ---
const ENEMIES_LAYER3 = [
    { name: "铁甲骑士", hp: 25, weaponAdj: "坚固的", weaponNoun: "长剑", baseDamage: 7, intentWeights: { attack: 5, defend: 4, lock: 1, buff: 1, cleanse: 0 }, special: "shield_cycle", lootToken: { type: "adjective", value: "坚固的" } },
    { name: "咒术师", hp: 18, weaponAdj: "诅咒的", weaponNoun: "法典", baseDamage: 4, intentWeights: { attack: 2, defend: 1, lock: 6, buff: 2, cleanse: 0 }, special: "lock_burst", lootToken: { type: "adjective", value: "诅咒的" } },
    { name: "噬词兽", hp: 20, weaponAdj: "扭曲的", weaponNoun: "虚空爪", baseDamage: 5, intentWeights: { attack: 5, defend: 1, lock: 0, buff: 0, cleanse: 0, devour: 4 }, special: "devour", lootToken: { type: "adjective", value: "扭曲的" } },
];

// Legacy ENEMIES array for backward compatibility with linear mode
const ENEMIES = ENEMIES_LAYER1;

// Boss with multi-HP-bar system
const BOSS_PHASES = [
    { hp: 20, baseDamage: 6, label: "试探期", intentWeights: { attack: 4, defend: 3, lock: 2, buff: 1, cleanse: 0 } },
    { hp: 20, baseDamage: 10, label: "狂暴期", intentWeights: { attack: 7, defend: 0, lock: 2, buff: 2, cleanse: 0 } },
    { hp: 15, baseDamage: 8, label: "终末期", intentWeights: { attack: 4, defend: 0, lock: 5, buff: 1, cleanse: 0 } },
];

// =============================================================
// SKILL SYSTEM — data tables
// =============================================================

const SKILL_DB = {
    // --- Offense skills ---
    slash: {
        id: "slash",
        name: "劈砍",
        category: "offense",
        manaCost: 3,
        description: "造成4点伤害",
        effect(gs) {
            const dmg = 4;
            const ehp = T("enemy-hp");
            ehp.value = String(Math.max(0, parseInt(ehp.value) - dmg));
            addLog("⚔️ 劈砍！对" + TV("enemy-name") + "造成" + dmg + "点伤害", "log-damage");
            showFloatingNumber(document.getElementById("enemy-hp"), dmg, "damage");
            return { damage: dmg };
        },
        producesToken: null,
    },
    flame_slash: {
        id: "flame_slash",
        name: "火焰斩",
        category: "offense",
        manaCost: 3,
        description: "造成3伤害，下回合再扣2",
        effect(gs) {
            const dmg = 3;
            const ehp = T("enemy-hp");
            ehp.value = String(Math.max(0, parseInt(ehp.value) - dmg));
            gs.skillBurn = (gs.skillBurn || 0) + 2;
            addLog("🔥 火焰斩！造成" + dmg + "点伤害，敌人燃烧中（下回合再扣2）", "log-damage");
            showFloatingNumber(document.getElementById("enemy-hp"), dmg, "damage");
            return { damage: dmg };
        },
        producesToken: "燃烧的",
    },
    thunder_strike: {
        id: "thunder_strike",
        name: "雷霆一击",
        category: "offense",
        manaCost: 6,
        description: "造成8伤害，敌人跳过下回合",
        effect(gs) {
            const dmg = 8;
            const ehp = T("enemy-hp");
            ehp.value = String(Math.max(0, parseInt(ehp.value) - dmg));
            gs.enemyFrozen = true;
            addLog("⚡ 雷霆一击！造成" + dmg + "点伤害，敌人被麻痹！", "log-damage");
            showFloatingNumber(document.getElementById("enemy-hp"), dmg, "damage");
            showBanner("⚡ 麻痹！", "banner-lock");
            return { damage: dmg };
        },
        producesToken: "麻痹的",
    },
    // --- Defense skills ---
    block: {
        id: "block",
        name: "格挡",
        category: "defense",
        manaCost: 2,
        description: "本回合减伤3点",
        effect(gs) {
            gs.playerDefense = (gs.playerDefense || 0) + 3;
            addLog("🛡️ 格挡！本回合减少3点伤害", "log-info");
            return {};
        },
        producesToken: null,
    },
    stone_skin: {
        id: "stone_skin",
        name: "石肤",
        category: "defense",
        manaCost: 3,
        description: "本回合减伤4，下回合减伤1",
        effect(gs) {
            gs.playerDefense = (gs.playerDefense || 0) + 4;
            gs.skillDefenseCarry = (gs.skillDefenseCarry || 0) + 1;
            addLog("🪨 石肤！本回合减少4点伤害，下回合额外减少1点", "log-info");
            return {};
        },
        producesToken: "坚固的",
    },
    counter_stance: {
        id: "counter_stance",
        name: "反击姿态",
        category: "defense",
        manaCost: 5,
        description: "减伤4，将减免量反弹",
        effect(gs) {
            gs.playerDefense = (gs.playerDefense || 0) + 4;
            gs.counterAttack = 4;
            addLog("⚔️🛡️ 反击姿态！本回合减伤4点，反弹等量伤害", "log-info");
            return {};
        },
        producesToken: null,
    },
    // --- Control skills ---
    intimidate: {
        id: "intimidate",
        name: "威吓",
        category: "control",
        manaCost: 2,
        description: "敌人意图强制变为防御",
        effect(gs) {
            if (gs.enemyIntent) {
                gs.enemyIntent = { type: "defend", value: Math.floor(gs.enemyBaseDamage * 0.4) };
            }
            addLog("😨 威吓！敌人被震慑，转为防御！", "log-combo");
            showBanner("😨 威吓！", "banner-lock");
            renderEnemyIntent();
            return {};
        },
        producesToken: null,
    },
    unlock: {
        id: "unlock",
        name: "解锁",
        category: "control",
        manaCost: 3,
        description: "解除一个被锁定的词块",
        effect(gs) {
            if (gs.lockedTokens.length > 0) {
                const targetId = gs.lockedTokens[0];
                const token = T(targetId);
                if (token) token.swappable = true;
                gs.lockedTokens = gs.lockedTokens.filter(id => id !== targetId);
                addLog("🔓 解锁！「" + (token ? token.value : "???") + "」恢复可交换", "log-info");
            } else {
                addLog("🔓 解锁——没有被锁定的词块", "log-info");
            }
            return {};
        },
        producesToken: null,
    },
    expose_weakness: {
        id: "expose_weakness",
        name: "暴露弱点",
        category: "control",
        manaCost: 5,
        description: "标记敌人，2回合内受伤翻倍",
        effect(gs) {
            gs.enemyVulnerable = (gs.enemyVulnerable || 0) + 2;
            addLog("🎯 暴露弱点！敌人接下来2回合受到伤害翻倍！", "log-combo");
            showBanner("🎯 弱点暴露！", "banner-combo");
            return {};
        },
        producesToken: null,
    },
};

// Skills the player starts with (2 initial skills out of 4 slots)
const INITIAL_SKILLS = ["slash", "block"];

// Mana system config
const MANA_CONFIG = {
    maxMana: 10,
    startMana: 4,
    regenPerTurn: 3,
};

// =============================================================
// RELIC / COLLECTIBLE SYSTEM
// =============================================================

const RELIC_RARITY = { normal: "普通", rare: "稀有", legendary: "传说" };

const RELIC_DB = {
    // --- Normal (生存/经济) ---
    iron_heart: {
        id: "iron_heart",
        name: "铁之心",
        rarity: "normal",
        icon: "🫀",
        description: "最大HP+5",
        onAcquire(gs) { T("player-hp").value = String(parseInt(TV("player-hp")) + 5); },
        passive: null,
    },
    lucky_coin: {
        id: "lucky_coin",
        name: "幸运硬币",
        rarity: "normal",
        icon: "🪙",
        description: "每场战斗胜利后额外+1笔力",
        onAcquire: null,
        passive: { trigger: "on_battle_win", effect(gs) { T("swap-count").value = String(parseInt(TV("swap-count")) + 1); } },
    },
    travelers_boots: {
        id: "travelers_boots",
        name: "旅人之靴",
        rarity: "normal",
        icon: "👢",
        description: "每进入新楼层时回复2HP",
        onAcquire: null,
        passive: { trigger: "on_new_floor", effect(gs) {
            const hp = T("player-hp");
            hp.value = String(Math.min(parseInt(hp.value) + 2, gs.maxHp || 30));
        }},
    },
    thick_skin: {
        id: "thick_skin",
        name: "厚皮术",
        rarity: "normal",
        icon: "🦏",
        description: "每场战斗开始时获得1点护甲",
        onAcquire: null,
        passive: { trigger: "on_battle_start", effect(gs) { gs.playerDefense += 1; } },
    },
    word_magnet: {
        id: "word_magnet",
        name: "词块磁石",
        rarity: "normal",
        icon: "🧲",
        description: "战利品选择时多出现1个词块选项",
        onAcquire: null,
        passive: { trigger: "on_loot_roll", effect(gs) { gs.extraLootChoices = (gs.extraLootChoices || 0) + 1; } },
    },

    // --- Rare (技能增强) ---
    mana_spring: {
        id: "mana_spring",
        name: "法力泉源",
        rarity: "rare",
        icon: "💎",
        description: "法力每回合额外回复1点",
        onAcquire(gs) { gs.manaRegen += 1; },
        passive: null,
    },
    flame_ring: {
        id: "flame_ring",
        name: "焰之戒",
        rarity: "rare",
        icon: "💍",
        description: "攻击类技能伤害+2",
        onAcquire: null,
        passive: { trigger: "on_skill_damage", effect(gs, ctx) {
            if (ctx && ctx.skillCategory === "offense") { ctx.bonusDamage = (ctx.bonusDamage || 0) + 2; }
        }},
    },
    shield_gem: {
        id: "shield_gem",
        name: "盾之宝石",
        rarity: "rare",
        icon: "🔮",
        description: "防御类技能额外+1护甲",
        onAcquire: null,
        passive: { trigger: "on_skill_defense", effect(gs, ctx) {
            if (ctx && ctx.skillCategory === "defense") { ctx.bonusDefense = (ctx.bonusDefense || 0) + 1; }
        }},
    },
    echo_stone: {
        id: "echo_stone",
        name: "回响之石",
        rarity: "rare",
        icon: "🗿",
        description: "每3回合法力消耗降低1（最低1）",
        onAcquire: null,
        passive: { trigger: "on_turn_start", effect(gs) {
            if (gs.round % 3 === 0) { gs.manaCostReduction = (gs.manaCostReduction || 0) + 1; }
            // manaCostReduction persists (cumulative) — no reset on non-multiple-of-3 rounds
        }},
    },

    // --- Legendary (改变交换规则) ---
    ink_well: {
        id: "ink_well",
        name: "无尽墨池",
        rarity: "legendary",
        icon: "🏺",
        description: "每次交换后有30%概率不消耗笔力",
        onAcquire: null,
        passive: { trigger: "on_swap_cost", effect(gs, ctx) {
            if (Math.random() < 0.3) { ctx.refund = true; }
        }},
    },
    mirror_quill: {
        id: "mirror_quill",
        name: "镜像羽笔",
        rarity: "legendary",
        icon: "🪶",
        description: "交换时可复制词块而不是交换（保留两处都用同一个词）",
        onAcquire: null,
        passive: { trigger: "on_swap_execute", effect(gs, ctx) { ctx.copyMode = true; } },
    },
};

// Relic pool grouped by rarity for random selection
const RELIC_POOL = {
    normal: Object.values(RELIC_DB).filter(r => r.rarity === "normal").map(r => r.id),
    rare: Object.values(RELIC_DB).filter(r => r.rarity === "rare").map(r => r.id),
    legendary: Object.values(RELIC_DB).filter(r => r.rarity === "legendary").map(r => r.id),
};

// =============================================================
// ENEMY INTENT SYSTEM
// =============================================================

const INTENT_TYPES = {
    attack:  { icon: "⚔️", label: "攻击", color: "#ff6060" },
    defend:  { icon: "🛡️", label: "防御", color: "#80c0ff" },
    lock:    { icon: "🔒", label: "锁定", color: "#c080ff" },
    buff:    { icon: "⬆️", label: "强化", color: "#ffb060" },
    cleanse: { icon: "✨", label: "净化", color: "#80ff90" },
    poison:  { icon: "☠️", label: "淬毒", color: "#80ff80" },
    seal:    { icon: "🚫", label: "封印", color: "#ff80c0" },
    devour:  { icon: "👁️", label: "吞噬", color: "#c060c0" },
};

function rollEnemyIntent() {
    const enemy = gameState.currentEnemyData || ENEMIES[gameState.battleNumber - 1] || ENEMIES[0];
    const weights = enemy.intentWeights || { attack: 5, defend: 2, lock: 1, buff: 1, cleanse: 0 };
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;

    let intentType = "attack";
    for (const [type, weight] of entries) {
        roll -= weight;
        if (roll <= 0) { intentType = type; break; }
    }

    // Special: shield_cycle enemy alternates between shield and attack
    if (enemy.special === "shield_cycle" && gameState.round % 2 === 0) {
        intentType = "defend";
    }

    // Generate intent value based on type
    let intentValue = 0;
    switch (intentType) {
        case "attack":
            intentValue = calculateEnemyDamage();
            break;
        case "defend":
            intentValue = Math.floor(enemy.baseDamage * 0.6) + Math.floor(Math.random() * 3);
            // Shield_cycle: full immunity
            if (enemy.special === "shield_cycle" && gameState.round % 2 === 0) {
                intentValue = 999; // effectively immune
            }
            break;
        case "lock":
            intentValue = 1; // lock 1 slot
            // lock_burst: lock 2 at once
            if (enemy.special === "lock_burst") {
                intentValue = 2;
            }
            break;
        case "buff":
            intentValue = 2 + Math.floor(Math.random() * 2); // +2~3 damage next turn
            break;
        case "cleanse":
            intentValue = 1;
            break;
        case "poison":
            intentValue = 1; // 1 poison damage per turn
            break;
        case "seal":
            intentValue = 1; // seal 1 skill slot
            break;
        case "devour":
            intentValue = 1; // devour 1 adjective token
            break;
    }

    gameState.enemyIntent = { type: intentType, value: intentValue };
}

const ENVIRONMENTS = [
    { adj: "干燥的", noun: "草地" },
    { adj: "潮湿的", noun: "洞穴" },
    { adj: "燃烧的", noun: "废墟" },
    { adj: "冰冻的", noun: "河流" },
];

// =============================================================
// PRESSURE / CORRUPTION SYSTEM
// =============================================================

const PRESSURE_CONFIG = {
    // How much pressure each swap type generates
    costPerSwap: {
        persistent: 2,   // Changing own weapon adj, env adj/noun
        tactical: 0,     // Swapping enemy stats, subject swap (immediate effect)
    },
    // Thresholds and their effects
    thresholds: [
        { level: 5,  effect: "noise",   label: "噪音侵入" },
        { level: 10, effect: "corrupt", label: "词块腐蚀" },
        { level: 15, effect: "lock",    label: "槽位封印" },
    ],
    maxPressure: 20,
    // Noise words that appear as unswappable placeholders
    noiseWords: ["▓▓", "░░", "??", "##", "∅∅", "██"],
};

// Determine if a swap is "persistent" (costs pressure) or "tactical" (free)
function getSwapPressureCost(idA, idB) {
    // Persistent swaps: modifying your own weapon, or environment
    const persistentIds = ["player-weapon-adj", "env-adj", "env-noun"];
    if (persistentIds.includes(idA) || persistentIds.includes(idB)) {
        return PRESSURE_CONFIG.costPerSwap.persistent;
    }
    // Subject swaps and enemy-targeting swaps are tactical (no pressure)
    return PRESSURE_CONFIG.costPerSwap.tactical;
}

function addPressure(amount) {
    if (amount <= 0) return;
    const oldPressure = gameState.pressure;
    gameState.pressure = Math.min(PRESSURE_CONFIG.maxPressure, gameState.pressure + amount);

    // Check if we crossed any thresholds
    PRESSURE_CONFIG.thresholds.forEach(threshold => {
        if (oldPressure < threshold.level && gameState.pressure >= threshold.level) {
            triggerPressureEffect(threshold);
        }
    });

    // Update visuals
    updatePressureVisuals();
}

function triggerPressureEffect(threshold) {
    switch (threshold.effect) {
        case "noise": {
            // Add a noise token to a random zone
            const noiseWord = PRESSURE_CONFIG.noiseWords[Math.floor(Math.random() * PRESSURE_CONFIG.noiseWords.length)];
            const noiseId = "noise-" + Date.now();
            setToken(noiseId, "adjective", noiseWord, "env", false); // unswappable noise
            gameState.noiseTokens.push(noiseId);
            addLog("⚠️ 压力过载——噪音词「" + noiseWord + "」侵入了文字！", "log-combo");
            showBanner("⚠️ " + threshold.label, "banner-pressure");
            screenShake();
            break;
        }
        case "corrupt": {
            // Corrupt a random swappable token's value
            const corruptible = Object.values(tokenPool).filter(t =>
                t.swappable && t.type === "adjective" &&
                !gameState.noiseTokens.includes(t.id) &&
                !gameState.corruptedTokens.includes(t.id)
            );
            if (corruptible.length > 0) {
                const target = corruptible[Math.floor(Math.random() * corruptible.length)];
                const oldValue = target.value;
                target.value = "扭曲的";
                gameState.corruptedTokens.push(target.id);
                addLog("💀 压力腐蚀——「" + oldValue + "」被扭曲为「扭曲的」！", "log-combo");
                showBanner("💀 " + threshold.label, "banner-pressure");
                screenShake();
            }
            break;
        }
        case "lock": {
            // Permanently lock a token slot for this run
            const lockable = Object.values(tokenPool).filter(t =>
                t.swappable &&
                !gameState.noiseTokens.includes(t.id) &&
                !gameState.permanentlyLocked.includes(t.id) &&
                t.id !== "swap-count"
            );
            if (lockable.length > 0) {
                const target = lockable[Math.floor(Math.random() * lockable.length)];
                target.swappable = false;
                gameState.permanentlyLocked.push(target.id);
                addLog("🔒 压力封印——「" + target.value + "」被永久锁定！", "log-combo");
                showBanner("🔒 " + threshold.label, "banner-pressure");
                screenShake();
            }
            break;
        }
    }
}

function updatePressureVisuals() {
    const pressureEl = document.getElementById("pressure-bar");
    if (!pressureEl) return;

    const ratio = gameState.pressure / PRESSURE_CONFIG.maxPressure;
    const fill = pressureEl.querySelector(".pressure-fill");
    if (fill) {
        fill.style.width = (ratio * 100) + "%";
    }

    const valueEl = pressureEl.querySelector(".pressure-value");
    if (valueEl) {
        valueEl.textContent = gameState.pressure + "/" + PRESSURE_CONFIG.maxPressure;
    }

    // Darken game background based on pressure
    const container = document.getElementById("game-container");
    if (container) {
        const darkness = ratio * 0.3; // max 30% darker
        container.style.filter = ratio > 0 ? `brightness(${1 - darkness}) saturate(${1 - ratio * 0.2})` : "";
    }
}

const REWARD_TEMPLATES = [
    { adj: "锋利的", noun: "短刀", gold: 3 },
    { adj: "燃烧的", noun: "火把", gold: 5 },
    { adj: "神圣的", noun: "护符", gold: 2 },
    { adj: "冰冻的", noun: "水晶", gold: 7 },
    { adj: "诅咒的", noun: "戒指", gold: 4 },
    { adj: "坚固的", noun: "盾牌", gold: 6 },
];

// =============================================================
// MAP / ROUTE SYSTEM
// =============================================================

const NODE_TYPES = {
    battle:  { icon: "⚔️", label: "战斗", color: "#ff6060" },
    elite:   { icon: "💀", label: "精英", color: "#c080ff" },
    event:   { icon: "❓", label: "事件", color: "#80c0ff" },
    rest:    { icon: "🏕️", label: "休息", color: "#80ff90" },
    boss:    { icon: "👹", label: "Boss", color: "#ff4040" },
};

const BOSS_ENEMY = { name: "巨龙", hp: 35, weaponAdj: "燃烧的", weaponNoun: "龙爪", baseDamage: 10, intentWeights: { attack: 5, defend: 2, lock: 2, buff: 2, cleanse: 1 } };

// Events with swappable tokens in descriptions and choices.
// Tokens are declared as { id, type, value } in the event's `tokens` array.
// Description and choice labels reference tokens by {{tokenId}}.
// The resolve function reads current token values to compute effects.
const EVENT_POOL = [
    {
        title: "贪婪的商人",
        tokens: [
            { id: "evt-adj1", type: "adjective", value: "贪婪的" },
            { id: "evt-cost1", type: "number", value: "5" },
            { id: "evt-adj2", type: "adjective", value: "浑浊的" },
            { id: "evt-cost2", type: "number", value: "8" },
            { id: "evt-adj3", type: "adjective", value: "锋利的" },
        ],
        description: "一位{{evt-adj1}}商人向你展示了他的货物。",
        choices: [
            {
                label: "花费{{evt-cost1}}金币购买{{evt-adj2}}药水",
                resolve() {
                    const cost = (parseInt(TV("evt-cost1"), 10) ?? 5);
                    const adj = TV("evt-adj2");
                    const adjStats = ADJECTIVES[adj] || { atk: 0, def: 0 };
                    const healAmt = 5 + adjStats.def * 2;
                    T("player-hp").value = String(Math.min(gameState.maxHp, parseInt(TV("player-hp")) + Math.max(1, healAmt)));
                    addLog(`你购买了「${adj}」药水，恢复了${Math.max(1, healAmt)}HP`, "log-info");
                },
            },
            {
                label: "花费{{evt-cost2}}金币购买{{evt-adj3}}匕首",
                resolve() {
                    const adj = TV("evt-adj3");
                    const adjStats = ADJECTIVES[adj] || { atk: 0 };
                    gameState.playerBaseDamage += Math.max(1, 2 + adjStats.atk);
                    addLog(`你购买了「${adj}」匕首，攻击力+${Math.max(1, 2 + adjStats.atk)}`, "log-info");
                },
            },
            { label: "离开", resolve() { addLog("你离开了商人", "log-info"); } },
        ],
    },
    {
        title: "古老石碑",
        tokens: [
            { id: "evt-adj1", type: "adjective", value: "古老的" },
            { id: "evt-num1", type: "number", value: "3" },
        ],
        description: "一块{{evt-adj1}}石碑矗立在路边，文字闪烁着{{evt-num1}}种颜色的光芒。",
        choices: [
            {
                label: "触摸石碑（获得力量，+压力）",
                resolve() {
                    const power = (parseInt(TV("evt-num1"), 10) ?? 3);
                    gameState.playerBaseDamage += power;
                    addPressure(power);
                    addLog(`石碑的力量涌入体内！攻击力+${power}，墨渍+${power}`, "log-info");
                },
            },
            {
                label: "抄录文字（+笔力）",
                resolve() {
                    const bonus = Math.max(1, Math.floor(((parseInt(TV("evt-num1"), 10) ?? 3)) / 2));
                    T("swap-count").value = String(parseInt(TV("swap-count")) + bonus);
                    addLog(`你抄录了碑文，获得${bonus}点笔力`, "log-info");
                },
            },
        ],
    },
    {
        title: "神秘泉水",
        tokens: [
            { id: "evt-adj1", type: "adjective", value: "神圣的" },
            { id: "evt-num1", type: "number", value: "8" },
        ],
        description: "一处{{evt-adj1}}泉水从岩缝中涌出，散发着治愈的光芒。",
        choices: [
            {
                label: "饮用泉水（恢复{{evt-num1}}HP）",
                resolve() {
                    const heal = (parseInt(TV("evt-num1"), 10) ?? 8);
                    const adj = TV("evt-adj1");
                    const bonus = (ADJECTIVES[adj] && ADJECTIVES[adj].def > 0) ? ADJECTIVES[adj].def : 0;
                    const total = heal + bonus;
                    T("player-hp").value = String(Math.min(gameState.maxHp, parseInt(TV("player-hp")) + total));
                    addLog(`你饮用了${adj}泉水，恢复了${total}HP`, "log-info");
                },
            },
            {
                label: "用泉水净化墨渍（压力-{{evt-num1}}）",
                resolve() {
                    const cleanse = (parseInt(TV("evt-num1"), 10) ?? 8);
                    gameState.pressure = Math.max(0, gameState.pressure - cleanse);
                    addLog(`泉水净化了你的墨渍，压力-${cleanse}`, "log-info");
                },
            },
        ],
    },
    {
        title: "迷途的旅人",
        tokens: [
            { id: "evt-adj1", type: "adjective", value: "疲惫的" },
            { id: "evt-num1", type: "number", value: "2" },
        ],
        description: "一个{{evt-adj1}}旅人在路边向你求助。",
        choices: [
            {
                label: "分享{{evt-num1}}点生命力帮助他",
                resolve() {
                    const cost = (parseInt(TV("evt-num1"), 10) ?? 2);
                    T("player-hp").value = String(Math.max(1, parseInt(TV("player-hp")) - cost));
                    // Reward: relic or ink
                    const relicId = rollRandomRelic(["normal", "normal", "rare"]);
                    if (relicId) {
                        acquireRelic(relicId);
                    } else {
                        T("swap-count").value = String(parseInt(TV("swap-count")) + 2);
                        addLog("旅人送你2点笔力作为感谢", "log-info");
                    }
                },
            },
            {
                label: "忽略他继续前进",
                resolve() { addLog("你无视了旅人的请求", "log-info"); },
            },
        ],
    },
    {
        title: "词块熔炉",
        tokens: [
            { id: "evt-adj1", type: "adjective", value: "燃烧的" },
            { id: "evt-adj2", type: "adjective", value: "冰冻的" },
        ],
        description: "一座{{evt-adj1}}熔炉散发着热量，似乎能改造你的武器。",
        choices: [
            {
                label: "将武器投入熔炉（武器变为{{evt-adj2}}）",
                resolve() {
                    const newAdj = TV("evt-adj2");
                    T("player-weapon-adj").value = newAdj;
                    addLog(`你的武器被改造为「${newAdj}」！`, "log-info");
                    syncDerivedTokens();
                },
            },
            {
                label: "离开熔炉",
                resolve() { addLog("你没有使用熔炉", "log-info"); },
            },
        ],
    },
];

function generateMap() {
    // Branched topology: 12 layers + 1 boss layer
    // Each layer has 2-4 nodes, connected via edges to next layer nodes
    const TOTAL_LAYERS = 12;
    const map = [];

    // Step 1: Create nodes per layer
    for (let layer = 0; layer < TOTAL_LAYERS; layer++) {
        const nodeCount = 2 + Math.floor(Math.random() * 3); // 2-4 nodes
        const nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            nodes.push({
                type: "battle", // placeholder, assigned below
                visited: false,
                id: `node-${layer}-${i}`,
                connections: [], // indices in next layer this node connects to
            });
        }
        map.push(nodes);
    }

    // Boss layer (single node)
    map.push([{ type: "boss", visited: false, id: "node-boss", connections: [] }]);

    // Step 2: Generate connections (edges from each layer to the next)
    for (let layer = 0; layer < TOTAL_LAYERS; layer++) {
        const currNodes = map[layer];
        const nextNodes = map[layer + 1];
        const nextCount = nextNodes.length;

        // Ensure every current node connects to at least 1 next node
        currNodes.forEach(node => {
            const connCount = 1 + Math.floor(Math.random() * Math.min(2, nextCount)); // 1-2 connections
            const available = Array.from({ length: nextCount }, (_, i) => i);
            for (let c = 0; c < connCount && available.length > 0; c++) {
                const pick = Math.floor(Math.random() * available.length);
                node.connections.push(available[pick]);
                available.splice(pick, 1);
            }
        });

        // Ensure every next-layer node is reachable from at least one current node
        for (let ni = 0; ni < nextCount; ni++) {
            const isReachable = currNodes.some(n => n.connections.includes(ni));
            if (!isReachable) {
                // Connect a random current node to this unreachable next node
                const randomCurr = currNodes[Math.floor(Math.random() * currNodes.length)];
                randomCurr.connections.push(ni);
            }
        }
    }

    // Step 3: Assign node types based on distribution rules
    for (let layer = 0; layer < TOTAL_LAYERS; layer++) {
        map[layer].forEach((node, idx) => {
            node.type = assignNodeType(layer, TOTAL_LAYERS, idx, map[layer].length);
        });
    }

    // Rule: Layer 0 is always normal battle
    map[0].forEach(n => { n.type = "battle"; });

    // Rule: Layer before boss must have at least one rest node
    const preBossLayer = map[TOTAL_LAYERS - 1];
    if (!preBossLayer.some(n => n.type === "rest")) {
        preBossLayer[Math.floor(Math.random() * preBossLayer.length)].type = "rest";
    }

    // Rule: Ensure at least one path exists that avoids all elites
    // (Simple check: ensure each layer has at least one non-elite node — already likely given distribution)

    return map;
}

function assignNodeType(layer, totalLayers, nodeIdx, layerSize) {
    // Layer 0: always battle (handled separately)
    // Layers 1-3: no elites (tutorial zone)
    // Layers 4-10: elites allowed (mid-game)
    // Layer totalLayers-1: pre-boss (rest/event/battle)

    if (layer === 0) return "battle";

    const isMidGame = layer >= 3 && layer <= totalLayers - 2;
    const isLateGame = layer === totalLayers - 1;

    if (isLateGame) {
        // Pre-boss layer: rest, events, battles — no elite
        const roll = Math.random();
        if (roll < 0.4) return "rest";
        if (roll < 0.7) return "event";
        return "battle";
    }

    if (isMidGame) {
        // Mid-game: can have elites
        const roll = Math.random();
        if (roll < 0.35) return "battle";
        if (roll < 0.55) return "elite";
        if (roll < 0.75) return "event";
        if (roll < 0.90) return "rest";
        return "battle"; // shop placeholder (future)
    }

    // Early game (layers 1-2): no elites
    const roll = Math.random();
    if (roll < 0.5) return "battle";
    if (roll < 0.75) return "event";
    return "rest";
}

function showMap() {
    gameState.phase = "map";
    const mapOverlay = document.getElementById("map-overlay");
    mapOverlay.style.display = "flex";
    renderMap();
}

function hideMap() {
    const mapOverlay = document.getElementById("map-overlay");
    mapOverlay.style.display = "none";
}

function renderMap() {
    const mapContainer = document.getElementById("map-container");
    mapContainer.innerHTML = "";

    const currentLayer = gameState.currentLayer;
    const lastVisitedNode = gameState.lastVisitedNode; // { layer, index }

    // Render from bottom (layer 0) to top (boss)
    // But display top-to-bottom in DOM (boss at top, start at bottom) or bottom-to-top
    // Let's render top = boss, bottom = start (like Slay the Spire)
    for (let layerIdx = gameState.map.length - 1; layerIdx >= 0; layerIdx--) {
        const layer = gameState.map[layerIdx];
        const layerDiv = document.createElement("div");
        layerDiv.className = "map-layer";

        // Layer label
        const layerLabel = document.createElement("div");
        layerLabel.className = "map-layer-label";
        if (layerIdx === gameState.map.length - 1) {
            layerLabel.textContent = "Boss";
        } else {
            layerLabel.textContent = `${layerIdx + 1}`;
        }
        layerDiv.appendChild(layerLabel);

        const nodesDiv = document.createElement("div");
        nodesDiv.className = "map-nodes";

        layer.forEach((node, nodeIdx) => {
            const nodeEl = document.createElement("button");
            nodeEl.className = "map-node";
            const info = NODE_TYPES[node.type];
            nodeEl.innerHTML = `<span class="node-icon">${info.icon}</span><span class="node-label">${info.label}</span>`;
            nodeEl.style.borderColor = info.color;

            if (node.visited) {
                nodeEl.classList.add("node-visited");
                nodeEl.disabled = true;
            } else if (isNodeReachable(layerIdx, nodeIdx, currentLayer, lastVisitedNode)) {
                nodeEl.classList.add("node-available");
                nodeEl.addEventListener("click", () => selectNode(layerIdx, nodeIdx));
            } else {
                nodeEl.classList.add("node-locked");
                nodeEl.disabled = true;
            }

            nodesDiv.appendChild(nodeEl);
        });

        layerDiv.appendChild(nodesDiv);
        mapContainer.appendChild(layerDiv);
    }
}

// Determine if a node is reachable from current position
function isNodeReachable(layerIdx, nodeIdx, currentLayer, lastVisitedNode) {
    // Player can only move to the next layer (currentLayer)
    if (layerIdx !== currentLayer) return false;

    // First move: all layer-0 nodes are reachable
    if (currentLayer === 0) return true;

    // Otherwise: check if the last visited node has a connection to this node
    if (!lastVisitedNode) return false;
    const prevNode = gameState.map[lastVisitedNode.layer][lastVisitedNode.index];
    return prevNode && prevNode.connections.includes(nodeIdx);
}

function selectNode(layerIdx, nodeIdx) {
    const node = gameState.map[layerIdx][nodeIdx];
    node.visited = true;
    gameState.lastVisitedNode = { layer: layerIdx, index: nodeIdx };
    gameState.currentLayer++;

    // Trigger relic passives for new floor (e.g. travelers_boots heals 2HP)
    triggerRelics("on_new_floor");

    hideMap();

    switch (node.type) {
        case "battle":
            startBattleFromMap("normal");
            break;
        case "elite":
            startBattleFromMap("elite");
            break;
        case "boss":
            startBattleFromMap("boss");
            break;
        case "event":
            startEvent();
            break;
        case "rest":
            startRest();
            break;
    }
}

// Difficulty scaling — computed from layer number (supports 12+ layers)
function getLayerScaling(layerNum) {
    // Progressive difficulty: scales smoothly from easy to hard
    const progress = Math.min(layerNum / 11, 1); // 0..1 over 12 layers
    return {
        hpMult: 0.8 + progress * 0.6,           // 0.8 → 1.4
        dmgMult: 0.8 + progress * 0.5,           // 0.8 → 1.3
        swapCount: Math.max(3, 5 - Math.floor(progress * 2)), // 5 → 3
        eliteHpBonus: Math.round(5 + progress * 8),  // 5 → 13
        eliteDmgBonus: Math.round(1 + progress * 3), // 1 → 4
    };
}
// Boss layer gets special generous swap count
const BOSS_LAYER_SCALING = { hpMult: 1.0, dmgMult: 1.0, swapCount: 6, eliteHpBonus: 0, eliteDmgBonus: 0 };

function startBattleFromMap(difficulty) {
    gameState.phase = "battle";
    gameState.round = 1;
    gameState.lastBattleDifficulty = difficulty; // Track for relic rewards
    gameState.fieldEffect = null;
    gameState.enemyFrozen = false;
    gameState.enemyDefenseActive = 0;
    gameState.playerDefense = 0;
    gameState.skillBurn = 0;
    gameState.skillDefenseCarry = 0;
    gameState.counterAttack = 0;
    gameState.enemyVulnerable = 0;
    gameState.sealedSlots = [];
    gameState.sealTimers = [];
    gameState.poisonStacks = 0;
    gameState.bonusDamage = 0;
    gameState._intentHandled = false;
    gameState.manaCostReduction = 0;
    unlockAllTokens();
    gameState.lockedTokens = [];

    const layer = Math.max(0, gameState.currentLayer - 1); // currentLayer already incremented
    const scaling = (difficulty === "boss") ? BOSS_LAYER_SCALING : getLayerScaling(layer);

    let enemy;
    if (difficulty === "boss") {
        // Boss multi-HP-bar system
        const phase = BOSS_PHASES[0];
        enemy = {
            name: "巨龙",
            hp: phase.hp,
            weaponAdj: "燃烧的",
            weaponNoun: "龙爪",
            baseDamage: phase.baseDamage,
            intentWeights: phase.intentWeights,
            special: "boss_multi_hp",
        };
        // Store boss state
        gameState.bossPhase = 0;
        gameState.bossPhasesRemaining = BOSS_PHASES.map(p => p.hp);
    } else if (difficulty === "elite") {
        // Elites from layer 3 pool
        const base = ENEMIES_LAYER3[Math.floor(Math.random() * ENEMIES_LAYER3.length)];
        enemy = {
            ...base,
            name: "精英" + base.name,
            hp: base.hp + scaling.eliteHpBonus,
            baseDamage: base.baseDamage + scaling.eliteDmgBonus,
        };
    } else {
        // Normal battle: pick enemy from appropriate layer pool
        let pool;
        if (layer === 0) pool = ENEMIES_LAYER1;
        else if (layer === 1) pool = ENEMIES_LAYER2;
        else pool = ENEMIES_LAYER2; // layers 2+ use L2 pool for normal battles
        const base = pool[Math.floor(Math.random() * pool.length)];
        enemy = {
            ...base,
            hp: Math.round(base.hp * scaling.hpMult),
            baseDamage: Math.round(base.baseDamage * scaling.dmgMult),
        };
    }

    gameState.enemyBaseDamage = enemy.baseDamage;
    gameState.mana = gameState.maxMana; // 每场战斗开始法力回满（决策D）
    gameState.battleNumber++;

    // Refresh swap count based on layer difficulty
    T("swap-count").value = String(scaling.swapCount);

    // Update tokens
    T("enemy-hp").value = String(enemy.hp);
    setToken("enemy-name", "subject", enemy.name, "battle");
    setToken("enemy-weapon-adj", "adjective", enemy.weaponAdj, "battle");
    setToken("enemy-weapon-noun", "noun", enemy.weaponNoun, "battle");
    setToken("enemy-damage", "number", calculateEnemyDamage(), "battle");

    const env = ENVIRONMENTS[Math.floor(Math.random() * ENVIRONMENTS.length)];
    T("env-adj").value = env.adj;
    T("env-noun").value = env.noun;

    // Temporarily store enemy data for intent rolling
    gameState.currentEnemyData = enemy;

    const nodeType = difficulty === "boss" ? "boss" : difficulty === "elite" ? "elite" : "battle";
    addLog(`\n═══ ${NODE_TYPES[nodeType].icon} ${enemy.name}出现了！（第${layer + 1}层） ═══`, "log-info");
    addLog(`笔力：${scaling.swapCount}`, "log-info");
    addLog(`—— 第1回合 ——`, "log-info");

    // Trigger relic passives on battle start (e.g. thick_skin gives 1 defense)
    triggerRelics("on_battle_start");

    rollEnemyIntent();
    render();
}

function startEvent() {
    gameState.phase = "event";
    const event = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
    gameState.currentEvent = event;

    // Register event tokens in the token pool (swappable!)
    if (event.tokens) {
        event.tokens.forEach(t => {
            setToken(t.id, t.type, t.value, "event");
        });
    }

    renderEventUI();
}

function renderEventUI() {
    const event = gameState.currentEvent;
    if (!event) return;

    const eventOverlay = document.getElementById("event-overlay");
    eventOverlay.style.display = "flex";

    document.getElementById("event-title").textContent = event.title;

    // Render description with swappable tokens
    const descEl = document.getElementById("event-description");
    descEl.innerHTML = "";
    renderEventText(descEl, event.description);

    // Render choices with swappable tokens
    const choicesEl = document.getElementById("event-choices");
    choicesEl.innerHTML = "";
    event.choices.forEach((choice, idx) => {
        const choiceDiv = document.createElement("div");
        choiceDiv.className = "event-choice-row";

        const textSpan = document.createElement("span");
        textSpan.className = "event-choice-text";
        renderEventText(textSpan, choice.label);
        choiceDiv.appendChild(textSpan);

        const btn = document.createElement("button");
        btn.className = "event-choice-btn";
        btn.textContent = "选择";
        btn.addEventListener("click", () => resolveEvent(idx));
        choiceDiv.appendChild(btn);

        choicesEl.appendChild(choiceDiv);
    });
}

// Render text with {{tokenId}} placeholders as draggable token elements
function renderEventText(container, template) {
    const parts = template.split(/(\{\{[^}]+\}\})/);
    parts.forEach(part => {
        const match = part.match(/^\{\{([^}]+)\}\}$/);
        if (match) {
            const tokenId = match[1];
            const token = T(tokenId);
            if (token) {
                const span = document.createElement("span");
                span.className = `token token-${token.type}`;
                span.textContent = token.value;
                span.dataset.tokenId = tokenId;
                span.draggable = true;

                // Make it draggable like battle tokens
                span.addEventListener("mousedown", (e) => onDragStart(e, span));
                span.addEventListener("touchstart", (e) => onTouchStart(e, span), { passive: false });

                domTokenEls.push(span);
                container.appendChild(span);
            } else {
                container.appendChild(document.createTextNode(part));
            }
        } else {
            container.appendChild(document.createTextNode(part));
        }
    });
}

function resolveEvent(choiceIdx) {
    const event = gameState.currentEvent;
    const choice = event.choices[choiceIdx];

    // Call the resolve function (reads current token values)
    if (choice.resolve) {
        choice.resolve();
    }

    // Clean up event tokens from pool
    removeTokensByZone("event");

    document.getElementById("event-overlay").style.display = "none";
    gameState.currentEvent = null;

    updatePressureVisuals();
    render();

    // After event, show map for next choice (or end if all layers done)
    if (gameState.currentLayer >= gameState.map.length) {
        gameOver(true);
    } else {
        setTimeout(() => showMap(), 600);
    }
}

function startRest() {
    const healAmount = 8;
    const oldHp = parseInt(TV("player-hp"));
    T("player-hp").value = String(Math.min(gameState.maxHp, oldHp + healAmount));
    addLog("🏕️ 你在营地休息，恢复了" + healAmount + "点生命", "log-info");
    showBanner("🏕️ 休息恢复", "banner-cleanse");

    render();

    // After rest, show map for next choice
    if (gameState.currentLayer >= gameState.map.length) {
        gameOver(true);
    } else {
        setTimeout(() => showMap(), 1200);
    }
}

// =============================================================
// TOKEN POOL — the single source of truth
// =============================================================
//
// Token schema:
// {
//   id:        string   — unique identifier (e.g. "player-hp", "env-adj")
//   type:      string   — "number" | "adjective" | "noun" | "subject"
//   value:     string   — the displayed/meaningful value
//   zone:      string   — "status" | "env" | "battle" | "summary" | "reward"
//   swappable: boolean  — whether this token can currently be dragged
// }
//
// The pool is rebuilt at the start of each battle/reward phase.
// Swapping = just exchange .value between two tokens of the same type.
// No getters, no setters, no roleMap. The pool IS the state.

let tokenPool = {};  // { [id]: Token }

function T(id) {
    return tokenPool[id];
}

function TV(id) {
    return tokenPool[id]?.value ?? "";
}

function setToken(id, type, value, zone, swappable = true) {
    tokenPool[id] = { id, type, value: String(value), zone, swappable };
}

function removeToken(id) {
    delete tokenPool[id];
}

function removeTokensByZone(zone) {
    Object.keys(tokenPool).forEach(id => {
        if (tokenPool[id].zone === zone) delete tokenPool[id];
    });
}


// =============================================================
// DIFFICULTY & RULES
// =============================================================

const DIFFICULTY_RULES = {
    1: {
        // 交换次数可以被交换（左脚踩右脚）
        swapCountSwappable: true,
    },
    2: {
        // 交换次数不可被交换
        swapCountSwappable: false,
    },
};

// =============================================================
// GAME STATE (non-token data that doesn't appear on screen)
// =============================================================

let gameState = {
    difficulty: 1,
    phase: "battle",         // "battle" | "reward"
    round: 1,
    battleNumber: 1,
    totalBattles: 3,
    playerBaseDamage: 6,
    enemyBaseDamage: 0,
    fieldEffect: null,
    enemyFrozen: false,
    bonusDamage: 0,
    summaryTemplate: null,   // "A" | "B" | null
    // rewardBonusSwap removed (P0 reward refactor)
    turnInProgress: false,   // lock during step-by-step resolution
    enemyIntent: null,       // { type: string, value: number }
    enemyDefenseActive: 0,   // damage reduction this turn
    lockedTokens: [],        // token IDs locked by enemy
    pressure: 0,             // corruption pressure value
    noiseTokens: [],         // IDs of noise tokens added by pressure
    corruptedTokens: [],     // IDs of tokens corrupted by pressure
    permanentlyLocked: [],   // IDs of tokens permanently locked by pressure
    // --- Skill system ---
    skills: [],              // Array of skill IDs (max 4), e.g. ["slash", "block"]
    mana: 0,                 // Current mana
    maxMana: 10,             // Max mana pool
    manaRegen: 3,            // Mana regen per turn
    playerDefense: 0,        // Defense from skills (resets after enemy attack resolves)
    skillBurn: 0,            // Burn damage to apply next turn from fire skills
    skillDefenseCarry: 0,    // Defense that carries to next turn
    counterAttack: 0,        // Counter-attack damage (reflects blocked damage)
    enemyVulnerable: 0,      // Turns remaining for double damage on enemy
    sealedSlots: [],         // Indices of sealed skill slots (by enemies)
    // --- Relic system ---
    relics: [],              // Array of relic IDs the player currently holds
    maxHp: 30,              // Track max HP for relics that heal
    manaCostReduction: 0,    // Temporary mana cost reduction from relics
    extraLootChoices: 0,     // Extra loot choices from relics
    // --- Two-mode system ---
    mode: "swap",            // "swap" | "delete"
    inventory: [],           // Array of { id, type, value } — collected word tokens
    selectedInventoryToken: null, // inventory item id selected for insertion
    emptySlots: [],          // Array of { id, type, zone } — slots where tokens were deleted
    // --- Economy ---
    gold: 0,                 // Gold currency（跨战斗继承）
};

// =============================================================
// DERIVED CALCULATIONS (read from token pool)
// =============================================================

function calculateEnemyDamage() {
    const adj = TV("enemy-weapon-adj");
    const adjStats = ADJECTIVES[adj] || { atk: 0 };
    return Math.max(1, gameState.enemyBaseDamage + adjStats.atk);
}

function calculatePlayerDamage() {
    const adj = TV("player-weapon-adj");
    const adjStats = ADJECTIVES[adj] || { atk: 0 };
    const raw = gameState.playerBaseDamage + adjStats.atk + (gameState.bonusDamage || 0);
    // Apply enemy defense reduction
    return Math.max(1, raw - (gameState.enemyDefenseActive || 0));
}

// =============================================================
// ENEMY INTENT EXECUTION
// =============================================================

function executeEnemyIntent() {
    const intent = gameState.enemyIntent;
    if (!intent) {
        // Fallback: basic attack
        var enemyDamage = calculateEnemyDamage();
        var oldHp = parseInt(TV("player-hp"));
        T("player-hp").value = String(Math.max(0, oldHp - enemyDamage));
        addLog(TV("enemy-name") + "对你造成了" + enemyDamage + "点伤害", "log-damage");
        render();
        showFloatingNumber(document.getElementById("player-hp"), enemyDamage, "damage");
        screenShake();
        return;
    }

    const enemyName = TV("enemy-name");

    switch (intent.type) {
        case "attack": {
            var damage = calculateEnemyDamage();
            var oldHp = parseInt(TV("player-hp"));
            T("player-hp").value = String(Math.max(0, oldHp - damage));
            addLog(enemyName + "发动攻击，对你造成了" + damage + "点伤害", "log-damage");
            render();
            showFloatingNumber(document.getElementById("player-hp"), damage, "damage");
            screenShake();
            break;
        }
        case "defend": {
            gameState.enemyDefenseActive = intent.value;
            addLog(enemyName + "进入防御姿态，减伤" + intent.value + "点", "log-info");
            showBanner("🛡️ " + enemyName + " 防御！", "banner-defend");
            render();
            break;
        }
        case "lock": {
            // Lock a random swappable player token
            const lockableTokens = Object.values(tokenPool).filter(t =>
                t.swappable && t.id !== "swap-count" &&
                (t.zone === "status" || t.zone === "battle" || t.zone === "env") &&
                !gameState.lockedTokens.includes(t.id)
            );
            if (lockableTokens.length > 0) {
                const target = lockableTokens[Math.floor(Math.random() * lockableTokens.length)];
                target.swappable = false;
                gameState.lockedTokens.push(target.id);
                addLog(enemyName + "锁定了「" + target.value + "」！下回合无法交换", "log-combo");
                showBanner("🔒 「" + target.value + "」被锁定！", "banner-lock");
                screenShake();
            } else {
                addLog(enemyName + "试图锁定，但没有可锁定的目标", "log-info");
            }
            render();
            break;
        }
        case "buff": {
            // Increase enemy base damage temporarily
            gameState.enemyBaseDamage += intent.value;
            syncDerivedTokens();
            addLog(enemyName + "强化了自身！攻击力+" + intent.value, "log-combo");
            showBanner("⬆️ " + enemyName + " 强化！", "banner-buff");
            render();
            break;
        }
        case "cleanse": {
            // Remove negative effects on enemy (frozen, etc.)
            let cleansed = false;
            if (gameState.fieldEffect && gameState.fieldEffect.type === "burn") {
                gameState.fieldEffect = null;
                cleansed = true;
            }
            if (gameState.bonusDamage > 0) {
                gameState.bonusDamage = 0;
                cleansed = true;
            }
            if (cleansed) {
                addLog(enemyName + "净化了场上的负面效果！", "log-info");
                showBanner("✨ 净化！", "banner-cleanse");
            } else {
                // If nothing to cleanse, do a weak attack instead
                var weakDmg = Math.max(1, Math.floor(calculateEnemyDamage() * 0.5));
                const blocked = Math.min(gameState.playerDefense || 0, weakDmg);
                const finalDmg = Math.max(0, weakDmg - blocked);
                var hp = parseInt(TV("player-hp"));
                T("player-hp").value = String(Math.max(0, hp - finalDmg));
                addLog(enemyName + "无可净化，转为轻击，造成" + finalDmg + "点伤害", "log-damage");
                if (finalDmg > 0) {
                    showFloatingNumber(document.getElementById("player-hp"), finalDmg, "damage");
                }
            }
            updateEffectsBar();
            render();
            break;
        }
        case "poison": {
            // Stack poison: accumulate ongoing damage each turn
            gameState.poisonStacks = (gameState.poisonStacks || 0) + 1;
            addLog("☠️ " + enemyName + "向你注入毒素！中毒层数+" + 1 + "（当前" + gameState.poisonStacks + "层）", "log-combo");
            showBanner("☠️ 中毒！", "banner-pressure");
            render();
            break;
        }
        case "seal": {
            // Seal a random non-sealed skill slot for 2 turns
            const availableSlots = [];
            for (let i = 0; i < gameState.skills.length; i++) {
                if (!gameState.sealedSlots.includes(i)) {
                    availableSlots.push(i);
                }
            }
            if (availableSlots.length > 0) {
                const targetSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
                gameState.sealedSlots.push(targetSlot);
                // Track when to unseal
                gameState.sealTimers = gameState.sealTimers || [];
                gameState.sealTimers.push({ slot: targetSlot, turnsLeft: 2 });
                const skillName = SKILL_DB[gameState.skills[targetSlot]]?.name || "技能";
                addLog("🚫 " + enemyName + "封印了「" + skillName + "」！2回合内不可使用", "log-combo");
                showBanner("🚫 封印！", "banner-pressure");
                screenShake();
            } else {
                // All slots sealed, do weak attack instead
                var sDmg = Math.max(1, Math.floor(calculateEnemyDamage() * 0.5));
                const sBlocked = Math.min(gameState.playerDefense || 0, sDmg);
                const sFinal = Math.max(0, sDmg - sBlocked);
                var sHp = parseInt(TV("player-hp"));
                T("player-hp").value = String(Math.max(0, sHp - sFinal));
                addLog(enemyName + "无可封印，转为攻击，造成" + sFinal + "点伤害", "log-damage");
                if (sFinal > 0) {
                    showFloatingNumber(document.getElementById("player-hp"), sFinal, "damage");
                }
            }
            render();
            break;
        }
        case "devour": {
            // Devour a random adjective token from the field
            const devourable = Object.values(tokenPool).filter(t =>
                t.swappable && t.type === "adjective" &&
                !gameState.noiseTokens.includes(t.id) &&
                t.zone !== "reward" && t.zone !== "summary"
            );
            if (devourable.length > 0) {
                const target = devourable[Math.floor(Math.random() * devourable.length)];
                const oldValue = target.value;
                target.value = "___";
                target.swappable = false;
                target.isEmpty = true;
                gameState.emptySlots.push({ id: target.id, type: target.type, zone: target.zone });
                addLog("👁️ " + enemyName + "吞噬了「" + oldValue + "」！词块消失了", "log-combo");
                showBanner("👁️ 吞噬！", "banner-pressure");
                screenShake();
            } else {
                // Nothing to devour, attack instead
                var dDmg = Math.max(1, Math.floor(calculateEnemyDamage() * 0.7));
                const dBlocked = Math.min(gameState.playerDefense || 0, dDmg);
                const dFinal = Math.max(0, dDmg - dBlocked);
                var dHp = parseInt(TV("player-hp"));
                T("player-hp").value = String(Math.max(0, dHp - dFinal));
                addLog(enemyName + "无可吞噬，转为撕咬，造成" + dFinal + "点伤害", "log-damage");
                if (dFinal > 0) {
                    showFloatingNumber(document.getElementById("player-hp"), dFinal, "damage");
                }
            }
            render();
            break;
        }
    }
}

function unlockAllTokens() {
    gameState.lockedTokens.forEach(id => {
        const token = T(id);
        if (token) token.swappable = true;
    });
    gameState.lockedTokens = [];
}

// Check if enemy is dead; if boss, transition to next phase instead
function checkEnemyDeath() {
    if (parseInt(TV("enemy-hp")) > 0) return false;

    // Boss multi-HP-bar: transition to next phase
    if (gameState.currentEnemyData && gameState.currentEnemyData.special === "boss_multi_hp") {
        const nextPhaseIdx = (gameState.bossPhase || 0) + 1;
        if (nextPhaseIdx < BOSS_PHASES.length) {
            // Transition to next phase
            gameState.bossPhase = nextPhaseIdx;
            const nextPhase = BOSS_PHASES[nextPhaseIdx];
            T("enemy-hp").value = String(nextPhase.hp);
            gameState.enemyBaseDamage = nextPhase.baseDamage;
            gameState.currentEnemyData.baseDamage = nextPhase.baseDamage;
            gameState.currentEnemyData.intentWeights = nextPhase.intentWeights;
            syncDerivedTokens();
            rollEnemyIntent();

            addLog("═══ 巨龙进入「" + nextPhase.label + "」！═══", "log-combo");
            showBanner("💀 " + nextPhase.label + "！", "banner-pressure");
            screenShake();
            render();
            return false; // Not truly dead yet
        }
    }

    return true; // Enemy is dead
}

// =============================================================
// RELIC SYSTEM — runtime functions
// =============================================================

// Trigger all relics matching a specific trigger event
function triggerRelics(triggerName, ctx) {
    for (const relicId of gameState.relics) {
        const relic = RELIC_DB[relicId];
        if (relic && relic.passive && relic.passive.trigger === triggerName) {
            relic.passive.effect(gameState, ctx);
        }
    }
}

// Grant a relic to the player
function acquireRelic(relicId) {
    const relic = RELIC_DB[relicId];
    if (!relic) return;
    if (gameState.relics.includes(relicId)) return; // No duplicates

    gameState.relics.push(relicId);
    addLog("✨ 获得遗物「" + relic.icon + " " + relic.name + "」—— " + relic.description, "log-combo");
    showBanner(relic.icon + " " + relic.name + "！", "banner-combo");

    // Immediate on-acquire effects
    if (relic.onAcquire) {
        relic.onAcquire(gameState);
    }

    renderRelicBar();
}

// Roll a random relic not yet owned, weighted by rarity tier
function rollRandomRelic(allowedRarities) {
    const rarities = allowedRarities || ["normal", "normal", "normal", "rare", "rare"];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const pool = RELIC_POOL[rarity].filter(id => !gameState.relics.includes(id));
    if (pool.length === 0) {
        // Fallback to any unowned relic
        const allUnowned = Object.keys(RELIC_DB).filter(id => !gameState.relics.includes(id));
        if (allUnowned.length === 0) return null;
        return allUnowned[Math.floor(Math.random() * allUnowned.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

// Render the relic bar (shows all owned relics)
function renderRelicBar() {
    let relicBar = document.getElementById("relic-bar");
    if (!relicBar) {
        // Create the relic bar if it doesn't exist
        relicBar = document.createElement("div");
        relicBar.id = "relic-bar";
        const gameContainer = document.getElementById("game-container") || document.querySelector(".container");
        if (gameContainer) {
            gameContainer.insertBefore(relicBar, gameContainer.firstChild);
        }
    }

    if (gameState.relics.length === 0) {
        relicBar.style.display = "none";
        return;
    }

    relicBar.style.display = "flex";
    relicBar.innerHTML = gameState.relics.map(id => {
        const r = RELIC_DB[id];
        return `<span class="relic-icon">${r.icon}<span class="relic-tooltip"><span class="relic-tooltip-name">${r.name}</span><span class="relic-tooltip-desc">${r.description}</span></span></span>`;
    }).join("");
}

// =============================================================
// FEEDBACK SYSTEM: floating numbers, banners, screen shake
// =============================================================

function showFloatingNumber(targetEl, amount, type) {
    const rect = targetEl.getBoundingClientRect();
    const container = document.getElementById("game-container");
    const containerRect = container.getBoundingClientRect();

    const floater = document.createElement("span");
    floater.className = "float-number " + type;
    floater.textContent = type === "damage" ? ("-" + amount) : ("+" + amount);
    floater.style.left = (rect.left - containerRect.left + rect.width / 2) + "px";
    floater.style.top = (rect.top - containerRect.top) + "px";

    container.appendChild(floater);
    setTimeout(function() { floater.remove(); }, 1000);
}

function showBanner(text, styleClass, duration) {
    duration = duration || 1400;
    const overlay = document.getElementById("banner-overlay");
    const banner = document.createElement("div");
    banner.className = "banner-text " + styleClass;
    banner.textContent = text;
    overlay.appendChild(banner);
    setTimeout(function() { banner.remove(); }, duration);
}

function screenShake() {
    const container = document.getElementById("game-container");
    container.classList.add("screen-shake");
    setTimeout(function() { container.classList.remove("screen-shake"); }, 400);
}

function updateEffectsBar() {
    const bar = document.getElementById("effects-bar");
    bar.innerHTML = "";

    if (gameState.fieldEffect && gameState.fieldEffect.type === "burn") {
        const tag = document.createElement("span");
        tag.className = "effect-tag burn";
        tag.textContent = "\ud83d\udd25 燃烧 (" + gameState.fieldEffect.damage + "/回合)";
        bar.appendChild(tag);
    }
    if (gameState.enemyFrozen) {
        const tag = document.createElement("span");
        tag.className = "effect-tag frozen";
        tag.textContent = "\ud83e\uddca 敌人冻结";
        bar.appendChild(tag);
    }
    if (gameState.bonusDamage > 0) {
        const tag = document.createElement("span");
        tag.className = "effect-tag poison";
        tag.textContent = "\u2620\ufe0f 淬毒 (+" + gameState.bonusDamage + ")";
        bar.appendChild(tag);
    }
    if (gameState.enemyVulnerable > 0) {
        const tag = document.createElement("span");
        tag.className = "effect-tag burn";
        tag.textContent = "🎯 弱点暴露 (" + gameState.enemyVulnerable + "回合)";
        bar.appendChild(tag);
    }
    if (gameState.playerDefense > 0) {
        const tag = document.createElement("span");
        tag.className = "effect-tag frozen";
        tag.textContent = "🛡️ 格挡 (-" + gameState.playerDefense + ")";
        bar.appendChild(tag);
    }
    if (gameState.skillBurn > 0) {
        const tag = document.createElement("span");
        tag.className = "effect-tag burn";
        tag.textContent = "🔥 灼烧 (下回合" + gameState.skillBurn + "伤害)";
        bar.appendChild(tag);
    }
}

function updateHpVisuals() {
    const playerHpEl = document.getElementById("player-hp");
    var currentHp = parseInt(TV("player-hp")) || 0;
    if (currentHp <= 10) {
        playerHpEl.classList.add("hp-critical");
    } else {
        playerHpEl.classList.remove("hp-critical");
    }
}

// =============================================================
// SKILL SYSTEM — usage logic
// =============================================================

function useSkill(slotIndex) {
    if (gameState.phase !== "battle") return;
    if (gameState.turnInProgress) return;

    // Check if slot is sealed
    if (gameState.sealedSlots.includes(slotIndex)) {
        addLog("❌ 该技能槽被封印！", "log-info");
        return;
    }

    const skillId = gameState.skills[slotIndex];
    if (!skillId) return;

    const skill = SKILL_DB[skillId];
    if (!skill) return;

    // Check mana (with cost reduction from relics)
    const effectiveCost = Math.max(1, skill.manaCost - (gameState.manaCostReduction || 0));
    if (gameState.mana < effectiveCost) {
        addLog("法力不足！" + skill.name + "需要" + effectiveCost + "点法力", "log-info");
        // Shake mana display
        const manaEl = document.getElementById("mana-value");
        manaEl.classList.remove("mana-shake");
        void manaEl.offsetWidth;
        manaEl.classList.add("mana-shake");
        setTimeout(() => manaEl.classList.remove("mana-shake"), 500);
        return;
    }

    // Consume mana
    gameState.mana -= effectiveCost;

    // Apply vulnerability multiplier to damage skills
    const result = skill.effect(gameState);

    // Relic bonus damage for offense skills
    if (result && result.damage) {
        const ctx = { skillCategory: skill.category, bonusDamage: 0 };
        triggerRelics("on_skill_damage", ctx);
        if (ctx.bonusDamage > 0) {
            const ehp = T("enemy-hp");
            ehp.value = String(Math.max(0, parseInt(ehp.value) - ctx.bonusDamage));
            addLog("💍 遗物加成！额外造成" + ctx.bonusDamage + "点伤害", "log-combo");
            showFloatingNumber(document.getElementById("enemy-hp"), ctx.bonusDamage, "damage");
        }
    }

    // Relic bonus defense for defense skills
    if (result && result.defense) {
        const ctx = { skillCategory: skill.category, bonusDefense: 0 };
        triggerRelics("on_skill_defense", ctx);
        if (ctx.bonusDefense > 0) {
            gameState.playerDefense += ctx.bonusDefense;
            addLog("🔮 遗物加成！额外+" + ctx.bonusDefense + "护甲", "log-combo");
        }
    }

    // If the skill dealt damage and enemy is vulnerable, apply bonus
    if (result && result.damage && gameState.enemyVulnerable > 0) {
        const bonusDmg = result.damage; // double = original + bonus of same amount
        const ehp = T("enemy-hp");
        ehp.value = String(Math.max(0, parseInt(ehp.value) - bonusDmg));
        addLog("🎯 弱点效果！额外造成" + bonusDmg + "点伤害！", "log-combo");
        showFloatingNumber(document.getElementById("enemy-hp"), bonusDmg, "damage");
    }

    // If skill produces a token, add it to inventory as bonus word token
    if (skill.producesToken) {
        addToInventory("adjective", skill.producesToken);
        addLog("词块「" + skill.producesToken + "」加入词块库", "log-info");
    }

    // Animate the skill button
    const skillBtns = document.querySelectorAll(".skill-btn");
    if (skillBtns[slotIndex]) {
        skillBtns[slotIndex].classList.add("skill-casting");
        setTimeout(() => skillBtns[slotIndex].classList.remove("skill-casting"), 500);
    }

    // Update UI
    renderSkillArea();
    render();

    // Check if enemy died from skill damage
    if (checkEnemyDeath()) {
        gameState.turnInProgress = true;
        setTimeout(() => battleWon(), 600);
    }
}

function renderSkillArea() {
    const skillArea = document.getElementById("skill-area");
    if (!skillArea) return;

    // Only show skill area during battle
    if (gameState.phase !== "battle") {
        skillArea.style.display = "none";
        return;
    }
    skillArea.style.display = "flex";

    // Update mana display
    document.getElementById("mana-value").textContent = gameState.mana;
    document.getElementById("mana-max").textContent = gameState.maxMana;
    document.getElementById("mana-regen").textContent = gameState.manaRegen;

    // Render skill slots
    const slotsEl = document.getElementById("skill-slots");
    slotsEl.innerHTML = "";

    for (let i = 0; i < 4; i++) {
        const btn = document.createElement("button");

        if (gameState.sealedSlots.includes(i)) {
            // Sealed slot
            btn.className = "skill-btn skill-sealed";
            btn.disabled = true;
            btn.innerHTML = `<span class="skill-name">🔒 封印</span><span class="skill-desc">不可用</span>`;
        } else if (i < gameState.skills.length) {
            const skillId = gameState.skills[i];
            const skill = SKILL_DB[skillId];
            if (skill) {
                btn.className = `skill-btn skill-${skill.category}`;
                btn.innerHTML = `
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-cost">✦${Math.max(1, skill.manaCost - (gameState.manaCostReduction || 0))}</span>
                    <span class="skill-desc">${skill.description}</span>
                `;
                // Disable if not enough mana (with cost reduction) or turn in progress
                const effectiveCost = Math.max(1, skill.manaCost - (gameState.manaCostReduction || 0));
                if (gameState.mana < effectiveCost || gameState.turnInProgress) {
                    btn.disabled = true;
                }
                const idx = i;
                btn.addEventListener("click", () => useSkill(idx));
            }
        } else {
            // Empty slot
            btn.className = "skill-btn skill-empty";
            btn.disabled = true;
            btn.innerHTML = `<span class="skill-name">空槽</span>`;
        }

        slotsEl.appendChild(btn);
    }
}

function regenMana() {
    gameState.mana = Math.min(gameState.maxMana, gameState.mana + gameState.manaRegen);
}

function applySkillBurnDamage() {
    if (gameState.skillBurn > 0) {
        const dmg = gameState.skillBurn;
        const ehp = T("enemy-hp");
        ehp.value = String(Math.max(0, parseInt(ehp.value) - dmg));
        addLog("🔥 燃烧伤害！敌人受到" + dmg + "点灼烧", "log-damage");
        showFloatingNumber(document.getElementById("enemy-hp"), dmg, "damage");
        gameState.skillBurn = 0;
    }
}

function applyCounterAttack() {
    if (gameState.counterAttack > 0) {
        const dmg = gameState.counterAttack;
        const ehp = T("enemy-hp");
        ehp.value = String(Math.max(0, parseInt(ehp.value) - dmg));
        addLog("⚔️ 反击！反弹" + dmg + "点伤害给敌人！", "log-damage");
        showFloatingNumber(document.getElementById("enemy-hp"), dmg, "damage");
        gameState.counterAttack = 0;
    }
}

// =============================================================
// MODE SYSTEM — swap / insert / delete
// =============================================================

function setMode(mode) {
    gameState.mode = mode;

    // Update button active states
    document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));
    if (mode !== "swap") {
        const activeBtn = document.getElementById("btn-mode-" + mode);
        if (activeBtn) activeBtn.classList.add("active");
    }

    // Update body class for cursor styling
    document.body.classList.remove("mode-swap", "mode-delete");
    document.body.classList.add("mode-" + mode);

    // Clear inventory selection when entering delete mode
    if (mode === "delete") {
        gameState.selectedInventoryToken = null;
    }

    // Re-render to update token interactivity
    render();
}

// Toggle mode: click again to exit back to swap (default)
function toggleMode(mode) {
    if (gameState.turnInProgress) return;
    if (gameState.mode === mode) {
        setMode("swap");
    } else {
        setMode(mode);
    }
}

// =============================================================
// INVENTORY SYSTEM — collected word tokens
// =============================================================

function toggleInventory() {
    const overlay = document.getElementById("inventory-overlay");
    const isVisible = overlay.style.display !== "none";
    overlay.style.display = isVisible ? "none" : "flex";
    if (!isVisible) {
        renderInventory();
    }
}

function renderInventory() {
    const grid = document.getElementById("inventory-grid");
    grid.innerHTML = "";

    if (gameState.inventory.length === 0) {
        const empty = document.createElement("div");
        empty.className = "inv-empty";
        empty.textContent = "词块库为空。击败敌人可获得词块。";
        grid.appendChild(empty);
        return;
    }

    gameState.inventory.forEach(item => {
        const el = document.createElement("div");
        el.className = `inv-token token-${item.type}`;
        el.textContent = item.value;
        el.dataset.invId = item.id;

        if (gameState.selectedInventoryToken === item.id) {
            el.classList.add("inv-selected");
        }

        el.addEventListener("click", () => selectInventoryToken(item.id));
        grid.appendChild(el);
    });

    // Update count display
    const countEl = document.getElementById("inv-count");
    if (countEl) countEl.textContent = gameState.inventory.length;
}

function selectInventoryToken(invId) {
    if (gameState.selectedInventoryToken === invId) {
        // Deselect
        gameState.selectedInventoryToken = null;
        renderInventory();
        return;
    }
    gameState.selectedInventoryToken = invId;
    renderInventory();
    // Close inventory panel so user can click on target tokens
    const overlay = document.getElementById("inventory-overlay");
    overlay.style.display = "none";
    const invItem = gameState.inventory.find(i => i.id === invId);
    addLog(`选中词块「${invItem?.value}」，点击句子中同类型词块完成交换`, "log-info");
    // Re-render to show compatible targets
    render();
}

function addToInventory(type, value) {
    const id = "inv-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    gameState.inventory.push({ id, type, value });
    // Update count display
    const countEl = document.getElementById("inv-count");
    if (countEl) countEl.textContent = gameState.inventory.length;
    return id;
}

function removeFromInventory(invId) {
    gameState.inventory = gameState.inventory.filter(i => i.id !== invId);
    const countEl = document.getElementById("inv-count");
    if (countEl) countEl.textContent = gameState.inventory.length;
}

// =============================================================
// DELETE OPERATION — erase a token, leave empty slot
// =============================================================

function handleDeleteClick(tokenId) {
    if (gameState.mode !== "delete") return;
    if (gameState.turnInProgress) return;

    const token = T(tokenId);
    if (!token || !token.swappable) return;

    // Cannot delete critical tokens
    const protectedIds = ["player-hp", "enemy-hp", "swap-count", "player-name", "enemy-name"];
    if (protectedIds.includes(tokenId)) {
        addLog("无法删除关键词块！", "log-info");
        showBanner("❌ 无法删除", "banner-pressure");
        return;
    }

    // Check ink cost (delete costs 2 ink)
    const sc = T("swap-count");
    const currentInk = parseInt(sc.value) || 0;
    const deleteCost = 2;
    if (currentInk < deleteCost) {
        addLog(`笔力不足！删除需要${deleteCost}点笔力`, "log-info");
        const scEl = document.getElementById("swap-count");
        scEl.classList.remove("swap-count-shake");
        void scEl.offsetWidth;
        scEl.classList.add("swap-count-shake");
        setTimeout(() => scEl.classList.remove("swap-count-shake"), 500);
        return;
    }

    // Consume ink
    sc.value = String(currentInk - deleteCost);

    // Add pressure cost (delete is destructive = high pressure)
    const pressureCost = 4;
    addPressure(pressureCost);

    const deletedValue = token.value;
    const deletedType = token.type;
    const deletedZone = token.zone;

    // Record empty slot
    gameState.emptySlots.push({ id: tokenId, type: deletedType, zone: deletedZone });

    // Mark token as empty
    token.value = "___";
    token.swappable = false;
    token.isEmpty = true;

    addLog(`✕ 抹除了「${deletedValue}」（笔力-${deleteCost}，墨渍+${pressureCost}）`, "log-swap");
    showBanner("✕ 抹除！", "banner-pressure");

    // Recalculate derived values and check combos after deletion
    syncDerivedTokens();
    checkCombos();

    // Auto-return to default mode
    setMode("swap");
    flashToken(tokenId);
}

// =============================================================
// INVENTORY SWAP — exchange inventory token with a sentence token
// =============================================================

function handleInventorySwapClick(tokenId) {
    if (gameState.turnInProgress) return;
    if (!gameState.selectedInventoryToken) return;

    const token = T(tokenId);
    if (!token) return;

    const invItem = gameState.inventory.find(i => i.id === gameState.selectedInventoryToken);
    if (!invItem) {
        gameState.selectedInventoryToken = null;
        return;
    }

    // Type check: inventory token type must match the target token type
    if (invItem.type !== token.type) {
        addLog(`类型不匹配！需要「${token.type}」类型词块`, "log-info");
        return;
    }

    // Check ink cost (1 ink)
    const sc = T("swap-count");
    const currentInk = parseInt(sc.value) || 0;
    const swapCost = 1;
    if (currentInk < swapCost) {
        addLog(`笔力不足！交换需要${swapCost}点笔力`, "log-info");
        const scEl = document.getElementById("swap-count");
        scEl.classList.remove("swap-count-shake");
        void scEl.offsetWidth;
        scEl.classList.add("swap-count-shake");
        setTimeout(() => scEl.classList.remove("swap-count-shake"), 500);
        return;
    }

    // Consume ink
    sc.value = String(currentInk - swapCost);

    if (token.isEmpty) {
        // Filling an empty slot: inventory item goes in, nothing comes back
        token.value = invItem.value;
        token.swappable = true;
        token.isEmpty = false;
        gameState.emptySlots = gameState.emptySlots.filter(s => s.id !== tokenId);

        // Remove from inventory
        removeFromInventory(invItem.id);
        addLog(`＋ 填入「${invItem.value}」→ 空槽（笔力-${swapCost}）`, "log-swap");
        showBanner("＋ 填入！", "banner-combo");
    } else {
        // Swap: inventory item replaces token, displaced token goes to inventory
        const displacedValue = token.value;
        token.value = invItem.value;

        // Remove old inventory item, add displaced token to inventory
        removeFromInventory(invItem.id);
        addToInventory(token.type, displacedValue);

        addLog(`交换！词块库「${invItem.value}」⟷「${displacedValue}」（笔力-${swapCost}）`, "log-swap");
    }

    gameState.selectedInventoryToken = null;

    // Recalculate derived values
    syncDerivedTokens();
    checkCombos();

    render();
    flashToken(tokenId);
}

// =============================================================
// DRAG & DROP
// =============================================================

let domTokenEls = [];   // all token DOM elements in current render
let dragInfo = {
    el: null,
    clone: null,
    sourceRect: null,    // original position of source element (for fly-back anim)
};
let swapAnimating = false;  // lock during animation

function onDragStart(e, el) {
    if (swapAnimating || gameState.turnInProgress) return;
    if (dragInfo.el) return; // guard against re-entry from multi-touch
    if (gameState.mode !== "swap") return; // Only drag in swap mode

    const tokenId = el.dataset.tokenId;
    const token = T(tokenId);
    if (!token || !token.swappable) return;

    // Check swap count (read from pool)
    const swapCountVal = parseInt(TV("swap-count")) || 0;
    if (swapCountVal <= 0) {
        // Shake the swap counter to indicate no swaps left
        const scEl = document.getElementById("swap-count");
        scEl.classList.remove("swap-count-shake");
        void scEl.offsetWidth; // force reflow
        scEl.classList.add("swap-count-shake");
        setTimeout(function() { scEl.classList.remove("swap-count-shake"); }, 500);
        return;
    }

    e.preventDefault();

    dragInfo.el = el;
    dragInfo.sourceRect = el.getBoundingClientRect();

    const clone = el.cloneNode(true);
    clone.classList.add("drag-clone");
    clone.style.left = e.clientX + "px";
    clone.style.top = e.clientY + "px";
    document.body.appendChild(clone);
    dragInfo.clone = clone;

    el.classList.add("dragging-source");

    // Highlight compatible targets (including empty slots of same type)
    domTokenEls.forEach(t => {
        const tid = t.dataset.tokenId;
        const tt = T(tid);
        if (tt && tt.id !== tokenId && tt.type === token.type) {
            if (tt.swappable || tt.isEmpty) {
                t.classList.add("compatible");
            }
        }
    });

    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
}

// Touch event wrappers
function onTouchStart(e, el) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    onDragStart({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => e.preventDefault() }, el);
}

function onTouchMove(e) {
    if (!dragInfo.clone) return;
    e.preventDefault();
    const touch = e.touches[0];
    onDragMove({ clientX: touch.clientX, clientY: touch.clientY });
}

function onTouchEnd(e) {
    if (!dragInfo.el) return;
    const touch = e.changedTouches ? e.changedTouches[0] : null;
    const clientX = touch ? touch.clientX : 0;
    const clientY = touch ? touch.clientY : 0;
    onDragEnd({ clientX, clientY });
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", onTouchEnd);
}

function onDragMove(e) {
    if (!dragInfo.clone) return;
    dragInfo.clone.style.left = e.clientX + "px";
    dragInfo.clone.style.top = e.clientY + "px";

    domTokenEls.forEach(t => t.classList.remove("drag-over"));
    const target = getTokenElUnder(e);
    if (target && target !== dragInfo.el) {
        const srcToken = T(dragInfo.el.dataset.tokenId);
        const tgtToken = T(target.dataset.tokenId);
        if (tgtToken && srcToken && tgtToken.type === srcToken.type && (tgtToken.swappable || tgtToken.isEmpty)) {
            target.classList.add("drag-over");
        }
    }
}

function onDragEnd(e) {
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", onTouchEnd);

    // Clean up highlights
    domTokenEls.forEach(t => {
        t.classList.remove("compatible");
        t.classList.remove("drag-over");
    });

    const target = getTokenElUnder(e);
    const sourceEl = dragInfo.el;
    const sourceRect = dragInfo.sourceRect;

    // Check if valid swap target (includes empty slots of same type)
    let validSwap = false;
    let srcToken = null;
    let tgtToken = null;
    if (target && target !== sourceEl) {
        srcToken = T(sourceEl.dataset.tokenId);
        tgtToken = T(target.dataset.tokenId);
        if (srcToken && tgtToken && srcToken.type === tgtToken.type && (tgtToken.swappable || tgtToken.isEmpty)) {
            validSwap = true;
        }
    }

    if (validSwap) {
        // --- Animate: B's value flies back to A's original position ---
        swapAnimating = true;

        // Remove the drag clone (A is already "at" B's location conceptually)
        if (dragInfo.clone) {
            dragInfo.clone.remove();
            dragInfo.clone = null;
        }
        if (sourceEl) {
            sourceEl.classList.remove("dragging-source");
        }

        // Create a "flyback" clone of B that travels to A's position
        const targetRect = target.getBoundingClientRect();
        const flyback = target.cloneNode(true);
        flyback.classList.add("flyback-clone");
        flyback.style.left = targetRect.left + targetRect.width / 2 + "px";
        flyback.style.top = targetRect.top + targetRect.height / 2 + "px";
        document.body.appendChild(flyback);

        // Calculate destination (A's original center)
        const destX = sourceRect.left + sourceRect.width / 2;
        const destY = sourceRect.top + sourceRect.height / 2;

        // Trigger transition on next frame
        requestAnimationFrame(() => {
            flyback.style.left = destX + "px";
            flyback.style.top = destY + "px";
        });

        // After animation completes, do the actual swap
        flyback.addEventListener("transitionend", () => {
            flyback.remove();
            swapAnimating = false;
            performSwap(srcToken.id, tgtToken.id);
        }, { once: true });

        // Safety timeout in case transitionend doesn't fire
        setTimeout(() => {
            if (swapAnimating) {
                flyback.remove();
                swapAnimating = false;
                performSwap(srcToken.id, tgtToken.id);
            }
        }, 400);

    } else {
        // Invalid drop — bounce clone back to source
        if (dragInfo.clone && sourceRect) {
            var bounceClone = dragInfo.clone;
            bounceClone.style.transition = "left 0.2s ease, top 0.2s ease, opacity 0.2s ease";
            bounceClone.style.left = (sourceRect.left + sourceRect.width / 2) + "px";
            bounceClone.style.top = (sourceRect.top + sourceRect.height / 2) + "px";
            bounceClone.style.opacity = "0";
            setTimeout(function() { bounceClone.remove(); }, 220);
        } else if (dragInfo.clone) {
            dragInfo.clone.remove();
        }
        dragInfo.clone = null;
        if (sourceEl) {
            sourceEl.classList.remove("dragging-source");
        }
    }

    dragInfo.el = null;
    dragInfo.sourceRect = null;
}

function getTokenElUnder(e) {
    if (dragInfo.clone) dragInfo.clone.style.pointerEvents = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (dragInfo.clone) dragInfo.clone.style.pointerEvents = "";

    if (el && el.classList.contains("token") && el.dataset.tokenId) return el;
    if (el && el.parentElement && el.parentElement.classList.contains("token") && el.parentElement.dataset.tokenId) return el.parentElement;
    return null;
}

// =============================================================
// SWAP LOGIC
// =============================================================

function performSwap(idA, idB) {
    const tokenA = T(idA);
    const tokenB = T(idB);
    if (!tokenA || !tokenB) return;

    // Difficulty check
    if (!isSwapAllowed(idA, idB)) {
        addLog("该交换在当前难度下被禁止！", "log-info");
        return;
    }

    const valA = tokenA.value;
    const valB = tokenB.value;
    const isMoveToEmpty = !!tokenB.isEmpty;

    // Determine swap cost (subject swap costs 2, others cost 1)
    const isSubjectSwap = tokenA.type === "subject" &&
        ((idA === "enemy-name" && idB === "player-name") ||
         (idA === "player-name" && idB === "enemy-name"));
    const swapCost = isSubjectSwap ? 2 : 1;

    // Check if enough ink (笔力)
    const sc = T("swap-count");
    const currentSwaps = parseInt(sc.value) || 0;
    if (currentSwaps < swapCost) {
        addLog(`笔力不足！${isSubjectSwap ? "主语交换" : "交换"}需要${swapCost}点笔力`, "log-info");
        const scEl = document.getElementById("swap-count");
        scEl.classList.remove("swap-count-shake");
        void scEl.offsetWidth;
        scEl.classList.add("swap-count-shake");
        setTimeout(() => scEl.classList.remove("swap-count-shake"), 500);
        return;
    }

    // Special: subject swap = attack reversal (high cost: 2 swaps + 5 pressure)
    if (isSubjectSwap) {
        handleSubjectReversal();
        addPressure(5);
        addLog("墨渍+5（主语反转的代价）", "log-info");
        showBanner("⚠️ 墨渍涌动！", "banner-pressure");
    } else if (tokenB.isEmpty) {
        // Move semantics: A moves to B's empty slot, A becomes empty
        tokenB.value = valA;
        tokenB.swappable = true;
        tokenB.isEmpty = false;
        gameState.emptySlots = gameState.emptySlots.filter(s => s.id !== idB);

        tokenA.value = "___";
        tokenA.swappable = false;
        tokenA.isEmpty = true;
        gameState.emptySlots.push({ id: idA, type: tokenA.type, zone: tokenA.zone });
    } else {
        // Normal swap: just exchange values
        tokenA.value = valB;
        tokenB.value = valA;
    }

    // Relic: on_swap_execute triggers (must run before relic refund check)
    const swapCtx = { refund: false, copyMode: false };
    triggerRelics("on_swap_cost", swapCtx);
    triggerRelics("on_swap_execute", swapCtx);

    // Relic: mirror_quill copy mode — duplicate source value instead of swapping
    if (swapCtx.copyMode && !isSubjectSwap && !isMoveToEmpty) {
        tokenB.value = valA; // both A and B now hold valA (original A value)
        addLog("🪶 镜像羽笔！词块被复制而非交换", "log-combo");
    }

    // Consume swap count
    sc.value = String(Math.max(0, currentSwaps - swapCost));

    // Relic: chance to refund swap cost (ink_well) — already triggered above
    if (swapCtx.refund) {
        sc.value = String(parseInt(sc.value) + swapCost);
        addLog("🏺 无尽墨池！笔力未消耗！", "log-combo");
    }

    const logVerb = isMoveToEmpty ? "移动" : "交换";
    addLog(`${logVerb}！「${valA}」${isMoveToEmpty ? "→ 空槽" : "⟷「" + valB + "」"}${swapCost > 1 ? "（消耗" + swapCost + "点笔力）" : ""}`, "log-swap");

    // Apply pressure for persistent swaps
    const pressureCost = getSwapPressureCost(idA, idB);
    if (pressureCost > 0) {
        addPressure(pressureCost);
        addLog(`墨渍+${pressureCost}（持续性交换）`, "log-info");
    }

    // HP swaps generate extra pressure
    if (idA === "player-hp" || idB === "player-hp" || idA === "enemy-hp" || idB === "enemy-hp") {
        addPressure(3);
        addLog("墨渍+3（生命值交换的代价）", "log-info");
    }

    // Recalculate enemy-damage token (derived)
    syncDerivedTokens();

    // Check combos
    checkCombos();

    // Re-render
    render();

    // If in event phase, re-render event UI to reflect swapped tokens
    if (gameState.phase === "event" && gameState.currentEvent) {
        renderEventUI();
    }

    // Flash both swapped tokens after render
    flashToken(idA);
    flashToken(idB);
    updateHpVisuals();
}

function flashToken(tokenId) {
    const el = domTokenEls.find(e => e.dataset.tokenId === tokenId);
    if (el) {
        el.classList.add("swap-landed");
        setTimeout(() => el.classList.remove("swap-landed"), 400);
    }
}

function handleSubjectReversal() {
    showBanner("\u26a1 攻击方向反转！", "banner-reversal");
    screenShake();
    addLog("攻击方向反转！", "log-combo");
    gameState.enemyFrozen = true;
    const damage = calculateEnemyDamage();
    const ehp = T("enemy-hp");
    ehp.value = String(Math.max(0, parseInt(ehp.value) - damage));
    addLog(`${TV("enemy-name")}对自己造成了${damage}点伤害！`, "log-damage");
}

function isSwapAllowed(idA, idB) {
    const rules = DIFFICULTY_RULES[gameState.difficulty];
    if (!rules.swapCountSwappable) {
        if (idA === "swap-count" || idB === "swap-count") return false;
    }
    return true;
}

function syncDerivedTokens() {
    // enemy-damage is a derived value: baseDamage + adj bonus
    const t = T("enemy-damage");
    if (t) {
        t.value = String(calculateEnemyDamage());
    }
}

function checkCombos() {
    const envAdj = TV("env-adj");
    const envNoun = TV("env-noun");
    const eWeaponAdj = TV("enemy-weapon-adj");
    const eWeaponNoun = TV("enemy-weapon-noun");
    const pWeaponAdj = TV("player-weapon-adj");
    const pWeaponNoun = "铁剑";

    COMBO_RULES.forEach(rule => {
        var triggered = false;
        var triggerNoun = "";
        if (rule.condition(envAdj, envNoun)) { triggered = true; triggerNoun = envNoun; }
        else if (rule.condition(eWeaponAdj, eWeaponNoun)) { triggered = true; triggerNoun = eWeaponNoun; }
        else if (rule.condition(pWeaponAdj, pWeaponNoun)) { triggered = true; triggerNoun = pWeaponNoun; }

        if (triggered) {
            var desc = rule.description.replace("{noun}", triggerNoun);
            showBanner("\ud83d\udca5 " + rule.label, "banner-combo");
            screenShake();
            addLog("\ud83d\udca5 连锁反应：" + desc, "log-combo");
            rule.apply(gameState);
            updateEffectsBar();
        }
    });
}

// =============================================================
// RENDERING — reads from tokenPool, writes to DOM
// =============================================================

function render() {
    domTokenEls = [];

    // --- Gold display ---
    const goldEl = document.getElementById("gold-value");
    if (goldEl) goldEl.textContent = gameState.gold;

    // --- Swap counter ---
    const swapCountEl = document.getElementById("swap-count");
    const scToken = T("swap-count");
    swapCountEl.textContent = scToken.value;
    if (scToken.swappable) {
        renderAsDraggable(swapCountEl, scToken);
    } else {
        swapCountEl.className = "";
        swapCountEl.dataset.tokenId = "";
        swapCountEl.style.cursor = "default";
    }

    // --- Summary ---
    const summaryArea = document.getElementById("summary-area");
    const summaryText = document.getElementById("summary-text");
    if (gameState.summaryTemplate) {
        summaryArea.style.display = "block";
        if (gameState.summaryTemplate === "A") {
            renderSentence(summaryText, [
                "你", tok("summary-adj"), "地击败了", tok("summary-subject"),
                "，剩余", tok("summary-number"), "点力量",
            ]);
        } else {
            renderSentence(summaryText, [
                tok("summary-subject"), "倒在了", tok("summary-adj"),
                tok("summary-noun"), "上，留下了", tok("summary-number"), "点余烬",
            ]);
        }
    } else {
        summaryArea.style.display = "none";
    }

    // --- Environment ---
    renderSentence(document.getElementById("environment-text"), [
        "你站在", tok("env-adj"), tok("env-noun"), "之中",
    ]);

    // --- Battle ---
    const battleArea = document.getElementById("battle-area");
    const rewardArea = document.getElementById("reward-area");
    const actionArea = document.getElementById("action-area");

    if (gameState.phase === "map" || gameState.phase === "event") {
        battleArea.style.display = "none";
        actionArea.style.display = "none";
        rewardArea.style.display = "none";
    } else if (gameState.phase === "reward") {
        // Reward phase handled by overlay, not inline
        battleArea.style.display = "none";
        actionArea.style.display = "none";
        rewardArea.style.display = "none";
    } else {
        battleArea.style.display = "block";
        actionArea.style.display = "flex";
        rewardArea.style.display = "none";

        if (gameState.enemyFrozen) {
            renderSentence(document.getElementById("battle-text"), [
                tok("enemy-name"), "被冻结了，无法行动",
            ]);
        } else {
            renderSentence(document.getElementById("battle-text"), [
                tok("enemy-name"), "用", tok("enemy-weapon-adj"),
                tok("enemy-weapon-noun"), "对", tok("player-name"),
                "造成了", tok("enemy-damage"), "点伤害",
            ]);
        }
    }

    // --- Status bar ---
    renderStatusEl(document.getElementById("player-hp"), "player-hp");
    renderStatusEl(document.getElementById("player-weapon-adj"), "player-weapon-adj");
    renderStatusEl(document.getElementById("enemy-hp"), "enemy-hp");

    // --- Enemy intent display ---
    renderEnemyIntent();

    // --- Effects bar & HP visuals & pressure & skills & relics ---
    updateEffectsBar();
    updateHpVisuals();
    updatePressureVisuals();
    renderSkillArea();
    renderRelicBar();
}

function renderEnemyIntent() {
    const intentEl = document.getElementById("enemy-intent");
    if (!intentEl) return;

    if (!gameState.enemyIntent || gameState.phase !== "battle") {
        intentEl.style.display = "none";
        return;
    }

    intentEl.style.display = "flex";
    const intent = gameState.enemyIntent;
    const info = INTENT_TYPES[intent.type];

    intentEl.innerHTML = "";
    intentEl.style.borderColor = info.color;

    const iconSpan = document.createElement("span");
    iconSpan.className = "intent-icon";
    iconSpan.textContent = info.icon;
    intentEl.appendChild(iconSpan);

    const labelSpan = document.createElement("span");
    labelSpan.className = "intent-label";
    labelSpan.style.color = info.color;

    let labelText = info.label;
    if (intent.type === "attack") labelText += " " + intent.value;
    else if (intent.type === "defend") labelText += " -" + intent.value;
    else if (intent.type === "buff") labelText += " +" + intent.value;

    labelSpan.textContent = labelText;
    intentEl.appendChild(labelSpan);
}

// Token reference helper for sentence templates
function tok(id) {
    return { _tok: true, id };
}

// Render a sentence mixing plain text and token references
function renderSentence(container, parts) {
    container.innerHTML = "";
    parts.forEach(part => {
        if (typeof part === "string") {
            container.appendChild(document.createTextNode(part));
        } else if (part._tok) {
            const token = T(part.id);
            if (token) {
                const span = makeTokenSpan(token);
                container.appendChild(span);
            }
        }
    });
}

// Create a fresh DOM span for a token
function makeTokenSpan(token) {
    const span = document.createElement("span");
    span.dataset.tokenId = token.id;

    const hasInvSelection = !!gameState.selectedInventoryToken;
    const invItem = hasInvSelection ? gameState.inventory.find(i => i.id === gameState.selectedInventoryToken) : null;
    const isCompatibleWithInv = invItem && invItem.type === token.type;

    // Empty slot rendering
    if (token.isEmpty) {
        span.className = `token token-empty token-${token.type}`;
        span.textContent = "___";

        if (isCompatibleWithInv) {
            // Inventory token selected and compatible: clickable to fill/swap
            span.style.cursor = "pointer";
            span.classList.add("slot-compatible");
            span.addEventListener("click", () => handleInventorySwapClick(token.id));
        } else {
            span.style.cursor = "default";
        }

        domTokenEls.push(span);
        return span;
    }

    span.className = `token token-${token.type}`;
    span.textContent = token.value;

    if (gameState.mode === "delete" && token.swappable) {
        // In delete mode: tokens are clickable to delete
        span.style.cursor = "crosshair";
        span.addEventListener("click", () => handleDeleteClick(token.id));
    } else if (hasInvSelection && isCompatibleWithInv && token.swappable) {
        // Inventory token selected and compatible: clickable to swap with inventory
        span.style.cursor = "pointer";
        span.classList.add("slot-compatible");
        span.addEventListener("click", () => handleInventorySwapClick(token.id));
    } else if (gameState.mode === "swap" && token.swappable) {
        // In swap mode: normal drag behavior
        span.style.cursor = "grab";
        span.addEventListener("mousedown", (e) => onDragStart(e, span));
        span.addEventListener("touchstart", (e) => onTouchStart(e, span), { passive: false });
    } else if (!token.swappable) {
        span.classList.add("token-locked");
        span.style.cursor = "not-allowed";
    } else {
        span.style.cursor = "default";
    }

    domTokenEls.push(span);
    return span;
}

// Render a persistent status bar element as a token
function renderStatusEl(el, tokenId) {
    const token = T(tokenId);
    if (!token) return;

    el.textContent = token.value;
    el.dataset.tokenId = tokenId;
    el.className = `token token-${token.type}`;

    // Remove old handlers
    if (el._handler) el.removeEventListener("mousedown", el._handler);
    if (el._touchHandler) el.removeEventListener("touchstart", el._touchHandler);
    if (el._clickHandler) el.removeEventListener("click", el._clickHandler);

    const hasInvSelection = !!gameState.selectedInventoryToken;
    const invItem = hasInvSelection ? gameState.inventory.find(i => i.id === gameState.selectedInventoryToken) : null;
    const isCompatibleWithInv = invItem && invItem.type === token.type;

    if (gameState.mode === "delete" && token.swappable) {
        el.style.cursor = "crosshair";
        el._clickHandler = () => handleDeleteClick(tokenId);
        el.addEventListener("click", el._clickHandler);
    } else if (hasInvSelection && isCompatibleWithInv && token.swappable) {
        el.style.cursor = "pointer";
        el.classList.add("slot-compatible");
        el._clickHandler = () => handleInventorySwapClick(tokenId);
        el.addEventListener("click", el._clickHandler);
    } else if (gameState.mode === "swap" && token.swappable) {
        el.style.cursor = "grab";
        el._handler = (e) => onDragStart(e, el);
        el._touchHandler = (e) => onTouchStart(e, el);
        el.addEventListener("mousedown", el._handler);
        el.addEventListener("touchstart", el._touchHandler, { passive: false });
    } else if (!token.swappable) {
        el.style.cursor = "not-allowed";
        el.classList.add("token-locked");
    } else {
        el.style.cursor = "default";
    }

    domTokenEls.push(el);
}

// Render a swappable inline element (for swap-count in header)
function renderAsDraggable(el, token) {
    el.textContent = token.value;
    el.className = `token token-${token.type}`;
    el.dataset.tokenId = token.id;
    el.style.cursor = "grab";

    if (el._handler) el.removeEventListener("mousedown", el._handler);
    if (el._touchHandler) el.removeEventListener("touchstart", el._touchHandler);
    el._handler = (e) => onDragStart(e, el);
    el._touchHandler = (e) => onTouchStart(e, el);
    el.addEventListener("mousedown", el._handler);
    el.addEventListener("touchstart", el._touchHandler, { passive: false });

    domTokenEls.push(el);
}

// =============================================================
// TURN LOGIC — step-by-step with delays
// =============================================================

function endTurn() {
    if (gameState.phase !== "battle") return;
    if (gameState.turnInProgress) return;
    gameState.turnInProgress = true;

    var btn = document.getElementById("btn-end-turn");
    btn.disabled = true;

    // Track whether battle ended during step execution
    var battleEnded = false;

    // Build resolution steps
    var steps = [];

    // Step 0.5: Apply skill burn damage from previous turn
    if (gameState.skillBurn > 0) {
        steps.push(function() {
            if (battleEnded) return;
            applySkillBurnDamage();
            if (checkEnemyDeath()) { battleEnded = true; battleWon(); return; }
            render();
        });
    }

    // Step 1: Execute enemy intent (with player defense from skills)
    if (!gameState.enemyFrozen) {
        steps.push(function() {
            if (battleEnded) return;
            // Apply player's skill-based defense to reduce enemy damage
            const intent = gameState.enemyIntent;
            if (intent && intent.type === "attack" && gameState.playerDefense > 0) {
                const origDmg = calculateEnemyDamage();
                const reduced = Math.min(gameState.playerDefense, origDmg);
                const finalDmg = Math.max(0, origDmg - reduced);
                const oldHp = parseInt(TV("player-hp"));
                T("player-hp").value = String(Math.max(0, oldHp - finalDmg));
                addLog(TV("enemy-name") + "攻击造成" + origDmg + "点伤害，格挡减免" + reduced + "点，实际受到" + finalDmg + "点", "log-damage");
                if (finalDmg > 0) {
                    showFloatingNumber(document.getElementById("player-hp"), finalDmg, "damage");
                    screenShake();
                }
                // Counter-attack: reflect blocked damage
                if (gameState.counterAttack > 0) {
                    applyCounterAttack();
                }
                render();
                // Mark intent as handled to skip normal executeEnemyIntent for attack
                gameState._intentHandled = true;
            } else {
                executeEnemyIntent();
            }
        });
    } else {
        steps.push(function() {
            addLog(TV("enemy-name") + "被冻结，无法行动", "log-info");
            gameState.enemyFrozen = false;
            updateEffectsBar();
            render();
        });
    }

    // Step 2: Player attacks (basic weapon attack)
    steps.push(function() {
        if (battleEnded) return;
        var playerDamage = calculatePlayerDamage();
        // Apply vulnerability bonus
        if (gameState.enemyVulnerable > 0) {
            playerDamage = playerDamage * 2;
        }
        var oldEnemyHp = parseInt(TV("enemy-hp"));
        T("enemy-hp").value = String(oldEnemyHp - playerDamage);
        var vulnText = gameState.enemyVulnerable > 0 ? "（弱点暴露×2！）" : "";
        addLog("你用" + TV("player-weapon-adj") + "铁剑对" + TV("enemy-name") + "造成了" + playerDamage + "点伤害" + vulnText, "log-damage");
        render();
        showFloatingNumber(document.getElementById("enemy-hp"), playerDamage, "damage");
        if (checkEnemyDeath()) { battleEnded = true; battleWon(); return; }
    });

    // Step 3: Field effects
    if (gameState.fieldEffect && gameState.fieldEffect.type === "burn") {
        steps.push(function() {
            if (battleEnded) return;
            var dmg = gameState.fieldEffect.damage;
            var php = parseInt(TV("player-hp"));
            var ehp = parseInt(TV("enemy-hp"));
            T("player-hp").value = String(Math.max(0, php - dmg));
            T("enemy-hp").value = String(Math.max(0, ehp - dmg));
            addLog("场地燃烧！双方各受" + dmg + "点伤害", "log-damage");
            render();
            showFloatingNumber(document.getElementById("player-hp"), dmg, "damage");
            showFloatingNumber(document.getElementById("enemy-hp"), dmg, "damage");
            if (checkEnemyDeath()) { battleEnded = true; battleWon(); return; }
        });
    }

    // Step 3.5: Poison damage
    if (gameState.poisonStacks > 0) {
        steps.push(function() {
            if (battleEnded) return;
            const poisonDmg = gameState.poisonStacks;
            const php = parseInt(TV("player-hp"));
            T("player-hp").value = String(Math.max(0, php - poisonDmg));
            addLog("☠️ 中毒伤害！受到" + poisonDmg + "点毒伤（" + gameState.poisonStacks + "层）", "log-damage");
            showFloatingNumber(document.getElementById("player-hp"), poisonDmg, "damage");
            render();
        });
    }

    // Step 4: Reset bonuses & skill state for next turn
    steps.push(function() {
        if (battleEnded) return;
        gameState.bonusDamage = 0;
        // Carry over defense if stone_skin effect
        gameState.playerDefense = gameState.skillDefenseCarry || 0;
        gameState.skillDefenseCarry = 0;
        gameState.counterAttack = 0;
        gameState._intentHandled = false;
        // Decrement vulnerability counter
        if (gameState.enemyVulnerable > 0) {
            gameState.enemyVulnerable--;
            if (gameState.enemyVulnerable === 0) {
                addLog("🎯 弱点暴露效果结束", "log-info");
            }
        }
        // Tick seal timers
        if (gameState.sealTimers && gameState.sealTimers.length > 0) {
            gameState.sealTimers.forEach(timer => timer.turnsLeft--);
            const expired = gameState.sealTimers.filter(t => t.turnsLeft <= 0);
            expired.forEach(timer => {
                gameState.sealedSlots = gameState.sealedSlots.filter(s => s !== timer.slot);
                const skillName = SKILL_DB[gameState.skills[timer.slot]]?.name || "技能";
                addLog("🔓 「" + skillName + "」的封印解除了！", "log-info");
            });
            gameState.sealTimers = gameState.sealTimers.filter(t => t.turnsLeft > 0);
        }
        updateEffectsBar();
    });

    // Step 5: Check win/lose or next round
    steps.push(function() {
        if (battleEnded) return;
        if (parseInt(TV("player-hp")) <= 0) {
            gameOver(false);
            return;
        }
        if (checkEnemyDeath()) {
            battleWon();
            return;
        }

        // Next round: clear defense, unlock tokens, roll new intent, regen mana
        gameState.round++;
        gameState.enemyDefenseActive = 0;
        unlockAllTokens();
        regenMana();
        triggerRelics("on_turn_start"); // e.g. echo_stone mana cost reduction
        rollEnemyIntent();
        addLog("—— 第" + gameState.round + "回合 ——（法力+" + gameState.manaRegen + "→" + gameState.mana + "）", "log-info");
        syncDerivedTokens();
        render();

        gameState.turnInProgress = false;
        btn.disabled = false;
    });

    // Execute steps with delays
    var delay = 0;
    var STEP_DELAY = 600;
    steps.forEach(function(step) {
        setTimeout(step, delay);
        delay += STEP_DELAY;
    });
}

function battleWon() {
    showBanner("\ud83c\udf89 " + TV("enemy-name") + "被击败了！", "banner-victory");
    addLog("\ud83c\udf89 " + TV("enemy-name") + "被击败了！", "log-info");

    // Trigger relic passives on battle win
    triggerRelics("on_battle_win");

    generateSummary();

    var delay = 1500;
    // If map mode, show reward panel
    if (gameState.map) {
        setTimeout(function() {
            gameState.turnInProgress = false;
            document.getElementById("btn-end-turn").disabled = false;
            showRewardPanel();
        }, delay);
        return;
    }

    // Legacy linear mode fallback
    if (gameState.battleNumber >= gameState.totalBattles) {
        setTimeout(function() { gameOver(true); }, delay);
        return;
    }

    setTimeout(function() {
        gameState.turnInProgress = false;
        document.getElementById("btn-end-turn").disabled = false;
        showRewardPanel();
    }, delay);
}

// =============================================================
// REWARD PANEL SYSTEM (P0-1)
// =============================================================

// Gold drop by difficulty
function rollGoldDrop(difficulty) {
    if (difficulty === "boss") return 40 + Math.floor(Math.random() * 21);
    if (difficulty === "elite") return 20 + Math.floor(Math.random() * 11);
    return 8 + Math.floor(Math.random() * 5);
}

// Ink reward by difficulty
function getInkReward(difficulty) {
    if (difficulty === "boss") return 2;
    return 1;
}

function showRewardPanel() {
    var diff = gameState.lastBattleDifficulty || "normal";
    var goldDropped = rollGoldDrop(diff);
    var inkReward = getInkReward(diff);
    var enemyData = gameState.currentEnemyData;

    // Apply gold + ink
    gameState.gold += goldDropped;
    var sc = T("swap-count");
    sc.value = String(parseInt(sc.value) + inkReward);

    // Show overlay
    var overlay = document.getElementById("reward-overlay");
    overlay.style.display = "flex";

    var basicEl = document.getElementById("reward-basic");
    basicEl.innerHTML = '<span class="reward-gold">💰 金币 +' + goldDropped + '</span>（当前: ' + gameState.gold + '）<br>'
        + '<span class="reward-ink">✒️ 笔力 +' + inkReward + '</span>（当前: ' + TV("swap-count") + '）<br>'
        + '✦ 法力已回满（' + gameState.maxMana + '/' + gameState.maxMana + '）';

    var choicesEl = document.getElementById("reward-choices");
    choicesEl.innerHTML = "";
    var continueBtn = document.getElementById("reward-continue");
    continueBtn.style.display = "none";

    gameState._rewardChosen = false;

    if (diff === "boss") {
        showBossRewardChoices(choicesEl);
    } else if (diff === "elite") {
        showEliteRewardChoices(choicesEl);
    } else {
        showNormalRewardChoices(choicesEl, enemyData);
    }

    render();
}

// --- Normal battle: loot token + skip option ---
function showNormalRewardChoices(container, enemyData) {
    var loot = enemyData && enemyData.lootToken ? enemyData.lootToken : { type: "adjective", value: "生锈的" };

    // Card 1: Take the loot token
    var card1 = document.createElement("div");
    card1.className = "reward-card card-token";
    card1.innerHTML = '<span class="card-icon">📜</span>'
        + '<span class="card-name">「' + loot.value + '」</span>'
        + '<span class="card-type">' + (loot.type === "adjective" ? "形容词" : "名词") + '</span>'
        + '<span class="card-desc">加入词块库</span>';
    card1.addEventListener("click", function() {
        if (gameState._rewardChosen) return;
        gameState._rewardChosen = true;
        addToInventory(loot.type, loot.value);
        addLog('收取战利品：「' + loot.value + '」加入词块库', "log-info");
        document.getElementById("reward-continue").style.display = "inline-block";
        container.querySelectorAll(".reward-card").forEach(function(c) { c.style.opacity = "0.4"; });
        card1.style.opacity = "1";
        card1.style.borderColor = "#f0c040";
    });
    container.appendChild(card1);

    // Card 2: Skip for +1 ink
    var card2 = document.createElement("div");
    card2.className = "reward-card card-skip";
    card2.innerHTML = '<span class="card-icon">✒️</span>'
        + '<span class="card-name">不要词块</span>'
        + '<span class="card-desc">换成 +1 笔力</span>';
    card2.addEventListener("click", function() {
        if (gameState._rewardChosen) return;
        gameState._rewardChosen = true;
        var sc = T("swap-count");
        sc.value = String(parseInt(sc.value) + 1);
        addLog("放弃了战利品词块，换成 +1 笔力", "log-info");
        document.getElementById("reward-continue").style.display = "inline-block";
        container.querySelectorAll(".reward-card").forEach(function(c) { c.style.opacity = "0.4"; });
        card2.style.opacity = "1";
        card2.style.borderColor = "#f0c040";
    });
    container.appendChild(card2);
}

// --- Elite battle: 3 skill choices ---
function showEliteRewardChoices(container) {
    var layer = Math.max(0, gameState.currentLayer - 1);
    var basicPool = ["slash", "block", "flame_slash", "intimidate", "stone_skin"];
    var expandedPool = basicPool.concat(["thunder_strike", "counter_stance", "expose_weakness", "unlock"]);

    var pool;
    if (layer <= 2) pool = basicPool;
    else if (layer <= 7) pool = expandedPool;
    else pool = expandedPool;

    var available = pool.filter(function(sid) { return !gameState.skills.includes(sid); });
    for (var i = available.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = available[i]; available[i] = available[j]; available[j] = tmp;
    }
    var picks = available.slice(0, Math.min(3, available.length));

    if (picks.length < 3) {
        var fallback = pool.slice();
        for (var fi = fallback.length - 1; fi > 0; fi--) {
            var fj = Math.floor(Math.random() * (fi + 1));
            var ftmp = fallback[fi]; fallback[fi] = fallback[fj]; fallback[fj] = ftmp;
        }
        picks = fallback.slice(0, 3);
    }

    picks.forEach(function(skillId) {
        var skill = SKILL_DB[skillId];
        var catClass = "card-skill-" + skill.category;
        var icons = { offense: "⚔️", defense: "🛡️", control: "🔮" };
        var labels = { offense: "输出", defense: "防御", control: "操控" };
        var card = document.createElement("div");
        card.className = "reward-card " + catClass;
        card.innerHTML = '<span class="card-icon">' + (icons[skill.category] || "📖") + '</span>'
            + '<span class="card-name">' + skill.name + '</span>'
            + '<span class="card-type">✦' + skill.manaCost + ' ' + (labels[skill.category] || "") + '</span>'
            + '<span class="card-desc">' + skill.description + '</span>';
        card.addEventListener("click", function() {
            if (gameState._rewardChosen) return;
            gameState._rewardChosen = true;
            addSkillToPlayer(skillId);
            document.getElementById("reward-continue").style.display = "inline-block";
            container.querySelectorAll(".reward-card").forEach(function(c) { c.style.opacity = "0.4"; });
            card.style.opacity = "1";
            card.style.borderColor = "#f0c040";
        });
        container.appendChild(card);
    });
}

// --- Boss battle: 3 legendary relic choices ---
function showBossRewardChoices(container) {
    var legendaryPool = RELIC_POOL.legendary.filter(function(id) { return !gameState.relics.includes(id); });

    for (var i = legendaryPool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = legendaryPool[i]; legendaryPool[i] = legendaryPool[j]; legendaryPool[j] = tmp;
    }
    var picks = legendaryPool.slice(0, Math.min(3, legendaryPool.length));

    if (picks.length < 3) {
        var rarePool = RELIC_POOL.rare.filter(function(id) { return !gameState.relics.includes(id); });
        for (var ri = rarePool.length - 1; ri > 0; ri--) {
            var rj = Math.floor(Math.random() * (ri + 1));
            var rtmp = rarePool[ri]; rarePool[ri] = rarePool[rj]; rarePool[rj] = rtmp;
        }
        while (picks.length < 3 && rarePool.length > 0) {
            picks.push(rarePool.shift());
        }
    }

    picks.forEach(function(relicId) {
        var relic = RELIC_DB[relicId];
        var card = document.createElement("div");
        card.className = "reward-card card-relic";
        card.innerHTML = '<span class="card-icon">' + relic.icon + '</span>'
            + '<span class="card-name">' + relic.name + '</span>'
            + '<span class="card-type">' + RELIC_RARITY[relic.rarity] + '</span>'
            + '<span class="card-desc">' + relic.description + '</span>';
        card.addEventListener("click", function() {
            if (gameState._rewardChosen) return;
            gameState._rewardChosen = true;
            acquireRelic(relicId);
            document.getElementById("reward-continue").style.display = "inline-block";
            container.querySelectorAll(".reward-card").forEach(function(c) { c.style.opacity = "0.4"; });
            card.style.opacity = "1";
            card.style.borderColor = "#f0c040";
        });
        container.appendChild(card);
    });
}

// Add a skill to player
function addSkillToPlayer(skillId) {
    if (gameState.skills.length < 4) {
        gameState.skills.push(skillId);
        addLog("学会新技能：「" + SKILL_DB[skillId].name + "」！", "log-combo");
        showBanner("📖 " + SKILL_DB[skillId].name + "！", "banner-combo");
    } else {
        var oldSkill = gameState.skills[0];
        gameState.skills[0] = skillId;
        addLog("技能槽满，「" + SKILL_DB[oldSkill].name + "」被替换为「" + SKILL_DB[skillId].name + "」", "log-combo");
        showBanner("🔄 " + SKILL_DB[skillId].name + "！", "banner-combo");
    }
    renderSkillArea();
}

function completeReward() {
    if (!gameState._rewardChosen) return;
    document.getElementById("reward-overlay").style.display = "none";
    gameState._rewardChosen = false;

    if (gameState.map) {
        if (gameState.currentLayer >= gameState.map.length) {
            gameOver(true);
        } else {
            gameState.phase = "map";
            render();
            setTimeout(function() { showMap(); }, 400);
        }
    } else {
        gameState.phase = "battle";
        startNextBattle();
    }
}

function startNextBattle() {
    gameState.battleNumber++;
    gameState.round = 1;
    gameState.fieldEffect = null;
    gameState.enemyFrozen = false;
    gameState.enemyDefenseActive = 0;
    gameState.playerDefense = 0;
    gameState.skillBurn = 0;
    gameState.skillDefenseCarry = 0;
    gameState.counterAttack = 0;
    gameState.enemyVulnerable = 0;
    gameState.sealedSlots = [];
    unlockAllTokens();
    gameState.lockedTokens = [];

    const enemy = ENEMIES[gameState.battleNumber - 1] || ENEMIES[0];
    gameState.enemyBaseDamage = enemy.baseDamage;

    // Update tokens
    T("enemy-hp").value = String(enemy.hp);
    setToken("enemy-name", "subject", enemy.name, "battle");
    setToken("enemy-weapon-adj", "adjective", enemy.weaponAdj, "battle");
    setToken("enemy-weapon-noun", "noun", enemy.weaponNoun, "battle");
    setToken("enemy-damage", "number", calculateEnemyDamage(), "battle");

    const env = ENVIRONMENTS[Math.floor(Math.random() * ENVIRONMENTS.length)];
    T("env-adj").value = env.adj;
    T("env-noun").value = env.noun;

    addLog(`\n═══ 第${gameState.battleNumber}场战斗：${enemy.name}出现了！ ═══`, "log-info");
    addLog(`—— 第1回合 ——`, "log-info");

    // Roll intent for new enemy
    rollEnemyIntent();

    render();
}

function generateSummary() {
    // Remove old summary tokens
    removeTokensByZone("summary");

    const playerAdj = TV("player-weapon-adj");
    const enemyName = TV("enemy-name");
    const remainHp = Math.max(0, parseInt(TV("player-hp")));
    const envAdj = TV("env-adj");
    const envNoun = TV("env-noun");

    if (Math.random() > 0.5) {
        gameState.summaryTemplate = "A";
        setToken("summary-adj", "adjective", playerAdj, "summary");
        setToken("summary-subject", "subject", enemyName, "summary");
        setToken("summary-number", "number", remainHp, "summary");
    } else {
        gameState.summaryTemplate = "B";
        setToken("summary-subject", "subject", enemyName, "summary");
        setToken("summary-adj", "adjective", envAdj, "summary");
        setToken("summary-noun", "noun", envNoun, "summary");
        setToken("summary-number", "number", remainHp, "summary");
    }
}

function gameOver(won) {
    var overlay = document.getElementById("game-over");
    var title = document.getElementById("game-over-title");
    var text = document.getElementById("game-over-text");

    var layer = gameState.currentLayer || 0;
    var hp = TV("player-hp");
    var ink = TV("swap-count");
    var relics = gameState.relics.length;
    var skills = gameState.skills.length;
    var inventory = gameState.inventory.length;
    var gold = gameState.gold;
    var pressure = gameState.pressure;

    if (won) {
        title.textContent = "胜利！";
        text.innerHTML = "你击败了 Boss，完成了这场冒险！<br><br>"
            + "到达层数：第 " + Math.min(layer, 13) + " 层<br>"
            + "剩余生命：❤️ " + hp + "<br>"
            + "剩余笔力：✒️ " + ink + "<br>"
            + "持有金币：💰 " + gold + "<br>"
            + "收集遗物：" + relics + " 件<br>"
            + "词块库：" + inventory + " 个词块<br>"
            + "最终墨渍：" + pressure + "/20";
        showBanner("🎉 胜利！", "banner-victory");
    } else {
        title.textContent = "战败…";
        text.innerHTML = "你在冒险中倒下了。<br><br>"
            + "到达层数：第 " + Math.max(1, layer) + " 层<br>"
            + "剩余生命：❤️ " + hp + "<br>"
            + "剩余笔力：✒️ " + ink + "<br>"
            + "持有金币：💰 " + gold + "<br>"
            + "拥有技能：" + skills + " 个<br>"
            + "收集遗物：" + relics + " 件<br>"
            + "词块库：" + inventory + " 个词块";
        showBanner("💀 战败…", "banner-defeat");
    }

    setTimeout(function() {
        overlay.style.display = "flex";
        requestAnimationFrame(function() { overlay.classList.add("visible"); });
    }, 800);
}

function addLog(message, className) {
    const log = document.getElementById("battle-log");
    const entry = document.createElement("div");
    entry.className = "log-entry " + (className || "");
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

// =============================================================
// GAME INIT
// =============================================================

function startGame() {
    var goOverlay = document.getElementById("game-over");
    goOverlay.classList.remove("visible");
    goOverlay.style.display = "none";
    document.getElementById("battle-log").innerHTML = "";
    document.getElementById("effects-bar").innerHTML = "";
    document.getElementById("banner-overlay").innerHTML = "";
    document.getElementById("btn-end-turn").disabled = false;
    document.getElementById("game-container").style.filter = "";
    document.getElementById("map-overlay").style.display = "none";
    document.getElementById("event-overlay").style.display = "none";

    const env = ENVIRONMENTS[Math.floor(Math.random() * ENVIRONMENTS.length)];
    const rules = DIFFICULTY_RULES[1]; // Start at difficulty 1

    // Reset game state
    gameState = {
        difficulty: 1,
        phase: "map",
        round: 1,
        battleNumber: 0,
        totalBattles: 4,  // 3 layers + boss
        playerBaseDamage: 6,
        enemyBaseDamage: 5,
        fieldEffect: null,
        enemyFrozen: false,
        bonusDamage: 0,
        summaryTemplate: null,
        // rewardBonusSwap removed (P0 reward refactor)
        turnInProgress: false,
        enemyIntent: null,
        enemyDefenseActive: 0,
        lockedTokens: [],
        pressure: 0,
        noiseTokens: [],
        corruptedTokens: [],
        permanentlyLocked: [],
        map: generateMap(),
        currentLayer: 0,
        lastVisitedNode: null,  // { layer, index } for branched map navigation
        currentEvent: null,
        currentEnemyData: null,
        // Skill system
        skills: [...INITIAL_SKILLS],
        mana: MANA_CONFIG.startMana,
        maxMana: MANA_CONFIG.maxMana,
        manaRegen: MANA_CONFIG.regenPerTurn,
        playerDefense: 0,
        skillBurn: 0,
        skillDefenseCarry: 0,
        counterAttack: 0,
        enemyVulnerable: 0,
        sealedSlots: [],
        sealTimers: [],
        poisonStacks: 0,
        manaCostReduction: 0,
        _intentHandled: false,
        // Relic system
        relics: [],
        maxHp: 30,
        manaCostReduction: 0,
        extraLootChoices: 0,
        // Two-mode system
        mode: "swap",
        inventory: [],
        selectedInventoryToken: null,
        emptySlots: [],
        gold: 0,
    };

    // Reset mode UI
    document.body.classList.remove("mode-swap", "mode-insert", "mode-delete");
    document.body.classList.add("mode-swap");
    document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));
    const invCountEl = document.getElementById("inv-count");
    if (invCountEl) invCountEl.textContent = "0";

    // Build the entire token pool from scratch
    tokenPool = {};

    // Status zone
    setToken("player-hp", "number", 30, "status");
    setToken("player-weapon-adj", "adjective", "锋利的", "status");
    setToken("enemy-hp", "number", 0, "status");
    setToken("swap-count", "number", 5, "status", rules.swapCountSwappable);

    // Environment zone
    setToken("env-adj", "adjective", env.adj, "env");
    setToken("env-noun", "noun", env.noun, "env");

    // Battle zone (will be populated when battle starts)
    setToken("enemy-name", "subject", "???", "battle");
    setToken("player-name", "subject", "你", "battle");
    setToken("enemy-weapon-adj", "adjective", "未知的", "battle");
    setToken("enemy-weapon-noun", "noun", "武器", "battle");
    setToken("enemy-damage", "number", 0, "battle");

    addLog("═══ 新的冒险开始了！ ═══", "log-info");
    addLog("提示：选择地图上的节点开始探索", "log-info");

    render();

    // Show map immediately
    setTimeout(() => showMap(), 300);
}

// =============================================================
// START
// =============================================================
startGame();
