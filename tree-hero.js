/* ============================================================
   SIGNON — 育つ大樹 ファーストビュー（AI生成 3Dモデル版）
   ⏻ スイッチON → 朝日が昇り、種から大樹が育つ
   樹木: 参考画像から TRELLIS で生成した GLB（テクスチャ焼き込み）
   実（フルーツ）= ページナビ / スクロールでも入場可
   ============================================================ */
(function () {
  'use strict';

  var canvas    = document.getElementById('tree-canvas');
  var labelWrap = document.getElementById('tree-labels');
  if (!window.THREE || !canvas || !labelWrap) return;

  var THREE    = window.THREE;
  var W = 0, H = 0;
  var pointer  = { x: 0, y: 0 };
  var isMobile = window.matchMedia('(max-width: 720px)').matches;

  /* ── 状態 ──
     lit  : 0=夜明け前 → 1=朝日が昇りきった状態
     grow : 0=種       → 1=大樹（成長タイムライン） */
  var lit = 0, litTarget = 0, switching = false, fovPunch = 0;
  var grow = 0, growing = false, growStart = -1;
  var intro = true, introProgress = 0, warpVeil = null;
  var flying = false, flyObj = null, flyStartPos = null, flyProgress = 0, flyAction = null;

  /* ── イージング ── */
  function clamp01 (x) { return Math.min(Math.max(x, 0), 1); }
  function win (g, s, e) { return clamp01((g - s) / (e - s)); }
  function easeOutCubic (x) { return 1 - Math.pow(1 - x, 3); }
  function easeOutBack (x) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  /* ── Renderer ── */
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: !isMobile, alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputEncoding    = THREE.sRGBEncoding;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;
  // 色の二重ガンマを防ぐ（鮮やかさの要）
  if (THREE.ColorManagement) {
    THREE.ColorManagement.enabled = true;                       // r150+
    if ('legacyMode' in THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;  // r146
  }
  function srgbTex (t) { t.encoding = THREE.sRGBEncoding; return t; }

  /* ── Scene / Camera ── */
  var scene  = new THREE.Scene();
  var focusX = isMobile ? 0 : 3.6;        // PC:木を左へ（右に理念パネル） / スマホ:中央
  var BASE_Z = isMobile ? 11.5 : 8.2;     // スマホは木を画面いっぱいに
  var FAR_Z  = isMobile ? 64 : 52;
  var camera = new THREE.PerspectiveCamera(82, 1, 0.1, 200);
  camera.position.set(focusX, 3.4, FAR_Z);
  camera.lookAt(focusX, 3.2, 0);

  /* ══════════════════════════════
     空：夜明け前 → 快晴ブルー（クロスフェード）
  ══════════════════════════════ */
  renderer.setClearColor(0x16264e, 1);
  function makeSkySphere (stops, transparent) {
    var sz = 1024, cv = document.createElement('canvas');
    cv.width = 64; cv.height = sz;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, sz);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, sz);
    var mat = new THREE.MeshBasicMaterial({
      map: srgbTex(new THREE.CanvasTexture(cv)), side: THREE.BackSide,
      depthWrite: false, transparent: !!transparent, opacity: transparent ? 0 : 1
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), mat));
    return mat;
  }
  // 夜明け前
  makeSkySphere([
    [0.00,'#0e1d46'], [0.38,'#22356e'], [0.62,'#4a4a82'],
    [0.80,'#8a6078'], [0.93,'#c08a64'], [1.00,'#e8c8a0']
  ], false);
  // 昼（スイッチONでフェードイン）— 原画から抽出した空グラデーション
  var brightSkyMat = makeSkySphere([
    [0.00,'#1f6ae0'], [0.45,'#3f8aec'], [0.72,'#7ab8f4'],
    [0.90,'#c8e6fb'], [1.00,'#eef8ff']
  ], true);
  new THREE.TextureLoader().load('vendor/world/sky_day.png?v=1', function (t) {
    srgbTex(t);
    brightSkyMat.map = t;
    brightSkyMat.needsUpdate = true;
  });

  /* ── 朝日（グロースプライト・lit で昇る） ── */
  function makeGlowTex (r, g, b, size) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size || 256;
    var ctx = cv.getContext('2d');
    var s = cv.width / 2;
    var gg = ctx.createRadialGradient(s, s, 0, s, s, s);
    gg.addColorStop(0,   'rgba(' + r + ',' + g + ',' + b + ',1)');
    gg.addColorStop(0.22,'rgba(' + r + ',' + g + ',' + b + ',0.72)');
    gg.addColorStop(0.55,'rgba(' + r + ',' + g + ',' + b + ',0.18)');
    gg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, cv.width, cv.height);
    var t = new THREE.CanvasTexture(cv); t.premultipliedAlpha = true;
    return srgbTex(t);
  }
  var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTex(255, 214, 130, 256),
    transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sunSprite.scale.setScalar(26);
  sunSprite.position.set(16, -4, -60);
  sunSprite.renderOrder = 2;   // 空のクロスフェード層より手前に描く
  scene.add(sunSprite);

  /* ── 薄明の星（朝が来ると消える） ── */
  var starMat;
  (function () {
    var N = isMobile ? 160 : 300;
    var pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1) * 0.55;   // 上半球寄り
      var r  = 90;
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = Math.abs(r * Math.cos(ph)) * 0.6 + 6;
      pos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starMat = new THREE.PointsMaterial({
      color: 0xfff6e0, size: 0.5, sizeAttenuation: true,
      transparent: true, opacity: 0.8, depthWrite: false
    });
    scene.add(new THREE.Points(geo, starMat));
  })();

  /* ══════════════════════════════
     ライト
  ══════════════════════════════ */
  var hemiLight = new THREE.HemisphereLight(0x9ab8e8, 0x6a7a4a, 0.5);
  scene.add(hemiLight);
  var ambLight = new THREE.AmbientLight(0x6a7088, 0.32);
  scene.add(ambLight);
  var sunDir = new THREE.DirectionalLight(0xffd9a0, 0.5);
  sunDir.position.set(14, 4, 8);
  sunDir.castShadow = true;
  sunDir.shadow.mapSize.set(2048, 2048);
  sunDir.shadow.camera.near = 0.5; sunDir.shadow.camera.far = 70;
  sunDir.shadow.camera.left = sunDir.shadow.camera.bottom = -14;
  sunDir.shadow.camera.right = sunDir.shadow.camera.top  =  14;
  sunDir.shadow.bias = -0.0006;
  scene.add(sunDir);
  // 逆光リム（3Dアニメ的な輪郭のきらめき・朝が来ると効く）
  var rimDir = new THREE.DirectionalLight(0xffe2b8, 0.0);
  rimDir.position.set(-12, 7, -10);
  scene.add(rimDir);

  /* ══════════════════════════════
     地面（草原のドーム）＋丘
  ══════════════════════════════ */
  var groundMat, moundMat;
  // 球面ジオメトリのUVをXZ平面投影に張り替える（渦巻き防止）
  function planarUV (geo, tile) {
    var pos = geo.attributes.position;
    var uv  = geo.attributes.uv;
    for (var i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
    }
    uv.needsUpdate = true;
  }
  (function buildGround () {
    groundMat = new THREE.MeshStandardMaterial({ color: 0x7db84e, roughness: 0.95, metalness: 0 });
    var gGeo = new THREE.SphereGeometry(30, 48, 24);
    planarUV(gGeo, 4.6);
    var ground = new THREE.Mesh(gGeo, groundMat);
    ground.scale.set(1, 0.07, 1);
    ground.position.y = -2.0;
    ground.receiveShadow = true;
    scene.add(ground);

    // 木の足元の丘
    moundMat = new THREE.MeshStandardMaterial({ color: 0x6fb244, roughness: 0.95 });
    var mGeo = new THREE.SphereGeometry(2.2, 24, 16);
    planarUV(mGeo, 4.6);
    var mound = new THREE.Mesh(mGeo, moundMat);
    mound.scale.set(1, 0.42, 1);
    mound.position.y = -0.45;
    mound.receiveShadow = true;
    scene.add(mound);

    // 原画から抽出した草テクスチャ（ヒナギク入り）を貼る
    new THREE.TextureLoader().load('vendor/world/grass_tile.png?v=2', function (t) {
      srgbTex(t);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;   // タイル割りはUV側（planarUV）で実施
      t.anisotropy = 8;
      groundMat.map = t; groundMat.color.set(0xffffff); groundMat.needsUpdate = true;
      moundMat.map = t; moundMat.color.set(0xffffff); moundMat.needsUpdate = true;
    });
  })();

  /* ══════════════════════════════
     背景：白雲・なだらかな丘・遠景の木・岩山
  ══════════════════════════════ */
  var clouds = [];
  (function buildClouds () {
    // 原画から切り出した雲（同一画風）
    var FILES = ['cloud_1.png', 'cloud_0.png'];
    var CFG = [
      { x:-26, y: 13, z:-48, s: 12, spd: 0.010, f: 0 },
      { x:  6, y: 16, z:-52, s: 15, spd: 0.013, f: 1 },
      { x: 26, y: 12, z:-46, s: 10, spd: 0.008, f: 0 },
      { x:-10, y: 18, z:-55, s: 16, spd: 0.011, f: 1 },
      { x: 38, y: 15, z:-50, s: 11, spd: 0.012, f: 0 },
      { x:-40, y: 15, z:-50, s: 13, spd: 0.009, f: 1 },
    ];
    CFG.forEach(function (c) {
      var mat = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false });
      var sp = new THREE.Sprite(mat);
      sp.position.set(c.x, c.y, c.z);
      sp.scale.set(c.s, c.s * 0.6, 1);
      sp.userData.spd = c.spd;
      sp.renderOrder = 2;   // 空のクロスフェード層より手前
      scene.add(sp);
      clouds.push(sp);
      new THREE.TextureLoader().load('vendor/world/' + FILES[c.f] + '?v=2', function (t) {
        srgbTex(t);
        mat.map = t; mat.needsUpdate = true;
        sp.scale.set(c.s, c.s * t.image.height / t.image.width, 1);
      });
    });
  })();

  (function buildBackdrop () {
    // 原画の地平線（丘・遠木・岩山）をそのまま立てる
    function strip (file, x, z, h, ry) {
      var mat = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false });
      var p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      p.position.set(x, 0, z);
      if (ry) p.rotation.y = ry;
      p.renderOrder = 1;
      scene.add(p);
      new THREE.TextureLoader().load('vendor/world/' + file + '?v=2', function (t) {
        srgbTex(t); t.anisotropy = 4;
        mat.map = t; mat.needsUpdate = true;
        var aspect = t.image.width / t.image.height;
        p.scale.set(h * aspect, h, 1);
        p.position.y = -0.55 + h * 0.26;   // 下端のフェードを草に重ねる
      });
    }
    strip('horizon_left.png',  -13.5, -23, 5.4,  0.16);
    strip('horizon_right.png',  13.5, -24, 5.6, -0.15);
  })();

  /* ══════════════════════════════
     本物の3Dツリー（参考画像 → TRELLIS生成のGLB）
  ══════════════════════════════ */
  var TREE_X = isMobile ? 0 : 0.9;      // 左に館のスペースを空ける
  var treeGroup = new THREE.Group();
  treeGroup.position.x = TREE_X;
  scene.add(treeGroup);
  var modelRoot = new THREE.Group();    // GLB本体（成長スケール対象）
  treeGroup.add(modelRoot);
  modelRoot.scale.setScalar(0.0001);
  var fruitLayer = new THREE.Group();   // 実もモデルと一緒に育つ
  treeGroup.add(fruitLayer);
  fruitLayer.scale.setScalar(0.0001);

  var TREE_H = 7.4;                     // 正規化後の樹高
  var treeReady = false;

  (function loadTreeModel () {
    // 参考画像の高解像度切り抜きをビルボードとして立てる
    // （忠実度100%・葉形の落ち影・成長スケール対応）
    var tl = new THREE.TextureLoader();
    tl.load('vendor/models/tree_billboard.png?v=1', function (tex) {
      srgbTex(tex);
      tex.anisotropy = 8;
      var aspect = tex.image.width / tex.image.height;
      var h = TREE_H, w = h * aspect;
      var mat = new THREE.MeshLambertMaterial({
        map: tex, transparent: true, alphaTest: 0.45,
        side: THREE.DoubleSide
      });
      var plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      plane.position.y = h / 2 - 0.12;   // 根元を丘の上面へ沈める
      plane.castShadow = true;            // alphaTest で木のシルエット影
      modelRoot.add(plane);
      treeReady = true;
    }, undefined, function (err) {
      console.error('tree billboard load error:', err);
    });
  })();

  /* ══════════════════════════════
     実（フルーツ）= ナビゲーション
     （満開時の樹冠まわりに配置・モデルと一緒に育つ）
  ══════════════════════════════ */
  var NAV = [
    { label: 'SIGNONとは',     url: 'about.html',              color: 0x0870c9, base: '#33408f', blush: '#6a7fd0' },  // 青プラム
    { label: 'スクールについて', url: 'school.html',            color: 0x29c765, base: '#5fae2f', blush: '#a8d84a' },  // 青リンゴ
    { label: '体験について',     url: 'experience.html',        color: 0xb06fd8, base: '#6a3a9e', blush: '#a878d8' },  // 紫プラム
    { label: '無料体験申込 →',   url: 'https://lin.ee/rTMgnyl', color: 0xff5520, base: '#c83218', blush: '#ff9038' },  // 赤リンゴ
  ];
  // 枝への取り付け点（樹冠の縁・葉のあいだに収まる位置）
  var FRUIT_POS = [
    [-1.70, 4.15, 0.55],
    [ 1.78, 4.45, 0.55],
    [-1.02, 5.45, 0.50],
    [ 1.05, 5.72, 0.50],
  ];
  var fruitMeshes = [];
  var fruitGroups = [];

  /* リンゴ型の回転体（上下にくぼみのある本物の輪郭） */
  function makeAppleGeo (r) {
    var profile = [
      [0.001,-0.92],[0.30,-0.90],[0.58,-0.80],[0.80,-0.58],[0.93,-0.28],
      [0.97, 0.02],[0.93, 0.32],[0.82, 0.58],[0.62, 0.78],[0.38, 0.90],
      [0.20, 0.88],[0.10, 0.80],[0.06, 0.72]
    ];
    var pts = profile.map(function (p) { return new THREE.Vector2(p[0]*r, p[1]*r); });
    var geo = new THREE.LatheGeometry(pts, 28);
    geo.computeVertexNormals();
    return geo;
  }

  /* 果実テクスチャ：下が濃く、上にブラッシュ（血色）＋果点 */
  function makeFruitTex (baseHex, blushHex) {
    var s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    var x = cv.getContext('2d');
    var g = x.createLinearGradient(0, s, 0, 0);
    g.addColorStop(0, baseHex);
    g.addColorStop(1, blushHex);
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    // 縦の淡い縞（リンゴのストライプ）
    for (var i = 0; i < 14; i++) {
      x.strokeStyle = 'rgba(255,255,255,' + (0.03 + Math.random()*0.05).toFixed(3) + ')';
      x.lineWidth = 2 + Math.random()*4;
      var sx = Math.random()*s;
      x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx + (Math.random()*10-5), s); x.stroke();
    }
    // 果点（レンチセル）
    for (var d = 0; d < 36; d++) {
      x.fillStyle = 'rgba(255,240,210,' + (0.10 + Math.random()*0.12).toFixed(3) + ')';
      x.beginPath();
      x.arc(Math.random()*s, Math.random()*s, 0.8 + Math.random()*1.2, 0, Math.PI*2);
      x.fill();
    }
    return srgbTex(new THREE.CanvasTexture(cv));
  }

  /* 小さな葉のテクスチャ（茎に1枚添える） */
  var fruitLeafTex = (function () {
    var s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    var x = cv.getContext('2d'); x.clearRect(0, 0, s, s);
    var g = x.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#7cc24a'); g.addColorStop(1, '#3f8a22');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(s*0.5, 2);
    x.bezierCurveTo(s*0.95, s*0.3, s*0.85, s*0.75, s*0.5, s-2);
    x.bezierCurveTo(s*0.15, s*0.75, s*0.05, s*0.3, s*0.5, 2);
    x.fill();
    x.strokeStyle = 'rgba(40,90,25,0.7)'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(s*0.5, 4); x.lineTo(s*0.5, s-5); x.stroke();
    return srgbTex(new THREE.CanvasTexture(cv));
  })();
  var stemMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.85, metalness: 0 });

  /* ぶら下がる果実を1つ作る（pivot=枝への取り付け点） */
  function buildFruit (opt) {
    var r = opt.r;
    var grp = new THREE.Group();
    grp.position.set(opt.pos[0], opt.pos[1], opt.pos[2]);
    fruitLayer.add(grp);

    // 茎（葉に隠れた枝から長めに垂れる）
    var stemLen = r * 1.15;
    var stem = new THREE.Mesh(
      new THREE.CylinderGeometry(r*0.06, r*0.085, stemLen, 7),
      stemMat
    );
    stem.position.y = -stemLen / 2;
    stem.rotation.z = 0.12;
    grp.add(stem);

    // 葉（茎の付け根に1枚）
    var leaf = new THREE.Mesh(
      new THREE.PlaneGeometry(r*0.85, r*0.5),
      new THREE.MeshLambertMaterial({ map: fruitLeafTex, alphaTest: 0.4, side: THREE.DoubleSide })
    );
    leaf.position.set(r*0.32, -stemLen*0.35, 0.02);
    leaf.rotation.set(-0.5, 0.3, -0.9);
    grp.add(leaf);

    // 果実本体（艶のあるワックス質）
    var mat = new THREE.MeshPhongMaterial({
      map: makeFruitTex(opt.base, opt.blush),
      shininess: 70, specular: 0x99775f,
      emissive: opt.color, emissiveIntensity: 0.05
    });
    var apple = new THREE.Mesh(makeAppleGeo(r), mat);
    apple.position.y = -(stemLen + r * 0.86);
    apple.rotation.y = Math.random() * Math.PI * 2;
    apple.castShadow = true;
    apple.userData = opt.userData;
    apple.userData.grp = grp;
    grp.add(apple);

    // ほのかな色グロー（クリック誘導・控えめ）
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTex((opt.color>>16)&255, (opt.color>>8)&255, opt.color&255, 128),
      transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.setScalar(r * 3.0);
    glow.position.copy(apple.position);
    grp.add(glow);

    return { group: grp, apple: apple, glow: glow };
  }

  NAV.forEach(function (n, i) {
    var f = buildFruit({
      r: 0.25, pos: FRUIT_POS[i],
      base: n.base, blush: n.blush, color: n.color,
      userData: { nav: n, isFruit: true }
    });
    fruitMeshes.push(f.apple);
    fruitGroups.push(f);
  });

  // 上部の黄金のリンゴ = サイトへ入る（梢の葉の中から覗く）
  var goldFruitObj = buildFruit({
    r: 0.30, pos: [0.15, 6.60, 0.45],
    base: '#c88a10', blush: '#ffd860', color: 0xffb030,
    userData: { isGold: true }
  });
  goldFruitObj.apple.material.emissiveIntensity = 0.22;   // 黄金だけ少し神々しく
  var goldFruit = goldFruitObj.apple;
  fruitGroups.push(goldFruitObj);

  /* ══════════════════════════════
     未来感：ホログラム演出
     （樹冠を巡る軌道リング＋根元のテックサークル＋光の微粒子）
  ══════════════════════════════ */
  var holoGroup = new THREE.Group();
  holoGroup.position.x = TREE_X;
  holoGroup.scale.setScalar(0.0001);
  scene.add(holoGroup);
  var holoRings = [];   // { mesh, baseOp, spin }
  var holoNodes = [];   // リング上を巡る光ノード

  (function buildHolo () {
    function ring (radius, y, tiltX, color, op) {
      var m = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.016, 8, 96),
        new THREE.MeshBasicMaterial({
          color: color, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      m.position.y = y;
      m.rotation.x = tiltX;
      m.renderOrder = 3;
      holoGroup.add(m);
      holoRings.push({ mesh: m, baseOp: op, spin: (Math.random() < 0.5 ? 1 : -1) * (0.10 + Math.random() * 0.10) });
    }
    ring(3.45, 4.9, Math.PI / 2.18, 0x6fd8ff, 0.65);   // シアンの大リング
    ring(2.55, 6.0, Math.PI / 1.92, 0xffd080, 0.48);   // 金の小リング
    ring(3.00, 5.4, Math.PI / 2.6,  0x9fe8ff, 0.36);   // 斜めの中リング

    for (var i = 0; i < 7; i++) {
      var col = i % 3 === 0 ? 0xffd080 : 0x8fe2ff;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTex((col >> 16) & 255, (col >> 8) & 255, col & 255, 64),
        transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      sp.scale.setScalar(i % 3 === 0 ? 0.5 : 0.34);
      sp.renderOrder = 3;
      holoGroup.add(sp);
      holoNodes.push({
        sp: sp,
        r: i % 2 ? 3.35 : 2.45,
        y: i % 2 ? 4.9 : 6.0,
        ang: Math.random() * Math.PI * 2,
        spd: 0.25 + Math.random() * 0.30,
        baseOp: 0.85
      });
    }
  })();

  // 根元のテックサークル（草に投影されたUI円陣）
  var groundHolo = new THREE.Group();
  groundHolo.position.set(TREE_X, 0.50, 0);
  groundHolo.rotation.x = -Math.PI / 2;
  groundHolo.scale.setScalar(0.0001);
  scene.add(groundHolo);
  var groundLayers = [];   // { mesh, baseOp, spin }

  (function buildGroundHolo () {
    function dashTex (dashes, radius, width, color) {
      var s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
      var x = cv.getContext('2d');
      x.translate(s / 2, s / 2);
      x.strokeStyle = color; x.lineWidth = width;
      for (var i = 0; i < dashes; i++) {
        var a0 = (i / dashes) * Math.PI * 2;
        var a1 = a0 + (Math.PI * 2 / dashes) * 0.55;
        x.beginPath(); x.arc(0, 0, radius, a0, a1); x.stroke();
      }
      return srgbTex(new THREE.CanvasTexture(cv));
    }
    function layer (tex, size, op, spin) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      m.renderOrder = 2;
      groundHolo.add(m);
      groundLayers.push({ mesh: m, baseOp: op, spin: spin });
    }
    layer(dashTex(36, 96, 6,  'rgba(120,220,255,1)'), 4.8, 0.62,  0.12);   // 細かい目盛り
    layer(dashTex(12, 70, 10, 'rgba(255,210,130,1)'), 4.8, 0.48, -0.20);   // 金の太目盛り（逆回転）
    var solid = new THREE.Mesh(
      new THREE.RingGeometry(2.18, 2.26, 72),
      new THREE.MeshBasicMaterial({
        color: 0x8fe2ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      })
    );
    solid.renderOrder = 2;
    groundHolo.add(solid);
    groundLayers.push({ mesh: solid, baseOp: 0.50, spin: 0 });
  })();

  // 漂う光の微粒子（ホタルのように上昇）
  var MOTE_N = isMobile ? 28 : 50;
  var moteGeo, motePts, moteSeed = [];
  (function buildMotes () {
    var pos = new Float32Array(MOTE_N * 3);
    for (var i = 0; i < MOTE_N; i++) {
      pos[i*3]   = TREE_X + (Math.random() - 0.5) * 5.4;
      pos[i*3+1] = 0.6 + Math.random() * 6.4;
      pos[i*3+2] = -0.6 + Math.random() * 2.2;
      moteSeed.push(0.15 + Math.random() * 0.35);
    }
    moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motePts = new THREE.Points(moteGeo, new THREE.PointsMaterial({
      map: makeGlowTex(160, 230, 255, 32),
      color: 0xbfeaff, size: 0.16, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    motePts.renderOrder = 3;
    scene.add(motePts);
  })();

  /* ══════════════════════════════
     種＋⏻スイッチ
  ══════════════════════════════ */
  var seedGroup = new THREE.Group();
  seedGroup.position.x = TREE_X;   // 種は木の生える場所に
  scene.add(seedGroup);
  var seed = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.55, metalness: 0.08 })
  );
  seed.scale.set(1, 1.25, 1);
  seed.position.y = 0.30;
  seed.castShadow = true;
  seed.userData = { isSeed: true };
  seedGroup.add(seed);

  var seedGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTex(255, 196, 110, 128),
    transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  seedGlow.scale.setScalar(2.4);
  seedGlow.position.y = 0.35;
  seedGroup.add(seedGlow);

  var powerSprite = (function () {
    var s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
    var x = cv.getContext('2d');
    x.strokeStyle = '#ffffff'; x.lineCap = 'round';
    x.shadowColor = '#ffe9b0'; x.shadowBlur = 26;
    x.lineWidth = 20;
    x.beginPath(); x.arc(s/2, s/2 + 8, 64, -Math.PI/2 + 0.62, -Math.PI/2 - 0.62 + Math.PI*2); x.stroke();
    x.beginPath(); x.moveTo(s/2, s/2 - 78); x.lineTo(s/2, s/2 - 4); x.stroke();
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: srgbTex(new THREE.CanvasTexture(cv)),
      transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sp.scale.setScalar(0.9);
    sp.position.set(0, 1.35, 0);
    seedGroup.add(sp);
    return sp;
  })();

  /* ══════════════════════════════
     花・舞う花びら・鳥（成長後のにぎわい）
  ══════════════════════════════ */
  var flowers = [];
  (function buildFlowers () {
    var cols = [0xff8aa0, 0xffd24a, 0xffffff, 0xff9a5c];
    for (var i = 0; i < 14; i++) {
      var g = new THREE.Group();
      var a = Math.random() * Math.PI * 2;
      var r = 2.6 + Math.random() * 5.5;
      g.position.set(Math.cos(a) * r, -0.02, Math.sin(a) * r * 0.8 + 1.0);
      var stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.02, 0.3, 5),
        new THREE.MeshStandardMaterial({ color: 0x3f8f2f, roughness: 0.9 })
      );
      stem.position.y = 0.15; g.add(stem);
      var head = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 8),
        new THREE.MeshStandardMaterial({
          color: cols[i % cols.length], roughness: 0.6,
          emissive: cols[i % cols.length], emissiveIntensity: 0.12
        })
      );
      head.position.y = 0.33; g.add(head);
      g.scale.setScalar(0.0001);
      g.userData.delay = Math.random() * 0.1;
      scene.add(g);
      flowers.push(g);
    }
  })();

  var petalPts, petalGeo;
  (function buildPetals () {
    var N = isMobile ? 30 : 55;
    var pos = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 12;
      pos[i*3+1] = Math.random() * 8 + 1;
      pos[i*3+2] = (Math.random() - 0.5) * 8;
    }
    petalGeo = new THREE.BufferGeometry();
    petalGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    petalPts = new THREE.Points(petalGeo, new THREE.PointsMaterial({
      color: 0xffd7e0, size: 0.14, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false
    }));
    scene.add(petalPts);
  })();

  var birds = [];
  for (var bi = 0; bi < 4; bi++) {
    var bg = new THREE.BufferGeometry();
    var bp = new Float32Array([-0.26,0,0, 0,0.12,0, 0.26,0,0, 0,0.10,0]);
    bg.setAttribute('position', new THREE.BufferAttribute(bp.slice(), 3));
    bg.setIndex([0,1,1,2,2,3,3,0]);
    var bird = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({
      color: 0x33445a, transparent: true, opacity: 0
    }));
    bird.position.set((Math.random()-0.5)*26, 6.5+Math.random()*3.5, -8-Math.random()*8);
    bird.scale.setScalar(0.5 + Math.random()*0.4);
    bird.userData = { spd: 0.025 + Math.random()*0.02, flap: 3+Math.random()*3 };
    scene.add(bird);
    birds.push(bird);
  }

  /* ══════════════════════════════
     HTML ラベル
  ══════════════════════════════ */
  var sunLabelDiv = document.createElement('div');
  sunLabelDiv.className = 'tree-label';
  sunLabelDiv.textContent = '⏻ スイッチを押して、はじめよう';
  sunLabelDiv.style.cssText = 'background:linear-gradient(120deg,#ffb030,#ff7a2f);box-shadow:0 4px 24px -6px #ff882099;font-size:15px;padding:9px 22px;';
  sunLabelDiv.addEventListener('click', function () { switchOn(); });
  labelWrap.appendChild(sunLabelDiv);

  var htmlLabels = [sunLabelDiv];
  NAV.forEach(function (n, i) {
    var div = document.createElement('div');
    div.className = 'tree-label';
    div.textContent = n.label;
    var hex = '#' + n.color.toString(16).padStart(6, '0');
    div.style.cssText = 'background:' + hex + ';box-shadow:0 4px 18px -5px ' + hex + 'aa;';
    div.addEventListener('click', function () { flyTo(fruitMeshes[i]); });
    labelWrap.appendChild(div);
    htmlLabels.push(div);
  });
  var goldLabelDiv = document.createElement('div');
  goldLabelDiv.className = 'tree-label';
  goldLabelDiv.textContent = '☀️ サイトへ入る';
  goldLabelDiv.style.cssText = 'background:linear-gradient(120deg,#ffc050,#ff9020);box-shadow:0 4px 20px -5px #ffa030aa;';
  goldLabelDiv.addEventListener('click', function () { enterSite(); });
  labelWrap.appendChild(goldLabelDiv);
  htmlLabels.push(goldLabelDiv);

  /* ══════════════════════════════
     スキルバースト＆スイッチON
  ══════════════════════════════ */
  var container = document.getElementById('tree-hero');

  function spawnSkillBurst () {
    var SKILLS = [
      { t: '表現力',       c: '#ff7a2f' },
      { t: '探究力',       c: '#0870c9' },
      { t: '協働力',       c: '#29c765' },
      { t: '倫理的思考力', c: '#b06fd8' },
      { t: '創造力',       c: '#ffb030' }
    ];
    var sp = new THREE.Vector3(0, 1.0, 0); sp.project(camera);
    var cx = (sp.x *  0.5 + 0.5) * W;
    var cy = (sp.y * -0.5 + 0.5) * H;
    SKILLS.forEach(function (s, i) {
      var el = document.createElement('span');
      el.className = 'skill-pop';
      el.textContent = s.t;
      var ang  = (-90 + (i - 2) * 38) * Math.PI / 180;
      var dist = 150 + Math.random() * 90;
      el.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;color:' + s.c + ';' +
        '--dx:' + (Math.cos(ang) * dist).toFixed(0) + 'px;' +
        '--dy:' + (Math.sin(ang) * dist).toFixed(0) + 'px;' +
        'animation-delay:' + (i * 110) + 'ms;';
      container.appendChild(el);
      setTimeout(function () { el.remove(); }, 2000 + i * 110);
    });
  }

  function switchOn () {
    if (intro || switching) return;
    if (litTarget === 1) { enterSite(); return; }
    switching = true;
    litTarget = 1;
    growing = true; growStart = -1;   // 次フレームで開始
    fovPunch = 1;
    if (warpVeil) {
      warpVeil.style.transition = 'opacity .16s ease';
      warpVeil.style.background = 'radial-gradient(circle at 50% 60%, rgba(255,248,220,.95) 0%, rgba(255,214,150,.5) 45%, rgba(255,190,110,0) 78%)';
      warpVeil.style.opacity = '1';
      setTimeout(function () {
        warpVeil.style.transition = 'opacity 1.1s ease';
        warpVeil.style.opacity = '0';
      }, 210);
    }
    spawnSkillBurst();
    sunLabelDiv.style.opacity = '0';
    sunLabelDiv.style.pointerEvents = 'none';
    setTimeout(function () { switching = false; }, 1200);
  }

  function enterSite () {
    var d = document.getElementById('about-intro');
    if (d) d.scrollIntoView({ behavior: 'smooth' });
  }

  /* ══════════════════════════════
     フライト（実へ飛んで遷移）
  ══════════════════════════════ */
  function startFlight (obj, action) {
    if (flying) return;
    flying = true; flyObj = obj; flyStartPos = camera.position.clone();
    flyProgress = 0; flyAction = action;
    canvas.style.cursor = 'default';
    if (labelWrap) { labelWrap.style.transition = 'opacity .4s'; labelWrap.style.opacity = '0'; }
    var sc = document.querySelector('.space-copy'); if (sc) { sc.style.transition = 'opacity .4s'; sc.style.opacity = '0'; }
    var th = document.querySelector('.tree-hint');  if (th) { th.style.transition = 'opacity .4s'; th.style.opacity = '0'; }
  }
  function flyTo (obj) {
    if (intro || flying || switching) return;
    if (obj.userData.isSeed) { switchOn(); return; }
    if (obj.userData.isGold) { enterSite(); return; }
    if (obj.userData.nav && grow > 0.95) {
      var u = obj.userData.nav.url;
      startFlight(obj, function () { window.location.href = u; });
    }
  }

  /* ══════════════════════════════
     ラベル投影（近づくと表示）
  ══════════════════════════════ */
  var _v = new THREE.Vector3();
  var mousePX = -9999, mousePY = -9999;
  var LABEL_REVEAL = 180;
  function placeLabel (el, vx, vy, vz, alwaysMin) {
    var lx = (vx *  0.5 + 0.5) * W;
    var ly = (vy * -0.5 + 0.5) * H;
    el.style.left = lx + 'px';
    el.style.top  = ly + 'px';
    if (vz > 1) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
    var op;
    if (isMobile) op = 1;
    else {
      var d = Math.hypot(lx - mousePX, ly - mousePY);
      op = d < LABEL_REVEAL ? Math.min(1, (LABEL_REVEAL - d) / LABEL_REVEAL * 1.8) : 0;
    }
    if (alwaysMin) op = Math.max(op, alwaysMin);
    el.style.opacity = op.toFixed(2);
    el.style.pointerEvents = op > 0.5 ? 'auto' : 'none';
  }
  function updateLabels () {
    // スイッチ（種）：成長前のみ
    if (grow < 0.05) {
      seed.getWorldPosition(_v); _v.y += 1.5; _v.project(camera);
      placeLabel(sunLabelDiv, _v.x, _v.y, _v.z, 0.6);
    } else {
      sunLabelDiv.style.opacity = '0'; sunLabelDiv.style.pointerEvents = 'none';
    }
    // 実：成長後のみ
    fruitMeshes.forEach(function (f, i) {
      var el = htmlLabels[i + 1];
      if (grow < 0.9) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
      f.getWorldPosition(_v); _v.y += 0.5; _v.project(camera);
      placeLabel(el, _v.x, _v.y, _v.z);
    });
    // 金の実
    if (grow < 0.95) { goldLabelDiv.style.opacity = '0'; goldLabelDiv.style.pointerEvents = 'none'; }
    else {
      goldFruit.getWorldPosition(_v); _v.y += 0.55; _v.project(camera);
      placeLabel(goldLabelDiv, _v.x, _v.y, _v.z, 0.55);
    }
  }

  /* ══════════════════════════════
     Raycaster
  ══════════════════════════════ */
  var ray = new THREE.Raycaster(), mNDC = new THREE.Vector2(), hovered = null;
  var clickables = [seed].concat(fruitMeshes).concat([goldFruit]);
  function setNDC (cx, cy) {
    var rc = canvas.getBoundingClientRect();
    mNDC.x =  ((cx - rc.left) / rc.width)  * 2 - 1;
    mNDC.y = -((cy - rc.top)  / rc.height) * 2 + 1;
  }
  canvas.addEventListener('mousemove', function (e) {
    mousePX = e.clientX; mousePY = e.clientY;
    setNDC(e.clientX, e.clientY);
    ray.setFromCamera(mNDC, camera);
    var hits = ray.intersectObjects(clickables);
    if (hovered) { (hovered.userData.grp || hovered).scale.setScalar(1); canvas.style.cursor = 'default'; hovered = null; }
    if (hits.length) {
      hovered = hits[0].object;
      if (!hovered.userData.isSeed) (hovered.userData.grp || hovered).scale.setScalar(1.15);
      canvas.style.cursor = 'pointer';
    }
  }, { passive: true });
  canvas.addEventListener('click', function (e) {
    setNDC(e.clientX, e.clientY);
    ray.setFromCamera(mNDC, camera);
    var hits = ray.intersectObjects(clickables);
    if (hits.length) flyTo(hits[0].object);
  });
  canvas.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0];
    setNDC(t.clientX, t.clientY);
    ray.setFromCamera(mNDC, camera);
    var hits = ray.intersectObjects(clickables);
    if (hits.length) flyTo(hits[0].object);
  }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    pointer.x = (e.clientX / Math.max(window.innerWidth,  1) - 0.5) * 2;
    pointer.y = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
  }, { passive: true });

  /* ══════════════════════════════
     リサイズ・暗幕
  ══════════════════════════════ */
  function resize () {
    W = container.clientWidth; H = container.clientHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  warpVeil = document.createElement('div');
  warpVeil.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;' +
    'background:radial-gradient(circle at center, rgba(10,16,40,0) 0%, rgba(6,10,28,0.8) 70%, #060a18 100%);';
  container.appendChild(warpVeil);
  if (labelWrap) labelWrap.style.opacity = '0';

  /* ══════════════════════════════
     成長の適用（GLBモデルをぽんっと育てる）
  ══════════════════════════════ */
  function applyGrowth (t) {
    var w = easeOutBack(win(grow, 0.04, 0.82));
    var breathe = 1 + Math.sin(t * 1.1) * 0.012 * grow;
    var s = Math.max(w * breathe, 0.0001);
    modelRoot.scale.setScalar(s);
    fruitLayer.scale.setScalar(s);
    // 種：成長が始まったら土に還る
    var seedShrink = 1 - win(grow, 0, 0.1);
    seedGroup.scale.setScalar(Math.max(seedShrink, 0.0001));
    // 未来ホログラム：木が育ってから展開
    var hw = easeOutBack(win(grow, 0.62, 0.95));
    holoGroup.scale.setScalar(Math.max(hw, 0.0001));
    var gw = easeOutBack(win(grow, 0.55, 0.90));
    groundHolo.scale.setScalar(Math.max(gw, 0.0001));
    // 花
    flowers.forEach(function (f) {
      var fw = easeOutBack(win(grow, 0.8 + f.userData.delay, 0.97 + f.userData.delay));
      f.scale.setScalar(Math.max(fw, 0.0001));
    });
  }

  /* ══════════════════════════════
     メインループ
  ══════════════════════════════ */
  var clock = new THREE.Clock();

  function renderFrame () {
    if (window.scrollY > window.innerHeight * 0.9) return;
    var t = clock.getElapsedTime();

    /* 点灯（朝日）ファクター */
    lit += (litTarget - lit) * 0.04;
    brightSkyMat.opacity = lit;
    starMat.opacity = 0.8 * (1 - lit);
    hemiLight.intensity = 0.45 + 0.42 * lit;
    hemiLight.color.setHSL(0.58 - 0.06 * lit, 0.55, 0.62 + 0.08 * lit);
    ambLight.intensity  = 0.30 + 0.14 * lit;
    sunDir.intensity    = 0.5 + 1.55 * lit;
    sunDir.position.set(14, 4 + 9 * lit, 8);
    rimDir.intensity    = 0.6 * lit;
    sunSprite.material.opacity = 0.85 * lit;
    sunSprite.position.y = -4 + 13 * lit;

    /* 成長タイムライン（スイッチ後 約2.8秒） */
    if (growing) {
      if (growStart < 0) growStart = t;
      grow = clamp01((t - growStart) / 2.8);
      if (grow >= 1) {
        growing = false;
        if (labelWrap) { labelWrap.style.transition = 'opacity .8s'; labelWrap.style.opacity = '1'; }
      }
    }
    applyGrowth(t);

    /* 木全体のそよぎ */
    treeGroup.rotation.z = Math.sin(t * 0.5) * 0.012 * grow + pointer.x * 0.010;

    /* 種＆⏻ の誘い */
    if (grow < 0.05) {
      seedGlow.material.opacity = 0.4 + Math.sin(t * 2.2) * 0.18;
      powerSprite.material.opacity = 0.8 + Math.sin(t * 2.2) * 0.2;
      powerSprite.scale.setScalar(0.9 * (1 + Math.sin(t * 2.2) * 0.06));
      seed.rotation.y = t * 0.4;
    }

    /* 実：枝からぶら下がって風に揺れる */
    fruitGroups.forEach(function (fg, i) {
      fg.group.rotation.z = Math.sin(t * 1.05 + i * 1.4) * 0.075;
      fg.group.rotation.x = Math.cos(t * 0.85 + i * 0.9) * 0.05;
      fg.glow.material.opacity = 0.12 + Math.sin(t * 1.5 + i) * 0.05;
    });
    fruitMeshes.forEach(function (f, i) {
      f.material.emissiveIntensity = 0.04 + Math.sin(t * 1.6 + i) * 0.025;
    });
    goldFruit.material.emissiveIntensity = 0.18 + Math.sin(t * 1.8) * 0.08;

    /* 未来ホログラムのアニメーション */
    var holoVis = lit * win(grow, 0.62, 0.95);
    holoRings.forEach(function (r) {
      r.mesh.rotation.z += r.spin * 0.016;
      r.mesh.material.opacity = r.baseOp * holoVis * (0.85 + Math.sin(t * 1.6) * 0.15);
    });
    holoNodes.forEach(function (n) {
      n.ang += n.spd * 0.016;
      n.sp.position.set(
        Math.cos(n.ang) * n.r,
        n.y + Math.sin(n.ang) * 0.30,
        Math.sin(n.ang) * n.r * 0.92
      );
      n.sp.material.opacity = n.baseOp * holoVis;
    });
    groundLayers.forEach(function (g) {
      if (g.spin) g.mesh.rotation.z += g.spin * 0.016;
      g.mesh.material.opacity = g.baseOp * (0.8 + Math.sin(t * 2.0) * 0.2) * lit * win(grow, 0.55, 0.90);
    });
    if (motePts) {
      motePts.material.opacity = 0.7 * holoVis;
      var mp = moteGeo.attributes.position.array;
      for (var mi = 0; mi < MOTE_N; mi++) {
        mp[mi*3+1] += moteSeed[mi] * 0.016;
        mp[mi*3]   += Math.sin(t * 0.8 + mi) * 0.0015;
        if (mp[mi*3+1] > 7.4) mp[mi*3+1] = 0.5;
      }
      moteGeo.attributes.position.needsUpdate = true;
    }

    /* 白雲（昼になると現れ、ゆっくり流れる） */
    clouds.forEach(function (c) {
      c.material.opacity = 0.92 * lit;
      c.position.x += c.userData.spd;
      if (c.position.x > 46) c.position.x = -46;
    });

    /* 花びら（成長後に舞う） */
    petalPts.material.opacity = 0.75 * win(grow, 0.9, 1);
    if (grow > 0.9) {
      var pp = petalGeo.attributes.position.array;
      for (var pi = 0; pi < pp.length; pi += 3) {
        pp[pi]   += Math.sin(t * 0.7 + pi) * 0.004;
        pp[pi+1] -= 0.008;
        if (pp[pi+1] < 0) pp[pi+1] = 7 + Math.random() * 2;
      }
      petalGeo.attributes.position.needsUpdate = true;
    }

    /* 鳥（成長後に飛来） */
    birds.forEach(function (b) {
      b.material.opacity = 0.85 * win(grow, 0.85, 1);
      if (grow > 0.85) {
        b.position.x += b.userData.spd;
        if (b.position.x > 18) b.position.x = -18;
        var pa = b.geometry.attributes.position.array;
        pa[1]  = Math.sin(t * b.userData.flap) * 0.13;
        pa[10] = Math.sin(t * b.userData.flap + 0.5) * 0.10;
        b.geometry.attributes.position.needsUpdate = true;
      }
    });

    /* カメラ */
    if (intro) {
      introProgress = Math.min(introProgress + 1/96, 1);
      var ie = 1 - Math.pow(2, -10 * introProgress);
      camera.position.set(focusX, 3.4, FAR_Z + (BASE_Z - FAR_Z) * ie);
      camera.lookAt(focusX, 3.2, 0);
      camera.fov = 82 - 26 * ie;
      camera.updateProjectionMatrix();
      if (warpVeil) warpVeil.style.opacity = String(Math.max(0, 1 - introProgress * 1.4));
      if (introProgress >= 1) {
        intro = false;
        camera.fov = 56; camera.updateProjectionMatrix();
        if (warpVeil) { warpVeil.style.transition = 'opacity .6s'; warpVeil.style.opacity = '0'; }
        if (labelWrap) { labelWrap.style.transition = 'opacity .8s'; labelWrap.style.opacity = '1'; }
      }
    } else if (flying && flyObj) {
      flyProgress = Math.min(flyProgress + 0.014, 1);
      var fe = flyProgress < 0.5
        ? 4 * flyProgress * flyProgress * flyProgress
        : 1 - Math.pow(-2 * flyProgress + 2, 3) / 2;
      var tp = new THREE.Vector3(); flyObj.getWorldPosition(tp);
      var frontDir = new THREE.Vector3().subVectors(flyStartPos, tp).normalize();
      var dest = tp.clone().add(frontDir.multiplyScalar(1.1));
      camera.position.lerpVectors(flyStartPos, dest, fe);
      camera.lookAt(tp);
      camera.fov = 56 + Math.sin(flyProgress * Math.PI) * 20;
      camera.updateProjectionMatrix();
      if (flyProgress >= 1) {
        flying = false;
        camera.fov = 56; camera.updateProjectionMatrix();
        if (flyAction) flyAction();
      }
    } else {
      // 通常：ゆったりドリフト（成長後も近くを保ち、木を大きく見せる）
      var pull = 0.3 * win(grow, 0.3, 1);
      camera.position.x += (focusX + pointer.x * 1.2 - camera.position.x) * 0.03;
      camera.position.y  = 3.6 + Math.sin(t * 0.18) * 0.12 - pointer.y * 0.5 + 0.5 * win(grow, 0.3, 1);
      camera.position.z += ((BASE_Z + pull) - camera.position.z) * 0.02;
      camera.lookAt(focusX, 3.5 + 0.4 * grow, 0);
      if (fovPunch > 0.001) {
        camera.fov = 56 + fovPunch * 10;
        fovPunch *= 0.90;
        camera.updateProjectionMatrix();
      }
    }

    renderer.render(scene, camera);
    updateLabels();
  }

  renderer.setAnimationLoop(renderFrame);

  /* ── 検証用フック ── */
  window.__space = {
    skipIntro: function () {
      intro = false; introProgress = 1;
      camera.position.set(focusX, 3.4, BASE_Z);
      camera.fov = 56; camera.updateProjectionMatrix();
      if (warpVeil) { warpVeil.style.transition = 'none'; warpVeil.style.opacity = '0'; }
      if (labelWrap) { labelWrap.style.transition = 'none'; labelWrap.style.opacity = '1'; }
    },
    tick: function () { renderFrame(); },
    setLit: function (v) { lit = v; litTarget = v; },
    setGrow: function (v) { grow = v; growing = false; if (v > 0) { lit = 1; litTarget = 1; } },
    switchOn: function () { switchOn(); },
    isTreeReady: function () { return treeReady; },
    scene: scene, camera: camera
  };

}());
