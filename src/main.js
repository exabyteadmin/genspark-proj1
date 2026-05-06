// ===== メインゲームコントローラー =====
import { GameState } from './engine/GameState.js';
import { MapRenderer } from './ui/MapRenderer.js';
import { CLANS, GENERALS, TECHNOLOGY_TREE, SKILLS } from './data/gameData.js';

let gs = null;
let renderer = null;
let selectedClan = null;
let attackMode = false;
let attackFromId = null;
let playerTechs = [];

// ======= 画面遷移 =======
window.showClanSelect = function() {
  showScreen('clanSelectScreen');
  renderClanGrid();
};

window.showHelp = function() {
  showModal('helpModal');
};

window.backToTitle = function() {
  gs = null; renderer = null; selectedClan = null;
  attackMode = false; attackFromId = null; playerTechs = [];
  showScreen('titleScreen');
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ======= 勢力選択 =======
function renderClanGrid() {
  const grid = document.getElementById('clanGrid');
  grid.innerHTML = '';
  const clanDescriptions = {
    oda: '尾張の小国から天下統一を目指す。革新的な戦術と鉄砲による近代的な軍を誇る。初心者にもおすすめ。',
    takeda: '騎馬軍団を率いる甲斐の雄。信玄・勘助などの名将が揃い、強力な軍事力を持つ。',
    uesugi: '義を重んじる越後の龍。謙信率いる最強の軍隊で天下に挑め。',
    hojo: '関東の覇者。堅固な小田原城と優れた民政で関東8カ国を目指せ。',
    mori: '謀略の名手・元就が率いる中国地方の雄。水軍と銀山の財力が武器。',
    tokugawa: '忍耐と計算で天下を狙う三河の武将。清洲同盟を活かして東海道を制せ。',
    imagawa: '最大の兵力を誇る東海道の雄。今川義元率いる大軍で一気に上洛を目指せ。上級者向け。',
    shimazu: '九州の最南端から北上する薩摩の雄。釣り野伏で敵を翻弄せよ。',
  };

  Object.values(CLANS).forEach(clan => {
    const lordGeneral = GENERALS[clan.lord];
    const card = document.createElement('div');
    card.className = 'clan-card';
    card.dataset.clanId = clan.id;
    card.innerHTML = `
      <div class="cc-header">
        <div class="cc-mon" style="background:${clan.color}22;border:2px solid ${clan.color};">
          ${lordGeneral?.portrait || '⚔️'}
        </div>
        <div>
          <div class="cc-name" style="color:${clan.color};">${clan.name}</div>
          <div class="cc-lord">主君：${lordGeneral?.name || '不明'}</div>
        </div>
      </div>
      <div class="cc-stats">
        <div class="cc-stat">
          <div class="cc-stat-val" style="color:${clan.color};">${(clan.troops/1000).toFixed(1)}k</div>
          <div class="cc-stat-lbl">兵力</div>
        </div>
        <div class="cc-stat">
          <div class="cc-stat-val" style="color:${clan.color};">${clan.gold}</div>
          <div class="cc-stat-lbl">金</div>
        </div>
        <div class="cc-stat">
          <div class="cc-stat-val" style="color:${clan.color};">${clan.regions.length}</div>
          <div class="cc-stat-lbl">領国数</div>
        </div>
      </div>
      <div class="cc-desc">${clanDescriptions[clan.id] || ''}</div>
    `;
    card.addEventListener('click', () => {
      document.querySelectorAll('.clan-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedClan = clan.id;
      const btn = document.getElementById('csStartBtn');
      btn.classList.add('visible');
      btn.textContent = `🏯 ${clan.name}で出陣！`;
    });
    grid.appendChild(card);
  });
}

// ======= ゲーム開始 =======
window.startGame = function() {
  if (!selectedClan) return;
  gs = new GameState();
  gs.startGame(selectedClan);
  playerTechs = [];
  showScreen('gameScreen');
  initGameUI();
};

function initGameUI() {
  // キャンバスセットアップ
  const canvas = document.getElementById('mapCanvas');
  const mapArea = canvas.parentElement;
  canvas.width = mapArea.clientWidth;
  canvas.height = mapArea.clientHeight;

  renderer = new MapRenderer(canvas, gs);
  renderer.onProvinceClick = onProvinceClick;
  renderer.onProvinceHover = onProvinceHover;

  // ツールチップ追従
  canvas.addEventListener('mousemove', e => {
    const tooltip = document.getElementById('provinceTooltip');
    if (tooltip.classList.contains('visible')) {
      const x = e.clientX + 15;
      const y = e.clientY - 10;
      tooltip.style.left = Math.min(x, window.innerWidth - 180) + 'px';
      tooltip.style.top = Math.min(y, window.innerHeight - 200) + 'px';
      tooltip.style.position = 'fixed';
    }
  });
  canvas.addEventListener('mouseleave', () => {
    document.getElementById('provinceTooltip').classList.remove('visible');
  });

  // リサイズ対応
  window.addEventListener('resize', () => {
    canvas.width = mapArea.clientWidth;
    canvas.height = mapArea.clientHeight;
    renderer.render();
  });

  updateAllUI();
  renderer.render();

  // オープニングトースト
  setTimeout(() => {
    showToast(`⚔️ ${gs.clans[gs.playerClan].name}で戦国の世に挑む！`, 'event');
  }, 500);
}

// ======= 領地クリック =======
function onProvinceClick(provinceId) {
  if (!provinceId) return;
  const prov = gs.provinces[provinceId];
  if (!prov) return;

  if (attackMode && attackFromId) {
    // 攻撃対象を選択
    if (prov.owner !== gs.playerClan) {
      const from = gs.provinces[attackFromId];
      if (!from?.neighbors.includes(provinceId)) {
        showToast('隣接していない領地です', 'error');
        return;
      }
      executeAttack(attackFromId, provinceId);
    } else {
      cancelAttackMode();
    }
    return;
  }

  gs.selectedProvince = provinceId;
  renderer.setSelectedProvince(provinceId);
  switchTab('province');
  renderProvincePanel(provinceId);
}

function onProvinceHover(provinceId) {
  const tooltip = document.getElementById('provinceTooltip');
  if (!provinceId) { tooltip.classList.remove('visible'); return; }
  const prov = gs.provinces[provinceId];
  if (!prov) { tooltip.classList.remove('visible'); return; }
  const owner = prov.owner ? gs.clans[prov.owner]?.name || '中立' : '空白地';
  const color = renderer.getClanColor(prov.owner);
  tooltip.innerHTML = `
    <div class="pt-name">${prov.name}（${prov.castle}）</div>
    <div class="pt-row"><span class="pt-lbl">支配</span><span class="pt-val" style="color:${color};">${owner}</span></div>
    <div class="pt-row"><span class="pt-lbl">人口</span><span class="pt-val">${prov.population}万</span></div>
    <div class="pt-row"><span class="pt-lbl">収入</span><span class="pt-val">金${prov.income}</span></div>
    <div class="pt-row"><span class="pt-lbl">発展度</span><span class="pt-val">${prov.development}%</span></div>
    <div class="pt-row"><span class="pt-lbl">防御力</span><span class="pt-val">${prov.defense}</span></div>
    <div class="pt-row"><span class="pt-lbl">特産</span><span class="pt-val">${prov.speciality}</span></div>
  `;
  tooltip.classList.add('visible');
  const canvas = document.getElementById('mapCanvas');
  const rect = canvas.getBoundingClientRect();
  // マウス位置に追従させるため mousemove で動かす
}

// mapCanvas mousemove は initGameUI() 内で登録するため、ここでは設定しない

// ======= 領地パネル描画 =======
function renderProvincePanel(provinceId) {
  const prov = gs.provinces[provinceId];
  if (!prov) return;
  const panel = document.getElementById('provincePanel');
  const isPlayer = prov.owner === gs.playerClan;
  const ownerClan = prov.owner ? gs.clans[prov.owner] : null;
  const ownerName = ownerClan ? ownerClan.name : '空白地';
  const ownerColor = renderer.getClanColor(prov.owner);
  const clan = gs.clans[gs.playerClan];
  const canAttack = !isPlayer && gs.provinces[provinceId] !== undefined;
  const canDevelop = isPlayer;

  panel.innerHTML = `
    <div class="province-panel">
      <div class="province-header">
        <div class="province-name">${prov.name}（${prov.castle}）</div>
        <span class="province-owner-badge" style="background:${ownerColor}22;color:${ownerColor};border:1px solid ${ownerColor}55;">
          ${ownerName}
        </span>
      </div>
      <div class="province-stats">
        <div class="stat-bar-wrap">
          <div class="label"><span>発展度</span><span>${prov.development}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${prov.development}%;background:hsl(${prov.development*1.2},70%,45%);"></div></div>
        </div>
        <div class="stat-bar-wrap">
          <div class="label"><span>防御力</span><span>${prov.defense}</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${prov.defense}%;background:#3498db;"></div></div>
        </div>
        <div class="prov-stat-row"><span class="lbl">👥 人口</span><span class="vl">${prov.population}万人</span></div>
        <div class="prov-stat-row"><span class="lbl">💰 収入</span><span class="vl">金 ${prov.income}/ターン</span></div>
        <div class="prov-stat-row"><span class="lbl">🏯 城</span><span class="vl">${prov.castle}</span></div>
        <div class="prov-stat-row"><span class="lbl">⚡ 特産</span><span class="vl">${prov.speciality}</span></div>
      </div>
      ${canDevelop ? `
      <div style="padding:0 14px 6px;font-size:11px;font-weight:700;color:var(--muted);">── 内政 ──</div>
      <div class="action-btns">
        <button class="act-btn" onclick="doDevProvince('${provinceId}','agriculture')" title="農業：金100">🌾 農業開発<br><span style="font-size:9px;color:var(--muted);">金100</span></button>
        <button class="act-btn" onclick="doDevProvince('${provinceId}','commerce')" title="商業：金150">🏪 商業開発<br><span style="font-size:9px;color:var(--muted);">金150</span></button>
        <button class="act-btn" onclick="doDevProvince('${provinceId}','defense')" title="築城：金200">🏯 城強化<br><span style="font-size:9px;color:var(--muted);">金200</span></button>
        <button class="act-btn" onclick="doDevProvince('${provinceId}','development')" title="開発：金80">🏘️ 町開発<br><span style="font-size:9px;color:var(--muted);">金80</span></button>
      </div>
      <div style="padding:0 14px 6px;font-size:11px;font-weight:700;color:var(--muted);">── 軍事 ──</div>
      <div class="action-btns">
        <button class="act-btn danger" onclick="enterAttackMode('${provinceId}')">⚔️ 出兵<br><span style="font-size:9px;color:var(--muted);">隣接地を攻める</span></button>
        <button class="act-btn" onclick="doRecruit('${provinceId}')">🏹 兵募集<br><span style="font-size:9px;color:var(--muted);">金150</span></button>
      </div>
      ` : `
      <div class="action-btns">
        ${!prov.owner ? `<button class="act-btn danger" onclick="enterAttackMode('${provinceId}')" style="grid-column:1/-1;opacity:0.6" disabled>空白地（隣接地から攻略）</button>` :
          `<button class="act-btn danger" onclick="enterAttackModeFromNearest('${provinceId}')" style="grid-column:1/-1;">⚔️ ${ownerName}を攻める</button>`}
      </div>
      `}
    </div>
  `;
}

// ======= 内政アクション =======
window.doDevProvince = function(provinceId, type) {
  const result = gs.developProvince(provinceId, type);
  showToast(result.msg, result.success ? 'success' : 'error');
  if (result.success) { updateAllUI(); renderProvincePanel(provinceId); }
};

window.doRecruit = function(provinceId) {
  const clan = gs.clans[gs.playerClan];
  if (clan.gold < 150) { showToast('金が不足しています（必要：150）', 'error'); return; }
  clan.gold -= 150;
  clan.troops += 1000;
  gs.addLog(`🏹 ${gs.provinces[provinceId].name}で兵を募集（+1000）`, 'action');
  showToast('兵1000人を募集しました！', 'success');
  updateAllUI();
};

// ======= 攻撃モード =======
window.enterAttackMode = function(fromId) {
  const from = gs.provinces[fromId];
  if (!from || from.owner !== gs.playerClan) return;
  const hasNeighborTarget = from.neighbors.some(nId => {
    const n = gs.provinces[nId];
    return n && n.owner !== gs.playerClan;
  });
  if (!hasNeighborTarget) { showToast('隣接する攻撃可能な領地がありません', 'error'); return; }

  attackMode = true;
  attackFromId = fromId;
  document.getElementById('attackBanner').classList.add('active');
  renderer.setAttackMode(true, fromId);
  showToast(`⚔️ ${from.name}から出陣！攻撃目標をクリックせよ`, 'info');
};

window.enterAttackModeFromNearest = function(targetId) {
  // 隣接するプレイヤー領地から攻める
  const target = gs.provinces[targetId];
  const playerProvinces = Object.values(gs.provinces).filter(p => p.owner === gs.playerClan);
  const from = playerProvinces.find(p => p.neighbors.includes(targetId));
  if (!from) { showToast('隣接する自領地がありません', 'error'); return; }
  attackMode = true;
  attackFromId = from.id;
  document.getElementById('attackBanner').classList.add('active');
  renderer.setAttackMode(true, from.id);
  showToast(`⚔️ ${from.name}から${target.name}へ出陣準備！`, 'info');
};

function cancelAttackMode() {
  attackMode = false;
  attackFromId = null;
  document.getElementById('attackBanner').classList.remove('active');
  renderer.setAttackMode(false, null);
}

function executeAttack(fromId, toId) {
  cancelAttackMode();
  const clan = gs.clans[gs.playerClan];
  const maxAttack = Math.floor(clan.troops * 0.6);
  if (maxAttack < 100) { showToast('兵力が不足しています', 'error'); return; }

  const troops = Math.min(maxAttack, Math.max(500, Math.floor(clan.troops * 0.4)));
  const result = gs.attack(fromId, toId, troops);

  if (result.success) {
    // 一騎討ちの発生判定（20%の確率）
    const duelChance = Math.random();
    if (duelChance < 0.20) {
      showDuelModal(fromId, toId, troops, result);
    } else {
      showBattleResult(fromId, toId, troops, result);
    }
    updateAllUI();
    if (gs.selectedProvince) renderProvincePanel(gs.selectedProvince);
    renderer.render();
    checkGameOver();
  } else {
    showToast(result.msg, 'error');
  }
}

// ======= 一騎討ちシステム =======
function showDuelModal(fromId, toId, troops, battleResult) {
  const from   = gs.provinces[fromId];
  const to     = gs.provinces[toId];
  const myGens = gs.getPlayerGenerals();
  const defClanId = to.owner;
  const defGens   = defClanId
    ? Object.values(gs.generals).filter(g => g.clan === defClanId)
    : [];

  if (myGens.length === 0 || defGens.length === 0) {
    showBattleResult(fromId, toId, troops, battleResult);
    return;
  }

  const myGen  = myGens.sort((a,b) => b.stats.military - a.stats.military)[0];
  const defGen = defGens.sort((a,b) => b.stats.military - a.stats.military)[0];

  const body = document.getElementById('battleResultBody');
  body.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px;">${from.name} → ${to.name}</div>
      <div style="font-size:22px;font-weight:900;color:var(--gold);letter-spacing:0.2em;margin-bottom:20px;">
        ⚔️ 一騎討ち！
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:24px;margin-bottom:20px;">
        <div style="text-align:center;">
          <div style="font-size:52px;">${myGen.portrait}</div>
          <div style="font-size:15px;font-weight:700;color:var(--gold);">${myGen.name}</div>
          <div style="font-size:12px;color:var(--muted);">武力 ${myGen.stats.military}</div>
        </div>
        <div style="font-size:36px;font-weight:900;color:#e74c3c;text-shadow:0 0 20px #e74c3c;">VS</div>
        <div style="text-align:center;">
          <div style="font-size:52px;">${defGen.portrait}</div>
          <div style="font-size:15px;font-weight:700;color:#e74c3c;">${defGen.name}</div>
          <div style="font-size:12px;color:var(--muted);">武力 ${defGen.stats.military}</div>
        </div>
      </div>
      <p style="color:var(--muted);font-size:13px;margin-bottom:20px;">
        両将が名乗りを上げ、一騎討ちとなった！<br>受けて立つか？
      </p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button onclick="executeDuel('${myGen.id}','${defGen.id}','${fromId}','${toId}',${troops},${JSON.stringify(battleResult).replace(/"/g,'&quot;')})" 
          style="padding:12px 24px;font-size:14px;font-weight:700;background:linear-gradient(135deg,#8b2020,var(--red));border:2px solid #e74c3c;color:#fff;border-radius:4px;cursor:pointer;letter-spacing:0.1em;">
          ⚔️ 一騎討ちを受ける
        </button>
        <button onclick="closeModal('battleResultModal');showBattleResult('${fromId}','${toId}',${troops},${JSON.stringify(battleResult).replace(/"/g,'&quot;')})" 
          style="padding:12px 24px;font-size:14px;font-weight:700;background:var(--panel2);border:1px solid var(--border);color:var(--muted);border-radius:4px;cursor:pointer;">
          断る
        </button>
      </div>
    </div>
  `;
  showModal('battleResultModal');
}

window.executeDuel = function(myGenId, defGenId, fromId, toId, troops, battleResult) {
  const myGen  = gs.generals[myGenId];
  const defGen = gs.generals[defGenId];
  const myPow  = myGen.stats.military * (0.7 + Math.random() * 0.6);
  const defPow = defGen.stats.military * (0.7 + Math.random() * 0.6);
  const win    = myPow > defPow;
  const margin = Math.abs(myPow - defPow);
  const closeCall = margin < 5;

  // 一騎討ち結果で戦闘修正
  if (win) {
    battleResult.victory = true;
    battleResult.result && (battleResult.result.attackerLoss = Math.floor((battleResult.result.attackerLoss || 0) * 0.5));
    gs.provinces[toId].owner = gs.playerClan;
    gs.addLog(`⚔️ ${myGen.name}が${defGen.name}との一騎討ちに勝利！`, 'battle');
  } else {
    battleResult.result && (battleResult.result.attackerLoss = Math.floor((battleResult.result.attackerLoss || 0) * 1.5));
    gs.addLog(`💀 ${myGen.name}が${defGen.name}との一騎討ちに敗れた…`, 'battle');
  }
  // 稀に武将が討ち死に
  const fatal = Math.random() < 0.1;

  const body = document.getElementById('battleResultBody');
  body.innerHTML = `
    <div style="text-align:center;padding:10px 0;">
      <div style="font-size:28px;font-weight:900;margin-bottom:12px;${win?'color:#f0d060;text-shadow:0 0 30px rgba(240,208,96,0.7);':'color:#e74c3c;'}">
        ${win ? '⚔️ 勝利！' : '💀 敗北…'}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin:16px 0;">
        <div>
          <div style="font-size:44px;">${myGen.portrait}</div>
          <div style="font-size:14px;font-weight:700;color:${win?'var(--gold)':'#e74c3c'};">${myGen.name}</div>
          <div style="font-size:24px;font-weight:900;color:${win?'var(--gold)':'#e74c3c'};margin-top:4px;">
            ${Math.floor(myPow)}
          </div>
        </div>
        <div style="font-size:28px;color:#e74c3c;">⚔️</div>
        <div>
          <div style="font-size:44px;">${defGen.portrait}</div>
          <div style="font-size:14px;font-weight:700;color:${!win?'var(--gold)':'#e74c3c'};">${defGen.name}</div>
          <div style="font-size:24px;font-weight:900;color:${!win?'var(--gold)':'#e74c3c'};margin-top:4px;">
            ${Math.floor(defPow)}
          </div>
        </div>
      </div>
      <p style="font-size:13px;color:var(--muted);">
        ${closeCall ? '僅差の激闘だった！' : win ? '圧倒的な剣技で敵将を打ち倒した！' : '惜しくも一歩及ばなかった…'}
      </p>
      ${fatal && !win ? `<div style="margin-top:12px;padding:10px;background:rgba(192,57,43,0.2);border:1px solid #c0392b;border-radius:4px;color:#e74c3c;font-size:13px;">
        ⚠️ ${myGen.name}が深手を負った！次の戦で能力が低下する
      </div>` : ''}
      ${win ? `<div style="margin-top:12px;padding:10px;background:rgba(201,168,76,0.15);border:1px solid var(--gold);border-radius:4px;color:var(--gold);font-size:13px;">
        🏯 ${gs.provinces[toId]?.name}を制圧！
      </div>` : ''}
      <button onclick="closeModal('battleResultModal')" style="margin-top:16px;padding:10px 24px;font-size:13px;font-weight:700;background:var(--panel2);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;">
        閉じる
      </button>
    </div>
  `;
  updateAllUI();
  renderer.render();
  checkGameOver();
};

function showBattleResult(fromId, toId, troops, result) {
  const from = gs.provinces[fromId];
  const to   = gs.provinces[toId];
  const body = document.getElementById('battleResultBody');
  const isVictory = result.victory;
  const atkGens = gs.getPlayerGenerals().slice(0, 2);
  const defGens = to.owner ? Object.values(gs.generals).filter(g => g.clan === to.owner).slice(0, 2) : [];

  body.innerHTML = `
    <div class="battle-result">
      <div class="battle-result-title ${isVictory ? 'victory' : 'defeat'}">
        ${isVictory ? '⚔️ 勝利！' : '💀 敗退…'}
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px;">
        ${from.name} → ${to.name}
      </div>
      <div class="battle-vs">
        <div class="battle-side">
          <div class="battle-side-name" style="color:${renderer.getClanColor(gs.playerClan)};">
            ${gs.clans[gs.playerClan].name}（攻撃）
          </div>
          <div style="display:flex;justify-content:center;gap:6px;margin:6px 0;">
            ${atkGens.map(g => `<span style="font-size:24px;" title="${g.name}">${g.portrait}</span>`).join('')}
          </div>
          <div class="battle-side-power" style="color:${isVictory?'#f0d060':'#e74c3c'};">
            ${(result.result?.atkPower || 0).toLocaleString()}
          </div>
          <div class="battle-side-loss">損害：-${(result.result?.attackerLoss || 0).toLocaleString()}兵</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">出陣兵力：${troops.toLocaleString()}</div>
        </div>
        <div class="battle-vs-text">VS</div>
        <div class="battle-side">
          <div class="battle-side-name" style="color:${renderer.getClanColor(to.owner)};">
            ${to.owner ? gs.clans[to.owner]?.name : '中立'}（防衛）
          </div>
          <div style="display:flex;justify-content:center;gap:6px;margin:6px 0;">
            ${defGens.map(g => `<span style="font-size:24px;" title="${g.name}">${g.portrait}</span>`).join('')}
          </div>
          <div class="battle-side-power" style="color:${!isVictory?'#f0d060':'#e74c3c'};">
            ${(result.result?.defPower || 0).toLocaleString()}
          </div>
          <div class="battle-side-loss">損害：-${(result.result?.defenderLoss || 0).toLocaleString()}兵</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">城防御：${to.defense}</div>
        </div>
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--panel2);border-radius:6px;font-size:13px;">
        ${isVictory
          ? `<span style="color:var(--gold);">🏯 ${to.name}を制圧！</span>
             <div style="margin-top:6px;color:var(--muted);">この領地から収入が増加します</div>`
          : `<span style="color:#e74c3c;">敵の防衛を突破できなかった</span>
             <div style="margin-top:6px;color:var(--muted);">兵力を整えて再挑戦せよ</div>`
        }
      </div>
      <button onclick="closeModal('battleResultModal')" style="margin-top:14px;width:100%;padding:10px;font-size:13px;font-weight:700;background:var(--panel2);border:1px solid var(--border);color:var(--text);border-radius:4px;cursor:pointer;">
        閉じる
      </button>
    </div>
  `;
  showModal('battleResultModal');
}

// ======= ターン進行 =======
window.doNextTurn = function() {
  gs.nextTurn();
  updateAllUI();
  renderer.render();
  if (gs.selectedProvince) renderProvincePanel(gs.selectedProvince);
  renderDiplomacyPanel();

  // イベント通知
  if (gs.events.length > 0) {
    const latest = gs.events[gs.events.length - 1];
    showToast(`📜 ${latest.name}`, 'event');
    gs.events = [];
  }

  checkGameOver();
};

function checkGameOver() {
  if (!gs.gameOver) return;
  const content = document.getElementById('gameOverContent');
  if (gs.winner) {
    const winClan = gs.clans[gs.winner];
    const isPlayer = gs.winner === gs.playerClan;
    if (isPlayer) {
      content.innerHTML = `
        <div class="victory-title">天下統一！</div>
        <div class="gameover-sub">${winClan.name}が日ノ本を統べた</div>
        <p style="color:var(--muted);font-size:16px;">ターン${gs.turn} / ${gs.year}年 — 天下への道のりは${gs.turn}手に及んだ</p>
      `;
    } else {
      content.innerHTML = `
        <div class="gameover-title">GAME OVER</div>
        <div class="gameover-sub">${winClan.name}が天下を統一した</div>
        <p style="color:var(--muted);font-size:16px;">貴方の勢力は滅亡の憂き目を見た…</p>
      `;
    }
  } else {
    content.innerHTML = `
      <div class="gameover-title">滅亡</div>
      <div class="gameover-sub">全ての領地を失った…</div>
    `;
  }
  setTimeout(() => showScreen('gameOverScreen'), 1500);
}

// ======= 外交パネル =======
function renderDiplomacyPanel() {
  const panel = document.getElementById('diplomacyPanel');
  const myClan = gs.clans[gs.playerClan];
  if (!myClan) return;

  const otherClans = Object.keys(gs.clans).filter(id => id !== gs.playerClan);
  let html = '';

  // 勢力が存在する（領地を持つ）ものだけ表示
  otherClans.filter(id => gs.getClanProvinceCount(id) > 0).forEach(clanId => {
    const clan = gs.clans[clanId];
    const rel = myClan.diplomacy[clanId] || { relation: 0, alliance: false, war: false };
    const relVal = rel.relation;
    const relColor = relVal >= 50 ? '#2ecc71' : relVal >= 0 ? '#f0d060' : '#e74c3c';
    const relBarW = Math.max(0, Math.min(100, (relVal + 100) / 2));
    let statusHtml = '';
    if (rel.alliance) statusHtml = '<span class="diplo-status ally">同盟</span>';
    else if (rel.war) statusHtml = '<span class="diplo-status war">交戦</span>';
    else if (rel.truce) statusHtml = `<span class="diplo-status neutral">休戦(${rel.truceTurns})</span>`;
    else statusHtml = '<span class="diplo-status neutral">中立</span>';

    html += `
      <div class="diplo-item">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <span class="diplo-clan" style="color:${renderer.getClanColor(clanId)};">${clan.name}</span>
            ${statusHtml}
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="diplo-rel-bar"><div class="diplo-rel-fill" style="width:${relBarW}%;background:${relColor};"></div></div>
            <span style="font-size:10px;color:${relColor};font-weight:700;">${relVal > 0 ? '+' : ''}${relVal}</span>
          </div>
          <div class="diplo-btns">
            ${!rel.alliance && !rel.war ? `<button class="diplo-btn" onclick="doDiplomacy('${clanId}','alliance')">同盟</button>` : ''}
            ${rel.alliance ? `<button class="diplo-btn" onclick="doDiplomacy('${clanId}','breakAlliance')">同盟破棄</button>` : ''}
            ${rel.war ? `<button class="diplo-btn" onclick="doDiplomacy('${clanId}','truce')">休戦申請</button>` : ''}
            <button class="diplo-btn" onclick="doDiplomacy('${clanId}','gift')">贈り物(金100)</button>
          </div>
        </div>
      </div>
    `;
  });

  panel.innerHTML = html || '<p style="color:var(--muted);font-size:12px;padding:10px 0;">外交対象の勢力がありません</p>';
}

window.doDiplomacy = function(clanId, action) {
  const result = gs.proposeDiplomacy(clanId, action);
  showToast(result.msg, result.success ? 'success' : 'error');
  renderDiplomacyPanel();
  updateTopbar();
};

// ======= ログパネル =======
function renderLogPanel() {
  const panel = document.getElementById('logPanel');
  if (!gs?.log?.length) { panel.innerHTML = '<p style="color:var(--muted);font-size:12px;">まだ記録がありません</p>'; return; }
  panel.innerHTML = gs.log.map(entry => `
    <div class="log-entry ${entry.type}">
      <div class="log-time">${entry.year}年${entry.month}月 T${entry.turn}</div>
      ${entry.message}
    </div>
  `).join('');
}

// ======= 武将モーダル =======
window.showGeneralModal = function() {
  const body = document.getElementById('generalModalBody');
  const myGenerals = gs.getPlayerGenerals();
  const unaffiliated = Object.values(gs.generals).filter(g => !g.clan || g.clan === null);

  let html = `<div style="margin-bottom:16px;">
    <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:10px;letter-spacing:0.2em;">── 家臣団（${myGenerals.length}名）──</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    ${myGenerals.map(g => `
      <div onclick="showGeneralDetail('${g.id}')" style="background:var(--panel2);border:1px solid var(--border);padding:10px;border-radius:6px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:28px;">${g.portrait}</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--gold);">${g.name}</div>
            <div style="font-size:10px;color:var(--muted);">${g.kana}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:10px;">
          <span style="color:var(--muted);">統率 <b style="color:var(--text);">${g.stats.leadership}</b></span>
          <span style="color:var(--muted);">武力 <b style="color:var(--text);">${g.stats.military}</b></span>
          <span style="color:var(--muted);">知略 <b style="color:var(--text);">${g.stats.intelligence}</b></span>
          <span style="color:var(--muted);">政治 <b style="color:var(--text);">${g.stats.politics}</b></span>
        </div>
      </div>
    `).join('')}
    </div>
  </div>`;

  if (unaffiliated.length > 0) {
    html += `<div>
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin:16px 0 10px;letter-spacing:0.2em;">── 在野の武将（登用可能）──</div>
      ${unaffiliated.map(g => {
        const cost = (g.stats.leadership + g.stats.military) * 5;
        const myClan = gs.clans[gs.playerClan];
        const canAfford = myClan.gold >= cost;
        return `
        <div style="display:flex;align-items:center;gap:10px;padding:8px;background:var(--panel2);border:1px solid var(--border);border-radius:6px;margin-bottom:8px;cursor:pointer;" onclick="showGeneralDetail('${g.id}')">
          <span style="font-size:24px;">${g.portrait}</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:700;color:var(--gold);">${g.name}</div>
            <div style="font-size:10px;color:var(--muted);">統${g.stats.leadership} 武${g.stats.military} 智${g.stats.intelligence} 政${g.stats.politics}</div>
          </div>
          <button onclick="event.stopPropagation();doRecruitGeneral('${g.id}')" style="padding:6px 12px;font-size:11px;font-weight:700;background:${canAfford?'rgba(39,174,96,0.2)':'rgba(100,100,100,0.2)'};border:1px solid ${canAfford?'#27ae60':'var(--border)'};color:${canAfford?'#2ecc71':'var(--muted)'};border-radius:3px;cursor:${canAfford?'pointer':'not-allowed'};" ${canAfford?'':'disabled'}>
            登用<br><span style="font-size:9px;">金${cost}</span>
          </button>
        </div>`;
      }).join('')}
    </div>`;
  }

  body.innerHTML = html;
  showModal('generalModal');
};

