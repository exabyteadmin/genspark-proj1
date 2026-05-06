// ===== ゲーム状態管理エンジン =====
import { CLANS, GENERALS, PROVINCES, HISTORICAL_EVENTS } from '../data/gameData.js';

export class GameState {
  constructor() {
    this.year = 1560;
    this.month = 1;
    this.season = '春';
    this.turn = 1;
    this.phase = 'main'; // main, battle, diplomacy, event
    this.playerClan = null;
    this.selectedProvince = null;
    this.selectedGeneral = null;
    this.log = [];
    this.events = [];
    this.gameOver = false;
    this.winner = null;

    // Deep copy game data
    this.clans = JSON.parse(JSON.stringify(CLANS));
    this.generals = JSON.parse(JSON.stringify(GENERALS));
    this.provinces = JSON.parse(JSON.stringify(PROVINCES));

    this.initDiplomacy();
  }

  initDiplomacy() {
    const clanIds = Object.keys(this.clans);
    clanIds.forEach(a => {
      this.clans[a].diplomacy = {};
      clanIds.forEach(b => {
        if (a !== b) {
          this.clans[a].diplomacy[b] = {
            relation: this._defaultRelation(a, b),
            alliance: false,
            war: false,
            truce: false,
            truceTurns: 0,
          };
        }
      });
    });

    // 史実に基づく初期関係
    this._setRelation('oda', 'tokugawa', 60, true, false);
    this._setRelation('oda', 'imagawa', -80, false, true);
    this._setRelation('takeda', 'uesugi', -60, false, false);
    this._setRelation('takeda', 'hojo', -30, false, false);
    this._setRelation('uesugi', 'hojo', -40, false, false);
    this._setRelation('tokugawa', 'imagawa', -70, false, true);
  }

  _defaultRelation(a, b) {
    const defaults = { oda: { takeda: -20, uesugi: 10, hojo: -10, mori: -20, shimazu: 0, imagawa: -80, tokugawa: 60 } };
    return (defaults[a] && defaults[a][b]) || 0;
  }

  _setRelation(a, b, rel, alliance, war) {
    if (this.clans[a] && this.clans[b]) {
      this.clans[a].diplomacy[b] = { relation: rel, alliance, war, truce: false, truceTurns: 0 };
      this.clans[b].diplomacy[a] = { relation: rel, alliance, war, truce: false, truceTurns: 0 };
    }
  }

  startGame(clanId) {
    this.playerClan = clanId;
    this.addLog(`${this.clans[clanId].name}にて天下統一の戦いが始まった！`, 'event');
    this.addLog(`西暦${this.year}年${this.month}月 — 戦国の世、乱れに乱れている…`, 'info');
    return this;
  }

  // ターン進行
  nextTurn() {
    this.month += 3;
    if (this.month > 12) {
      this.month = 1;
      this.year++;
    }
    this.turn++;
    this.season = this._getSeason(this.month);

    // 収入処理
    this._processIncome();
    // AI行動
    this._processAI();
    // イベント
    this._checkEvents();
    // 休戦ターン更新
    this._updateTruces();
    // 勝利判定
    this._checkVictory();

    this.addLog(`━━━ ${this.year}年${this.month}月（${this.season}） ターン${this.turn} ━━━`, 'turn');
    return this;
  }

  _getSeason(month) {
    if (month <= 3) return '春';
    if (month <= 6) return '夏';
    if (month <= 9) return '秋';
    return '冬';
  }

