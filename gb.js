// Handheld-style sprite engine: 4-shade palettes, a 16x16 walking sprite,
// a large portrait, fans, mood bubbles and the ball. All art is original and
// built pixel by pixel, outlined automatically, then cached.
(function () {
  const INK = "#181820";

  // ---------- palettes ----------
  // Each mono palette runs lightest -> darkest. "color" keeps the player's own colours.
  const PALETTES = {
    color: { name: "Color", shades: ["#f8f8f0", "#b8d0e8", "#5878a8", "#181828"] },
    red: { name: "Red version", shades: ["#fff4ec", "#f4a490", "#b4383c", "#2c0c14"] },
    blue: { name: "Blue version", shades: ["#f0f6ff", "#90b8f0", "#3858a8", "#0c1430"] },
    green: { name: "Classic green", shades: ["#e0f8d0", "#88c070", "#346856", "#081820"] },
    pocket: { name: "Pocket grey", shades: ["#f4f4ec", "#b4b4a8", "#686860", "#1c1c18"] },
    gold: { name: "Gold version", shades: ["#fff8e0", "#f0c860", "#a87818", "#2c1c04"], locked: "gold" },
  };
  const isMono = p => p && p !== "color";

  const hex = c => { c = c.replace("#", ""); return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)); };
  const mix = (a, b, k) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k).toString(16).padStart(2, "0")).join("");
  const shade = c => mix(c, INK, 0.3), light = c => mix(c, "#ffffff", 0.4);
  const warmShade = c => mix(c, "#9a4a3c", 0.22), warmLight = c => mix(c, "#ffd9a0", 0.35);
  const lum = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function painter(w, h) {
    const c = canvas(w, h), x = c.getContext("2d");
    return {
      c, x,
      r(px, py, pw, ph, col) { x.fillStyle = col; x.fillRect(px, py, pw, ph); },
      p(px, py, col) { x.fillStyle = col; x.fillRect(px, py, 1, 1); },
      clear(px, py, pw, ph) { x.clearRect(px, py, pw, ph); },
    };
  }
  function outline(c, col) {
    const x = c.getContext("2d"), w = c.width, h = c.height, d = x.getImageData(0, 0, w, h), a = d.data;
    const [R, G, B] = hex(col), solid = i => a[i * 4 + 3] > 127, add = [];
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) {
      const i = y * w + X; if (solid(i)) continue;
      if ((X > 0 && solid(i - 1)) || (X < w - 1 && solid(i + 1)) || (y > 0 && solid(i - w)) || (y < h - 1 && solid(i + w))) add.push(i);
    }
    for (const i of add) { a[i * 4] = R; a[i * 4 + 1] = G; a[i * 4 + 2] = B; a[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    return c;
  }
  // Map a full-colour sprite onto a 4-shade palette by brightness. Outlines stay darkest.
  function quantize(src, pal) {
    if (!isMono(pal)) return src;
    const sh = PALETTES[pal].shades.map(hex);
    const c = canvas(src.width, src.height), x = c.getContext("2d");
    x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 128) { a[i + 3] = 0; continue; }
      const L = lum([a[i], a[i + 1], a[i + 2]]);
      const k = L > 0.8 ? 0 : L > 0.52 ? 1 : L > 0.2 ? 2 : 3;
      [a[i], a[i + 1], a[i + 2]] = sh[k]; a[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  // ---------- customisation ----------
  const HAIRSTYLES = { spiky: "Spiky", short: "Short", long: "Long", curly: "Curly", buzz: "Buzz cut", ponytail: "Ponytail" };
  const HEADWEAR = { none: "None", cap: "Cap", headband: "Headband", crown: "Crown" };
  const GOLD = "#ffcc33", ARMBAND = "#ffd23f";
  const PATTERNS = { plain: "Plain", stripes: "Stripes", hoops: "Hoops", halves: "Halves", sash: "Sash" };
  function look(s) {
    return {
      kit: s.kit || "#e63946", kit2: s.kit2 || "#ffffff", pattern: s.pattern || "plain",
      shorts: s.shorts || (s.kit === "#f2f2f2" ? "#2b3a67" : "#f4f4f4"), boots: s.boots || "#3b3550",
      skin: s.skin || "#f7d1b5", hair: s.hair || "#3b2618", hairStyle: s.hairStyle || "spiky",
      headwear: s.headwear || "none", gear: s.gear || "#3a86ff", number: s.number || 10,
      armband: !!(s.extras && s.extras.armband),
      ...(s.extras && s.extras.goldBoots ? { boots: "#f0b828" } : {}),
    };
  }
  // Colour of a shirt pixel at (x, y) within a shirt whose box starts at (x0, y0) and is w wide.
  function shirtColor(o, x, y, x0, y0, w, h) {
    const lx = x - x0, ly = y - y0;
    const on = o.pattern === "stripes" ? (lx >> (w > 12 ? 1 : 0)) % 2 === 1
      : o.pattern === "hoops" ? (ly >> (h > 8 ? 1 : 0)) % 2 === 1
      : o.pattern === "halves" ? lx >= w / 2
      : o.pattern === "sash" ? Math.abs((lx - ly * (w / h)) - w * 0.15) < Math.max(1.2, w / 8)
      : false;
    return on ? o.kit2 : o.kit;
  }

  // ---------- 16x16 walking sprite (canvas 16x21, feet on row 18) ----------
  const fit = s => (s + "................").slice(0, 16);
  const BODY = {
    down: {
      head: ["....SSSSSSSS....", "...SSSSSSSSSS...", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..",
        "..SSSSSSSSSSSS..", "..SSSESSSSESSS..", "..SSRESSSSERSS..", "...sSSSSSSSSs..."],
      stand: ["...JJJJWWJJJJ...", "..JJJJJJJJJJJJ..", "..SJJJJJJJJJJS..", "...PPPPPPPPPP...", "....SS....SS....", "....DD....DD....", "...BBB....BBB..."],
      walk: ["...JJJJWWJJJJ...", "..JJJJJJJJJJJS..", "..SJJJJJJJJJJ...", "...PPPPPPPPPP...", "....SS....SS....", "....DD....BBB...", "...BBB.........."],
    },
    up: {
      head: ["....SSSSSSSS....", "...SSSSSSSSSS...", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..",
        "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..", "..SSSSSSSSSSSS..", "...sSSSSSSSSs..."],
      stand: ["...JJJJJJJJJJ...", "..JJJJJJJJJJJJ..", "..SJJJJJJJJJJS..", "...PPPPPPPPPP...", "....SS....SS....", "....DD....DD....", "...BBB....BBB..."],
      walk: ["...JJJJJJJJJJ...", "..SJJJJJJJJJJJ..", "...JJJJJJJJJJS..", "...PPPPPPPPPP...", "....SS....SS....", "....BBB...DD....", "..........BBB..."],
    },
    left: {
      head: [".....SSSSSS.....", "....SSSSSSSS....", "...SSSSSSSSSS...", "...SSSSSSSSSS...", "...SSSSSSSSSS...",
        "...SSSSSSSSSS...", "...SESSSSSSSS...", "...SERSSSSSSs...", "....sSSSSSSs...."],
      stand: [".....JJJJJJ.....", "....JJJJJJJ.....", "....SJJJJJJ.....", ".....PPPPPP.....", "......SS.SS.....", "......DD.DD.....", ".....BBB.BBB...."],
      walk: [".....JJJJJJ.....", "....JJJJJJJ.....", "...SJJJJJJJ.....", ".....PPPPPP.....", ".....SS...SS....", ".....DD...DD....", "....BBB...BBB..."],
    },
  };
  // Hair overlays, listed from row -1 (above the head). "H" hair, "h" hair shade.
  const HAIR = {
    down: {
      spiky: ["....H..H..H.....", "...HHH.HHH.HH...", "...HHHHHHHHHHH..", "..HHHHHHHHHHHHH.", "..HHHHHHHHHHHHH.", "..HHhHHhHHhHHHH.", "..HH.hH..hH..HH.", "..H..........H.."],
      short: ["", "", "....HHHHHHHH....", "...HHHHHHHHHH...", "..HHHHHHHHHHHH..", "..HHHHHHHHHhHH..", "..HHHHHHh.....H.", "..H..........H.."],
      long: ["", "", "....HHHHHHHH....", "...HHHHHHHHHH...", "..HHHHHHHHHHHH..", "..HHHHHHHHHhHH..", "..HHHh......HH..", ".HH..........HH.", ".HH..........HH.", ".HH..........HH.", ".HH..........HH.", ".Hh..........hH.", ".h............h."],
      curly: ["....HHHHHHHH....", "..HHHHHHHHHHHH..", ".HHhHHHHhHHHhHH.", ".HHHHHHHHHHHHHH.", ".HhHHHhHHHHhHHH.", ".HHHhHHhHHhHHHH.", ".HH.h.....h..HH.", ".HH..........HH.", "..H..........H.."],
      buzz: ["", "", "....hhhhhhhh....", "...hhhhhhhhhh...", "..hhHhhHhhHhhh..", "..h..........h.."],
      ponytail: ["", "", "....HHHHHHHH....", "...HHHHHHHHHH...", "..HHHHHHHHHHHH..", "..HHHHHhhHHHHHH.", "..HHH......HHHH.", "..H..........HH.", ".............hH."],
    },
    left: {
      spiky: [".......H..H.....", "......HHH.HHH...", ".....HHHHHHHHH..", "....HHHHHHHHHHH.", "...HHHHHHHHHHHH.", "...HhHHHHHHHHHH.", "...h.hHHHHHHHHH.", "........HHHHHH..", ".........HHHHH..", "...........HH..."],
      short: ["", "", ".....HHHHHH.....", "....HHHHHHHHH...", "...HHHHHHHHHHH..", "...HHHHHHHHHHH..", "...H...HHHHHHH..", ".......HHHHHHH..", "........HHHHHH..", "..........HHh..."],
      long: ["", "", ".....HHHHHH.....", "....HHHHHHHHH...", "...HHHHHHHHHHH..", "...HHHHHHHHHHH..", "...H...HHHHHHH..", ".......HHHHHHH..", "........HHHHHH..", ".........HHHHH..", ".........HHHHh..", "..........HHHh..", "..........hHh..."],
      curly: [".....HHHHHHH....", "...HHHHHHHHHHH..", "..HHHHHhHHHHHHH.", "..HHhHHHHHhHHHH.", "..HHHHHHHHHHHHH.", "..HhHHHHHHHHhHH.", "..H.h..HHHHHHHH.", ".......HHHHHHHH.", "........HHHHHH..", "..........HHH..."],
      buzz: ["", "", ".....hhhhhh.....", "....hhhhhhhhh...", "...hhHhhhHhhhh..", "...h....hhhhhh..", ".........hhhh..."],
      ponytail: ["", "", ".....HHHHHH.....", "....HHHHHHHHH...", "...HHHHHHHHHHH..", "...HHHHHHHHHHHH.", "...H...HHHHHHHH.", ".......HHHHHHHH.", "........HHHHHHH.", "..........HHhHH.", "............hH.."],
    },
  };
  const GEAR = {
    cap: {
      down: ["", "....CCCCCCCC....", "...CCCCCCCCCC...", "..CCCCCcCCCCCC..", "..CCCCCCCCCCCC..", ".ccccccccccccc.."],
      up: ["", "....CCCCCCCC....", "...CCCCCCCCCC...", "..CCCCCCCCCCCC..", "..CCCCCCCCCCCC..", "..CCCCCccCCCCC.."],
      left: ["", ".....CCCCCC.....", "....CCCCCCCCC...", "...CCCCCCCCCCC..", "...CCCCCCCCCCC..", ".ccccCCCCCCCCC.."],
    },
    crown: {
      down: ["....C..CC..C....", "....CC.CC.CC....", "....CCCCCCCC....", "....CjCCCCjC...."],
      up: ["....C..CC..C....", "....CC.CC.CC....", "....CCCCCCCC....", "....CCCCCCCC...."],
      left: [".....C.CC.C.....", ".....CC.C.CC....", ".....CCCCCCC....", ".....CjCCCjC...."],
    },
    headband: {
      down: ["", "", "", "", "..CCCCCCCCCCCC.."],
      up: ["", "", "", "", "..CCCCCCCCCCCC..", "......CC........"],
      left: ["", "", "", "", "...CCCCCCCCCCC..", ".............C.."],
    },
  };

  function walkSprite(o, dir, frame) {
    const L = painter(16, 21), oy = 3; // headroom for spikes and their outline
    const d = dir === "right" ? "left" : dir;
    const B = BODY[d], rows = [...B.head, ...(frame ? B.walk : B.stand)].map(fit);
    const col = {
      S: o.skin, s: warmShade(o.skin), E: INK, R: "#ff9bb0", W: "#ffffff", P: o.shorts, D: o.kit, B: o.boots,
    };
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === ".") return;
      if (ch === "J") L.p(x, y + oy, shirtColor(o, x, y, 2, 9, 12, 3));
      else L.p(x, y + oy, col[ch]);
    }));
    // hair: front/side maps, or a filled head for the back view
    const style = o.headwear === "cap" ? (o.hairStyle === "curly" ? "short" : o.hairStyle) : o.hairStyle;
    const paint = (map, startRow, colors) => map.map(fit).forEach((row, i) => [...row].forEach((ch, x) => {
      if (colors[ch]) L.p(x, startRow + i + oy, colors[ch]);
    }));
    const hc = { H: o.hair, h: shade(o.hair) };
    if (d === "up") {
      B.head.map(fit).forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && y < 8) L.p(x, y + oy, o.hair); }));
      paint(HAIR.down[style], -2, { H: o.hair, h: o.hair });
      if (style === "long") for (let y = 8; y <= 11; y++) L.r(3, y + oy, 10, 1, y === 11 ? shade(o.hair) : o.hair);
      if (style === "ponytail") { L.r(7, 8 + oy, 2, 4, o.hair); L.r(7, 11 + oy, 2, 1, shade(o.hair)); }
      if (style === "buzz") B.head.map(fit).forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== "." && y < 7) L.p(x, y + oy, shade(o.hair)); }));
    } else {
      let map = HAIR[d][style];
      if (o.headwear === "cap") map = map.map((r, i) => i <= 4 ? "" : r);
      paint(map, -2, hc);
    }
    if (o.headwear !== "none") {
      const g = GEAR[o.headwear][d];
      paint(g, -2, o.headwear === "crown" ? { C: GOLD, c: shade(GOLD), j: "#e03050" } : { C: o.gear, c: shade(o.gear) });
    }
    // captain's armband on the left sleeve
    if (o.armband) L.p(d === "up" ? 13 : d === "left" ? 4 : 2, 10 + oy, ARMBAND);
    let c = outline(L.c, INK);
    if (dir === "right") { const m = canvas(16, 21), x = m.getContext("2d"); x.translate(16, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); c = m; }
    return c;
  }

  // ---------- large portrait (44x62, feet at (22, 60)) ----------
  const SW = 44, SH = 62, CX = 22;
  const mirror = (side, x, w) => side < 0 ? x : 2 * CX - x - w;
  const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001",
    "111100111001111", "111100111101111", "111001010010010", "111101111101111", "111101111001111"];

  function pBody(o) {
    const L = painter(SW, SH), skin = o.skin, boot = o.boots, u = o.sit ? 6 : 0, sy = 32 + u;
    if (o.sit) {
      for (const side of [-1, 1]) {
        L.r(mirror(side, CX - 13, 4), 55, 4, 3, skin);
        L.r(mirror(side, CX - 17, 4), 55, 4, 3, o.kit); L.r(mirror(side, CX - 17, 4), 56, 4, 1, o.kit2);
        L.r(mirror(side, CX - 20, 3), 53, 3, 6, boot);
      }
    } else {
      for (const [lx, lift] of [[CX - 8, o.liftL || 0], [CX + 3, o.liftR || 0]]) {
        L.r(lx, 49 - lift, 5, 3, skin); L.r(lx, 52 - lift, 5, 5, o.kit); L.r(lx, 53 - lift, 5, 1, o.kit2);
        const bx = lx < CX ? lx - 1 : lx;
        L.r(bx, 57 - lift, 6, 3, boot); L.r(bx + 1, 57 - lift, 2, 1, light(boot));
      }
    }
    L.r(CX - 9, 44 + u, 18, 6, o.shorts); L.r(CX - 9, 49 + u, 18, 1, shade(o.shorts)); L.clear(CX - 1, 48 + u, 2, 2);
    // patterned shirt
    for (let y = sy; y < sy + 12; y++) for (let x = CX - 10; x < CX + 10; x++) L.p(x, y, shirtColor(o, x, y, CX - 10, sy, 20, 12));
    L.clear(CX - 10, sy, 1, 1); L.clear(CX + 9, sy, 1, 1);
    for (let y = sy + 1; y < sy + 12; y++) for (let x = CX + 7; x < CX + 9; x++) L.p(x, y, shade(shirtColor(o, x, y, CX - 10, sy, 20, 12)));
    for (let x = CX - 10; x < CX + 10; x++) L.p(x, sy + 11, shade(shirtColor(o, x, sy + 11, CX - 10, sy, 20, 12)));
    [[-3, 0], [-2, 1], [-1, 2], [0, 2], [1, 1], [2, 0]].forEach(([dx, dy]) => L.p(CX + dx, sy + dy, o.kit2 === o.kit ? "#fff" : o.kit2));
    L.r(CX - 2, sy, 4, 1, skin); L.r(CX - 1, sy + 1, 2, 1, skin);
    // number in a colour that reads on the shirt
    const num = String(o.number), nc = lum(hex(o.kit)) > 0.6 ? INK : "#fff", nx = (CX - (num.length * 4 - 1) / 2) | 0;
    L.r(nx - 1, sy + 3, num.length * 4 + 1, 7, o.kit);
    [...num].forEach((dg, i) => { const g = DIGITS[+dg]; for (let k = 0; k < 15; k++) if (g[k] === "1") L.p(nx + i * 4 + k % 3, sy + 4 + ((k / 3) | 0), nc); });
    for (const [side, pose] of [[-1, o.armL || "down"], [1, o.armR || "down"]]) {
      const S = (x, y, w, h) => L.r(mirror(side, x, w), y, w, h, o.kit);
      const Hd = (x, y) => L.r(mirror(side, x, 3), y, 3, 3, skin);
      if (pose === "up") { S(CX - 14, sy - 2, 3, 4); S(CX - 16, sy - 5, 3, 4); Hd(CX - 17, sy - 8); }
      else if (pose === "wave") { S(CX - 14, sy - 1, 3, 4); S(CX - 17, sy - 3, 3, 3); Hd(CX - 19, sy - 6); }
      else if (pose === "low") { S(CX - 14, sy + 3, 3, 5); Hd(CX - 14, sy + 8); }
      else { S(CX - 14, sy + 2, 3, 5); Hd(CX - 14, sy + 7); }
      if (o.headwear === "headband") L.r(mirror(side, CX - 14, 3), pose === "up" ? sy - 6 : sy + 6, 3, 1, o.gear);
      if (o.armband && side < 0) L.r(CX - 14, pose === "up" ? sy - 1 : pose === "low" ? sy + 4 : sy + 3, 3, 2, ARMBAND);
    }
    return L.c;
  }

  function pHead(o) {
    const L = painter(SW, SH), u = o.sit ? 6 : 0, cx = CX, cy = 18 + u + (o.headDy || 0), r = 13.5;
    const hair = o.hair, hs = shade(hair), hl = warmLight(hair), skin = o.skin, sks = warmShade(skin);
    const style = o.hairStyle, zig = [0, 1, 2, 3, 2, 1];
    // hair that hangs behind the head
    if (style === "long") for (let y = cy - 2; y <= cy + 13; y++) for (let x = cx - 16; x < cx + 16; x++) {
      const dx = x + 0.5 - cx; if (Math.abs(dx) > 15.5 - Math.max(0, y - cy - 9) * 0.6) continue; L.p(x, y, y > cy + 11 ? hs : hair);
    }
    if (style === "ponytail") { L.r(cx + 12, cy - 6, 5, 10, hair); L.r(cx + 13, cy + 4, 3, 4, hair); L.r(cx + 14, cy + 8, 2, 2, hs); }
    if (style === "curly") for (let y = cy - 20; y <= cy + 6; y++) for (let x = cx - 18; x < cx + 18; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - (cy - 3), a = Math.atan2(dy, dx), R = 16.5 + Math.sin(a * 7) * 1.2;
      if (dx * dx + dy * dy <= R * R) L.p(x, y, ((x * 3 + y * 5) % 11 === 0) ? hl : ((x + y) % 7 === 0 ? hs : hair));
    }
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      let isHair, c = hair;
      if (style === "spiky") isHair = y < cy - 5 + zig[(x + 60) % 6] || (Math.abs(dx) > 10 && y < cy + 4);
      else if (style === "short" || style === "long" || style === "ponytail") isHair = y < cy - 3 - (dx < -3 ? 0 : 2) || (Math.abs(dx) > 10.5 && y < cy + 3);
      else if (style === "curly") isHair = y < cy - 4 + ((x >> 1) % 2) || (Math.abs(dx) > 11 && y < cy + 2);
      else isHair = y < cy - 7; // buzz
      if (isHair) {
        if (style === "buzz") c = (x + y) % 3 ? hs : hair;
        else if ((y === cy - 10 && dx > -9 && dx < -3) || (y === cy - 11 && dx > 3 && dx < 7)) c = hl;
        L.p(x, y, c);
      } else L.p(x, y, dy > 10 ? sks : skin);
    }
    if (style === "spiky" && o.face !== "hurt" && o.headwear !== "cap" && o.headwear !== "crown") { L.r(cx, cy - 15, 2, 2, hair); L.r(cx + 1, cy - 17, 2, 2, hair); L.r(cx + 3, cy - 18, 2, 1, hair); }
    if (o.headwear === "cap") {
      for (let y = 0; y < cy - 5; y++) for (let x = 0; x < SW; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > (r + 0.6) * (r + 0.6)) continue;
        L.p(x, y, y === cy - 11 && dx < -2 && dx > -9 ? light(o.gear) : o.gear);
      }
      L.r(cx - 1, cy - 14, 2, 1, shade(o.gear));
      L.r(cx - 14, cy - 6, 24, 2, shade(o.gear)); L.r(cx - 15, cy - 5, 18, 1, shade(o.gear));
    }
    if (o.headwear === "crown") {
      L.r(cx - 9, cy - 16, 18, 4, GOLD); L.r(cx - 9, cy - 13, 18, 1, shade(GOLD));
      for (const px of [cx - 9, cx - 2, cx + 6]) { L.r(px, cy - 19, 3, 3, GOLD); L.p(px + 1, cy - 20, GOLD); }
      for (const jx of [cx - 6, cx - 1, cx + 4]) L.r(jx, cy - 15, 2, 2, "#e03050");
      L.r(cx - 8, cy - 16, 6, 1, light(GOLD));
    }
    if (o.headwear === "headband") for (let x = 0; x < SW; x++) for (let y = cy - 7; y <= cy - 5; y++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy <= r * r) L.p(x, y, y === cy - 5 ? shade(o.gear) : o.gear);
    }
    L.r(cx - 11, cy + 6, 3, 2, "#ffb3c1"); L.r(cx + 8, cy + 6, 3, 2, "#ffb3c1");
    const eyes = [cx - 8, cx + 4], ey = cy + 1, f = o.face;
    if (f === "normal" || f === "blink") {
      for (const x0 of eyes) {
        if (f === "blink") { L.r(x0, ey + 3, 4, 1, INK); continue; }
        L.r(x0, ey, 4, 5, INK); [[0, 0], [3, 0], [0, 4], [3, 4]].forEach(([a, b]) => L.p(x0 + a, ey + b, skin));
        L.r(x0 + 1, ey + 1, 2, 1, "#fff"); L.r(x0 + 1, ey + 3, 2, 1, "#4a5aa8");
      }
      L.p(cx - 2, cy + 7, INK); L.r(cx - 1, cy + 8, 2, 1, INK); L.p(cx + 1, cy + 7, INK);
    } else if (f === "happy") {
      for (const x0 of eyes) { L.p(x0, ey + 3, INK); L.r(x0 + 1, ey + 2, 2, 1, INK); L.p(x0 + 3, ey + 3, INK); }
      L.r(cx - 2, cy + 7, 4, 1, INK); L.p(cx - 2, cy + 8, INK); L.p(cx - 1, cy + 8, "#c8324b"); L.p(cx, cy + 8, "#ff8fa3"); L.p(cx + 1, cy + 8, INK);
      L.r(cx - 1, cy + 9, 2, 1, INK);
    } else if (f === "tired") {
      for (const x0 of eyes) { L.r(x0 - 1, ey + 2, 6, 1, INK); L.r(x0, ey + 3, 4, 2, INK); L.p(x0, ey + 4, skin); L.p(x0 + 3, ey + 4, skin); L.p(x0 + 2, ey + 3, "#fff"); }
      [[-3, 8], [-2, 7], [-1, 8], [0, 7], [1, 8], [2, 7]].forEach(([a, b]) => L.p(cx + a, cy + b, INK));
      L.p(cx + 13, cy - 8, "#8fd3ff"); L.r(cx + 12, cy - 7, 3, 3, "#8fd3ff"); L.p(cx + 12, cy - 6, "#fff");
    } else if (f === "hurt") {
      const g = [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4], [1, 0], [2, 1], [3, 2], [2, 3], [1, 4]];
      g.forEach(([a, b]) => { L.p(eyes[0] + a, ey + b, INK); L.p(eyes[1] + 3 - a, ey + b, INK); });
      L.p(cx - 2, cy + 9, INK); L.r(cx - 1, cy + 8, 2, 1, INK); L.p(cx + 1, cy + 9, INK);
      for (const x0 of eyes) { L.p(x0 + 1, ey + 5 + (o.tear || 0), "#8fd3ff"); L.p(x0 + 1, ey + 6 + (o.tear || 0), "#8fd3ff"); }
      L.r(cx + 6, cy + 8, 4, 2, "#e8b77a");
      for (let x = 0; x < SW; x++) for (let y = cy - 7; y <= cy - 3; y++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > r * r) continue;
        L.p(x, y, y === cy - 7 || y === cy - 3 ? INK : "#ffffff");
      }
    }
    return L.c;
  }

  const cache = new Map();
  const cached = (key, make) => { let c = cache.get(key); if (!c) { if (cache.size > 600) cache.clear(); c = make(); cache.set(key, c); } return c; };
  function portrait(o, pal) {
    return cached("P" + pal + JSON.stringify(o), () => {
      const c = canvas(SW, SH), x = c.getContext("2d");
      x.drawImage(outline(pBody(o), INK), 0, 0); x.drawImage(outline(pHead(o), INK), 0, 0);
      return quantize(c, pal);
    });
  }
  function walker(o, dir, frame, pal) { return cached("W" + pal + dir + frame + JSON.stringify(o), () => quantize(walkSprite(o, dir, frame), pal)); }

  // ---------- small sprites ----------
  const MONO_IDX = (pal, cols) => isMono(pal) ? PALETTES[pal].shades : cols;
  function ball(pal, frame) {
    return cached("B" + pal + frame, () => {
      const [w, , , k] = MONO_IDX(pal, ["#ffffff", "#c8c8d8", "#8888a0", INK]);
      const L = painter(8, 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const dx = x - 3.5, dy = y - 3.5; if (dx * dx + dy * dy <= 9.5) L.p(x, y, w); }
      (frame ? [[3, 3], [4, 3], [3, 4], [4, 4], [1, 2], [6, 5]] : [[3, 3], [4, 4], [4, 3], [3, 4], [6, 2], [2, 6]]).forEach(([x, y]) => L.p(x, y, k));
      return outline(L.c, isMono(pal) ? PALETTES[pal].shades[3] : INK);
    });
  }
  const FAN = {
    sit: ["..HHHH..", ".HHHHHH.", ".HSSSSH.", ".SESSES.", "..SSSS..", ".JJJJJJ.", "JJJJJJJJ", "........"],
    cheer: ["S.HHHH.S", "JHHHHHHJ", "JHSSSSHJ", "JSESSESJ", "..SSSS..", ".JJJJJJ.", "JJJJJJJJ", "........"],
  };
  function fan(pal, shirt, skin, hair, cheer) {
    return cached("F" + pal + shirt + skin + hair + cheer, () => {
      const L = painter(10, 10);
      FAN[cheer ? "cheer" : "sit"].forEach((row, y) => [...row].forEach((ch, x) => {
        const c = { H: hair, S: skin, E: INK, J: shirt }[ch]; if (c) L.p(x + 1, y + 1, c);
      }));
      return quantize(outline(L.c, INK), pal);
    });
  }
  // Mood bubbles: a little speech balloon with an icon.
  const ICONS = {
    note: ["..XX.", "..X.X", "..X..", "XXX..", "XXX.."],
    bang: ["..X..", "..X..", "..X..", ".....", "..X.."],
    drop: ["..X..", ".XXX.", "XXXXX", "XXXXX", ".XXX."],
    zzz: ["XXXX.", "..X..", ".X...", "XXXX.", "....."],
    heart: [".X.X.", "XXXXX", "XXXXX", ".XXX.", "..X.."],
    dots: [".....", ".....", "X.X.X", ".....", "....."],
  };
  function emote(pal, kind) {
    return cached("E" + pal + kind, () => {
      const mono = isMono(pal), sh = mono ? PALETTES[pal].shades : null;
      const L = painter(11, 11), bg = mono ? sh[0] : "#ffffff";
      L.r(1, 1, 9, 7, bg); L.clear(1, 1, 1, 1); L.clear(9, 1, 1, 1); L.clear(1, 7, 1, 1); L.clear(9, 7, 1, 1);
      L.r(3, 8, 2, 1, bg); L.p(3, 9, bg);
      const ic = mono ? sh[3] : { note: "#3858c8", bang: "#d83838", drop: "#3898e8", zzz: "#6858b8", heart: "#e83878", dots: INK }[kind];
      ICONS[kind].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "X") L.p(x + 3, y + 2, ic); }));
      return outline(L.c, mono ? sh[3] : INK);
    });
  }
  function flag(pal, color) {
    return cached("G" + pal + color, () => {
      const L = painter(8, 10);
      L.r(1, 1, 1, 8, "#e8e8f0"); L.r(2, 1, 4, 3, color); L.r(2, 2, 4, 1, shade(color));
      return quantize(outline(L.c, INK), pal);
    });
  }

  // ---------- badge icons (9x9, outlined) ----------
  const ICON_MAPS = {
    star: ["....X....", "....X....", "...XXX...", "XXXXXXXXX", ".XXXXXXX.", "..XXXXX..", "..XX.XX..", ".XX...XX.", ".X.....X."],
    flame: ["....X....", "...XX..X.", "..XXX.XX.", "..XXXXXX.", ".XXXooXXX", ".XXoooXXX", ".XXooooXX", "..XoooXX.", "...XXXX.."],
    boot: [".........", "..XXX....", "..XXX....", "..XXX....", "..XXXX...", "..XXXXXX.", ".XXXXXXXX", ".XXXXXXXX", ".k.k.k.k."],
    shield: [".XXXXXXX.", ".XoooooX.", ".XoXXXoX.", ".XoXXXoX.", ".XoXXXoX.", "..XoXoX..", "..XXoXX..", "...XXX...", "....X...."],
    band: [".........", ".XXXXXXX.", "XXXXXXXXX", "XXkkkXXXX", "XXkXXXXXX", "XXkkkXXXX", "XXXXXXXXX", ".XXXXXXX.", "........."],
    medal: ["XX.....XX", ".XX...XX.", "..XX.XX..", "...XXX...", "..ggggg..", ".ggXXXgg.", ".ggXXXgg.", ".ggXXXgg.", "..ggggg.."],
    arrow: ["....X....", "...XXX...", "..XXXXX..", ".XXXXXXX.", "XXXXXXXXX", "...XXX...", "...XXX...", "...XXX...", "...XXX..."],
    trophy: ["ggggggggg", "g.ggggg.g", "g.ggggg.g", ".ggggggg.", "..ggggg..", "...ggg...", "....g....", "...ggg...", "..ggggg.."],
    sun: ["....X....", ".X..X..X.", "..XXXXX..", "..XXXXX..", "XXXXXXXXX", "..XXXXX..", "..XXXXX..", ".X..X..X.", "....X...."],
    moon: ["...XXX...", "..XXX....", ".XXX.....", ".XXX.....", ".XXX.....", ".XXX.....", "..XXX....", "...XXX...", "....XX..."],
    cal: [".k.....k.", "XXXXXXXXX", "XXXXXXXXX", "ooooooooo", "okokokoko", "ooooooooo", "okokokoko", "ooooooooo", "ooooooooo"],
    book: [".........", "XXXX.XXXX", "XoooXoooX", "XoooXoooX", "XoooXoooX", "XoooXoooX", "XoooXoooX", "XXXXXXXXX", "....X...."],
    ball: ["...ooo...", ".ooooooo.", ".ooXXXoo.", "ooXXXXXoo", "ooXXXXXoo", "ooXXXXXoo", ".ooXXXoo.", ".ooooooo.", "...ooo..."],
  };
  const ICON_COLORS = { star: "#f8b800", flame: "#f05a28", boot: "#f0b828", shield: "#5878c8", band: ARMBAND, medal: "#d83838", arrow: "#38a848",
    trophy: GOLD, sun: "#f8a800", moon: "#7868c8", cal: "#e04848", book: "#6a4a2a", ball: INK };
  function badgeIcon(icon, pal, locked) {
    return cached("I" + icon + pal + locked, () => {
      const L = painter(11, 11), main = ICON_COLORS[icon] || "#888";
      (ICON_MAPS[icon] || ICON_MAPS.star).forEach((row, y) => [...row].forEach((ch, x) => {
        const c = { X: main, o: "#ffffff", k: INK, g: GOLD }[ch]; if (c) L.p(x + 1, y + 1, c);
      }));
      let c = outline(L.c, INK);
      if (locked) {
        const x = c.getContext("2d"), d = x.getImageData(0, 0, 11, 11);
        for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3]) { const v = 120 + lum([d.data[i], d.data[i + 1], d.data[i + 2]]) * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
        x.putImageData(d, 0, 0);
      }
      return quantize(c, pal);
    });
  }
  // A gold cup for the trophy cabinet, and a floodlight tower.
  function trophy(pal) {
    return cached("T" + pal, () => {
      const L = painter(12, 14);
      ICON_MAPS.trophy.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "g") L.p(x + 1, y + 1, GOLD); }));
      L.r(3, 11, 7, 2, "#7a4a2a"); L.p(3, 2, light(GOLD));
      return quantize(outline(L.c, INK), pal);
    });
  }
  function floodlight(pal, lit) {
    return cached("L" + pal + lit, () => {
      const L = painter(14, 40);
      L.r(6, 9, 2, 30, "#9aa0b8"); L.r(7, 9, 1, 30, "#6a7088");
      L.r(1, 1, 12, 8, "#3a3a48");
      for (let y = 2; y < 8; y++) for (let x = 2; x < 12; x++) L.p(x, y, (x + y) % 2 ? (lit ? "#fff6c9" : "#c8c8d0") : (lit ? "#ffe08a" : "#a0a0b0"));
      return quantize(outline(L.c, INK), pal);
    });
  }

  window.GB = {
    INK, PALETTES, HAIRSTYLES, HEADWEAR, PATTERNS, isMono, hex, mix, shade, light, lum,
    canvas, painter, outline, quantize, look, portrait, walker, ball, fan, emote, flag, badgeIcon, trophy, floodlight, GOLD,
  };
})();