window.showGeneralDetail = function(generalId) {
  const g = gs.generals[generalId];
  if (!g) return;
  document.getElementById('genDetailTitle').textContent = `${g.portrait} ${g.name}`;
  const clanName = g.clan ? (gs.clans[g.clan]?.name || '不明') : '在野';
  const clanColor = g.clan ? renderer.getClanColor(g.clan) : '#888';

  const stats = [
    { name: '統率', val: g.stats.leadership, color: '#e74c3c' },
    { name: '武力', val: g.stats.military, color: '#e67e22' },
    { name: '知略', val: g.stats.intelligence, color: '#3498db' },
    { name: '政治', val: g.stats.politics, color: '#2ecc71' },
  ];

  document.getElementById('generalDetailBody').innerHTML = `
    <div class="gen-detail-header">
      <div class="gen-portrait-large">${g.portrait}</div>
      <div class="gen-detail-info">
        <div class="gen-detail-name">${g.name}</div>
        <div class="gen-detail-kana">${g.kana}（${g.born}年生）</div>
        <div class="gen-detail-clan" style="color:${clanColor};">${clanName}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">性格：${g.personality}</div>
      </div>
    </div>
    <div class="gen-stats-grid">
      ${stats.map(s => `
        <div class="gen-stat-item">
          <div class="gen-stat-name">${s.name}</div>
          <div class="gen-stat-val" style="color:${s.color};">${s.val}</div>
          <div class="gen-stat-bar"><div class="gen-stat-fill" style="width:${s.val}%;background:${s.color};"></div></div>
        </div>
      `).join('')}
    </div>
    <div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:700;">特技</div>
      <div class="gen-skills">
        ${g.skills.map(sk => {
          const skillData = SKILLS[sk];
          return `<span class="skill-badge" title="${skillData?.effect || ''}">${sk}</span>`;
        }).join('')}
      </div>
    </div>
    <div class="gen-bio">${g.bio}</div>
  `;
  showModal('generalDetailModal');
};