  _processIncome() {
    Object.values(this.clans).forEach(clan => {
      const ownedProvinces = Object.values(this.provinces).filter(p => p.owner === clan.id);
      let goldIncome = 0;
      let foodIncome = 0;
      ownedProvinces.forEach(p => {
        goldIncome += Math.floor(p.income * (p.development / 100));
        foodIncome += Math.floor(p.population * 0.5 * (p.development / 100));
      });
      // 兵士維持費
      const upkeep = Math.floor(clan.troops / 100);
      clan.gold = Math.max(0, clan.gold + goldIncome - upkeep);
      clan.food = Math.max(0, clan.food + foodIncome);

      // 兵士補充（資源があれば）
      if (clan.gold > 100 && clan.food > 50) {
        const maxTroops = ownedProvinces.reduce((s, p) => s + p.population * 200, 0);
        if (clan.troops < maxTroops) {
          const recruit = Math.min(500, Math.floor(clan.gold * 0.1));
          clan.troops = Math.min(maxTroops, clan.troops + recruit);
          clan.gold -= Math.floor(recruit * 0.5);
          clan.food -= Math.floor(recruit * 0.2);
        }
      }
    });
  }

  _processAI() {
    Object.keys(this.clans).forEach(clanId => {
      if (clanId === this.playerClan) return;
      const clan = this.clans[clanId];
      const ownedProvinces = Object.values(this.provinces).filter(p => p.owner === clanId);
      if (ownedProvinces.length === 0) return;

      // AIの行動決定（シンプルな優先度）
      const r = Math.random();
      if (r < 0.3 && clan.troops > 3000) {
        this._aiAttack(clanId);
      } else if (r < 0.5) {
        this._aiDevelop(clanId);
      } else if (r < 0.6) {
        this._aiDiplomacy(clanId);
      }
    });
  }

  _aiAttack(attackerId) {
    const attacker = this.clans[attackerId];
    const ownedProvinces = Object.values(this.provinces).filter(p => p.owner === attackerId);

    // 隣接する敵領地を探す
    let targets = [];
    ownedProvinces.forEach(prov => {
      prov.neighbors.forEach(neighborId => {
        const neighbor = this.provinces[neighborId];
        if (!neighbor) return;
        if (neighbor.owner !== attackerId && !this._isAllied(attackerId, neighbor.owner)) {
          targets.push({ province: neighbor, from: prov });
        }
      });
    });

    if (targets.length === 0) return;
    // ランダムに目標選択
    const target = targets[Math.floor(Math.random() * targets.length)];
    const defenderClanId = target.province.owner;

    // 戦闘力計算
    const attackPower = Math.min(attacker.troops * 0.4, 5000) + Math.random() * 1000;
    const defPower = defenderClanId
      ? Math.min(this.clans[defenderClanId].troops * 0.3, 3000) + target.province.defense * 20 + Math.random() * 500
      : target.province.defense * 30;

    if (attackPower > defPower) {
      // 攻撃側勝利
      const troopLoss = Math.floor(attackPower * 0.15);
      attacker.troops = Math.max(0, attacker.troops - troopLoss);
      if (defenderClanId) {
        const defLoss = Math.floor(defPower * 0.3);
        this.clans[defenderClanId].troops = Math.max(0, this.clans[defenderClanId].troops - defLoss);
        this._setWarRelation(attackerId, defenderClanId);
      }
      target.province.owner = attackerId;
      const attackerName = attacker.name;
      const provinceName = target.province.name;
      this.addLog(`⚔️ ${attackerName}が${provinceName}を攻略！`, 'battle');
    } else {
      // 防衛側勝利
      const troopLoss = Math.floor(attackPower * 0.2);
      attacker.troops = Math.max(0, attacker.troops - troopLoss);
      if (defenderClanId) {
        this._setWarRelation(attackerId, defenderClanId);
      }
    }
  }

  _aiDevelop(clanId) {
    const clan = this.clans[clanId];
    if (clan.gold < 100) return;
    const ownedProvinces = Object.values(this.provinces).filter(p => p.owner === clanId);
    if (ownedProvinces.length === 0) return;
    const prov = ownedProvinces[Math.floor(Math.random() * ownedProvinces.length)];
    if (prov.development < 100) {
      prov.development = Math.min(100, prov.development + 5);
      clan.gold -= 80;
    }
  }

