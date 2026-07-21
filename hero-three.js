(function () {
  var canvas = document.querySelector(".hero-three");
  if (!window.THREE || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var THREE = window.THREE;
  var isMobile = window.matchMedia("(max-width: 720px)").matches;
  var hasHeroCanvas = !!canvas;
  var pointer = { x: 0, y: 0 };

  /* ====================================================
     1. SPATIAL PAGE MOTION  (全ページ CSS 3D + tilt)
     ==================================================== */
  function installSpatialPageMotion() {
    document.body.classList.add("spatial-home");
    if (document.querySelector(".hero")) document.body.classList.add("signon-growth-home");

    var sections = Array.prototype.slice.call(document.querySelectorAll(
      ".hero, .about-v2-hero, .page-head, .xp2-hero, " +
      ".section, .about-v2-section, .intro, .reasons, .pillars, .make, .cta, " +
      ".manifesto, .grade, .promo, .about-v2-cta, .xp2-worry, .xp2-philo, " +
      ".xp2-cycle, .xp2-powers, .xp2-trans, .xp2-why, .xp2-menu, .xp2-trial, .xp2-final"
    ));
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle("in-view", entry.isIntersecting);
        });
      }, { threshold: 0.18, rootMargin: "-8% 0px -12% 0px" });
      sections.forEach(function (section) { observer.observe(section); });
    } else {
      sections.forEach(function (section) { section.classList.add("in-view"); });
    }

    window.addEventListener("pointermove", function (event) {
      pointer.x = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      pointer.y = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      document.body.style.setProperty("--mx", pointer.x.toFixed(3));
      document.body.style.setProperty("--my", pointer.y.toFixed(3));
    }, { passive: true });

    window.addEventListener("scroll", function () {
      document.body.style.setProperty("--scroll-depth", Math.round(window.scrollY));
    }, { passive: true });

    var tiltTargets = Array.prototype.slice.call(document.querySelectorAll(
      ".goal-card, .feature-card, .school, .lesson-step, .strength-card, " +
      ".safety-card, .price-item, .qa, .xp2-phase, .xp2-power, .xp2-transform, " +
      ".xp2-card, .xp2-trial__detail, .about-v2-visual, .page-head__visual, " +
      ".school-card-panel, .xp2-collage, .btn, .nav__cta, .line-add, .brand, " +
      ".nav__links a, .slot, .hero__visual, .hero__video, .intro__visual, " +
      ".xp2-worry__visual, .xp2-why__visual, .xp2-trial__visual, .flow-card, " +
      ".mini-panel, .make-card, .skill, .age-card, .pillar, .reason, .strength, " +
      ".xp2-philo__card, .safety-card__icon, .flow-card__icon, .make-card__badgeicon, " +
      ".goal-card__icon, .xp2-card__emoji"
    ));
    tiltTargets.forEach(function (target) {
      target.classList.add("three-tilt");
      target.addEventListener("pointermove", function (event) {
        if (isMobile) return;
        var rect = target.getBoundingClientRect();
        var x = (event.clientX - rect.left) / Math.max(rect.width, 1);
        var y = (event.clientY - rect.top) / Math.max(rect.height, 1);
        target.style.setProperty("--card-ry", ((x - 0.5) * 9).toFixed(2) + "deg");
        target.style.setProperty("--card-rx", ((0.5 - y) * 7).toFixed(2) + "deg");
        target.style.setProperty("--glow-x", (x * 100).toFixed(1) + "%");
        target.style.setProperty("--glow-y", (y * 100).toFixed(1) + "%");
      }, { passive: true });
      target.addEventListener("pointerleave", function () {
        target.style.removeProperty("--card-ry");
        target.style.removeProperty("--card-rx");
        target.style.removeProperty("--glow-x");
        target.style.removeProperty("--glow-y");
      }, { passive: true });
    });
  }

  installSpatialPageMotion();

  /* ====================================================
     2. SITE BACKGROUND DEPTH LAYER  (全ページ背景 WebGL)
     ==================================================== */
  function createSiteDepthLayer() {
    var bgCanvas = document.createElement("canvas");
    bgCanvas.className = "site-three-bg";
    bgCanvas.setAttribute("aria-hidden", "true");
    document.body.prepend(bgCanvas);

    var bgRenderer = new THREE.WebGLRenderer({
      canvas: bgCanvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance"
    });
    bgRenderer.setClearColor(0xffffff, 0);
    bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hasHeroCanvas ? 1 : 1.15));

    var bgScene = new THREE.Scene();
    var bgCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    bgCamera.position.set(0, 0, 13);

    var bgRoot = new THREE.Group();
    var bgRings = new THREE.Group();
    var bgRibbons = new THREE.Group();
    bgScene.add(bgRoot);
    bgScene.add(bgRings);
    bgScene.add(bgRibbons);
    bgScene.add(new THREE.AmbientLight(0xffffff, 0.9));

    var bgPalette = [0x54c6ff, 0x2f6ed3, 0xff8545, 0x8fd8ff];
    var bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x54c6ff,
      transparent: true,
      opacity: 0.32,
      wireframe: true,
      depthWrite: false
    });
    var bgMeshes = [];
    var shapes = [
      new THREE.IcosahedronGeometry(0.8, 1),
      new THREE.OctahedronGeometry(0.75, 1),
      new THREE.TorusGeometry(0.72, 0.045, 8, 48),
      new THREE.BoxGeometry(1.1, 0.72, 0.08)
    ];
    var bgMeshCount = hasHeroCanvas ? (isMobile ? 3 : 6) : (isMobile ? 5 : 8);
    for (var i = 0; i < bgMeshCount; i += 1) {
      var material = bgMaterial.clone();
      material.color = new THREE.Color(bgPalette[i % bgPalette.length]);
      material.opacity = 0.22 + (i % 4) * 0.055;
      var mesh = new THREE.Mesh(shapes[i % shapes.length], material);
      mesh.position.set((Math.random() - 0.5) * 13, (Math.random() - 0.5) * 9, -4 - Math.random() * 12);
      mesh.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      mesh.scale.setScalar(0.55 + Math.random() * 1.15);
      mesh.userData = { speed: 0.14 + Math.random() * 0.18, offset: Math.random() * 8 };
      bgMeshes.push(mesh);
      bgRoot.add(mesh);
    }

    var ringLineMaterial = new THREE.LineBasicMaterial({
      color: 0x2f6ed3,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    var bgRingCount = hasHeroCanvas ? 2 : 4;
    for (var rr = 0; rr < bgRingCount; rr += 1) {
      var ringPoints = [];
      var radius = 2.6 + rr * 0.72;
      for (var a = 0; a <= 96; a += 1) {
        var angle = (a / 96) * Math.PI * 2;
        ringPoints.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.38, -3.5 - rr * 1.35));
      }
      var ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
      var line = new THREE.Line(ringGeometry, ringLineMaterial.clone());
      line.rotation.z = rr * 0.22;
      bgRings.add(line);
    }

    var ribbonMaterials = [
      new THREE.LineBasicMaterial({ color: 0x54c6ff, transparent: true, opacity: 0.5, depthWrite: false }),
      new THREE.LineBasicMaterial({ color: 0xff8545, transparent: true, opacity: 0.36, depthWrite: false })
    ];
    var bgRibbonCount = hasHeroCanvas ? 1 : 2;
    for (var rb = 0; rb < bgRibbonCount; rb += 1) {
      var points = [];
      for (var s = 0; s < 56; s += 1) {
        var u = s / 55;
        points.push(new THREE.Vector3(
          -7 + u * 14,
          Math.sin(u * Math.PI * 3 + rb) * (0.5 + rb * 0.08) + (rb - 2) * 1.2,
          -3 - rb * 1.7 - Math.sin(u * Math.PI * 2) * 1.2
        ));
      }
      bgRibbons.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ribbonMaterials[rb % ribbonMaterials.length]));
    }

    var bgParticleCount = hasHeroCanvas ? (isMobile ? 20 : 48) : (isMobile ? 36 : 72);
    var bgPositions = new Float32Array(bgParticleCount * 3);
    for (var p = 0; p < bgParticleCount; p += 1) {
      bgPositions[p * 3] = (Math.random() - 0.5) * 14;
      bgPositions[p * 3 + 1] = (Math.random() - 0.5) * 10;
      bgPositions[p * 3 + 2] = -2 - Math.random() * 15;
    }
    var bgParticleGeometry = new THREE.BufferGeometry();
    bgParticleGeometry.setAttribute("position", new THREE.BufferAttribute(bgPositions, 3));
    var bgParticles = new THREE.Points(
      bgParticleGeometry,
      new THREE.PointsMaterial({
        color: 0x2f6ed3,
        size: isMobile ? 0.035 : 0.06,
        transparent: true,
        opacity: 0.62,
        depthWrite: false
      })
    );
    bgRoot.add(bgParticles);

    function resizeBg() {
      var width = Math.max(1, window.innerWidth);
      var height = Math.max(1, window.innerHeight);
      bgRenderer.setSize(width, height, false);
      bgCamera.aspect = width / height;
      bgCamera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resizeBg, { passive: true });
    resizeBg();

    var bgClock = new THREE.Clock();
    var lastBgRender = 0;
    bgRenderer.setAnimationLoop(function () {
      if (document.hidden) return;
      var now = performance.now();
      if (now - lastBgRender < 32) return;
      lastBgRender = now;
      var t = bgClock.getElapsedTime();
      bgCamera.position.x += (pointer.x * 0.8 - bgCamera.position.x) * 0.035;
      bgCamera.position.y += (-pointer.y * 0.45 - bgCamera.position.y) * 0.035;
      bgCamera.lookAt(0, 0, -5);
      bgRoot.rotation.y = pointer.x * 0.08 + Math.sin(t * 0.08) * 0.12;
      bgRoot.rotation.x = -pointer.y * 0.05 + Math.cos(t * 0.06) * 0.06;
      bgRings.rotation.z = t * 0.035;
      bgRings.rotation.x = Math.sin(t * 0.07) * 0.08;
      bgRibbons.rotation.y = Math.sin(t * 0.06) * 0.12;
      bgParticles.rotation.y = t * 0.025;
      bgMeshes.forEach(function (mesh, index) {
        mesh.rotation.x += 0.002 + index * 0.00004;
        mesh.rotation.y += 0.003 + index * 0.00005;
        mesh.position.y += Math.sin(t * mesh.userData.speed + mesh.userData.offset) * 0.002;
      });
      bgRenderer.render(bgScene, bgCamera);
    });
  }

  // 背景WebGLは削除 → ヒーローのみに集中してパフォーマンス向上
  // createSiteDepthLayer();
  if (!canvas) return;

  /* ====================================================
     3. HERO CANVAS — "AI COSMOS" (ヒーロー3Dシーン)
        テーマ: 宇宙を漂うAI神経回路 + 5つのスキル惑星
     ==================================================== */
  var hero = canvas.closest(".hero__inner") || canvas.parentElement;

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: !isMobile,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x061529, 0.035);

  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 0, 11);

  /* ── ライト ── */
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var keyLight = new THREE.DirectionalLight(0xdff6ff, 2.8);
  keyLight.position.set(4, 5, 7);
  scene.add(keyLight);
  var blueLight = new THREE.PointLight(0x4cc8ff, 3.5, 22);
  blueLight.position.set(-2, 1.5, 3.5);
  scene.add(blueLight);
  var orangeLight = new THREE.PointLight(0xff8545, 2.2, 20);
  orangeLight.position.set(5.5, -1.2, 3);
  scene.add(orangeLight);
  var greenLight = new THREE.PointLight(0x29c765, 1.8, 18);
  greenLight.position.set(0.5, 4.5, 2);
  scene.add(greenLight);
  var purpleLight = new THREE.PointLight(0xcc66ff, 1.4, 16);
  purpleLight.position.set(-4, -2, 2);
  scene.add(purpleLight);

  /* ── グロー テクスチャ factory ── */
  function makeGlowTex(r, g, b) {
    var sz = 256;
    var c = document.createElement("canvas");
    c.width = c.height = sz;
    var ctx = c.getContext("2d");
    var grad = ctx.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
    grad.addColorStop(0,    "rgba(" + r + "," + g + "," + b + ",1)");
    grad.addColorStop(0.22, "rgba(" + r + "," + g + "," + b + ",0.7)");
    grad.addColorStop(0.55, "rgba(" + r + "," + g + "," + b + ",0.18)");
    grad.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sz, sz);
    var tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  var glowBlue   = makeGlowTex(84,  198, 255);
  var glowOrange = makeGlowTex(255, 133,  69);
  var glowGreen  = makeGlowTex(41,  199, 101);
  var glowYellow = makeGlowTex(255, 223,  88);
  var glowPurple = makeGlowTex(190, 110, 255);

  function makeSprite(tex, hexColor, opacity, scale) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex,
      color: hexColor,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    sp.scale.setScalar(scale);
    return sp;
  }

  var root = new THREE.Group();
  scene.add(root);

  /* ──────────────────────────────────
     A. コア — AI ブレイン (中央の結晶体)
     ────────────────────────────────── */
  var coreGroup = new THREE.Group();
  root.add(coreGroup);

  // ソリッド 二十面体
  var coreMat = new THREE.MeshStandardMaterial({
    color: 0x7bd8ff,
    emissive: 0x1a55cc,
    emissiveIntensity: 0.75,
    roughness: 0.08,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88
  });
  var coreIcosa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.92, 2), coreMat);
  coreGroup.add(coreIcosa);

  // ワイヤーフレーム オーバーレイ
  var wireIcosaMat = new THREE.MeshBasicMaterial({
    color: 0xaaeeff, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false
  });
  var wireIcosa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.98, 2), wireIcosaMat);
  coreGroup.add(wireIcosa);

  // 内部コア (白く輝く球)
  var innerCoreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false
  });
  var innerCore = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), innerCoreMat);
  coreGroup.add(innerCore);

  // グロー スプライト × 2
  var coreGlowA = makeSprite(glowBlue, 0x54c6ff, 0.92, 5.8);
  coreGroup.add(coreGlowA);
  var coreGlowB = makeSprite(glowBlue, 0x1a44aa, 0.38, 10.0);
  coreGlowB.position.z = -0.6;
  coreGroup.add(coreGlowB);

  // 外側リング (コアを囲む光輪)
  var haloPoints = [];
  for (var ha = 0; ha <= 128; ha++) {
    var hAng = (ha / 128) * Math.PI * 2;
    haloPoints.push(new THREE.Vector3(Math.cos(hAng) * 1.32, Math.sin(hAng) * 0.12, Math.sin(hAng) * 1.32));
  }
  var halo = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(haloPoints),
    new THREE.LineBasicMaterial({ color: 0x54c6ff, transparent: true, opacity: 0.55, depthWrite: false })
  );
  coreGroup.add(halo);
  var halo2Points = [];
  for (var hb = 0; hb <= 128; hb++) {
    var hbAng = (hb / 128) * Math.PI * 2;
    halo2Points.push(new THREE.Vector3(Math.cos(hbAng) * 1.48, Math.sin(hbAng) * 1.48 * 0.26, Math.sin(hbAng) * 0.08));
  }
  var halo2 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(halo2Points),
    new THREE.LineBasicMaterial({ color: 0xff8545, transparent: true, opacity: 0.32, depthWrite: false })
  );
  coreGroup.add(halo2);

  /* ──────────────────────────────────
     B. 5つのスキル惑星 (orbiting gems)
     表現力 / 探究力 / 協働力 / 倫理的思考力 / 創造力
     ────────────────────────────────── */
  var SKILL_DATA = [
    { color: 0xff8545, glowTex: glowOrange, radius: 3.05, speed: 0.27, tiltX: 0.48, phase: 0,    geo: new THREE.TetrahedronGeometry(0.34)        },
    { color: 0x54c6ff, glowTex: glowBlue,   radius: 3.52, speed: 0.19, tiltX: 0.88, phase: 1.26, geo: new THREE.OctahedronGeometry(0.30)          },
    { color: 0x29c765, glowTex: glowGreen,  radius: 2.62, speed: 0.35, tiltX: 0.32, phase: 2.51, geo: new THREE.IcosahedronGeometry(0.27, 0)      },
    { color: 0xffdf58, glowTex: glowYellow, radius: 3.22, speed: 0.23, tiltX: 1.12, phase: 3.77, geo: new THREE.DodecahedronGeometry(0.25)        },
    { color: 0xcc66ff, glowTex: glowPurple, radius: 2.35, speed: 0.44, tiltX: 0.22, phase: 5.03, geo: new THREE.SphereGeometry(0.22, 16, 12) }
  ];

  var skillGems = SKILL_DATA.map(function (d, idx) {
    var g = new THREE.Group();
    root.add(g);

    var mat = new THREE.MeshStandardMaterial({
      color: d.color,
      emissive: d.color,
      emissiveIntensity: 0.58,
      roughness: 0.06,
      metalness: 0.88,
      transparent: true,
      opacity: 0.93
    });
    var mesh = new THREE.Mesh(d.geo, mat);
    g.add(mesh);

    var glow = makeSprite(d.glowTex, d.color, 0.7, 1.5);
    g.add(glow);

    // 軌道線
    var orbPts = [];
    for (var oa = 0; oa <= 100; oa++) {
      var oAng = (oa / 100) * Math.PI * 2;
      orbPts.push(new THREE.Vector3(
        Math.cos(oAng) * d.radius,
        Math.sin(oAng * 0.5) * d.radius * Math.sin(d.tiltX) * 0.36,
        Math.sin(oAng) * d.radius * 0.84
      ));
    }
    var orbLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbPts),
      new THREE.LineBasicMaterial({ color: d.color, transparent: true, opacity: 0.13, depthWrite: false })
    );
    root.add(orbLine);

    return { group: g, mesh: mesh, mat: mat, glowSprite: glow, data: d };
  });

  /* ──────────────────────────────────
     C. ニューラル ネットワーク ノード
     ────────────────────────────────── */
  var nodeCount = isMobile ? 14 : 26;
  var allNodes  = [];
  var nodeGeo   = new THREE.SphereGeometry(0.072, 8, 6);
  var nodeEmissive = [0x54c6ff, 0xff8545, 0x29c765, 0xcc66ff, 0xffdf58];

  for (var ni = 0; ni < nodeCount; ni++) {
    var theta = Math.acos(2 * Math.random() - 1);
    var phi   = Math.random() * Math.PI * 2;
    var nr    = 1.6 + Math.random() * 3.6;

    var nMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: nodeEmissive[ni % nodeEmissive.length],
      emissiveIntensity: 0.88,
      roughness: 0, metalness: 0
    });
    var nd = new THREE.Mesh(nodeGeo, nMat);
    nd.position.set(
      Math.sin(theta) * Math.cos(phi) * nr,
      Math.cos(theta) * nr * 0.62,
      Math.sin(theta) * Math.sin(phi) * nr * 0.78
    );
    nd.userData = { base: nd.position.clone(), phase: Math.random() * Math.PI * 2, spd: 0.28 + Math.random() * 0.5 };
    allNodes.push(nd);
    root.add(nd);
  }

  // ノード間の接続線
  var connections = [];
  var maxConn = isMobile ? 18 : 38;
  for (var ai = 0; ai < allNodes.length && connections.length < maxConn; ai++) {
    for (var bi = ai + 1; bi < allNodes.length && connections.length < maxConn; bi++) {
      if (allNodes[ai].position.distanceTo(allNodes[bi].position) < 2.6) {
        var cGeo = new THREE.BufferGeometry().setFromPoints([allNodes[ai].position, allNodes[bi].position]);
        var cLine = new THREE.Line(cGeo, new THREE.LineBasicMaterial({
          color: 0x54c6ff, transparent: true, opacity: 0.16, depthWrite: false
        }));
        cLine.userData = { a: allNodes[ai], b: allNodes[bi], phase: Math.random() * Math.PI * 2, spd: 0.5 + Math.random() * 1.4 };
        connections.push(cLine);
        root.add(cLine);
      }
    }
  }

  /* ──────────────────────────────────
     D. スター パーティクル (背景星)
     ────────────────────────────────── */
  var starCount = isMobile ? 110 : 260;
  var sPosArr   = new Float32Array(starCount * 3);
  var sColArr   = new Float32Array(starCount * 3);
  var starPalette = [
    new THREE.Color(0x54c6ff),
    new THREE.Color(0x2f6ed3),
    new THREE.Color(0xff8545),
    new THREE.Color(0x29c765),
    new THREE.Color(0xcc66ff),
    new THREE.Color(0xffffff)
  ];
  for (var si = 0; si < starCount; si++) {
    sPosArr[si * 3]     = (Math.random() - 0.5) * 24;
    sPosArr[si * 3 + 1] = (Math.random() - 0.5) * 18;
    sPosArr[si * 3 + 2] = -4 - Math.random() * 20;
    var sc = starPalette[Math.floor(Math.random() * starPalette.length)];
    sColArr[si * 3] = sc.r; sColArr[si * 3 + 1] = sc.g; sColArr[si * 3 + 2] = sc.b;
  }
  var starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(sPosArr, 3));
  starGeo.setAttribute("color",    new THREE.BufferAttribute(sColArr, 3));
  var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: isMobile ? 0.048 : 0.068,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  }));
  root.add(stars);

  /* ──────────────────────────────────
     E. 流れる光のリボン (光の尾)
     ────────────────────────────────── */
  var ribbonColors = [0x54c6ff, 0xff8545, 0x29c765];
  var ribbons = [];
  var ribbonCount = isMobile ? 2 : 4;
  for (var ri = 0; ri < ribbonCount; ri++) {
    var rPts = [];
    var rSegs = 50;
    for (var rs = 0; rs < rSegs; rs++) {
      var ru = rs / (rSegs - 1);
      rPts.push(new THREE.Vector3(
        -5 + ru * 10,
        (ri - ribbonCount * 0.5) * 0.7 + Math.sin(ru * Math.PI * 2.5 + ri) * 0.35,
        -2.5 - ri * 1.4 - Math.cos(ru * Math.PI + ri * 0.5) * 0.8
      ));
    }
    var rLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(rPts),
      new THREE.LineBasicMaterial({
        color: ribbonColors[ri % ribbonColors.length],
        transparent: true,
        opacity: 0.18 + ri * 0.04,
        depthWrite: false
      })
    );
    rLine.userData = { phase: ri * 0.85 };
    ribbons.push(rLine);
    root.add(rLine);
  }

  /* ────── リサイズ ────── */
  function resize() {
    var rect = hero.getBoundingClientRect();
    var w = Math.max(1, Math.floor(rect.width));
    var h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    if (isMobile) {
      coreGroup.position.set(0.9, -0.2, 0);
      coreGroup.scale.setScalar(0.9);
      root.position.set(0, 0, 0);
    } else {
      coreGroup.position.set(2.6, 0.15, 0);
      coreGroup.scale.setScalar(1.22);
      root.position.set(0, 0, 0);
    }
    canvas.dataset.threeReady = "true";
  }

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(hero);
  window.addEventListener("resize", resize, { passive: true });
  resize();

  /* ────── アニメーション ────── */
  var clock = new THREE.Clock();

  renderer.setAnimationLoop(function () {
    if (document.hidden) return;
    var t = clock.getElapsedTime();

    // カメラ マウス追従
    var targetX = isMobile ? 0.9 : 2.6;
    camera.position.x += (pointer.x * 1.6 - camera.position.x) * 0.042;
    camera.position.y += (-pointer.y * 0.9 - camera.position.y) * 0.042;
    camera.lookAt(new THREE.Vector3(targetX, 0, 0));

    // root ゆっくり揺れる
    root.rotation.y = Math.sin(t * 0.09) * 0.13 + pointer.x * 0.045;
    root.rotation.x = Math.cos(t * 0.07) * 0.055 - pointer.y * 0.022;

    /* A. コア アニメーション */
    coreIcosa.rotation.x = t * 0.15;
    coreIcosa.rotation.y = t * 0.23;
    wireIcosa.rotation.x = -t * 0.11;
    wireIcosa.rotation.y = t * 0.18;

    var pulse = (Math.sin(t * 1.6) + 1) * 0.5; // 0–1
    coreMat.emissiveIntensity = 0.55 + pulse * 0.48;
    innerCoreMat.opacity      = 0.52 + pulse * 0.32;
    coreGlowA.material.opacity = 0.62 + pulse * 0.28;
    coreGlowA.scale.setScalar(5.0 + pulse * 0.9);
    coreGlowB.material.opacity = 0.20 + pulse * 0.14;
    blueLight.intensity = 2.8 + pulse * 2.2;
    halo.material.opacity  = 0.38 + pulse * 0.22;
    halo2.material.opacity = 0.18 + pulse * 0.16;
    halo.rotation.y  = t * 0.38;
    halo2.rotation.z = -t * 0.28;

    /* B. スキル惑星 */
    skillGems.forEach(function (gem, idx) {
      var d = gem.data;
      var ang = t * d.speed + d.phase;
      gem.group.position.set(
        Math.cos(ang) * d.radius,
        Math.sin(ang * 0.52) * d.radius * Math.sin(d.tiltX) * 0.38,
        Math.sin(ang) * d.radius * 0.82
      );
      gem.mesh.rotation.x += 0.011 + idx * 0.0018;
      gem.mesh.rotation.y += 0.017 + idx * 0.0025;
      var gp = (Math.sin(t * 2.4 + idx * 1.35) + 1) * 0.5;
      gem.mat.emissiveIntensity = 0.36 + gp * 0.64;
      gem.glowSprite.material.opacity = 0.38 + gp * 0.42;
      gem.glowSprite.scale.setScalar(1.3 + gp * 0.4);
    });

    /* C. ニューラル ノード */
    allNodes.forEach(function (nd) {
      var d = nd.userData;
      nd.position.x = d.base.x + Math.sin(t * d.spd + d.phase) * 0.13;
      nd.position.y = d.base.y + Math.cos(t * d.spd * 0.76 + d.phase) * 0.17;
      nd.material.emissiveIntensity = 0.65 + Math.sin(t * 1.6 + d.phase) * 0.32;
    });

    // 接続線を更新
    connections.forEach(function (ln) {
      var pos = ln.geometry.attributes.position.array;
      pos[0] = ln.userData.a.position.x; pos[1] = ln.userData.a.position.y; pos[2] = ln.userData.a.position.z;
      pos[3] = ln.userData.b.position.x; pos[4] = ln.userData.b.position.y; pos[5] = ln.userData.b.position.z;
      ln.geometry.attributes.position.needsUpdate = true;
      ln.material.opacity = 0.08 + (Math.sin(t * ln.userData.spd + ln.userData.phase) + 1) * 0.09;
    });

    /* D. 星 */
    stars.rotation.y = t * 0.013;
    stars.rotation.z = Math.sin(t * 0.045) * 0.014;

    /* E. リボン */
    ribbons.forEach(function (rb, ri) {
      rb.rotation.z = Math.sin(t * 0.32 + rb.userData.phase) * 0.06;
      rb.position.x = Math.sin(t * 0.22 + ri) * 0.1;
      rb.material.opacity = 0.12 + Math.sin(t * 0.8 + rb.userData.phase) * 0.07 + ri * 0.018;
    });

    renderer.render(scene, camera);
  });
}());