window.doRecruitGeneral = function(generalId) {
  const result = gs.recruitGeneral(generalId);
  showToast(result.msg, result.success ? 'success' : 'error');
  if (result.success) {
    updateAllUI();
    showGeneralModal(); // 更新
  }
};

// ======= 技術モーダル =======
window.showTechModal = function() {
  const body = document.getElementById('techModalBody');
  const clan = gs.clans[gs.playerClan];
  const categories = [...new Set(TECHNOLOGY_TREE.map(t => t.category))];

  let html = `<div style="color:var(--muted);font-size:13px;margin-bottom:16px;">現在の金：<b style="color:var(--gold);">${clan.gold}</b></div>`;

  categories.forEach(cat => {
    html += `<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:0.2em;margin:14px 0 8px;">── ${cat} ──</div>`;
    TECHNOLOGY_TREE.filter(t => t.category === cat).forEach(tech => {
      const researched = playerTechs.includes(tech.id);
      const prereqMet = tech.prereq.every(p => playerTechs.includes(p));
      const canResearch = !researched && prereqMet && clan.gold >= tech.cost;

      html += `
        <div style="background:var(--panel2);border:1px solid ${researched ? '#27ae60' : prereqMet ? 'var(--border)' : 'rgba(100,100,100,0.3)'};padding:12px;margin-bottom:8px;border-radius:6px;opacity:${prereqMet || researched ? 1 : 0.5};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:14px;font-weight:700;color:${researched ? '#2ecc71' : 'var(--text)'};">
              ${researched ? '✅ ' : prereqMet ? '🔬 ' : '🔒 '}${tech.name}
            </span>
            ${!researched ? `<button onclick="doResearch('${tech.id}')" style="padding:5px 12px;font-size:11px;font-weight:700;background:${canResearch ? 'rgba(39,174,96,0.2)' : 'transparent'};border:1px solid ${canResearch ? '#27ae60' : 'var(--border)'};color:${canResearch ? '#2ecc71' : 'var(--muted)'};border-radius:3px;cursor:${canResearch ? 'pointer' : 'not-allowed'};" ${canResearch ? '' : 'disabled'}>
              金${tech.cost}
            </button>` : '<span style="font-size:11px;color:#2ecc71;">習得済</span>'}
          </div>
          <div style="font-size:12px;color:var(--muted);">効果：${tech.effect}</div>
          ${tech.prereq.length > 0 ? `<div style="font-size:10px;color:var(--muted);margin-top:3px;">前提：${tech.prereq.join('、')}</div>` : ''}
        </div>
      `;
    });
  });

  body.innerHTML = html;
  showModal('techModal');
};