  _aiDiplomacy(clanId) {
    // 敵意が低い相手に同盟提案
    const clan = this.clans[clanId];
    const candidates = Object.keys(clan.diplomacy).filter(otherId => {
      const rel = clan.diplomacy[otherId];
      return !rel.alliance && !rel.war && rel.relation > 20 && this.clans[otherId];
    });
    if (candidates.length === 0) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    if (Math.random() < 0.3) {
      clan.diplomacy[target].alliance = true;
      this.clans[target].diplomacy[clanId].alliance = true;
      this.addLog(`🤝 ${clan.name}と${this.clans[target].name}が同盟を締結`, 'diplomacy');
    }
  }

  _setWarRelation(a, b) {
    if (!this.clans[a] || !this.clans[b]) return;
    this.clans[a].diplomacy[b].war = true;
    this.clans[a].diplomacy[b].alliance = false;
    this.clans[b].diplomacy[a].war = true;
    this.clans[b].diplomacy[a].alliance = false;
  }

  _isAllied(a, b) {
    if (!b) return false;
    return this.clans[a]?.diplomacy[b]?.alliance || false;
  }

  _updateTruces() {
    Object.values(this.clans).forEach(clan => {
      Object.values(clan.diplomacy).forEach(rel => {
        if (rel.truce && rel.truceTurns > 0) {
          rel.truceTurns--;
          if (rel.truceTurns === 0) rel.truce = false;
        }
      });
    });
  }

  _checkEvents() {
    const triggered = HISTORICAL_EVENTS.filter(e =>
      e.year === this.year && Math.ceil(this.month / 3) === Math.ceil(e.month / 3)
    );
    triggered.forEach(event => {
      this.addLog(`📜 歴史的事件：${event.name} — ${event.description}`, 'event');
      this.events.push(event);
    });
  }

  _checkVictory() {
    // 天下統一チェック（全国の80%以上を支配）
    const totalProvinces = Object.keys(this.provinces).length;
    Object.keys(this.clans).forEach(clanId => {
      const owned = Object.values(this.provinces).filter(p => p.owner === clanId).length;
      if (owned >= totalProvinces * 0.8) {
        this.gameOver = true;
        this.winner = clanId;
        this.addLog(`🎉 ${this.clans[clanId].name}が天下統一を成し遂げた！`, 'victory');
      }
    });

    // プレイヤーが全領地を失った場合
    if (this.playerClan) {
      const playerOwned = Object.values(this.provinces).filter(p => p.owner === this.playerClan).length;
      if (playerOwned === 0 && !this.gameOver) {
        this.gameOver = true;
        this.addLog(`💀 ${this.clans[this.playerClan].name}は滅亡しました…`, 'defeat');
      }
    }
  }

  // プレイヤー行動：領地開発
  developProvince(provinceId, type) {
    const province = this.provinces[provinceId];
    const clan = this.clans[this.playerClan];
    if (!province || province.owner !== this.playerClan) return { success: false, msg: 'この領地は支配下にありません' };

    const costs = { agriculture: { gold: 100, food: 0, effect: '農業開発', stat: 'population', val: 2 },
                    commerce: { gold: 150, food: 0, effect: '商業開発', stat: 'income', val: 3 },
                    defense: { gold: 200, food: 50, effect: '城強化', stat: 'defense', val: 5 },
                    development: { gold: 80, food: 20, effect: '町開発', stat: 'development', val: 8 } };
    const action = costs[type];
    if (!action) return { success: false, msg: '不明な開発種別です' };
    if (clan.gold < action.gold || clan.food < action.food) return { success: false, msg: '資源が不足しています' };

    clan.gold -= action.gold;
    clan.food -= action.food;
    province[action.stat] = Math.min(100, (province[action.stat] || 0) + action.val);
    this.addLog(`🏗️ ${province.name}で${action.effect}を実施`, 'action');
    return { success: true, msg: `${province.name}の${action.effect}が完了しました` };
  }

