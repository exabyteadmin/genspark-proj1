// ===== マップ描画エンジン（実GeoJSONベース日本列島版） =====
import { JAPAN_PATHS } from '../data/japanPaths.js';

// ── 座標変換定数（japanPaths.jsと完全一致） ──
const LON_MIN = 127.5, LON_MAX = 146.5;
const LAT_MIN = 30.2,  LAT_MAX = 46.0;
const CX_MIN  = 25,    CX_MAX  = 875;  // CW=900, PAD=25
const CY_MIN  = 655,   CY_MAX  = 25;   // CH=680, PAD=25

// ── 各国の地理的中心座標（経緯度→キャンバス変換済み） ──
const PROVINCE_COORDS = {
  // 九州
  'satsuma':    { x: 164, y: 599 },
  'osumi':      { x: 177, y: 607 },
  'hyuga':      { x: 200, y: 583 },
  'higo':       { x: 168, y: 555 },
  'hizen':      { x: 137, y: 535 },
  'chikugo':    { x: 159, y: 535 },
  'bungo':      { x: 208, y: 535 },
  'chikuzen':   { x: 155, y: 519 },
  'buzen':      { x: 191, y: 519 },
  // 中国地方
  'nagato':     { x: 191, y: 500 },
  'suou':       { x: 217, y: 500 },
  'iwami':      { x: 217, y: 476 },
  'aki':        { x: 244, y: 488 },
  'bingo':      { x: 276, y: 484 },
  'izumo':      { x: 276, y: 448 },
  'hoki':       { x: 293, y: 448 },
  'inaba':      { x: 325, y: 444 },
  'mimasaka':   { x: 311, y: 464 },
  'bizen':      { x: 316, y: 476 },
  'oki':        { x: 280, y: 420 },
  // 四国
  'iyo':        { x: 258, y: 512 },
  'tosa':       { x: 293, y: 523 },
  'sanuki':     { x: 316, y: 500 },
  'awa':        { x: 338, y: 508 },
  // 近畿
  'tanba':      { x: 370, y: 460 },
  'tango':      { x: 365, y: 440 },
  'tajima':     { x: 352, y: 448 },
  'harima':     { x: 347, y: 468 },
  'settsu':     { x: 383, y: 476 },
  'kawachi':    { x: 387, y: 484 },
  'yamashiro':  { x: 392, y: 468 },
  'yamato':     { x: 396, y: 488 },
  'izumi':      { x: 383, y: 492 },
  'kii':        { x: 396, y: 504 },
  'awaji':      { x: 361, y: 484 },
  'omi':        { x: 405, y: 456 },
  'ise':        { x: 428, y: 476 },
  'iga':        { x: 410, y: 476 },
  'wakasa':     { x: 392, y: 444 },
  // 東海・中部
  'mino':       { x: 437, y: 444 },
  'owari':      { x: 441, y: 456 },
  'mikawa':     { x: 459, y: 472 },
  'totomi':     { x: 481, y: 476 },
  'suruga':     { x: 513, y: 464 },
  'izu':        { x: 540, y: 464 },
  'kai':        { x: 522, y: 440 },
  'shinano':    { x: 495, y: 416 },
  // 北陸
  'hida':       { x: 459, y: 416 },
  'etchu':      { x: 450, y: 396 },
  'kaga':       { x: 432, y: 400 },
  'noto':       { x: 450, y: 380 },
  'echizen':    { x: 414, y: 420 },
  'echigo':     { x: 508, y: 376 },
  // 関東
  'kozuke':     { x: 540, y: 408 },
  'musashi':    { x: 562, y: 432 },
  'sagami':     { x: 553, y: 448 },
  'shimosa':    { x: 593, y: 432 },
  'shimotsuke': { x: 580, y: 404 },
  'hitachi':    { x: 602, y: 408 },
  'kazusa':     { x: 593, y: 444 },
  'awa_kanto':  { x: 584, y: 460 },
  // 東北
  'dewa':       { x: 589, y: 308 },
  'mutsu':      { x: 638, y: 328 },
};

export class MapRenderer {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.gs     = gameState;

    this.hoveredProvince  = null;
    this.selectedProvince = null;
    this.attackMode = false;
    this.attackFrom = null;
    this.onProvinceClick = null;
    this.onProvinceHover = null;
    this._pulsePhase = 0;