window.doResearch = function(techId) {
  const tech = TECHNOLOGY_TREE.find(t => t.id === techId);
  if (!tech) return;
  const clan = gs.clans[gs.playerClan];
  if (clan.gold < tech.cost) { showToast('金が不足しています', 'error'); return; }
  if (playerTechs.includes(techId)) { showToast('すでに習得済みです', 'error'); return; }
  clan.gold -= tech.cost;
  playerTechs.push(techId);
  gs.addLog(`🔬 技術「${tech.name}」を習得！`, 'action');
  showToast(`技術「${tech.name}」を習得しました！`, 'success');
  updateAllUI();
  showTechModal();
};

// ======= UI更新 =======
function updateAllUI() {
  updateTopbar();
  renderMyClanInfo();
  renderMyGeneralsList();
  renderPowerRanking();
  renderLogPanel();
}

function updateTopbar() {
  document.getElementById('topbarDate').textContent = `${gs.year}年${gs.month}月`;
  document.getElementById('topbarSeason').textContent = `【${gs.season}】`;
  const clan = gs.clans[gs.playerClan];
  const owned = gs.getPlayerProvinces().length;
  const total = gs.getTotalProvinceCount();
  document.getElementById('topbarResources').innerHTML = `
    <div class="res-item"><span class="res-icon">💰</span><div><div class="res-val">${clan.gold.toLocaleString()}</div><div class="res-lbl">金</div></div></div>
    <div class="res-item"><span class="res-icon">🌾</span><div><div class="res-val">${clan.food.toLocaleString()}</div><div class="res-lbl">食料</div></div></div>
    <div class="res-item"><span class="res-icon">⚔️</span><div><div class="res-val">${clan.troops.toLocaleString()}</div><div class="res-lbl">兵力</div></div></div>
    <div class="res-item"><span class="res-icon">🏯</span><div><div class="res-val">${owned}/${total}</div><div class="res-lbl">領地</div></div></div>
  `;
}