  // プレイヤー行動：出兵
  attack(fromId, toId, troops) {
    const from = this.provinces[fromId];
    const to = this.provinces[toId];
    const clan = this.clans[this.playerClan];

    if (!from || from.owner !== this.playerClan) return { success: false, msg: '出撃元が無効です' };
    if (!to) return { success: false, msg: '目標が無効です' };
    if (!from.neighbors.includes(toId)) return { success: false, msg: '隣接していない領地です' };
    if (to.owner === this.playerClan) return { success: false, msg: 'すでに支配下の領地です' };
    if (troops > clan.troops) return { success: false, msg: '兵力が足りません' };
    if (troops < 100) return { success: false, msg: '最低100の兵力が必要です' };

    const defenderClanId = to.owner;
    const defClan = defenderClanId ? this.clans[defenderClanId] : null;

    // 戦闘計算
    const result = this._resolveBattle(this.playerClan, defenderClanId, troops, to);

    clan.troops -= result.attackerLoss;
    if (defClan) defClan.troops = Math.max(0, defClan.troops - result.defenderLoss);

    if (result.victory) {
      to.owner = this.playerClan;
      if (defenderClanId) this._setWarRelation(this.playerClan, defenderClanId);
      this.addLog(`⚔️ ${from.name}から${to.name}への攻撃 → 勝利！(損害: ${result.attackerLoss})`, 'battle');
      return { success: true, victory: true, result, msg: `${to.name}を制圧しました！` };
    } else {
      if (defenderClanId) this._setWarRelation(this.playerClan, defenderClanId);
      this.addLog(`⚔️ ${from.name}から${to.name}への攻撃 → 敗退…(損害: ${result.attackerLoss})`, 'battle');
      return { success: true, victory: false, result, msg: `${to.name}の攻略に失敗しました` };
    }
  }

  _resolveBattle(attackerId, defenderId, attackTroops, province) {
    const attacker = this.clans[attackerId];
    const atkGenerals = this._getGeneralsForClan(attackerId);
    const defGenerals = defenderId ? this._getGeneralsForClan(defenderId) : [];

    const atkBonus = atkGenerals.reduce((s, g) => s + g.stats.military * 0.01, 1);
    const defBonus = defGenerals.reduce((s, g) => s + g.stats.military * 0.01, 1) + (province.defense * 0.005);

    const atkPower = attackTroops * atkBonus * (0.8 + Math.random() * 0.4);
    const defTroops = defenderId ? Math.min(this.clans[defenderId].troops * 0.5, attackTroops * 1.2) : 0;
    const defPower = (defTroops * defBonus + province.defense * 50) * (0.8 + Math.random() * 0.4);

    const victory = atkPower > defPower;
    return {
      victory,
      attackerLoss: Math.floor(attackTroops * (victory ? 0.15 : 0.25) * Math.random() + attackTroops * 0.05),
      defenderLoss: Math.floor(defTroops * (victory ? 0.35 : 0.15)),
      atkPower: Math.floor(atkPower),
      defPower: Math.floor(defPower),
    };
  }

  _getGeneralsForClan(clanId) {
    return Object.values(this.generals).filter(g => g.clan === clanId);
  }

