// Blockbench MCP runner: export FBX meshes and bake animation poses for trailer rendering.
//   node bbrun.js <trailer.json> export <id> [id ...]     -> <work>/fbx/<id>.fbx
//   node bbrun.js <trailer.json> bake   <id> [id ...]     -> <work>/poses/<id>.json   (sampled at 60 fps)
//   node bbrun.js <trailer.json> both   <id> [id ...]
//   node bbrun.js <trailer.json> eval   <file.js>         -> runs arbitrary JS in Blockbench (debugging)
// <id> is a geometry file name in <rp>/models/entity/<ns>/<id>.geo.json (mobs and props alike).
// Needs Blockbench open with the MCP plugin serving http://localhost:3000/bb-mcp (override: env BB_MCP_URL).
const fs = require("fs");
const path = require("path");
const URL = process.env.BB_MCP_URL || "http://localhost:3000/bb-mcp";
const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

async function post(body, sid) {
  const r = await fetch(URL, { method: "POST", headers: sid ? { ...H, "mcp-session-id": sid } : H, body: JSON.stringify(body) });
  return { sid: r.headers.get("mcp-session-id"), t: await r.text() };
}
const parse = (t) => { const m = t.match(/^data: (.*)$/m); return JSON.parse(m ? m[1] : t); };

async function evalInBlockbench(code) {
  const a = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "trailer", version: "1" } } });
  await post({ jsonrpc: "2.0", method: "notifications/initialized" }, a.sid);
  const r = await post({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "risky_eval", arguments: { code } } }, a.sid);
  const j = parse(r.t);
  return j.result ? j.result.content.map((c) => c.text || c.type).join("\n") : JSON.stringify(j.error);
}

// Shared Blockbench-side loader: fresh Bedrock project with the RP geometry + its animation files.
const LOAD = `
  while (ModelProject.all.length) await ModelProject.all[0].close(true);
  newProject(Formats.bedrock);
  const geoPath = id.startsWith('blk_') ? RP + 'models/blocks/' + NS + '/' + id.slice(4) + '.geo.json' : RP + 'models/entity/' + NS + '/' + id + '.geo.json';
  Codecs.bedrock.parse(JSON.parse(fs.readFileSync(geoPath, 'utf8')), geoPath);
  const animDir = RP + 'animations/' + NS + '/';
  for (const f of [id + '.animation.json'])
    if (fs.existsSync(animDir + f)) Animator.loadFile({ path: animDir + f, content: fs.readFileSync(animDir + f, 'utf8') }, null);
  const entPath = RP + 'entity/' + id + '.entity.json';
  const ent = fs.existsSync(entPath) ? fs.readFileSync(entPath, 'utf8') : '';
  const mr = ent.match(/v\\.(\\w*rate)\\s*=\\s*math\\.random\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\)/);
  const rate = mr ? (parseFloat(mr[2]) + parseFloat(mr[3])) / 2 : 450;
  const G = Animator.MolangParser.global_variables;
  Object.assign(G, { 'variable.anim_speed_multiplier': 1, 'variable.anim_speed_movement_max': 0.3, 'variable.fl_rate': rate, 'variable.eagle_rate': rate, 'variable.fl_bank': 0, 'variable.fl_pitch': 0 });
  if (mr) G['variable.' + mr[1]] = rate;
  const LEN = { glide: 2, walk: 1, run: 0.5, breathe: 3, turn: 1, perch: 1, idle: 6 };
  LEN.flap = Math.max(0.3, Math.round(1.6 * rate / 360) * 360 / rate);
  const shortName = (a) => a.name.split('.' + id + '.').pop();
`;

function script(kind, cfg, ids) {
  const RP = cfg.rp.replace(/\\/g, "/").replace(/\/?$/, "/");
  const work = cfg.work.replace(/\\/g, "/").replace(/\/?$/, "/");
  const head = `(async () => { const fs = require('fs'); const RP = ${JSON.stringify(RP)}; const NS = ${JSON.stringify(cfg.namespace || "rpc")}; const OUT = ${JSON.stringify(work)}; const res = {};
    for (const id of ${JSON.stringify(ids)}) { try { ${LOAD}`;
  const tail = ` } catch (e) { res[id] = 'ERR ' + e.message; } } return JSON.stringify(res); })()`;
  if (kind === "export") {
    return head + `
      for (const a of Animation.all) if (!a.length || a.length > 12) a.length = LEN[shortName(a).split('.').pop()] || 1;
      let out = Codecs.fbx.compile({ include_animations: false });
      if (out && out.then) out = await out;
      fs.mkdirSync(OUT + 'fbx', { recursive: true });
      fs.writeFileSync(OUT + 'fbx/' + id + '.fbx', out);
      res[id] = Cube.all.length + ' cubes';` + tail;
  }
  return head + `
      Modes.options.animate.select();
      const r = v => Math.round(v * 1000) / 1000;
      const snap = () => Object.fromEntries(Group.all.map(g => [g.name, [...g.mesh.position.toArray(), ...g.mesh.rotation.toArray().slice(0, 3).map(x => x * 180 / Math.PI), ...g.mesh.scale.toArray()].map(r)]));
      const FPSB = 60; const HOPS = { kangaroo: 0.6 }; const out = { fps: FPSB, anims: {} };
      Animation.all.forEach(a => a.playing = false);
      Animator.showDefaultPose(); out.rest = snap();
      for (const a of Animation.all) {
        const n = shortName(a);
        if (/look_at|baby_transform|sleep|brood|scatter/.test(n)) continue;
        let L = a.length; if (!L || L > 12) L = LEN[n.split('.').pop()] || 2;
        Animation.all.forEach(b => b.playing = false);
        a.select(); a.playing = true;
        const frames = [];
        const HOP = HOPS[id] && /^(walk|run)$/.test(n); if (HOP) L = 2 * HOPS[id]; for (let f = 0; f <= Math.round(L * FPSB); f++) { if (HOP) G['variable.jump_rotation'] = Math.sin(Math.PI * ((f / FPSB) % HOPS[id]) / HOPS[id]); Timeline.setTime(f / FPSB); Animator.preview(); frames.push(snap()); } G['variable.jump_rotation'] = 0;
        out.anims[n] = { length: L, loop: a.loop, frames };
      }
      fs.mkdirSync(OUT + 'poses', { recursive: true });
      fs.writeFileSync(OUT + 'poses/' + id + '.json', JSON.stringify(out));
      res[id] = Object.keys(out.anims).length + ' anims';` + tail;
}

(async () => {
  const [cfgPath, kind, ...rest] = process.argv.slice(2);
  if (!cfgPath || !kind) { console.log("usage: node bbrun.js <trailer.json> export|bake|both|eval <ids...|file.js>"); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  if (kind === "eval") { console.log(await evalInBlockbench(fs.readFileSync(rest[0], "utf8"))); return; }
  const kinds = kind === "both" ? ["export", "bake"] : [kind];
  for (let i = 0; i < rest.length; i += 6) {
    const batch = rest.slice(i, i + 6);
    for (const k of kinds) console.log(k, batch.join(","), "->", await evalInBlockbench(script(k, cfg, batch)));
  }
})().catch((e) => { console.log("ERR", e.message); process.exit(1); });
