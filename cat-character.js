/**
 * CatCharacter — a small, hand-drawn cream-and-ginger garden cat.
 *
 * draw(ctx, {x, y, scale = 1, time = 0, speed = 0, phase = 0,
 *            jump = 0, facing = 1, delivery = 0, pet = 0,
 *            reducedMotion = false})
 *
 * x/y are the ground baseline between the paws, in the caller's world space.
 * Unscaled artwork is about 175 units wide (235 with the curved tail),
 * and 150 units tall. Facing 1 looks right; -1 mirrors the whole illustration.
 * time is seconds; phase is a walk-cycle angle in radians. Any nonzero speed
 * blends into walking, reaching its full pose at |speed| >= 1. The caller owns
 * movement and jump physics: jump is a positive height, subtracted from y.
 * At speed zero the raised cat sits at that height (for a wall/window perch).
 * The renderer neither changes the DOM nor keeps animation/physics state.
 */
(function installCatCharacter(global) {
  'use strict';

  const TAU = Math.PI * 2;
  const C = {
    ink: '#785846', softInk: '#98745a', cream: '#f2dfb5', light: '#fff0ce',
    shade: '#d9bd90', far: '#d9bd99', ginger: '#c58455', gingerLight: '#d49a66',
    gingerShade: '#b4764e', blush: '#d39a83', pink: '#d7a391', nose: '#9c6a59'
  };
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const mix = (a, b, n) => a + (b - a) * n;
  const smooth = n => n * n * (3 - 2 * n);

  // Stable, intentionally sparse pencil grain. No per-frame randomness.
  const grain = Array.from({ length: 108 }, (_, i) => {
    const a = Math.sin(i * 127.1 + 19.2) * 43758.5453;
    const b = Math.sin(i * 311.7 + 7.1) * 19642.349;
    return [a - Math.floor(a), b - Math.floor(b), 1.2 + (i % 4) * .45];
  });

  function path(ctx, fill, stroke = C.ink, width = 1.85) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }

  function line(ctx, points, color = C.ink, width = 1.25) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    if (points.length === 8) ctx.bezierCurveTo(...points.slice(2));
    else if (points.length === 6) ctx.quadraticCurveTo(...points.slice(2));
    else ctx.lineTo(points[2], points[3]);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, fill, stroke = null, width = 1.4) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    path(ctx, fill, stroke, width);
  }

  function pencilGrain(ctx, x, y, w, h, opacity = .13) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha *= opacity;
    ctx.strokeStyle = C.softInk;
    ctx.lineWidth = .65;
    for (const [u, v, length] of grain) {
      const px = x + u * w, py = y + v * h;
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.lineTo(px + length * .65, py - length);
      ctx.stroke();
    }
    ctx.restore();
  }

  function tailShape(ctx, wag) {
    // The entire outline shares the same root; the tip never floats off.
    ctx.beginPath(); ctx.moveTo(-65, -48);
    ctx.bezierCurveTo(-84, -40, -109, -47 + wag * .12, -117, -67 + wag * .25);
    ctx.bezierCurveTo(-128, -93 + wag * .5, -117 + wag * .1, -125 + wag, -103 + wag * .2, -125 + wag);
    ctx.bezierCurveTo(-92 + wag * .2, -126 + wag, -89, -111 + wag * .7, -100, -105 + wag * .6);
    ctx.bezierCurveTo(-110, -99 + wag * .5, -112, -86 + wag * .35, -104, -74 + wag * .18);
    ctx.bezierCurveTo(-96, -61, -78, -68, -65, -64);
    ctx.bezierCurveTo(-58, -61, -57, -52, -65, -48);
    ctx.closePath();
  }

  function drawTail(ctx, wag) {
    tailShape(ctx, wag); path(ctx, C.gingerLight, C.ink, 1.9);
    ctx.save(); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-119, -103 + wag * .6);
    ctx.bezierCurveTo(-112, -100 + wag * .6, -102, -98 + wag * .6, -96, -101 + wag * .6);
    ctx.lineTo(-87, -134 + wag); ctx.lineTo(-130, -139 + wag); ctx.closePath();
    path(ctx, C.cream, null);
    line(ctx, [-115, -84 + wag * .3, -114, -80 + wag * .3, -108, -78, -106, -79], C.gingerShade, 2.8);
    line(ctx, [-106, -63, -102, -62, -98, -63, -96, -66], C.gingerShade, 3.5);
    ctx.restore();
    tailShape(ctx, wag); pencilGrain(ctx, -125, -127 + wag, 68, 84, .17);
    line(ctx, [-114, -116 + wag, -111, -122 + wag, -105, -123 + wag, -101, -119 + wag], C.light, 1.2);
  }

  function walkFoot(phase, amount, airborne, rear) {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    return {
      // With increasing travel phase, sin <= 0 is the planted half:
      // pull the paw backward under the body, then recover forward aloft.
      x: (rear ? -44 : 40) - c * 17 * amount + (rear ? -5 : 5) * airborne,
      y: -Math.max(0, s) * 15 * amount - airborne * (rear ? 10 : 13),
      bend: -c * 9 * amount
    };
  }

  function drawLeg(ctx, rootX, rootY, foot, near, rear) {
    const ankleX = foot.x - (rear ? 4 : 1);
    const pawX = foot.x + (rear ? 1 : 3);
    ctx.beginPath(); ctx.moveTo(rootX - 10, rootY - 3);
    ctx.bezierCurveTo(rootX - 12, rootY + 12, ankleX - 7 + foot.bend * .2, foot.y - 17, ankleX - 7, foot.y - 9);
    ctx.bezierCurveTo(ankleX - 10, foot.y - 4, pawX - 11, foot.y + 1, pawX - 3, foot.y + 2);
    ctx.bezierCurveTo(pawX + 1, foot.y + 3, pawX + 13, foot.y + 3, pawX + 14, foot.y - 2);
    ctx.bezierCurveTo(pawX + 16, foot.y - 7, pawX + 9, foot.y - 10, ankleX + 6, foot.y - 10);
    ctx.bezierCurveTo(ankleX + 8, foot.y - 18, rootX + 12, rootY + 13, rootX + 10, rootY);
    // Canvas closes the fill implicitly; the open stroke has no hard
    // horizontal seam where the leg grows out of the painted body.
    const wash = ctx.createLinearGradient(rootX, rootY, foot.x, foot.y);
    wash.addColorStop(0, near ? C.cream : C.far);
    wash.addColorStop(1, near ? C.light : C.far);
    path(ctx, wash, C.ink, near ? 1.85 : 1.5);
    if (near) {
      line(ctx, [pawX + 6, foot.y - 4, pawX + 5, foot.y - 1, pawX + 5, foot.y + 1], C.softInk, .95);
      line(ctx, [pawX + 10, foot.y - 4, pawX + 10, foot.y - 2, pawX + 9, foot.y + 1], C.softInk, .85);
      line(ctx, [ankleX - 4, foot.y - 15, ankleX - 4, foot.y - 11], C.light, 1.3);
    }
  }

  function bodyShape(ctx, sit) {
    ctx.beginPath(); ctx.moveTo(29, -97);
    ctx.bezierCurveTo(9, -111, -32, -112, -56 - sit * 7, -100);
    ctx.bezierCurveTo(-79 - sit * 3, -90, -88, -67, -80, -42);
    ctx.bezierCurveTo(-77, -27, -66, -19, -47, -16 + sit * 4);
    ctx.bezierCurveTo(-28, -9 + sit * 3, 2, -12 + sit * 2, 21, -19);
    ctx.bezierCurveTo(43, -23, 57, -39, 55, -61);
    ctx.bezierCurveTo(54, -79, 45, -90, 29, -97);
    ctx.closePath();
  }

  function drawBody(ctx, sit) {
    bodyShape(ctx, sit); path(ctx, C.cream, C.ink, 2.0);
    ctx.save(); ctx.clip();
    // A broad transparent wash gives the round tummy a painted edge.
    const wash = ctx.createLinearGradient(-24, -104, -10, -11);
    wash.addColorStop(0, C.light); wash.addColorStop(.57, C.cream); wash.addColorStop(1, C.shade);
    ctx.fillStyle = wash; ctx.fillRect(-92, -115, 156, 112);
    ctx.beginPath(); ctx.moveTo(-90, -89);
    ctx.bezierCurveTo(-67, -114, -37, -111, -25, -99);
    ctx.bezierCurveTo(-17, -88, -30, -77, -44, -73);
    ctx.bezierCurveTo(-57, -69, -59, -52, -74, -46);
    ctx.lineTo(-97, -48); ctx.closePath(); path(ctx, C.gingerLight, null);
    ctx.beginPath(); ctx.moveTo(-86, -70);
    ctx.bezierCurveTo(-68, -83, -60, -91, -55, -104);
    ctx.bezierCurveTo(-59, -108, -66, -108, -71, -104);
    ctx.bezierCurveTo(-69, -91, -77, -86, -91, -83); ctx.closePath(); path(ctx, C.gingerShade, null);
    ctx.beginPath(); ctx.moveTo(-53, -104);
    ctx.bezierCurveTo(-43, -100, -41, -92, -46, -85);
    ctx.bezierCurveTo(-35, -88, -31, -93, -31, -103); ctx.closePath(); path(ctx, C.ginger, null);
    // A cream chest curls into the belly, with a ragged fur margin.
    ctx.beginPath(); ctx.moveTo(27, -94);
    ctx.bezierCurveTo(48, -79, 51, -49, 37, -34);
    ctx.bezierCurveTo(26, -22, 2, -20, -13, -24);
    ctx.bezierCurveTo(0, -30, 13, -36, 17, -48);
    ctx.bezierCurveTo(19, -56, 11, -61, 15, -72);
    ctx.bezierCurveTo(18, -79, 17, -89, 27, -94); ctx.closePath(); path(ctx, C.light, null);
    ctx.restore();
    bodyShape(ctx, sit); pencilGrain(ctx, -82, -108, 140, 96, .15);
    line(ctx, [-65, -39, -62, -33, -57, -30, -52, -29], C.softInk, .9);
    line(ctx, [-38, -21, -33, -20, -30, -20, -27, -21], C.softInk, .8);
    line(ctx, [19, -39, 17, -35, 15, -34], C.shade, 1.2);
    line(ctx, [-15, -101, -7, -104, 4, -103, 11, -100], C.light, 1.3);
  }

  function drawHaunch(ctx, amount, bob) {
    ctx.save(); ctx.globalAlpha *= amount;
    ctx.beginPath(); ctx.moveTo(-53, -60 + bob);
    ctx.bezierCurveTo(-75, -54 + bob, -78, -25, -66, -11);
    ctx.bezierCurveTo(-59, -2, -42, -1, -27, -1);
    ctx.bezierCurveTo(-20, -4, -17, -2, -14, 1);
    ctx.bezierCurveTo(-13, 5, -20, 6, -27, 6);
    ctx.bezierCurveTo(-47, 7, -71, 7, -77, -8);
    ctx.bezierCurveTo(-87, -28, -76, -54, -60, -58);
    ctx.closePath(); path(ctx, C.cream, C.ink, 1.7);
    line(ctx, [-64, -49 + bob, -47, -48 + bob, -39, -26, -49, -17], C.softInk, 1.2);
    line(ctx, [-24, 1, -25, 3, -25, 5], C.softInk, .9);
    line(ctx, [-19, 1, -20, 3, -20, 4], C.softInk, .9);
    ctx.restore();
  }

  function headShape(ctx) {
    ctx.beginPath(); ctx.moveTo(23, -118);
    ctx.bezierCurveTo(17, -109, 18, -92, 28, -83);
    ctx.bezierCurveTo(37, -74, 53, -74, 65, -79);
    ctx.bezierCurveTo(73, -82, 83, -81, 90, -89);
    ctx.bezierCurveTo(96, -96, 91, -102, 84, -105);
    ctx.bezierCurveTo(82, -121, 71, -130, 56, -132);
    ctx.bezierCurveTo(43, -136, 30, -130, 23, -118);
    ctx.closePath();
  }

  function drawHead(ctx, time, pet, pride, still) {
    const ear = still ? 0 : Math.sin(time * 1.15 + .9) * .8 + Math.sin(time * .47) * .4;
    // The far ear stays behind the round head.
    ctx.beginPath(); ctx.moveTo(61, -125);
    ctx.bezierCurveTo(61, -133, 67 + ear * .4, -145, 72 + ear * .4, -146);
    ctx.bezierCurveTo(76 + ear * .4, -146, 81, -131, 78, -119);
    ctx.closePath(); path(ctx, C.ginger, C.ink, 1.65);
    ctx.beginPath(); ctx.moveTo(68, -128);
    ctx.bezierCurveTo(68, -134, 70, -139, 72, -140);
    ctx.bezierCurveTo(75, -136, 76, -130, 75, -125); ctx.closePath(); path(ctx, C.pink, null);
    headShape(ctx); path(ctx, C.cream, C.ink, 1.95);
    ctx.save(); ctx.clip();
    const wash = ctx.createLinearGradient(40, -130, 70, -77);
    wash.addColorStop(0, C.light); wash.addColorStop(1, C.cream);
    ctx.fillStyle = wash; ctx.fillRect(13, -139, 86, 69);
    ctx.beginPath(); ctx.moveTo(15, -110);
    ctx.bezierCurveTo(19, -132, 46, -143, 65, -129);
    ctx.bezierCurveTo(70, -121, 62, -113, 53, -115);
    ctx.bezierCurveTo(45, -121, 43, -116, 39, -107);
    ctx.bezierCurveTo(33, -103, 28, -103, 22, -99); ctx.closePath(); path(ctx, C.gingerLight, null);
    ctx.beginPath(); ctx.moveTo(41, -135);
    ctx.bezierCurveTo(43, -130, 46, -124, 49, -122);
    ctx.bezierCurveTo(52, -128, 53, -130, 53, -134); ctx.closePath(); path(ctx, C.gingerShade, null);
    ctx.beginPath(); ctx.moveTo(59, -133);
    ctx.bezierCurveTo(60, -126, 62, -123, 65, -122);
    ctx.lineTo(71, -130); ctx.closePath(); path(ctx, C.ginger, null);
    ctx.restore();
    headShape(ctx); pencilGrain(ctx, 17, -134, 76, 60, .13);
    // Near ear, with a slightly folded, soft point.
    ctx.beginPath(); ctx.moveTo(25, -117);
    ctx.bezierCurveTo(21, -126, 23 + ear, -145, 29 + ear, -149);
    ctx.bezierCurveTo(32 + ear, -151, 40, -136, 47, -128);
    ctx.bezierCurveTo(39, -128, 30, -122, 25, -117); ctx.closePath(); path(ctx, C.gingerLight, C.ink, 1.75);
    ctx.beginPath(); ctx.moveTo(28, -125);
    ctx.bezierCurveTo(27, -133, 28 + ear * .7, -141, 30 + ear * .7, -142);
    ctx.bezierCurveTo(34, -137, 37, -132, 39, -129);
    ctx.bezierCurveTo(34, -129, 30, -127, 28, -125); ctx.closePath(); path(ctx, C.pink, null);
    line(ctx, [30, -136, 31, -132, 32, -130], '#bd8b78', .7);
    // A little tuft at the cheek and the cream muzzle.
    line(ctx, [22, -100, 19, -97, 22, -96, 24, -96], C.softInk, 1.1);
    ctx.beginPath(); ctx.moveTo(61, -101);
    ctx.bezierCurveTo(68, -105, 78, -104, 84, -101);
    ctx.bezierCurveTo(89, -100, 93, -96, 89, -91);
    ctx.bezierCurveTo(82, -85, 69, -86, 63, -90);
    ctx.bezierCurveTo(59, -93, 58, -98, 61, -101); ctx.closePath(); path(ctx, C.light, null);
    ctx.save(); ctx.globalAlpha *= .38;
    ellipse(ctx, 60, -98, 7.5, 3.5, C.blush);
    ctx.restore();

    const cycle = ((time + .72) % 5.7 + 5.7) % 5.7;
    const blink = still ? 0 : clamp(1 - Math.abs(cycle - .14) / .14);
    const shut = Math.max(blink, pet * .9);
    const eyeY = -110 + pet * 1.2;
    // Half-lidded eyes are drawn as tiny crescents, not painted emoji dots.
    if (shut > .7) {
      line(ctx, [53, eyeY, 56, eyeY + 3, 60, eyeY + 3, 63, eyeY], C.ink, 1.55);
      line(ctx, [75, eyeY + 1.6, 77, eyeY + 3.5, 80, eyeY + 3.5, 82, eyeY + 1.5], C.ink, 1.35);
    } else {
      line(ctx, [52, eyeY + .2, 55, eyeY - .7 + shut, 60, eyeY - .5 + shut, 63, eyeY + 1], C.ink, 1.35);
      ellipse(ctx, 58.5, eyeY + 2.1, 1.55, 2.8 * (1 - shut * .75), C.ink);
      line(ctx, [74, eyeY + 2, 76, eyeY + 1, 79, eyeY + 1.3, 81, eyeY + 2.5], C.ink, 1.1);
      ellipse(ctx, 78.5, eyeY + 3.8, 1.25, 2.25 * (1 - shut * .75), C.ink);
      ellipse(ctx, 58.8, eyeY + 1.1, .45, .65, C.light);
      ellipse(ctx, 78.8, eyeY + 2.9, .35, .5, C.light);
    }
    line(ctx, [53, -117, 55, -118, 58, -118, 60, -117], C.gingerShade, .65);
    // Tiny pink-brown nose and a calm, off-centre smile.
    ctx.beginPath(); ctx.moveTo(83, -102);
    ctx.bezierCurveTo(85, -103, 89, -102, 89.5, -100.5);
    ctx.bezierCurveTo(89, -98.8, 86, -97.7, 84.8, -98.9);
    ctx.closePath(); path(ctx, C.nose, null);
    line(ctx, [86, -99, 86.5, -95.5, 84, -94, 82, -95], C.ink, 1.05);
    line(ctx, [82, -95, 79.5, -91.5 - pet, 75, -92 - pet, 74, -94], C.ink, 1.1);
    ellipse(ctx, 69, -95, .6, .55, C.softInk);
    ellipse(ctx, 73, -97, .55, .5, C.softInk);
    ellipse(ctx, 71, -92, .5, .45, C.softInk);
    // Faint tapered whiskers, attached to the muzzle.
    line(ctx, [66, -96, 56, -100, 48, -99, 44, -98], C.softInk, .75);
    line(ctx, [65, -93, 55, -94, 46, -91, 42, -89], C.softInk, .7);
    line(ctx, [85, -94, 92, -96, 98, -96, 102, -94], C.softInk, .7);
    line(ctx, [85, -91, 92, -90, 96, -88, 98, -86], C.softInk, .65);
    // Loose chest fur makes the head belong to the body.
    line(ctx, [31, -81, 32, -77, 35, -76], C.softInk, .9);
    line(ctx, [37, -79, 38, -75, 41, -74], C.softInk, .85);
  }

  function draw(ctx, options = {}) {
    const x = finite(options.x), y = finite(options.y);
    const scale = Math.max(.001, Math.abs(finite(options.scale, 1)));
    const time = finite(options.time), phase = finite(options.phase);
    const moving = smooth(clamp(Math.abs(finite(options.speed))));
    const still = !!options.reducedMotion;
    const pet = clamp(finite(options.pet));
    const pride = clamp(finite(options.delivery));
    const jump = Math.max(0, finite(options.jump));
    const airborne = clamp(jump / 25) * moving;
    const idle = 1 - moving;
    const motion = still ? 0 : 1;
    const legPhase = still ? .7 : phase;
    const bob = Math.sin(phase * 2) * 1.7 * moving * motion + Math.sin(time * 1.8) * .65 * idle * motion;
    const wag = (Math.sin(time * 1.7) * 5 + Math.sin(phase - .5) * 3 * moving) * motion + pet * 5;
    const lean = Math.sin(phase) * .012 * moving * motion - pride * .018 - pet * .025;
    const frontNear = walkFoot(legPhase, moving, airborne, false);
    const rearNear = walkFoot(legPhase + Math.PI, moving, airborne, true);
    const frontFar = walkFoot(legPhase + Math.PI, moving, airborne, false);
    const rearFar = walkFoot(legPhase, moving, airborne, true);
    // A second outline is visible behind each near paw when the cat rests.
    frontFar.x += 12 * idle; frontFar.y -= 2 * idle;
    rearFar.x -= 11 * idle;

    ctx.save();
    try {
      ctx.translate(x, y - jump);
      ctx.scale(scale * (finite(options.facing, 1) < 0 ? -1 : 1), scale);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.save(); ctx.translate(0, bob); ctx.rotate(lean);
      drawTail(ctx, wag);
      ctx.restore();
      drawLeg(ctx, 40, -49 + bob, frontFar, false, false);
      ctx.save(); ctx.globalAlpha *= moving;
      drawLeg(ctx, -47, -43 + bob, rearFar, false, true);
      ctx.restore();
      ctx.save(); ctx.translate(0, bob); ctx.rotate(lean);
      ctx.scale(1 + airborne * .015, 1 - airborne * .015);
      drawBody(ctx, idle);
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= moving;
      drawLeg(ctx, -48, -43 + bob, rearNear, true, true);
      ctx.restore();
      drawHaunch(ctx, idle, bob);
      drawLeg(ctx, 37, -46 + bob, frontNear, true, false);
      ctx.save();
      ctx.translate(pet * 1.2 + pride * 1.2, bob - pride * 2.5 + pet * 2);
      ctx.translate(34, -90); ctx.rotate(lean + pet * .045); ctx.translate(-34, 90);
      drawHead(ctx, time, pet, pride, still);
      ctx.restore();
    } finally {
      ctx.restore();
    }
  }

  global.CatCharacter = Object.freeze({ draw });
})(typeof window !== 'undefined' ? window : globalThis);