  // 外交：同盟提案
  proposeDiplomacy(targetClanId, action) {
    const myClan = this.clans[this.playerClan];
    const target = this.clans[targetClanId];
    if (!target) return { success: false, msg: '対象勢力が存在しません' };

    const rel = myClan.diplomacy[targetClanId];

    if (action === 'alliance') {
      if (rel.alliance) return { success: false, msg: 'すでに同盟関係です' };
      if (rel.war) return { success: false, msg: '交戦中は同盟できません' };
      const chance = Math.min(0.9, Math.max(0.1, (rel.relation + 100) / 200));
      if (Math.random() < chance) {
        rel.alliance = true;
        target.diplomacy[this.playerClan].alliance = true;
        rel.relation = Math.min(100, rel.relation + 20);
        target.diplomacy[this.playerClan].relation = rel.relation;
        this.addLog(`🤝 ${target.name}との同盟が成立！`, 'diplomacy');
        return { success: true, msg: `${target.name}との同盟が成立しました！` };
      } else {
        rel.relation = Math.max(-100, rel.relation - 5);
        target.diplomacy[this.playerClan].relation = rel.relation;
        this.addLog(`❌ ${target.name}は同盟の申し出を断った`, 'diplomacy');
        return { success: false, msg: `${target.name}は同盟の申し出を断りました` };
      }
    }

    if (action === 'truce') {
      if (rel.truce) return { success: false, msg: 'すでに休戦中です' };
      const chance = Math.min(0.85, Math.max(0.15, (rel.relation + 80) / 200));
      if (Math.random() < chance) {
        rel.war = false; rel.truce = true; rel.truceTurns = 4;
        target.diplomacy[this.playerClan].war = false;
        target.diplomacy[this.playerClan].truce = true;
        target.diplomacy[this.playerClan].truceTurns = 4;
        this.addLog(`🕊️ ${target.name}と休戦が成立（4ターン）`, 'diplomacy');
        return { success: true, msg: `${target.name}との休戦が成立しました（4ターン）` };
      } else {
        return { success: false, msg: `${target.name}は休戦を拒否しました` };
      }
    }

    if (action === 'gift') {
      const giftGold = 100;
      if (myClan.gold < giftGold) return { success: false, msg: '資源が不足しています' };
      myClan.gold -= giftGold;
      rel.relation = Math.min(100, rel.relation + 15);
      target.diplomacy[this.playerClan].relation = rel.relation;
      this.addLog(`🎁 ${target.name}に贈り物を送り、関係が改善（+15）`, 'diplomacy');
      return { success: true, msg: `${target.name}との関係が改善されました` };
    }

    if (action === 'breakAlliance') {
      rel.alliance = false;
      target.diplomacy[this.playerClan].alliance = false;
      rel.relation = Math.max(-100, rel.relation - 30);
      target.diplomacy[this.playerClan].relation = rel.relation;
      this.addLog(`💔 ${target.name}との同盟を破棄`, 'diplomacy');
      return { success: true, msg: `${target.name}との同盟を解消しました` };
    }

    return { success: false, msg: '不明な外交行動です' };
  }

  // 武将登用
  recruitGeneral(generalId) {
    const general = this.generals[generalId];
    const clan = this.clans[this.playerClan];
    if (!general) return { success: false, msg: '武将が見つかりません' };
    if (general.clan === this.playerClan) return { success: false, msg: 'すでに家臣です' };
    if (general.clan && general.clan !== this.playerClan) return { success: false, msg: '他の勢力に仕えています（調略が必要）' };

    const cost = (general.stats.leadership + general.stats.military) * 5;
    if (clan.gold < cost) return { success: false, msg: `登用には金${cost}が必要です` };
    clan.gold -= cost;
    general.clan = this.playerClan;
    this.addLog(`👤 ${general.name}を召し抱えた！`, 'recruit');
    return { success: true, msg: `${general.name}が家臣となりました！` };
  }

  addLog(message, type = 'info') {
    this.log.unshift({ message, type, turn: this.turn, year: this.year, month: this.month });
    if (this.log.length > 100) this.log.pop();
  }

  getPlayerClan() { return this.clans[this.playerClan]; }
  getPlayerProvinces() { return Object.values(this.provinces).filter(p => p.owner === this.playerClan); }
  getPlayerGenerals() { return Object.values(this.generals).filter(g => g.clan === this.playerClan); }
  getClanProvinceCount(clanId) { return Object.values(this.provinces).filter(p => p.owner === clanId).length; }
  getTotalProvinceCount() { return Object.keys(this.provinces).length; }
}