function renderMyClanInfo() {
  const clan = gs.clans[gs.playerClan];
  const owned = gs.getPlayerProvinces();
  const total = gs.getTotalProvinceCount();
  const pct = Math.floor(owned.length / total * 100);
  const el = document.getElementById('myClanInfo');
  el.innerHTML = `
    <div class="clan-info-name" style="color:${renderer.getClanColor(gs.playerClan)};">${clan.name}</div>
    <div class="info-row"><span class="label">ターン</span><span class="val">${gs.turn}</span></div>
    <div class="info-row"><span class="label">領地</span><span class="val">${owned.length} / ${total}</span></div>
    <div class="info-row"><span class="label">天下統一度</span><span class="val">${pct}%</span></div>
    <div class="progress-bar" style="margin-top:4px;"><div class="progress-fill" style="width:${pct}%;background:var(--gold);"></div></div>
    <div class="info-row" style="margin-top:8px;"><span class="label">💰 金</span><span class="val">${clan.gold.toLocaleString()}</span></div>
    <div class="info-row"><span class="label">🌾 食料</span><span class="val">${clan.food.toLocaleString()}</span></div>
    <div class="info-row"><span class="label">⚔️ 兵力</span><span class="val">${clan.troops.toLocaleString()}</span></div>
    <div class="info-row"><span class="label">🏯 本拠</span><span class="val">${gs.provinces[clan.capital]?.castle || '—'}</span></div>
  `;
}

