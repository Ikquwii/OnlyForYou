/* A small, hand-drawn garden. All coordinates live on the same storybook page. */
(function () {
  'use strict';

  const WIDTH = 3600;
  const HEIGHT = 900;
  const GROUND = 700;
  const TAU = Math.PI * 2;
  const C = {
    cream: '#fbf3de', paper: '#f6eedb', sky: '#f8e6cd', peach: '#efd2b7',
    blush: '#e6b7a8', pink: '#d59b9f', rose: '#b76f7f', terra: '#bd8067',
    moss: '#71836d', sage: '#9daa87', pale: '#bec7a2', leaf: '#879574',
    deep: '#627662', bark: '#ab8c6b', ink: '#806e57', path: '#e8cba8',
    water: '#b4c9be', waterLight: '#d3dfce', wood: '#c7a17a', woodLight: '#dfbd92'
  };
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, Number.isFinite(n) ? n : a));
  const noise = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  const dots = Array.from({ length: 3400 }, (_, i) => ({
    x: noise(i + 1) * WIDTH, y: noise(i + 8001) * HEIGHT,
    r: .3 + noise(i + 901) * 1.3, a: .025 + noise(i + 1901) * .04
  }));
  let staticLayer = null;
  let staticImage = null;

  function path(ctx, d, fill, stroke, width = 1) {
    ctx.beginPath();
    d(ctx);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function oval(ctx, x, y, rx, ry, fill, rotate = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotate, 0, TAU);
    ctx.fillStyle = fill; ctx.fill();
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function leaf(ctx, x, y, length, width, angle, fill = C.sage, vein = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    path(ctx, p => {
      p.moveTo(0, 0); p.bezierCurveTo(-width, -length * .32, -width * .7, -length * .82, 0, -length);
      p.bezierCurveTo(width * .85, -length * .78, width, -length * .2, 0, 0);
    }, fill);
    if (vein) {
      path(ctx, p => { p.moveTo(0, -2); p.quadraticCurveTo(-1, -length * .55, 0, -length * .87); }, null, 'rgba(244,240,207,.36)', .8);
    }
    ctx.restore();
  }
  function branch(ctx, x, y, length, angle, seed, dark = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    path(ctx, p => { p.moveTo(0, 0); p.quadraticCurveTo(6, -length * .6, 0, -length); }, null, dark ? C.moss : '#8e9d78', 2);
    for (let j = 0; j < 6; j++) {
      const yy = -length * (.18 + j * .13);
      leaf(ctx, 3, yy, 20 + noise(seed + j) * 16, 7, .75 + noise(seed + j + 29) * .4, dark ? C.moss : C.leaf, true);
      leaf(ctx, 0, yy - 5, 22 + noise(seed + j + 2) * 14, 7, -.8 - noise(seed + j + 13) * .3, dark ? C.deep : C.sage, true);
    }
    leaf(ctx, 0, -length * .9, 27, 8, 0, dark ? C.leaf : C.sage, true);
    ctx.restore();
  }
  function cloud(ctx, x, y, size, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    path(ctx, p => {
      p.moveTo(x - size, y + 7); p.bezierCurveTo(x - size * 1.08, y - 12, x - size * .8, y - 24, x - size * .61, y - 20);
      p.bezierCurveTo(x - size * .48, y - 60, x + size * .04, y - 65, x + size * .2, y - 28);
      p.bezierCurveTo(x + size * .6, y - 47, x + size * 1.02, y - 14, x + size * .94, y + 9);
      p.bezierCurveTo(x + size * .43, y + 27, x - size * .63, y + 27, x - size, y + 7);
    }, '#fff8e9'); ctx.restore();
  }
  function canopy(ctx, x, y, w, h, color, seed) {
    ctx.save(); ctx.translate(x, y);
    path(ctx, p => {
      p.moveTo(-w * .47, h * .13);
      p.bezierCurveTo(-w * .68, -h * .02, -w * .47, -h * .35, -w * .29, -h * .34);
      p.bezierCurveTo(-w * .38, -h * .63, -w * .03, -h * .76, w * .14, -h * .55);
      p.bezierCurveTo(w * .37, -h * .7, w * .65, -h * .39, w * .46, -h * .22);
      p.bezierCurveTo(w * .74, -h * .09, w * .51, h * .22, w * .29, h * .14);
      p.bezierCurveTo(w * .09, h * .38, -w * .21, h * .34, -w * .28, h * .14);
      p.bezierCurveTo(-w * .37, h * .2, -w * .46, h * .2, -w * .47, h * .13);
    }, color);
    for (let j = 0; j < 31; j++) {
      const xx = (noise(seed + j) - .5) * w * .92;
      const yy = (noise(seed + j + 101) - .6) * h * .68;
      leaf(ctx, xx, yy, 8 + noise(seed + j + 203) * 13, 3.5, noise(seed + j + 66) * TAU,
        j % 3 === 0 ? 'rgba(239,232,183,.23)' : 'rgba(81,108,83,.085)');
    }
    ctx.restore();
  }
  function tree(ctx, x, y, scale, seed, pale = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    oval(ctx, 0, 8, 111, 16, 'rgba(102,116,80,.1)');
    path(ctx, p => {
      p.moveTo(-17, 8); p.bezierCurveTo(-10, -65, -7, -155, -23, -243);
      p.lineTo(-3, -243); p.bezierCurveTo(14, -154, 9, -64, 22, 8);
      p.bezierCurveTo(2, 2, -3, 4, -17, 8);
    }, pale ? '#c7ad86' : C.bark);
    path(ctx, p => { p.moveTo(0, -136); p.quadraticCurveTo(-65, -189, -90, -240); p.moveTo(3, -172); p.quadraticCurveTo(61, -207, 93, -260); }, null, pale ? '#c7ad86' : C.bark, 10);
    line(ctx, -5, -4, -2, -129, 'rgba(243,213,170,.46)', 3);
    canopy(ctx, -86, -256, 210, 190, pale ? '#bdc8a4' : '#98a985', seed + 1);
    canopy(ctx, 77, -281, 227, 210, pale ? '#b4c09c' : '#8c9c79', seed + 17);
    canopy(ctx, -11, -355, 260, 205, pale ? '#c5cda8' : '#a9b48a', seed + 37);
    canopy(ctx, -21, -222, 225, 165, pale ? '#c1cba6' : '#a0ac83', seed + 51);
    if (seed % 2) for (let j = 0; j < 14; j++) {
      const xx = (noise(seed + j + 303) - .5) * 257;
      const yy = -230 - noise(seed + j + 1001) * 172;
      oval(ctx, xx, yy, 5.5, 6.3, j % 3 ? '#d8b18a' : '#c9957d', -.13);
      leaf(ctx, xx + 1, yy - 5, 8, 3, .7, C.moss);
    }
    ctx.restore();
  }
  function bush(ctx, x, y, w, h, color, seed) {
    ctx.save(); ctx.translate(x, y);
    path(ctx, p => {
      p.moveTo(-w * .55, 6); p.bezierCurveTo(-w * .67, -h * .45, -w * .34, -h * .64, -w * .22, -h * .38);
      p.bezierCurveTo(-w * .2, -h, w * .23, -h * .99, w * .28, -h * .47);
      p.bezierCurveTo(w * .48, -h * .68, w * .72, -h * .37, w * .52, 6);
      p.quadraticCurveTo(0, 16, -w * .55, 6);
    }, color);
    for (let j = 0; j < Math.ceil(w / 11); j++) {
      leaf(ctx, (noise(seed + j) - .5) * w, -noise(seed + j + 91) * h * .58,
        12 + noise(seed + j + 61) * 13, 4, noise(seed + j + 821) * TAU,
        j % 2 ? 'rgba(226,227,185,.35)' : 'rgba(77,111,80,.1)');
    }
    ctx.restore();
  }
  function littleFlower(ctx, x, y, s, color, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    path(ctx, p => { p.moveTo(0, 0); p.quadraticCurveTo(-4, -22, 1, -37); }, null, '#87956f', 1.8);
    leaf(ctx, -1, -13, 14, 5, -.9, '#a4ad82'); leaf(ctx, -1, -22, 11, 4, .8, '#8e9e76');
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + seed;
      oval(ctx, 1 + Math.sin(a) * 7, -39 + Math.cos(a) * 6, 4.5, 7.5, color, -a);
    }
    oval(ctx, 1, -39, 3, 2.8, '#d9b777'); ctx.restore();
  }
  function plantBed(ctx, x, y, w, seed, pink = false) {
    oval(ctx, x, y, w * .52, 15, '#b4bc94');
    for (let j = 0; j < Math.ceil(w / 15); j++) {
      const xx = x + (noise(seed + j) - .5) * w;
      const yy = y + (noise(seed + j + 57) - .5) * 15;
      branch(ctx, xx, yy, 26 + noise(seed + j + 77) * 22, (noise(seed + j + 31) - .5) * .8, seed + j);
    }
    for (let j = 0; j < Math.ceil(w / 28); j++) {
      const xx = x + (noise(seed + j + 790) - .5) * w;
      littleFlower(ctx, xx, y + noise(seed + j + 101) * 5, .5 + noise(seed + j) * .35,
        pink ? (j % 2 ? '#d9acaa' : '#e8c1b1') : (j % 3 ? '#ece3bc' : '#b6b2bf'), noise(seed + j));
    }
  }
  function fence(ctx, start, end, y, seed) {
    ctx.save();
    path(ctx, p => { p.moveTo(start, y - 37); p.bezierCurveTo(start + (end - start) * .3, y - 30, end - 80, y - 36, end, y - 30); }, null, '#c8b48f', 7);
    path(ctx, p => { p.moveTo(start, y - 72); p.bezierCurveTo(start + 90, y - 64, end - 120, y - 76, end, y - 68); }, null, '#d0bd97', 6);
    for (let x = start; x <= end; x += 43) {
      const top = y - 95 - noise(seed + x) * 12;
      path(ctx, p => { p.moveTo(x - 5, y + 3); p.lineTo(x - 5, top + 7); p.lineTo(x, top); p.lineTo(x + 5, top + 7); p.lineTo(x + 6, y + 4); }, '#d5c39e');
      line(ctx, x - 2, top + 15, x - 1, y - 3, 'rgba(249,239,207,.5)', 1.4);
    }
    ctx.restore();
  }
  function grassTuft(ctx, x, y, s, color, bend = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineCap = 'round';
    path(ctx, p => {
      p.moveTo(-8, 0); p.quadraticCurveTo(-13 + bend, -16, -20 + bend, -21);
      p.moveTo(-4, 0); p.quadraticCurveTo(-7 + bend, -28, -4 + bend, -36);
      p.moveTo(0, 0); p.quadraticCurveTo(5 + bend, -18, 10 + bend, -26);
      p.moveTo(4, 1); p.quadraticCurveTo(14 + bend, -13, 19 + bend, -15);
    }, null, color, 2.2); ctx.restore();
  }
  function stone(ctx, x, y, rx, ry, seed) {
    path(ctx, p => {
      p.moveTo(x - rx, y); p.bezierCurveTo(x - rx * .85, y - ry, x + rx * .22, y - ry * 1.16, x + rx * .72, y - ry * .45);
      p.bezierCurveTo(x + rx * 1.3, y + ry * .2, x + rx * .37, y + ry * .6, x - rx * .6, y + ry * .41);
      p.quadraticCurveTo(x - rx, y + ry * .22, x - rx, y);
    }, seed % 2 ? '#d1c2a5' : '#d9ccb1');
    path(ctx, p => { p.moveTo(x - rx * .65, y - ry * .24); p.quadraticCurveTo(x - rx * .1, y - ry * .64, x + rx * .5, y - ry * .29); }, null, 'rgba(250,243,216,.6)', 2);
  }
  function brick(ctx, x, y, w, h, color) {
    path(ctx, p => {
      p.moveTo(x + 3, y); p.lineTo(x + w - 4, y + 1); p.quadraticCurveTo(x + w, y + 2, x + w, y + 5);
      p.lineTo(x + w - 1, y + h - 2); p.lineTo(x + 1, y + h); p.closePath();
    }, color);
  }
  function drawHouse(ctx) {
    ctx.save();
    oval(ctx, 3233, 698, 332, 26, 'rgba(109,118,80,.13)');
    // A little side wing gives the cottage its illustrated, slightly crooked shape.
    path(ctx, p => { p.moveTo(3378, 385); p.lineTo(3510, 423); p.lineTo(3510, 701); p.lineTo(3374, 700); p.closePath(); }, '#dfc6a5');
    path(ctx, p => { p.moveTo(2964, 383); p.lineTo(3211, 228); p.lineTo(3415, 378); p.lineTo(3400, 702); p.lineTo(2978, 703); p.closePath(); }, '#f0d9b8');
    path(ctx, p => { p.moveTo(2964, 383); p.lineTo(3211, 228); p.lineTo(3407, 375); p.lineTo(3387, 395); p.lineTo(3208, 264); p.lineTo(2982, 402); p.closePath(); }, '#ce9378');
    path(ctx, p => { p.moveTo(2938, 385); p.lineTo(3208, 215); p.lineTo(3440, 376); p.lineTo(3423, 395); p.lineTo(3208, 250); p.lineTo(2954, 405); p.closePath(); }, '#b77962');
    path(ctx, p => { p.moveTo(2948, 388); p.lineTo(3208, 226); p.lineTo(3429, 379); }, null, '#e1ac87', 7);
    path(ctx, p => { p.moveTo(3390, 397); p.lineTo(3534, 432); p.lineTo(3535, 417); p.lineTo(3408, 376); }, '#b77b64');
    brick(ctx, 3335, 246, 39, 91, '#c28d70'); brick(ctx, 3328, 244, 55, 13, '#b47960');
    line(ctx, 3340, 279, 3369, 280, '#dab497', 2); line(ctx, 3340, 302, 3370, 303, '#dab497', 2);
    // Roof tiles follow the gable instead of a repeated flat grid.
    for (let j = 0; j < 11; j++) {
      const x = 2981 + j * 37;
      const yy = x <= 3208 ? 383 - (x - 2960) * .618 : 244 + (x - 3208) * .67;
      line(ctx, x, yy - 8, x + 23, yy + 8, 'rgba(115,73,54,.22)', 1.7);
    }
    path(ctx, p => { p.moveTo(2980, 405); p.lineTo(2984, 696); p.moveTo(3391, 403); p.lineTo(3389, 692); }, null, 'rgba(255,247,218,.52)', 7);
    // Subtle warm plaster patches and masonry, never a perfectly clean rectangle.
    for (let j = 0; j < 27; j++) {
      const x = 3000 + noise(j + 810) * 367;
      const y = 401 + noise(j + 73) * 275;
      if (x > 3085 && x < 3336 && y < 624) continue;
      oval(ctx, x, y, 6 + noise(j + 27) * 15, 2 + noise(j + 81) * 5, 'rgba(185,133,102,.065)');
    }
    [[2998,658,31,12],[3031,666,29,11],[3364,655,25,12],[3370,675,29,12],[3000,634,23,11],[3347,637,31,11]].forEach(b => brick(ctx, ...b, '#dcbb99'));
    // The window is the destination. Its centre is (3210, 500).
    path(ctx, p => { p.moveTo(3081, 613); p.lineTo(3081, 414); p.quadraticCurveTo(3081, 355, 3140, 355); p.lineTo(3280, 355); p.quadraticCurveTo(3339, 355, 3339, 414); p.lineTo(3339, 613); p.closePath(); }, '#e3c6a0');
    path(ctx, p => { p.moveTo(3098, 603); p.lineTo(3098, 414); p.quadraticCurveTo(3098, 373, 3140, 373); p.lineTo(3280, 373); p.quadraticCurveTo(3322, 373, 3322, 414); p.lineTo(3322, 603); p.closePath(); }, '#9c9c81');
    const glass = ctx.createLinearGradient(3100, 370, 3315, 608);
    glass.addColorStop(0, '#acb7a0'); glass.addColorStop(.45, '#c3c3a6'); glass.addColorStop(1, '#e5caa7');
    path(ctx, p => { p.moveTo(3108, 601); p.lineTo(3108, 414); p.quadraticCurveTo(3108, 384, 3142, 384); p.lineTo(3279, 384); p.quadraticCurveTo(3312, 384, 3312, 414); p.lineTo(3312, 601); p.closePath(); }, glass);
    // Soft linen curtains, with fine folds and gently scalloped hems.
    path(ctx, p => {
      p.moveTo(3111, 386); p.quadraticCurveTo(3137, 374, 3168, 385); p.bezierCurveTo(3160, 447, 3151, 476, 3121, 497);
      p.bezierCurveTo(3139, 533, 3148, 565, 3147, 599); p.quadraticCurveTo(3125, 590, 3110, 600); p.closePath();
    }, '#f4e8cb');
    path(ctx, p => {
      p.moveTo(3310, 386); p.quadraticCurveTo(3280, 376, 3251, 385); p.bezierCurveTo(3257, 448, 3270, 474, 3297, 495);
      p.bezierCurveTo(3281, 533, 3273, 570, 3275, 600); p.quadraticCurveTo(3292, 592, 3311, 601); p.closePath();
    }, '#f4e8cb');
    for (let j = 0; j < 3; j++) {
      path(ctx, p => { p.moveTo(3120 + j * 13, 390); p.quadraticCurveTo(3134 + j * 4, 444, 3120 + j * 4, 486); }, null, 'rgba(183,156,118,.25)', 1.3);
      path(ctx, p => { p.moveTo(3301 - j * 13, 390); p.quadraticCurveTo(3289 - j * 4, 442, 3297 - j * 4, 485); }, null, 'rgba(183,156,118,.25)', 1.3);
    }
    line(ctx, 3210, 382, 3210, 604, '#e7c99f', 7);
    line(ctx, 3109, 469, 3311, 469, '#e7c99f', 7);
    line(ctx, 3213, 385, 3213, 601, '#f6e1b9', 2);
    line(ctx, 3110, 472, 3308, 472, '#f6e1b9', 2);
    path(ctx, p => { p.moveTo(3068, 606); p.lineTo(3350, 606); p.lineTo(3345, 624); p.quadraticCurveTo(3210, 630, 3073, 624); p.closePath(); }, '#d2aa7f');
    line(ctx, 3072, 609, 3347, 609, '#f2d5a9', 4);
    // Sage shutters frame the curtains rather than hiding the delivery.
    for (const side of [-1, 1]) {
      const x = side < 0 ? 3034 : 3341;
      path(ctx, p => { p.moveTo(x, 393); p.lineTo(x + 39, 390); p.lineTo(x + 38, 598); p.lineTo(x + 2, 602); p.closePath(); }, side < 0 ? '#97a382' : '#a4ad8a');
      for (let j = 0; j < 10; j++) line(ctx, x + 6, 405 + j * 18, x + 32, 403 + j * 18, 'rgba(81,106,74,.2)', 3);
      line(ctx, x + 6, 396, x + 6, 594, 'rgba(244,229,190,.5)', 2);
    }
    // A round attic window, a doorstep, a modest terracotta pot.
    oval(ctx, 3210, 320, 24, 23, '#dcb28e'); oval(ctx, 3210, 320, 17, 17, '#a5ac8f');
    line(ctx, 3195, 320, 3225, 320, '#e7c59e', 3); line(ctx, 3210, 305, 3210, 335, '#e7c59e', 3);
    stone(ctx, 3240, 699, 151, 17, 2);
    pot(ctx, 3028, 698, .95, 20); pot(ctx, 3430, 699, 1.15, 51);
    branch(ctx, 2992, 665, 187, -.12, 135);
    branch(ctx, 3000, 634, 153, -.26, 111);
    for (let j = 0; j < 7; j++) littleFlower(ctx, 2988 + noise(j + 44) * 25, 530 + noise(j + 99) * 111, .9, '#d9b1a5', j);
    ctx.restore();
  }
  function pot(ctx, x, y, scale, seed) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    path(ctx, p => { p.moveTo(-22, -43); p.lineTo(21, -43); p.lineTo(16, -3); p.quadraticCurveTo(0, 3, -15, -3); p.closePath(); }, '#bd8a6d');
    path(ctx, p => { p.moveTo(-24, -45); p.lineTo(24, -45); p.lineTo(23, -36); p.lineTo(-23, -36); p.closePath(); }, '#d1a17d');
    line(ctx, -15, -32, -11, -7, 'rgba(246,214,170,.35)', 3);
    for (let j = 0; j < 5; j++) branch(ctx, (j - 2) * 4, -42, 40 + noise(seed + j) * 36, (j - 2) * .27, seed + j);
    ctx.restore();
  }
  function drawBackground(ctx, image) {
    if (image && image.complete !== false && (image.naturalWidth || image.width)) {
      ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
      return;
    }
    const sky = ctx.createLinearGradient(0, 0, 0, 710);
    sky.addColorStop(0, '#f8e9d3'); sky.addColorStop(.58, '#f8e5ca'); sky.addColorStop(1, '#eee0bd');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // A broad, quiet sun is tinted into the paper, not a glowing interface disc.
    const sun = ctx.createRadialGradient(2510, 145, 28, 2510, 145, 245);
    sun.addColorStop(0, 'rgba(255,249,217,.7)'); sun.addColorStop(.55, 'rgba(255,244,205,.31)'); sun.addColorStop(1, 'rgba(255,244,205,0)');
    ctx.fillStyle = sun; ctx.fillRect(2250, 0, 520, 420);
    cloud(ctx, 375, 153, 101, .61); cloud(ctx, 1260, 116, 130, .48);
    cloud(ctx, 2202, 190, 94, .41); cloud(ctx, 2990, 99, 111, .47);
    path(ctx, p => {
      p.moveTo(0, 509); p.bezierCurveTo(420, 377, 650, 549, 1030, 455); p.bezierCurveTo(1400, 352, 1690, 483, 2020, 470);
      p.bezierCurveTo(2420, 365, 2620, 482, 2930, 435); p.bezierCurveTo(3250, 382, 3460, 435, 3600, 402); p.lineTo(3600, 710); p.lineTo(0, 710); p.closePath();
    }, '#d8d9b7');
    path(ctx, p => {
      p.moveTo(0, 566); p.bezierCurveTo(366, 460, 577, 566, 780, 529); p.bezierCurveTo(1080, 472, 1430, 564, 1720, 528);
      p.bezierCurveTo(2230, 453, 2560, 597, 2860, 503); p.bezierCurveTo(3240, 451, 3430, 539, 3600, 506); p.lineTo(3600, 730); p.lineTo(0, 730); p.closePath();
    }, '#ccd1a9');
    // Trees have deliberately uneven silhouettes and visible warm trunks.
    tree(ctx, 367, 625, .66, 2, true); tree(ctx, 1163, 606, .72, 10, true);
    tree(ctx, 2081, 611, .81, 4, true); tree(ctx, 2738, 635, .8, 8, true);
    fence(ctx, -30, 840, 660, 4); fence(ctx, 1210, 1716, 653, 19); fence(ctx, 1996, 2920, 656, 9);
    tree(ctx, 58, 665, 1.12, 3); tree(ctx, 505, 645, .96, 11);
    tree(ctx, 1414, 649, 1.04, 5); tree(ctx, 2355, 642, 1.08, 13);
    tree(ctx, 3528, 662, 1.04, 15);
    bush(ctx, 23, 686, 257, 106, '#9eae86', 49);
    bush(ctx, 508, 672, 268, 88, '#a7b28c', 99);
    bush(ctx, 1420, 665, 286, 111, '#a3b28b', 38);
    bush(ctx, 2120, 675, 265, 91, '#abb58b', 62);
    bush(ctx, 2670, 671, 286, 118, '#a4b18b', 29);
    bush(ctx, 3580, 686, 250, 113, '#9caa84', 89);
    // Ground and winding sand path; the walking baseline stays precisely at 700.
    path(ctx, p => {
      p.moveTo(0, 664); p.bezierCurveTo(455, 652, 597, 683, 916, 669); p.bezierCurveTo(1300, 651, 1530, 668, 1820, 667);
      p.bezierCurveTo(2260, 659, 2540, 661, 2880, 665); p.bezierCurveTo(3180, 678, 3430, 663, 3600, 664); p.lineTo(3600, 900); p.lineTo(0, 900); p.closePath();
    }, '#c9ce9f');
    path(ctx, p => {
      p.moveTo(-20, 698); p.bezierCurveTo(345, 652, 652, 684, 940, 685); p.bezierCurveTo(1270, 700, 1540, 666, 1840, 686);
      p.bezierCurveTo(2160, 708, 2500, 672, 2790, 687); p.bezierCurveTo(3160, 707, 3370, 673, 3620, 697);
      p.lineTo(3620, 779); p.bezierCurveTo(3290, 764, 3160, 796, 2790, 772); p.bezierCurveTo(2460, 755, 2200, 789, 1840, 770);
      p.bezierCurveTo(1480, 748, 1260, 788, 938, 769); p.bezierCurveTo(600, 751, 340, 749, -20, 786); p.closePath();
    }, '#e8cfaa');
    path(ctx, p => { p.moveTo(0, 700); p.bezierCurveTo(362, 669, 670, 687, 905, 687); p.moveTo(1215, 689); p.bezierCurveTo(1500, 679, 1624, 677, 1758, 687); p.moveTo(1955, 691); p.bezierCurveTo(2343, 696, 2617, 679, 2861, 691); }, null, 'rgba(252,231,191,.62)', 5);
    // Sparse paper marks keep the path tactile without a live random-grain pass.
    for (let j = 0; j < 167; j++) {
      const x = noise(j + 529) * WIDTH;
      const y = 709 + noise(j + 953) * 51;
      if (x > 916 && x < 1190) continue;
      oval(ctx, x, y, 1 + noise(j + 373) * 3, .45 + noise(j + 995), j % 3 ? 'rgba(159,126,86,.13)' : 'rgba(255,245,211,.48)', .2);
    }
    plantBed(ctx, 290, 681, 235, 119, true); plantBed(ctx, 1300, 680, 147, 149);
    plantBed(ctx, 2190, 678, 234, 199, true); plantBed(ctx, 2790, 682, 195, 291);
    drawHouse(ctx);
    // Only quiet background details: a dovecote, watering can and sleeping snail.
    line(ctx, 1656, 633, 1656, 455, '#b49976', 8);
    path(ctx, p => { p.moveTo(1628, 474); p.lineTo(1628, 439); p.lineTo(1684, 439); p.lineTo(1684, 474); p.closePath(); }, '#ead3ad');
    path(ctx, p => { p.moveTo(1619, 441); p.lineTo(1655, 415); p.lineTo(1693, 440); p.closePath(); }, '#b78369');
    oval(ctx, 1656, 455, 6, 8, '#9e9876'); line(ctx, 1631, 477, 1680, 477, '#c4aa82', 5);
    wateringCan(ctx, 2513, 682, .62);
    oval(ctx, 1557, 697, 9, 3, '#aa9a74'); oval(ctx, 1557, 690, 6, 6, '#d6b58a');
    path(ctx, p => { p.arc(1557, 690, 3.4, -.6, Math.PI * 1.55); }, null, '#b58e68', 1);
    for (let j = 0; j < 30; j++) {
      const x = 14 + j * 123 + noise(j + 992) * 45;
      if (x > 900 && x < 1205) continue;
      grassTuft(ctx, x, 691 + noise(j + 31) * 8, .43 + noise(j + 81) * .4, '#a5b184');
    }
    // Paper flecks are generated once, then baked into this static layer.
    for (const d of dots) {
      ctx.fillStyle = `rgba(125,96,61,${d.a})`; ctx.fillRect(d.x, d.y, d.r, d.r * .68);
    }
  }
  function wateringCan(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    path(ctx, p => { p.moveTo(-23, -4); p.lineTo(-27, -44); p.quadraticCurveTo(0, -55, 25, -44); p.lineTo(21, -4); p.quadraticCurveTo(0, 5, -23, -4); }, '#aab899');
    path(ctx, p => { p.moveTo(23, -32); p.lineTo(56, -53); p.lineTo(66, -46); p.lineTo(28, -15); }, '#aab899');
    path(ctx, p => { p.moveTo(-24, -36); p.bezierCurveTo(-65, -56, -64, -1, -22, -8); }, null, '#95a686', 7);
    oval(ctx, 64, -50, 6, 12, '#c4c9a6', -.6);
    line(ctx, -17, -37, -15, -10, 'rgba(245,235,197,.48)', 3); ctx.restore();
  }
  function makeLayer(image) {
    let canvas = null;
    if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(WIDTH, HEIGHT);
    else if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    }
    const context = canvas && canvas.getContext('2d');
    if (!context) return null;
    drawBackground(context, image); return canvas;
  }
  function drawWater(ctx, time, reducedMotion) {
    ctx.save();
    path(ctx, p => {
      p.moveTo(955, 655); p.bezierCurveTo(988, 619, 1081, 639, 1117, 658); p.bezierCurveTo(1154, 674, 1183, 677, 1183, 700);
      p.bezierCurveTo(1197, 730, 1169, 752, 1117, 755); p.bezierCurveTo(1083, 781, 991, 768, 977, 748);
      p.bezierCurveTo(916, 751, 897, 718, 923, 696); p.bezierCurveTo(907, 678, 932, 664, 955, 655); p.closePath();
    }, '#aabda7', '#c0c8a6', 5);
    path(ctx, p => {
      p.moveTo(957, 661); p.bezierCurveTo(993, 637, 1076, 644, 1116, 665); p.bezierCurveTo(1150, 681, 1175, 682, 1172, 705);
      p.bezierCurveTo(1183, 729, 1158, 742, 1111, 746); p.bezierCurveTo(1070, 767, 1008, 755, 980, 739);
      p.bezierCurveTo(930, 740, 914, 718, 934, 697); p.bezierCurveTo(925, 681, 941, 669, 957, 661); p.closePath();
    }, '#bfd0c0');
    // Reflections are brushed silhouettes clipped into the puddle.
    ctx.save(); ctx.clip();
    oval(ctx, 1032, 684, 83, 12, 'rgba(238,233,195,.55)');
    path(ctx, p => { p.moveTo(940, 676); p.quadraticCurveTo(1004, 677, 1010, 704); p.quadraticCurveTo(1048, 713, 1092, 685); p.lineTo(1109, 691); p.quadraticCurveTo(1045, 734, 995, 714); p.closePath(); }, 'rgba(142,163,137,.28)');
    const t = reducedMotion ? 0 : time * .001;
    for (let j = 0; j < 7; j++) {
      const yy = 674 + j * 11;
      const xx = 976 + (j % 3) * 31 + Math.sin(t * .56 + j * 1.8) * 5;
      path(ctx, p => { p.moveTo(xx - 25, yy); p.quadraticCurveTo(xx, yy + 2, xx + 42 + j * 3, yy - 1); }, null, j % 2 ? 'rgba(244,242,213,.67)' : 'rgba(157,184,165,.5)', 1.8);
    }
    ctx.restore();
    stone(ctx, 936, 741, 14, 6, 1); stone(ctx, 1168, 744, 17, 7, 2);
    stone(ctx, 1176, 666, 11, 6, 3); stone(ctx, 927, 679, 8, 4, 4);
    grassTuft(ctx, 934, 663, .7, '#99ab80'); grassTuft(ctx, 1187, 728, .7, '#a2b084');
    // Two small reeds and their soft seed heads.
    for (let j = 0; j < 3; j++) {
      const x = 1183 + j * 9;
      path(ctx, p => { p.moveTo(x, 689); p.quadraticCurveTo(x - 9, 645, x - 1, 626 - j * 7); }, null, '#8d9e74', 2);
      oval(ctx, x - 1, 624 - j * 7, 2.5, 9, '#b2956a', -.1);
    }
    ctx.restore();
  }
  function drawPlank(ctx, bridge, plankPosition) {
    const b = clamp(bridge);
    const moving = b === 0 && plankPosition && Number.isFinite(plankPosition.x) && Number.isFinite(plankPosition.y);
    ctx.save();
    if (b < .98) {
      ctx.globalAlpha = 1 - b;
      ctx.translate(moving ? plankPosition.x : 830, moving ? plankPosition.y : 745);
      ctx.rotate(moving ? -.08 : -.10);
      plankShape(ctx, moving ? -68 : -66, moving ? -12 : -16, 137, 25, false);
      ctx.restore(); ctx.save();
    }
    if (b > 0) {
      ctx.globalAlpha = clamp(b * 2);
      // The wood slides gently into place; it never changes the safe ground height.
      ctx.translate(912 - (1 - b) * 58, 687 - Math.sin(b * Math.PI) * 24);
      ctx.rotate((1 - b) * -.075);
      plankShape(ctx, 0, 0, 281, 30, true);
    }
    ctx.restore();
  }
  function plankShape(ctx, x, y, w, h, installed) {
    path(ctx, p => { p.moveTo(x, y + 6); p.lineTo(x + w - 2, y); p.lineTo(x + w, y + h - 3); p.lineTo(x + 3, y + h + 4); p.closePath(); }, '#a17e5a');
    path(ctx, p => { p.moveTo(x - 1, y); p.lineTo(x + w - 2, y - 5); p.lineTo(x + w - 1, y + h - 8); p.lineTo(x + 2, y + h - 2); p.closePath(); }, C.woodLight, '#b5926c', 1.2);
    path(ctx, p => { p.moveTo(x + 11, y + 5); p.bezierCurveTo(x + w * .3, y + 1, x + w * .8, y + 6, x + w - 12, y + 1); p.moveTo(x + 14, y + 13); p.bezierCurveTo(x + w * .4, y + 10, x + w * .65, y + 17, x + w - 9, y + 11); }, null, 'rgba(144,103,68,.38)', 1.1);
    if (installed) {
      for (let j = 0; j < 9; j++) line(ctx, x + 18 + j * 30, y - 2, x + 20 + j * 30, y + h - 5, 'rgba(140,101,67,.4)', 1.4);
      [17, w - 17].forEach(v => { oval(ctx, x + v, y + 4, 1.7, 1.5, '#8d7861'); oval(ctx, x + v, y + h - 10, 1.7, 1.5, '#8d7861'); });
    } else {
      oval(ctx, x + w * .63, y + 9, 10, 3.2, 'rgba(170,122,77,.25)', -.1);
      oval(ctx, x + w * .63, y + 9, 5.5, 1.7, 'rgba(132,96,64,.2)', -.1);
    }
  }
  // The arbour crosses the path in depth: the back foot is above the walking
  // baseline, the near foot below it. The cat travels between these two planes.
  const ARCH = { farX: 1759, farY: 646, farTop: 426, nearX: 1945, nearY: 788, nearTop: 482, hingeX: 1772, hingeY: 646 };

  function drawArchLattice(ctx, x, top, bottom) {
    line(ctx, x - 7, top, x - 7, bottom, '#bea37d', 6);
    line(ctx, x + 7, top, x + 7, bottom, '#cbb28b', 6);
    for (let y = top + 30; y <= bottom; y += 31) {
      line(ctx, x - 13, y, x + 14, y - 29, '#bba27a', 3);
    }
  }
  function archLeaves(ctx, x, y, a, seed) {
    leaf(ctx, x, y, 28 + noise(seed + 6) * 10, 9, a, seed % 3 ? '#8a9d76' : '#a3ad81', true);
    leaf(ctx, x + 3, y - 10, 20, 7, -a * 1.6, '#aeb88b', true);
    if (seed % 4 === 0) blossom(ctx, x + (seed % 2 ? 12 : -8), y - 12, 14, seed);
  }
  function drawGateLeaf(ctx, gate) {
    const angle = clamp(gate) * Math.PI * .5;
    // Rotate about the far hinge in the ground plane. At full opening the
    // entire leaf lies at y <= 646, behind the cat's 680–720 walking lane.
    // Both projected basis components change: the wood swings into the garden
    // instead of leaving a squeezed 15-pixel strip across the entrance.
    const dx = 166 * Math.cos(angle) - 176 * Math.sin(angle);
    const dy = 132 * Math.cos(angle) - 18 * Math.sin(angle);
    ctx.save(); ctx.transform(dx / 165, dy / 165, 0, 1, ARCH.hingeX, ARCH.hingeY);
    path(ctx, p => { p.moveTo(0, -3); p.lineTo(0, -159); p.quadraticCurveTo(82, -203, 165, -161); p.lineTo(165, -3); p.closePath(); }, '#c8b994', '#a89c78', 3);
    for (let j = 0; j < 8; j++) {
      const x = 9 + j * 21;
      path(ctx, p => { p.moveTo(x, -7); p.lineTo(x, -158 - Math.sin(j / 7 * Math.PI) * 19); }, null, '#e2d1a8', 10);
      line(ctx, x - 3, -145, x - 3, -11, 'rgba(151,142,104,.37)', 1.2);
    }
    line(ctx, 3, -125, 163, -125, '#b1a17e', 7); line(ctx, 3, -25, 163, -25, '#b1a17e', 8);
    line(ctx, 12, -36, 151, -117, '#b1a17e', 7);
    oval(ctx, 147, -93, 4, 4, '#8d8064');
    // Hinges stay attached to the far upright throughout the turn.
    line(ctx, 0, -132, 12, -132, '#928363', 4);
    line(ctx, 0, -31, 12, -31, '#928363', 4);
    ctx.restore();
  }
  function drawArchBack(ctx, gate) {
    ctx.save();
    oval(ctx, 1851, 723, 133, 19, 'rgba(95,115,78,.12)', .22);
    // Only the far upright and the overhead bow belong behind the character.
    path(ctx, p => {
      p.moveTo(ARCH.farX, ARCH.farY); p.lineTo(ARCH.farX, ARCH.farTop);
      p.bezierCurveTo(1759, 314, 1945, 344, ARCH.nearX, ARCH.nearTop);
    }, null, '#a58c69', 16);
    path(ctx, p => {
      p.moveTo(ARCH.farX + 6, ARCH.farY); p.lineTo(ARCH.farX + 6, ARCH.farTop);
      p.bezierCurveTo(1765, 325, 1939, 354, ARCH.nearX - 6, ARCH.nearTop);
    }, null, '#dbc39a', 7);
    drawArchLattice(ctx, 1747, 437, ARCH.farY + 1);
    stone(ctx, ARCH.farX, ARCH.farY + 2, 17, 5, 2);
    line(ctx, ARCH.farX, ARCH.hingeY - 132, ARCH.hingeX + 4, ARCH.hingeY - 132, '#928363', 4);
    line(ctx, ARCH.farX, ARCH.hingeY - 31, ARCH.hingeX + 4, ARCH.hingeY - 31, '#928363', 4);
    drawGateLeaf(ctx, gate);
    path(ctx, p => {
      p.moveTo(1748, 644); p.bezierCurveTo(1774, 580, 1736, 500, 1774, 425);
      p.bezierCurveTo(1803, 356, 1885, 363, 1920, 422);
    }, null, '#859571', 4);
    for (let j = 0; j < 8; j++) archLeaves(ctx, 1756 + Math.sin(j) * 10, 626 - j * 29, j % 2 ? -.6 : .8, j);
    for (let j = 0; j < 9; j++) {
      const t = j / 8;
      archLeaves(ctx, 1772 + t * 158, 421 - Math.sin(t * Math.PI) * 48, t * 2 - 1, j + 8);
    }
    bush(ctx, 1724, 649, 101, 52, '#9aaa80', 12);
    for (let j = 0; j < 7; j++) littleFlower(ctx, 1687 + j * 14, 652, .65, j % 2 ? '#d4aaaa' : '#eee2bc', j);
    ctx.restore();
  }
  function drawArchForeground(ctx, gate, time, reducedMotion) {
    ctx.save();
    // The near upright stays solid and paints after the cat. Its foot sits on
    // the near edge of the path, rather than directly on the cat's baseline.
    stone(ctx, ARCH.nearX, ARCH.nearY + 1, 22, 7, 2);
    drawArchLattice(ctx, 1957, 493, ARCH.nearY);
    path(ctx, p => { p.moveTo(ARCH.nearX, ARCH.nearTop); p.lineTo(ARCH.nearX, ARCH.nearY); }, null, '#a58c69', 16);
    path(ctx, p => { p.moveTo(ARCH.nearX - 6, ARCH.nearTop); p.lineTo(ARCH.nearX - 6, ARCH.nearY); }, null, '#dbc39a', 7);
    line(ctx, ARCH.nearX + 2, 506, ARCH.nearX + 2, 778, 'rgba(128,100,66,.3)', 1.5);
    path(ctx, p => { p.moveTo(1956, 783); p.bezierCurveTo(1930, 685, 1971, 557, 1920, 422); }, null, '#859571', 4);
    for (let j = 0; j < 11; j++) archLeaves(ctx, 1947 + Math.sin(j + 17) * 10, 772 - j * 28, j % 2 ? -.8 : .8, j + 17);
    // The bell shares the near plane; its hotspot retains the same coordinates.
    const sway = reducedMotion ? 0 : Math.sin(time * .0016) * .025;
    ctx.save(); ctx.translate(1959, 458); ctx.rotate(sway + clamp(gate) * .08);
    path(ctx, p => { p.moveTo(0, -28); p.quadraticCurveTo(12, -30, 14, -17); }, null, '#9a8865', 3);
    line(ctx, 13, -17, 13, -7, '#8f7f60', 1.6);
    path(ctx, p => { p.moveTo(4, 8); p.quadraticCurveTo(7, 2, 7, -3); p.quadraticCurveTo(13, -12, 19, -3); p.quadraticCurveTo(19, 2, 23, 8); p.closePath(); }, '#c2a06b', '#a68759', 1);
    oval(ctx, 13, 9, 11, 2.5, '#d5b784'); oval(ctx, 13, 12, 2, 3, '#9d825a');
    line(ctx, 13, 14, 13, 48, '#b19a73', 1.5); oval(ctx, 13, 50, 3, 5, '#c2a06b');
    ctx.restore();
    bush(ctx, 1991, 791, 112, 64, '#a6b18a', 31);
    grassTuft(ctx, 1929, 792, .65, '#a0ae81');
    ctx.restore();
  }
  function blossom(ctx, x, y, r, seed) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(noise(seed + 13));
    for (let j = 0; j < 6; j++) {
      const a = j * TAU / 6;
      oval(ctx, Math.cos(a) * r * .37, Math.sin(a) * r * .37, r * .41, r * .59, j % 2 ? '#deb7ac' : '#e9c6b3', a);
    }
    oval(ctx, 0, 0, r * .3, r * .27, '#c4a57a');
    for (let j = 0; j < 5; j++) oval(ctx, Math.cos(j * 1.9) * r * .14, Math.sin(j * 1.9) * r * .14, .9, .9, '#f3dbad');
    ctx.restore();
  }
  function petal(ctx, radius, width, angle, inner, fill, seed) {
    ctx.save(); ctx.rotate(angle);
    const r = radius;
    const w = width;
    path(ctx, p => {
      p.moveTo(-w * .16, inner);
      p.bezierCurveTo(-w * .78, -r * .18, -w * .8, -r * .64, -w * .58, -r * .82);
      p.bezierCurveTo(-w * .69, -r * 1.02, -w * .27, -r * 1.1, -w * .12, -r * .96);
      p.bezierCurveTo(w * .03, -r * 1.12, w * .24, -r * 1.03, w * .29, -r * .94);
      p.bezierCurveTo(w * .56, -r * 1.02, w * .76, -r * .79, w * .54, -r * .61);
      p.bezierCurveTo(w * .67, -r * .32, w * .32, -r * .04, w * .1, inner); p.closePath();
    }, fill, 'rgba(169,89,109,.13)', .6);
    path(ctx, p => {
      p.moveTo(-w * .46, -r * .82); p.bezierCurveTo(-w * .27, -r * .95, -w * .22, -r * .9, -w * .12, -r * .89);
      p.bezierCurveTo(w * .1, -r * 1.01, w * .21, -r * .9, w * .31, -r * .88);
    }, null, 'rgba(255,234,225,.7)', .8);
    if (seed % 3 !== 0) {
      path(ctx, p => { p.moveTo(-w * .08, inner - 2); p.quadraticCurveTo(-w * .28, -r * .41, -w * .19, -r * .76); }, null, 'rgba(172,86,109,.14)', .55);
      path(ctx, p => { p.moveTo(w * .06, inner - 2); p.quadraticCurveTo(w * .36, -r * .42, w * .32, -r * .72); }, null, 'rgba(254,230,223,.42)', .6);
    }
    ctx.restore();
  }
  function peony(ctx, x, y, radius, seed, open = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((noise(seed + 171) - .5) * .45);
    ctx.scale(1, .91 + noise(seed + 191) * .13);
    // Five sepals are barely visible beneath the full, many-petalled flower.
    for (let j = 0; j < 5; j++) leaf(ctx, 0, radius * .15, radius * 1.03, radius * .16, j * TAU / 5, '#88966d');
    const rings = [
      { n: 12, r: 1, w: .72, inner: .23, colors: ['#e7b6bb', '#edc4c6', '#e4b0b9', '#efcac9'] },
      { n: 11, r: .81, w: .67, inner: .16, colors: ['#e3a9b5', '#e8b4bc', '#edc2c6', '#e3a7b2'] }
    ];
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      for (let j = 0; j < ring.n; j++) {
        const k = seed * 31 + i * 103 + j * 7;
        const a = j / ring.n * TAU + i * .77 + noise(k + 89) * .27;
        const rr = radius * ring.r * (.86 + noise(k + 12) * .22) * (.85 + clamp(open) * .15);
        petal(ctx, rr, radius * ring.w * (.9 + noise(k + 303) * .18), a,
          radius * ring.inner, ring.colors[Math.floor(noise(k + 28) * ring.colors.length)], k);
      }
    }
    // The crowded heart has irregular, folded petaloids. Off-centre clusters break
    // the concentric spiral that would read as a rose instead of a full peony.
    const folds = [];
    for (let j = 0; j < 37; j++) {
      const k = seed * 13 + j * 41;
      const a = noise(k + 1) * TAU;
      const d = Math.sqrt(noise(k + 37)) * radius * .54;
      folds.push({ j, k, a, d, x: Math.cos(a) * d, y: Math.sin(a) * d * .83 });
    }
    folds.sort((a, b) => b.d - a.d);
    for (const f of folds) {
      const r = radius * (.21 + noise(f.k + 55) * .17);
      ctx.save(); ctx.translate(f.x, f.y);
      const angle = f.a + Math.PI * .5 + (noise(f.k + 82) - .5) * 1.5;
      const colors = ['#e4aab6', '#edbec6', '#e8b1bd', '#eec6ca', '#dda0af', '#e9b7c1'];
      petal(ctx, r, radius * (.23 + noise(f.k + 71) * .24), angle,
        r * .18, colors[Math.floor(noise(f.k + 99) * colors.length)], f.j);
      ctx.restore();
    }
    ctx.restore();
  }
  function drawBouquet(ctx, options = {}) {
    if (!ctx) return;
    const { x = 0, y = 0, scale = 1, open = 1 } = options;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    // Stems remain visible through the open folds of unbleached florist paper.
    path(ctx, p => { p.moveTo(-6, -11); p.lineTo(-90, -160); p.lineTo(2, -123); p.lineTo(88, -163); p.lineTo(29, -6); p.closePath(); }, '#d8be91');
    path(ctx, p => { p.moveTo(-81, -153); p.lineTo(-58, -28); p.lineTo(0, -5); p.lineTo(-7, -126); p.closePath(); }, '#ebd4a9');
    path(ctx, p => { p.moveTo(80, -155); p.lineTo(62, -29); p.lineTo(4, -4); p.lineTo(-7, -126); p.closePath(); }, '#dec399');
    const heads = [
      { x: -65, y: -159, r: 40, seed: 17 }, { x: 62, y: -161, r: 39, seed: 43 },
      { x: -29, y: -211, r: 42, seed: 61 }, { x: 34, y: -218, r: 40, seed: 89 },
      { x: -2, y: -157, r: 46, seed: 101 }
    ];
    for (let j = 0; j < heads.length; j++) {
      const h = heads[j];
      path(ctx, p => { p.moveTo(3 + j, -13); p.quadraticCurveTo(h.x * .6, -83, h.x, h.y + 18); }, null, j % 2 ? '#7e906a' : '#91a17a', 3.5);
    }
    branch(ctx, -3, -34, 175, -.56, 77);
    branch(ctx, 12, -36, 167, .58, 113);
    leaf(ctx, -57, -133, 52, 15, -1.21, '#889b75', true);
    leaf(ctx, 53, -125, 58, 16, 1.18, '#82956f', true);
    leaf(ctx, -82, -156, 39, 12, -.63, '#a1ad80', true);
    leaf(ctx, 78, -156, 42, 13, .63, '#9fac7e', true);
    heads.forEach(h => peony(ctx, h.x, h.y, h.r, h.seed, open));
    // The wrapping overlaps the stems, but leaves the five flower faces clear.
    path(ctx, p => {
      p.moveTo(-79, -123); p.quadraticCurveTo(-54, -131, -27, -107); p.lineTo(22, -19); p.lineTo(-17, 7);
      p.quadraticCurveTo(-37, -22, -48, -50); p.closePath();
    }, '#ead2a7', 'rgba(165,135,92,.25)', .8);
    path(ctx, p => {
      p.moveTo(76, -128); p.quadraticCurveTo(44, -133, 15, -98); p.lineTo(-19, -15); p.lineTo(18, 6);
      p.quadraticCurveTo(47, -35, 57, -72); p.closePath();
    }, '#e2c59a', 'rgba(165,135,92,.3)', .8);
    path(ctx, p => { p.moveTo(-70, -121); p.quadraticCurveTo(-53, -110, -32, -100); p.moveTo(69, -125); p.quadraticCurveTo(41, -110, 28, -90); }, null, 'rgba(255,242,207,.6)', 1.7);
    path(ctx, p => { p.moveTo(-28, -77); p.lineTo(5, -19); p.moveTo(32, -78); p.lineTo(10, -27); }, null, 'rgba(163,129,86,.18)', 1.1);
    // Dusty rose linen ribbon, folded loops and uneven tails.
    path(ctx, p => { p.moveTo(-30, -50); p.quadraticCurveTo(1, -40, 32, -50); p.lineTo(28, -37); p.quadraticCurveTo(1, -29, -25, -39); p.closePath(); }, '#bd8490');
    path(ctx, p => { p.moveTo(1, -42); p.bezierCurveTo(-38, -77, -63, -46, -20, -36); p.quadraticCurveTo(-9, -34, 1, -42); }, '#d29aa2', '#b47c88', .7);
    path(ctx, p => { p.moveTo(4, -42); p.bezierCurveTo(32, -74, 57, -54, 30, -39); p.quadraticCurveTo(15, -33, 4, -42); }, '#ca929c', '#b47c88', .7);
    path(ctx, p => { p.moveTo(-1, -39); p.quadraticCurveTo(-8, -10, -30, 2); p.lineTo(-25, -11); p.lineTo(-37, -12); p.quadraticCurveTo(-15, -25, -10, -42); }, '#cb929b');
    path(ctx, p => { p.moveTo(8, -40); p.quadraticCurveTo(25, -24, 34, -7); p.lineTo(21, -13); p.lineTo(20, -1); p.quadraticCurveTo(4, -21, -1, -39); }, '#be8491');
    oval(ctx, 2, -41, 8, 6, '#b77d89', -.12);
    path(ctx, p => { p.moveTo(-35, -51); p.quadraticCurveTo(-18, -57, -4, -43); p.moveTo(13, -44); p.quadraticCurveTo(28, -59, 38, -54); }, null, 'rgba(246,207,204,.48)', 1.2);
    ctx.restore();
  }
  function draw(ctx, options = {}) {
    if (!ctx) return;
    const { time = 0, bridge = 0, gate = 0, final = 0, reducedMotion = false, assets = {}, plankPosition = null } = options;
    const image = assets.background && assets.background.complete !== false && (assets.background.naturalWidth || assets.background.width) ? assets.background : null;
    if (!staticLayer || image !== staticImage) {
      staticLayer = makeLayer(image); staticImage = image;
    }
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (staticLayer) ctx.drawImage(staticLayer, 0, 0);
    else drawBackground(ctx, image);
    drawWater(ctx, time, reducedMotion);
    drawPlank(ctx, bridge, plankPosition);
    drawArchBack(ctx, gate);
    if (final > 0) {
      ctx.save(); ctx.globalAlpha = clamp(final); drawBouquet(ctx, { x: 3380, y: 580, scale: .67, open: 1 }); ctx.restore();
    }
    ctx.restore();
  }
  function drawForeground(ctx, options = {}) {
    if (!ctx) return;
    const { time = 0, cameraX = 0, viewportWidth = WIDTH, reducedMotion = false, flowers = 0, final = 0, gate = 0 } = options;
    const min = cameraX - 140;
    const max = cameraX + viewportWidth + 140;
    const t = reducedMotion ? 0 : time * .001;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (max >= 1700 && min <= 2040) drawArchForeground(ctx, gate, time, reducedMotion);
    // Plants frame the bottom of the page without concealing the walking cat.
    for (let j = 0; j < 39; j++) {
      const x = j * 97 + noise(j + 232) * 39;
      if (x < min || x > max) continue;
      const y = 838 + noise(j + 99) * 69;
      const s = .75 + noise(j + 44) * .62;
      const sway = Math.sin(t * .64 + j * 1.6) * 1.8;
      grassTuft(ctx, x, y, s, j % 2 ? '#9eae82' : '#b4be91', sway);
      if (j % 4 === 0) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(sway * .008);
        branch(ctx, 0, 0, 66 + noise(j + 9) * 27, (noise(j + 722) - .5) * .8, j + 349);
        ctx.restore();
      }
      if (j % 5 === 0) littleFlower(ctx, x + 18, y - 2, 1.05, j % 2 ? '#e1b8aa' : '#e9d9b3', j);
    }
    // A handful of fallen petals; each has a stable identity and a tiny breeze.
    for (let j = 0; j < 17; j++) {
      const x = 179 + noise(j + 401) * 3260;
      if (x < min || x > max) continue;
      const y = 790 + noise(j + 707) * 69;
      leaf(ctx, x + Math.sin(t * .4 + j) * 1.3, y, 7 + noise(j + 88) * 4, 3.5,
        noise(j + 76) * TAU + Math.sin(t * .3 + j) * .07, j % 3 ? '#dfb8a6' : '#e9c9b1');
    }
    // Flowers wake subtly after each solved obstacle; they do not flash or sparkle.
    const growth = clamp(flowers / (flowers > 1 ? 3 : 1));
    if (growth > 0) {
      const stops = [540, 1285, 2235, 2865];
      stops.forEach((x, j) => {
        if (x < min || x > max) return;
        ctx.save(); ctx.globalAlpha = growth;
        littleFlower(ctx, x, 792 + j % 2 * 5, .95, '#d6a5a4', j + 8);
        littleFlower(ctx, x + 19, 793, .68, '#e8c9af', j + 10);
        ctx.restore();
      });
    }
    if (final > 0 && 3380 > min && 3380 < max) {
      ctx.save(); ctx.globalAlpha = clamp(final) * .75;
      leaf(ctx, 3315, 703, 12, 4.5, 1.0, '#e2b1b4');
      leaf(ctx, 3440, 706, 10, 4, -.5, '#e9c0bd'); ctx.restore();
    }
    ctx.restore();
  }

  window.GardenWorld = Object.freeze({ width: WIDTH, height: HEIGHT, groundY: GROUND, draw, drawForeground, drawBouquet });
})();