    // 実GeoJSON座標を各国に適用
    this._applyGeoCoords();

    // キャンバスサイズに合わせた初期ビュー（日本列島全体が収まるよう）
    this._resetView();

    this._setupInteraction();
    this._startAnimLoop();
  }

  _resetView() {
    // 地図論理サイズ: x 25〜875(850px幅), y 25〜655(630px高)
    const MAP_W = 850, MAP_H = 630;
    const MAP_X0 = 25, MAP_Y0 = 25;
    const cw = this.canvas.width  || 900;
    const ch = this.canvas.height || 600;
    this.scale   = Math.min(cw / MAP_W, ch / MAP_H) * 0.93;
    this.offsetX = (cw - MAP_W * this.scale) / 2 - MAP_X0 * this.scale;
    this.offsetY = (ch - MAP_H * this.scale) / 2 - MAP_Y0 * this.scale;
  }

  _applyGeoCoords() {
    Object.entries(PROVINCE_COORDS).forEach(([id, pos]) => {
      if (this.gs.provinces[id]) {
        this.gs.provinces[id].x = pos.x;
        this.gs.provinces[id].y = pos.y;
      }
    });
  }

  _startAnimLoop() {
    const tick = () => {
      this._pulsePhase = (this._pulsePhase + 0.025) % (Math.PI * 2);
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _setupInteraction() {
    // ── ホバー・クリック ──
    this.canvas.addEventListener('mousemove', e => {
      const { x, y } = this._canvasPos(e);
      const prov = this._findProvince(x, y);
      if (prov !== this.hoveredProvince) {
        this.hoveredProvince = prov;
        if (this.onProvinceHover) this.onProvinceHover(prov);
      }
    });
    this.canvas.addEventListener('click', e => {
      const { x, y } = this._canvasPos(e);
      if (this.onProvinceClick) this.onProvinceClick(this._findProvince(x, y));
    });

    // ── ズーム ──
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.88 : 1.14;
      const ns = Math.max(0.35, Math.min(5.0, this.scale * factor));
      this.offsetX = mx - (mx - this.offsetX) * (ns / this.scale);
      this.offsetY = my - (my - this.offsetY) * (ns / this.scale);
      this.scale = ns;
    }, { passive: false });

    // ── ドラッグ ──
    let dragging = false, lx = 0, ly = 0;
    this.canvas.addEventListener('mousedown',  e => { if (e.button===0){ dragging=true; lx=e.clientX; ly=e.clientY; }});
    window.addEventListener('mouseup',         () => { dragging = false; });
    this.canvas.addEventListener('mousemove',  e => {
      if (!dragging) return;
      this.offsetX += e.clientX - lx;
      this.offsetY += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });

    // ── タッチ ──
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length===1){ dragging=true; lx=e.touches[0].clientX; ly=e.touches[0].clientY; }
    }, { passive: true });
    this.canvas.addEventListener('touchmove',  e => {
      e.preventDefault();
      if (e.touches.length===1 && dragging){
        this.offsetX += e.touches[0].clientX - lx;
        this.offsetY += e.touches[0].clientY - ly;
        lx=e.touches[0].clientX; ly=e.touches[0].clientY;
      }
    }, { passive: false });
    this.canvas.addEventListener('touchend',   () => { dragging = false; });
  }

  _canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - this.offsetX) / this.scale,
      y: (e.clientY - r.top  - this.offsetY) / this.scale,
    };
  }

  _findProvince(x, y) {
    let best = null, bestDist = 22;
    for (const p of Object.values(this.gs.provinces)) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) { bestDist = d; best = p.id; }
    }
    return best;
  }

  getClanColor(clanId) {
    if (!clanId) return '#4a5568';
    const MAP = {
      oda:      '#e74c3c', takeda:   '#e67e22',
      uesugi:   '#3498db', hojo:     '#9b59b6',
      mori:     '#27ae60', tokugawa: '#1abc9c',
      imagawa:  '#f1c40f', shimazu:  '#e91e63',
    };
    return MAP[clanId] || '#888899';
  }

  // ════════════════════════════════════════════
  //  メイン描画
  // ════════════════════════════════════════════
  render() {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 海背景グラデーション
    const seaBg = ctx.createLinearGradient(0, 0, W, H);
    seaBg.addColorStop(0,   '#071828');
    seaBg.addColorStop(0.5, '#0a2235');
    seaBg.addColorStop(1,   '#061220');
    ctx.fillStyle = seaBg;
    ctx.fillRect(0, 0, W, H);

    // 海面の波紋（アニメ）
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(20,80,160,${0.025 + i*0.006})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let wx = 0; wx < W; wx += 4) {
        const wy = 50 + i*110 + Math.sin(wx/180 + this._pulsePhase*0.6 + i*1.1) * 7;
        wx===0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // ── 1. 日本列島シルエット（実GeoJSONデータ） ──
    this._drawJapanLand(ctx);

    // ── 2. 海峡・海名ラベル ──
    this._drawSeaLabels(ctx);

    // ── 3. 国境線 ──
    this._drawBorders(ctx);

    // ── 4. 攻撃ハイライト ──
    if (this.attackMode && this.attackFrom) this._drawAttackHighlights(ctx);

    // ── 5. 国マーカー（通常 → ホバー → 選択の順で重ね描き） ──
    for (const p of Object.values(this.gs.provinces)) {
      if (p.id !== this.selectedProvince && p.id !== this.hoveredProvince)
        this._drawMarker(ctx, p, false, false);
    }
    if (this.hoveredProvince && this.hoveredProvince !== this.selectedProvince) {
      const p = this.gs.provinces[this.hoveredProvince];
      if (p) this._drawMarker(ctx, p, true, false);
    }
    if (this.selectedProvince) {
      const p = this.gs.provinces[this.selectedProvince];
      if (p) this._drawMarker(ctx, p, false, true);
    }

    // ── 6. 勢力名ラベル ──
    this._drawClanLabels(ctx);

    ctx.restore();

    // ── UI オーバーレイ ──
    this._drawCompass(ctx, W - 55, 55, 32);
    this._drawMinimap(ctx, W - 168, H - 128, 158, 118);
    this._drawLegend(ctx, 8, H - 22);
  }

  // ════════════════════════════════════════════
  //  日本列島シルエット描画（実GeoJSONパス使用）
  // ════════════════════════════════════════════
  _drawJapanLand(ctx) {
    // 陸地カラースキーム
    const landGrad = ctx.createLinearGradient(200, 300, 700, 700);
    landGrad.addColorStop(0,   '#3d6b2a');
    landGrad.addColorStop(0.4, '#4a7c33');
    landGrad.addColorStop(0.7, '#3a6226');
    landGrad.addColorStop(1,   '#2f521f');

    const coastColor = 'rgba(160,210,90,0.45)';
    const shadowColor = 'rgba(0,0,0,0.55)';

    // 島の描画順（大きい順）
    const drawOrder = ['honshu', 'hokkaido', 'kyushu', 'shikoku', 'okinawa'];

    for (const island of drawOrder) {
      const polys = JAPAN_PATHS[island];
      if (!polys) continue;
      for (const pts of polys) {
        if (pts.length < 3) continue;
        this._fillPoly(ctx, pts, landGrad, coastColor, shadowColor);
      }
    }

    // 地形ハイライト（山地の稜線感）
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#aee870';
    for (const island of drawOrder) {
      const polys = JAPAN_PATHS[island];
      if (!polys) continue;
      for (const pts of polys) {
        if (pts.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _fillPoly(ctx, pts, fill, strokeColor, shadowColor) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();

    // ドロップシャドウ
    ctx.shadowColor  = shadowColor;
    ctx.shadowBlur   = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

    // 海岸線
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  // ── 海名ラベル ──
  _drawSeaLabels(ctx) {
    ctx.save();
    ctx.font = 'italic 13px "Yu Gothic","Hiragino Sans",Georgia,serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(120,190,255,0.28)';
    ctx.letterSpacing = '2px';
    const labels = [
      [155, 400, '日  本  海'],
      [530, 600, '太  平  洋'],
      [270, 548, '瀬 戸 内 海'],
      [700, 280, '太平洋'],
    ];
    for (const [x, y, text] of labels) {
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  // ── 国境線（隣接ライン） ──
  _drawBorders(ctx) {
    const drawn = new Set();
    ctx.save();
    for (const p of Object.values(this.gs.provinces)) {
      for (const nId of p.neighbors) {
        const key = p.id < nId ? p.id+'|'+nId : nId+'|'+p.id;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const n = this.gs.provinces[nId];
        if (!n) continue;
        const same = p.owner && p.owner === n.owner;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(n.x, n.y);
        if (same) {
          ctx.strokeStyle = `${this.getClanColor(p.owner)}44`;
          ctx.lineWidth = 1.0;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(255,255,220,0.08)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 5]);
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── 攻撃ハイライト ──
  _drawAttackHighlights(ctx) {
    const from = this.gs.provinces[this.attackFrom];
    if (!from) return;
    const pulse = Math.sin(this._pulsePhase) * 0.4 + 0.6;

    ctx.save();
    // 出撃元グロー
    ctx.shadowColor = this.getClanColor(this.gs.playerClan);
    ctx.shadowBlur  = 20 * pulse;
    ctx.beginPath();
    ctx.arc(from.x, from.y, 16, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 攻撃可能ターゲット
    for (const nId of from.neighbors) {
      const n = this.gs.provinces[nId];
      if (!n || n.owner === this.gs.playerClan) continue;
      ctx.save();
      ctx.globalAlpha = 0.7 * pulse;
      ctx.strokeStyle = '#ff3333';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(n.x, n.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(n.x, n.y, 14 + 4*pulse, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,50,50,${0.9*pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle   = `rgba(255,50,50,${0.13*pulse})`; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── 国マーカー ──
  _drawMarker(ctx, p, isHovered, isSelected) {
    const isPlayer = p.owner === this.gs.playerClan;
    const isTarget = this.attackMode && this.attackFrom &&
      this.gs.provinces[this.attackFrom]?.neighbors.includes(p.id) &&
      p.owner !== this.gs.playerClan;

    const r     = isSelected ? 13 : isHovered ? 11 : 8;
    const color = this.getClanColor(p.owner);

    ctx.save();

    // グロー
    if (isSelected)      { ctx.shadowColor='#ffe800'; ctx.shadowBlur=22; }
    else if (isPlayer)   { ctx.shadowColor=color;     ctx.shadowBlur=10; }
    else if (isTarget)   { ctx.shadowColor='#ff2222'; ctx.shadowBlur=16; }

    // 外リング（勢力色）
    if (p.owner) {
      ctx.beginPath(); ctx.arc(p.x, p.y, r+3, 0, Math.PI*2);
      ctx.fillStyle = `${color}55`; ctx.fill();
    }

    // メインドット
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    const g = ctx.createRadialGradient(p.x-r*0.3, p.y-r*0.3, 1, p.x, p.y, r*1.4);
    const tc = this._terrainColor(p, color);
    g.addColorStop(0, this._lighten(tc, 65));
    g.addColorStop(0.55, tc);
    g.addColorStop(1, this._darken(tc, 45));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 枠線
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    if      (isSelected) { ctx.strokeStyle='#ffe800'; ctx.lineWidth=2.5; }
    else if (isTarget)   { ctx.strokeStyle='#ff4444'; ctx.lineWidth=2.2; }
    else if (isPlayer)   { ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.8; }
    else if (p.owner)    { ctx.strokeStyle=`${color}cc`; ctx.lineWidth=1.5; }
    else                 { ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1; }
    ctx.stroke();

    // 地形アイコン
    ctx.globalAlpha = 0.85;
    ctx.font = `${r * 0.95}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(this._terrainIcon(p), p.x, p.y+0.5);
    ctx.globalAlpha = 1;

    // 城アイコン（高防御）
    if (p.defense >= 70) {
      ctx.font='7px serif'; ctx.textBaseline='bottom';
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.fillText('🏯', p.x + r + 1, p.y - r*0.3);
    }

    // 国名ラベル
    ctx.shadowColor='rgba(0,0,0,1)'; ctx.shadowBlur=5;
    ctx.font=`bold ${isSelected||isHovered?10:8}px 'Yu Gothic','Hiragino Sans',sans-serif`;
    ctx.fillStyle = p.owner ? '#fff' : '#bbb';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(p.name, p.x, p.y + r + 3);
    ctx.shadowBlur=0;

    // ホバー時：発展度バー
    if (isHovered || isSelected) {
      const bw=r*2.6, bh=3, bx=p.x-bw/2, by=p.y+r+(isSelected||isHovered?10:8)+5;
      ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle=`hsl(${p.development*1.2},75%,48%)`;
      ctx.fillRect(bx, by, bw*(p.development/100), bh);
    }

    ctx.restore();
  }

  // ── 勢力ラベル ──
  _drawClanLabels(ctx) {
    const centers = {};
    for (const p of Object.values(this.gs.provinces)) {
      if (!p.owner) continue;
      if (!centers[p.owner]) centers[p.owner] = {x:0, y:0, n:0};
      centers[p.owner].x += p.x; centers[p.owner].y += p.y; centers[p.owner].n++;
    }
    ctx.save();
    for (const [cid, c] of Object.entries(centers)) {
      if (c.n < 1) continue;
      const clan = this.gs.clans[cid]; if (!clan) continue;
      const cx = c.x/c.n, cy = c.y/c.n;
      const isPlayer = cid === this.gs.playerClan;
      ctx.font=`bold ${isPlayer?12:10}px "Yu Gothic","Hiragino Sans",sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='rgba(0,0,0,0.95)'; ctx.shadowBlur=7;
      ctx.fillStyle = isPlayer ? '#ffe800' : this.getClanColor(cid);
      ctx.globalAlpha = isPlayer ? 0.92 : 0.72;
      ctx.fillText(clan.name, cx, cy-24);
    }
    ctx.restore();
  }

  // ── コンパス ──
  _drawCompass(ctx, cx, cy, r) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
    const g = ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,'rgba(28,40,60,0.93)'); g.addColorStop(1,'rgba(8,14,24,0.93)');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(200,165,70,0.55)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.font='bold 9px serif'; ctx.fillStyle='rgba(200,165,70,0.88)';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('北',0,-r+9); ctx.fillText('南',0,r-9);
    ctx.fillText('東',r-9,0);  ctx.fillText('西',-r+9,0);
    // 北矢印（赤）
    ctx.beginPath(); ctx.moveTo(0,-r+15); ctx.lineTo(4,2); ctx.lineTo(0,-1); ctx.lineTo(-4,2); ctx.closePath();
    ctx.fillStyle='#e74c3c'; ctx.fill();
    // 南矢印（白）
    ctx.beginPath(); ctx.moveTo(0,r-15); ctx.lineTo(4,-2); ctx.lineTo(0,1); ctx.lineTo(-4,-2); ctx.closePath();
    ctx.fillStyle='rgba(255,255,255,0.55)'; ctx.fill();
    ctx.restore();
  }

  // ── ミニマップ ──
  _drawMinimap(ctx, mx, my, mw, mh) {
    ctx.save();
    ctx.fillStyle='rgba(6,14,24,0.90)'; ctx.strokeStyle='rgba(200,165,70,0.45)'; ctx.lineWidth=1;
    ctx.fillRect(mx,my,mw,mh); ctx.strokeRect(mx,my,mw,mh);
    ctx.font='8px "Yu Gothic",sans-serif'; ctx.fillStyle='rgba(200,165,70,0.75)';
    ctx.textAlign='left'; ctx.fillText('全国図', mx+4, my+9);

    // 日本列島シルエット（縮小描画）
    const S = 0.175;
    ctx.save();
    ctx.translate(mx+3, my+13);
    ctx.scale(S, S);
    ctx.fillStyle='#3a6b24'; ctx.strokeStyle='rgba(170,210,80,0.35)'; ctx.lineWidth=2;
    for (const island of ['honshu','hokkaido','kyushu','shikoku']) {
      const polys = JAPAN_PATHS[island]; if (!polys) continue;
      for (const pts of polys) {
        if (pts.length<3) continue;
        ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
        for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // 国マーカー
    for (const p of Object.values(this.gs.provinces)) {
      ctx.beginPath(); ctx.arc(p.x,p.y, p.owner===this.gs.playerClan?5.5:3.5, 0, Math.PI*2);
      ctx.fillStyle = p.owner ? this.getClanColor(p.owner) : '#555566'; ctx.fill();
      if (p.id===this.selectedProvince){ ctx.strokeStyle='#ffe800'; ctx.lineWidth=2.5; ctx.stroke(); }
    }
    ctx.restore();

    // ビューポート枠
    const sx=(mw-6)/850, sy=(mh-16)/630;
    const vpX=mx+3+(-this.offsetX/this.scale - 25)*sx;
    const vpY=my+13+(-this.offsetY/this.scale - 25)*sy;
    const vpW=(this.canvas.width /this.scale)*sx;
    const vpH=(this.canvas.height/this.scale)*sy;
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1;
    ctx.strokeRect(vpX,vpY,vpW,vpH);
    ctx.restore();
  }

  // ── 凡例 ──
  _drawLegend(ctx, x, y) {
    const items = ['🌾農','⛏金','⚓水','🏪商','⛩宗','🌙忍','🐴馬','🌲木'];
    ctx.save();
    ctx.fillStyle='rgba(6,14,24,0.72)';
    ctx.fillRect(x, y-14, items.length*30+6, 18);
    ctx.font='9px "Yu Gothic",sans-serif';
    ctx.fillStyle='rgba(200,165,70,0.65)';
    ctx.textBaseline='middle';
    items.forEach((it,i) => ctx.fillText(it, x+5+i*30, y-5));
    ctx.restore();
  }

  // ── ユーティリティ ──
  _terrainColor(p, base) {
    const s = p.speciality || '';
    if (s.includes('農'))           return this._blend(base,'#4a7c2a',0.45);
    if (s.includes('金山')||s.includes('銀山')) return this._blend(base,'#8B7340',0.48);
    if (s.includes('漁')||s.includes('水軍'))   return this._blend(base,'#1a6090',0.42);
    if (s.includes('商')||s.includes('港')||s.includes('貿易')) return this._blend(base,'#a07800',0.38);
    if (s.includes('木'))           return this._blend(base,'#1a5c28',0.48);
    if (s.includes('忍'))           return this._blend(base,'#5c2880',0.38);
    if (s.includes('宗')||s.includes('寺')) return this._blend(base,'#6e3a10',0.38);
    if (s.includes('製鉄')||s.includes('鉄')) return this._blend(base,'#505860',0.42);
    if (s.includes('馬'))           return this._blend(base,'#706010',0.38);
    if (s.includes('絹'))           return this._blend(base,'#804090',0.32);
    return base;
  }

  _terrainIcon(p) {
    const s = p.speciality || '';
    if (s.includes('農'))   return '🌾';
    if (s.includes('金山')) return '⛏';
    if (s.includes('銀山')) return '💎';
    if (s.includes('漁'))   return '🐟';
    if (s.includes('水軍')) return '⚓';
    if (s.includes('商')||s.includes('港')) return '🏪';
    if (s.includes('貿易')) return '⛵';
    if (s.includes('木'))   return '🌲';
    if (s.includes('忍'))   return '🌙';
    if (s.includes('宗')||s.includes('寺')) return '⛩';
    if (s.includes('公家')) return '👘';
    if (s.includes('陶'))   return '🏺';
    if (s.includes('馬'))   return '🐴';
    if (s.includes('絹'))   return '🎋';
    if (s.includes('製鉄')||s.includes('鉄')) return '⚒';
    return '🏰';
  }

  _blend(c1, c2, t) {
    const a = this._hexToRgb(c1), b = this._hexToRgb(c2);
    if (!a||!b) return c1;
    return `rgb(${Math.round(a.r*(1-t)+b.r*t)},${Math.round(a.g*(1-t)+b.g*t)},${Math.round(a.b*(1-t)+b.b*t)})`;
  }
  _hexToRgb(hex) {
    const m = (hex||'').match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    return m ? {r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)} : null;
  }
  _lighten(c, v) {
    const r = this._hexToRgb(c); if(!r) return c;
    return `rgb(${Math.min(255,r.r+v)},${Math.min(255,r.g+v)},${Math.min(255,r.b+v)})`;
  }
  _darken(c, v) {
    const r = this._hexToRgb(c); if(!r) return c;
    return `rgb(${Math.max(0,r.r-v)},${Math.max(0,r.g-v)},${Math.max(0,r.b-v)})`;
  }

  setSelectedProvince(id) { this.selectedProvince = id; }
  setAttackMode(en, fromId=null) {
    this.attackMode=en; this.attackFrom=fromId;
    this.canvas.style.cursor = en ? 'crosshair' : 'default';
  }
}