function renderMyGeneralsList() {
  const generals = gs.getPlayerGenerals();
  const el = document.getElementById('myGeneralsList');
  if (generals.length === 0) {
    el.innerHTML = '<p style="color:var(--muted);font-size:11px;">家臣なし</p>';
    return;
  }
  el.innerHTML = generals.map(g => `
    <div class="general-item" onclick="showGeneralDetail('${g.id}')">
      <div class="general-portrait">${g.portrait}</div>
      <div class="general-info">
        <div class="general-name">${g.name}</div>
        <div class="general-stats-mini">統${g.stats.leadership} 武${g.stats.military} 智${g.stats.intelligence} 政${g.stats.politics}</div>
      </div>
    </div>
  `).join('');
}

function renderPowerRanking() {
  const el = document.getElementById('powerRanking');
  const total = gs.getTotalProvinceCount();
  const ranking = Object.values(gs.clans)
    .map(c => ({ ...c, count: gs.getClanProvinceCount(c.id) }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  el.innerHTML = ranking.map((c, i) => `
    <div class="ranking-item">
      <div class="rank-num">${i + 1}</div>
      <div class="rank-color" style="background:${renderer.getClanColor(c.id)};"></div>
      <div class="rank-name" style="color:${c.id === gs.playerClan ? 'var(--gold)' : 'var(--text)'};">${c.name}</div>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${c.count/total*100}%;background:${renderer.getClanColor(c.id)};"></div></div>
      <div class="rank-provinces">${c.count}</div>
    </div>
  `).join('');
}

// ======= タブ切り替え =======
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['province', 'diplomacy', 'log'][i] === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  if (tabId === 'diplomacy') renderDiplomacyPanel();
  if (tabId === 'log') renderLogPanel();
};

// ======= モーダル =======
window.showModal = function(id) {
  document.getElementById(id).classList.add('active');
};
window.closeModal = function(id) {
  document.getElementById(id).classList.remove('active');
};
// オーバーレイクリックで閉じる
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

// ======= トースト =======
let toastTimer = null;
window.showToast = function(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3000);
};

// ======= グローバルキーボード =======
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    cancelAttackMode();
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});
