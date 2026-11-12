// Symbolic JVM interpreter for Citadel (Alex's Mobs) entity models.
//  - mode 'build':    run <init> concretely -> bone tree + cubes
//  - mode 'anim':     run setupAnim symbolically -> per-bone Molang channel deltas
//  - mode 'animator': run animate() -> ModelAnimator keyframe lists
// Unknown branch conditions fork the state; states meeting at the same pc are merged
// with Molang ternaries, so `if (entity.isFlying()) {...} else {...}` becomes `(v.am_flying ? a : b)`.
'use strict';
const J = require('./javap');
const M = require('./molang');
const { EntitySyms } = require('./entsym');

const BOX = 'com/github/alexthe666/citadel/client/model/AdvancedModelBox';
const CITADEL_MODEL = 'com/github/alexthe666/citadel/client/model/AdvancedEntityModel';
const ANIMATOR = 'com/github/alexthe666/citadel/client/model/ModelAnimator';

function parseDesc(desc) {
  const m = desc.match(/^\((.*)\)(.*)$/);
  if (!m) return { args: [], ret: 'V' };
  const args = [];
  const s = m[1];
  for (let i = 0; i < s.length;) {
    let start = i;
    while (s[i] === '[') i++;
    if (s[i] === 'L') i = s.indexOf(';', i) + 1; else i++;
    args.push(s.slice(start, i));
  }
  return { args, ret: m[2] };
}
const UNK = { t: 'unk' };
const isBox = v => v && v.t === 'box';

let BOX_ID = 0;
function newBox(name) {
  return { t: 'box', id: ++BOX_ID, name, parent: null, children: [], pivot: [0, 0, 0], rot: [0, 0, 0], cubes: [], tex: [0, 0], mirror: false, scale: [1, 1, 1], hidden: false };
}

class Interp {
  constructor(modelClass) {
    this.cls = J.parseClass(modelClass);
    this.chain = [];
    for (let c = this.cls; c && c.ok && c.name.startsWith('com/github/alexthe666/alexsmobs'); c = c.superName ? J.parseClass(c.superName) : null) this.chain.push(c);
    this.fields = new Map(); // this.<field> values
    this.boxes = [];
    this.texW = 64; this.texH = 32;
    this.ent = new EntitySyms();
    this.anims = new Map(); // animator recordings
    this.curAnim = null;
    this.warn = [];
    this.gaits = []; // limb/idle motion calls recorded while running setupAnim (see anims2.js)
    this.faces = []; // faceTarget head-look calls
  }

  findOwnMethod(name, desc) {
    for (const c of this.chain) {
      const m = c.methods.find(mm => mm.name === name && (!desc || matchParams(mm, desc)));
      if (m) return m;
    }
    return null;
  }

  // ---------------- public entry points ----------------
  build(ctorArgs = [], switchCase = 1) {
    const init = this.cls.methods.find(m => m.name === '<init>' && m.params.length === ctorArgs.length) || this.cls.methods.find(m => m.name === '<init>');
    if (!init) throw new Error('no <init>');
    this.mode = 'build';
    this.switchCase = switchCase;
    const args = init.params.map((p, i) => (ctorArgs[i] !== undefined ? ctorArgs[i] : (/^(int|float|double|boolean)$/.test(p) ? 0 : { t: 'unk' })));
    this.run(init, [{ t: 'this' }, ...args], { fork: false });
    return this.boxes;
  }

  setupAnim(fork = true) {
    const m = this.cls.methods.find(mm => mm.name === 'setupAnim' && mm.params.length === 6 && !/net\.minecraft\.world\.entity\.Entity$/.test(mm.params[0]))
      || this.cls.methods.find(mm => mm.name === 'setupAnim' && mm.params.length === 6)
      || this.cls.methods.find(mm => mm.name === 'm_6973_' && mm.params.length === 6);
    if (!m) return null;
    this.mode = 'anim';
    const args = [{ t: 'this' }, { t: 'ent' }, M.S('v.ls'), M.S('v.lsa'), M.S('v.age'), M.S('v.yaw'), M.S('v.pitch')];
    this.ent.progress.clear && this.ent.progress.clear();
    this.gaits = []; this.faces = [];
    const res = this.run(m, args, { fork });
    return res;
  }

  animator() {
    const m = this.cls.methods.find(mm => mm.name === 'animate' && mm.params.length >= 1);
    if (!m) return this.anims;
    this.mode = 'animator';
    this.run(m, [{ t: 'this' }, { t: 'ent' }, M.S('v.ls'), M.S('v.lsa'), M.S('v.age'), M.S('v.yaw'), M.S('v.pitch')], { fork: false });
    return this.anims;
  }

  // ---------------- core ----------------
  run(method, args, opts) {
    const locals = [];
    let li = 0;
    for (const a of args) {
      locals[li++] = a;
    }
    // fix slot widths for long/double params
    const fixed = [];
    let slot = 0;
    const ptypes = (method.isStatic ? [] : ['this']).concat(method.params);
    for (let i = 0; i < args.length && i < ptypes.length; i++) {
      fixed[slot] = args[i];
      slot += (ptypes[i] === 'double' || ptypes[i] === 'long') ? 2 : 1;
    }
    const start = { idx: 0, stack: [], locals: fixed, guard: [], chan: new Map(), depth: 0 };
    const states = [start];
    const finished = [];
    let steps = 0;
    const MAX_STATES = 64;
    while (states.length) {
      // pick lowest pc so join points merge
      states.sort((a, b) => method.code[a.idx].pc - method.code[b.idx].pc);
      let st = states.shift();
      // merge others sitting on the same pc with same stack depth
      for (let i = 0; i < states.length;) {
        if (states[i].idx === st.idx && states[i].stack.length === st.stack.length) {
          st = mergeStates(st, states[i]);
          states.splice(i, 1);
        } else i++;
      }
      // execute until branch/fork/return
      let guardLoop = 0;
      for (;;) {
        if (++steps > 400000) { this.warn.push('step limit in ' + method.name); return this.finish(finished.concat([st]), method); }
        if (++guardLoop > 20000) { this.warn.push('loop limit'); finished.push(st); break; }
        const ins = method.code[st.idx];
        if (!ins) { finished.push(st); break; }
        const r = this.step(method, st, ins, opts);
        if (r === 'ret') { finished.push(st); break; }
        if (r && r.fork) {
          const [a, b] = r.fork;
          if (states.length + 2 > MAX_STATES || !opts.fork) {
            // fall through (take the non-jump path)
            Object.assign(st, b.st === st ? b : b);
            st = b; continue;
          }
          states.push(a, b);
          break;
        }
        if (r === 'yield') { states.push(st); break; }
        // check whether another state waits at our new pc -> yield to merge
        if (states.some(s => s.idx === st.idx)) { states.push(st); break; }
      }
    }
    return this.finish(finished, method);
  }

  finish(finished, method) {
    if (!finished.length) return { chan: new Map(), ret: UNK };
    let st = finished[0];
    for (let i = 1; i < finished.length; i++) st = mergeStates(st, finished[i], true);
    return { chan: st.chan, ret: st.ret === undefined ? UNK : st.ret };
  }

  jump(method, st, target) {
    const idx = method.byPc.get(target);
    if (idx === undefined) throw new Error('bad jump ' + target);
    st.idx = idx;
  }

  branch(method, st, ins, c) {
    c = M.toVal(c);
    const target = +ins.args[0];
    if (M.isNum(c)) {
      if (c) this.jump(method, st, target); else st.idx++;
      return null;
    }
    const a = cloneState(st); a.guard = guardList(st.guard).concat([M.str(c)]); this.jump(method, a, target);
    const b = cloneState(st); b.guard = guardList(st.guard).concat([M.str(M.not(c))]); b.idx++;
    return { fork: [a, b] };
  }

  step(method, st, ins, opts) {
    const S = st.stack;
    const op = ins.op;
    const pop = () => S.pop();
    const push = v => S.push(v);
    let m;
    if ((m = op.match(/^([ifdal])const_(m1|\d)$/))) { push(m[2] === 'm1' ? -1 : +m[2]); st.idx++; return; }
    if ((m = op.match(/^([ifdal])load(?:_(\d))?$/))) { const n = m[2] !== undefined ? +m[2] : +ins.args[0]; push(st.locals[n] === undefined ? 0 : st.locals[n]); st.idx++; return; }
    if ((m = op.match(/^([ifdal])store(?:_(\d))?$/))) { const n = m[2] !== undefined ? +m[2] : +ins.args[0]; st.locals[n] = pop(); st.idx++; return; }
    switch (op) {
      case 'aconst_null': push(null); break;
      case 'bipush': case 'sipush': push(+ins.args[0]); break;
      case 'ldc': case 'ldc_w': case 'ldc2_w': {
        const r = ins.ref;
        if (!r) push(0);
        else if (r.kind === 'num') push(r.value);
        else if (r.kind === 'string') push({ t: 'str', v: r.value });
        else if (r.kind === 'class') push({ t: 'class', name: r.name });
        else push(UNK);
        break;
      }
      case 'iinc': { const n = +ins.args[0]; st.locals[n] = M.add(st.locals[n], +ins.args[1]); break; }
      case 'fadd': case 'dadd': case 'iadd': case 'ladd': { const b = pop(), a = pop(); push(M.add(a, b)); break; }
      case 'fsub': case 'dsub': case 'isub': case 'lsub': { const b = pop(), a = pop(); push(M.sub(a, b)); break; }
      case 'fmul': case 'dmul': case 'imul': case 'lmul': { const b = pop(), a = pop(); push(M.mul(a, b)); break; }
      case 'fdiv': case 'ddiv': { const b = pop(), a = pop(); push(M.div(a, b)); break; }
      case 'idiv': case 'ldiv': { const b = pop(), a = pop(); const r = M.div(a, b); push(M.isNum(r) ? Math.trunc(r) : M.fn('trunc', r)); break; }
      case 'frem': case 'drem': case 'irem': case 'lrem': { const b = pop(), a = pop(); push(M.rem(a, b)); break; }
      case 'fneg': case 'dneg': case 'ineg': case 'lneg': push(M.neg(pop())); break;
      case 'iand': { const b = pop(), a = pop(); push(M.isNum(a) && M.isNum(b) ? (a & b) : M.and(a, b)); break; }
      case 'ior': { const b = pop(), a = pop(); push(M.isNum(a) && M.isNum(b) ? (a | b) : M.or(a, b)); break; }
      case 'ixor': { const b = pop(), a = pop(); push(M.isNum(a) && M.isNum(b) ? (a ^ b) : (b === 1 ? M.not(a) : M.S(`${M.p(a)} != ${M.p(b)}`))); break; }
      case 'ishl': case 'ishr': case 'iushr': { const b = pop(), a = pop(); push(M.isNum(a) && M.isNum(b) ? (op === 'ishl' ? a << b : a >> b) : 0); break; }
      case 'i2f': case 'i2d': case 'f2d': case 'd2f': case 'l2f': case 'l2d': case 'i2l': case 'i2b': case 'i2s': case 'i2c': break;
      case 'f2i': case 'd2i': case 'f2l': case 'd2l': case 'l2i': { const a = M.toVal(pop()); push(M.isNum(a) ? Math.trunc(a) : M.fn('trunc', a)); break; }
      case 'fcmpl': case 'fcmpg': case 'dcmpl': case 'dcmpg': case 'lcmp': { const b = pop(), a = pop(); push({ t: 'cmp', a: M.toVal(a), b: M.toVal(b) }); break; }
      case 'ifeq': case 'ifne': case 'iflt': case 'ifge': case 'ifgt': case 'ifle': {
        const v = pop();
        const OPS = { ifeq: '==', ifne: '!=', iflt: '<', ifge: '>=', ifgt: '>', ifle: '<=' };
        let c;
        if (v && v.t === 'cmp') c = M.cond(OPS[op], v.a, v.b);
        else if (v === null || v === UNK || (v && (v.t === 'unk' || v.t === 'ent' || v.t === 'obj'))) c = op === 'ifeq' ? 1 : (op === 'ifne' ? 0 : 0);
        else {
          const x = M.toVal(v);
          if (op === 'ifeq') c = M.not(x);
          else if (op === 'ifne') c = M.isNum(x) ? (x !== 0 ? 1 : 0) : x;
          else c = M.cond(OPS[op], x, 0);
        }
        return this.branch(method, st, ins, c);
      }
      case 'if_icmpeq': case 'if_icmpne': case 'if_icmplt': case 'if_icmpge': case 'if_icmpgt': case 'if_icmple': {
        const b = pop(), a = pop();
        const OPS = { if_icmpeq: '==', if_icmpne: '!=', if_icmplt: '<', if_icmpge: '>=', if_icmpgt: '>', if_icmple: '<=' };
        return this.branch(method, st, ins, M.cond(OPS[op], a, b));
      }
      case 'if_acmpeq': case 'if_acmpne': {
        const b = pop(), a = pop();
        let eq = a === b || (a && b && a.t === 'box' && b.t === 'box' && a.id === b.id) || (a && b && a.t === 'static' && b.t === 'static' && a.name === b.name);
        if (a && b && ((a.t === 'unk' || a.t === 'obj') || (b.t === 'unk' || b.t === 'obj'))) eq = false;
        return this.branch(method, st, ins, op === 'if_acmpeq' ? (eq ? 1 : 0) : (eq ? 0 : 1));
      }
      case 'ifnull': case 'ifnonnull': {
        const v = pop();
        const isNull = v === null || v === undefined || (v && (v.t === 'unk'));
        return this.branch(method, st, ins, op === 'ifnull' ? (isNull ? 1 : 0) : (isNull ? 0 : 1));
      }
      case 'goto': case 'goto_w': this.jump(method, st, +ins.args[0]); return;
      case 'tableswitch': case 'lookupswitch': {
        const k = M.toVal(pop());
        let target = ins.default;
        if (M.isNum(k) && ins.cases.has(k)) target = ins.cases.get(k);
        this.jump(method, st, target); return;
      }
      case 'return': st.ret = undefined; return 'ret';
      case 'ireturn': case 'freturn': case 'dreturn': case 'areturn': case 'lreturn': st.ret = pop(); return 'ret';
      case 'athrow': return 'ret';
      case 'pop': pop(); break;
      case 'pop2': pop(); pop(); break; // approximate
      case 'dup': { const v = S[S.length - 1]; push(v); break; }
      case 'dup_x1': { const a = pop(), b = pop(); push(a); push(b); push(a); break; }
      case 'dup_x2': { const a = pop(), b = pop(), c = pop(); push(a); push(c); push(b); push(a); break; }
      case 'dup2': { const a = S[S.length - 1]; push(a); break; } // assume single wide value
      case 'swap': { const a = pop(), b = pop(); push(a); push(b); break; }
      case 'new': push({ t: 'new', cls: ins.ref && ins.ref.name }); break;
      case 'checkcast': break;
      case 'instanceof': pop(); push(0); break;
      case 'monitorenter': case 'monitorexit': pop(); break;
      case 'anewarray': case 'newarray': { const n = M.toVal(pop()); push({ t: 'arr', items: new Array(M.isNum(n) ? Math.max(0, n) : 0).fill(op === 'newarray' ? 0 : null) }); break; }
      case 'multianewarray': push({ t: 'arr', items: [] }); break;
      case 'arraylength': { const a = pop(); push(a && a.t === 'arr' ? a.items.length : 0); break; }
      case 'aastore': case 'fastore': case 'iastore': case 'dastore': case 'bastore': case 'castore': case 'sastore': case 'lastore': {
        const v = pop(), i = M.toVal(pop()), a = pop();
        if (a && a.t === 'arr' && M.isNum(i)) a.items[i] = v;
        break;
      }
      case 'aaload': case 'faload': case 'iaload': case 'daload': case 'baload': case 'caload': case 'saload': case 'laload': {
        const i = M.toVal(pop()), a = pop();
        if (a && a.t === 'static' && /SwitchMap/.test(a.name)) { push(this.switchCase || 1); break; }
        push(a && a.t === 'arr' && M.isNum(i) ? (a.items[i] === undefined ? 0 : a.items[i]) : (op === 'aaload' ? UNK : 0));
        break;
      }
      case 'getstatic': {
        const r = ins.ref;
        push({ t: 'static', owner: r.owner, name: r.name, desc: r.desc });
        break;
      }
      case 'putstatic': pop(); break;
      case 'getfield': {
        const obj = pop();
        push(this.getField(st, obj, ins.ref));
        break;
      }
      case 'putfield': {
        const v = pop(); const obj = pop();
        this.putField(st, obj, ins.ref, v);
        break;
      }
      case 'invokevirtual': case 'invokespecial': case 'invokestatic': case 'invokeinterface': {
        const r = ins.ref;
        const d = parseDesc(r.desc);
        const args = [];
        for (let i = d.args.length - 1; i >= 0; i--) args[i] = pop();
        const recv = op === 'invokestatic' ? null : pop();
        const res = this.invoke(st, r, recv, args, d, op, opts);
        if (d.ret !== 'V') push(res === undefined ? (d.ret.startsWith('L') || d.ret.startsWith('[') ? UNK : 0) : res);
        else if (op === 'invokespecial' && r.name === '<init>' && recv && recv.t === 'new') {
          // constructor result: replace the `new` placeholder on the stack (dup'd copy)
          for (let i = S.length - 1; i >= 0; i--) if (S[i] === recv) S[i] = res || UNK;
          for (let i = 0; i < st.locals.length; i++) if (st.locals[i] === recv) st.locals[i] = res || UNK;
        }
        break;
      }
      case 'invokedynamic': push(UNK); break;
      case 'nop': break;
      default:
        this.warn.push('unhandled op ' + op);
    }
    st.idx++;
  }

  getField(st, obj, r) {
    if (obj && obj.t === 'this') {
      if (this.fields.has(r.name)) return this.fields.get(r.name);
      if (r.name === 'texWidth' || r.name === 'f_102610_') return this.texW;
      if (r.name === 'texHeight' || r.name === 'f_102611_') return this.texH;
      if (r.name === 'f_102609_' || r.name === 'young') return M.S('q.is_baby');
      if (r.name === 'f_102608_' || r.name === 'attackTime') return M.S('v.attack_time');
      if (r.name === 'f_102610_') return 0;
      return r.desc && r.desc.startsWith('L') ? UNK : 0;
    }
    if (isBox(obj)) {
      const ch = boxChannel(r.name);
      if (ch) {
        const def = defaultOf(obj, ch);
        if (this.mode !== 'anim') return def;
        const delta = st.chan.get(obj.id + ch);
        return delta === undefined ? def : M.add(def, delta);
      }
      if (r.name === 'mirror') return obj.mirror ? 1 : 0;
      return 0;
    }
    if (obj && obj.t === 'ent') return this.ent.field(r.name, r.desc);
    if (obj && obj.t === 'new') return 0;
    if (r.desc && /^[FDIJZSB]$/.test(r.desc)) return 0;
    return UNK;
  }

  putField(st, obj, r, v) {
    if (obj && obj.t === 'this') {
      if (r.name === 'texWidth' || r.name === 'f_102610_' && false) this.texW = M.toVal(v);
      else if (r.name === 'texHeight') this.texH = M.toVal(v);
      if (this.mode === 'build' || !this.fields.has(r.name)) this.fields.set(r.name, v);
      if (isBox(v) && this.mode === 'build' && !v.fieldName) { v.fieldName = r.name; if (!v.name) v.name = r.name; }
      return;
    }
    if (isBox(obj)) {
      const ch = boxChannel(r.name);
      if (ch) {
        if (this.mode === 'build') setDefault(obj, ch, M.toVal(v));
        else if (this.mode === 'anim') st.chan.set(obj.id + ch, M.sub(v, defaultOf(obj, ch)));
        return;
      }
      if (r.name === 'mirror' && this.mode === 'build') obj.mirror = !!M.toVal(v);
      if ((r.name === 'showModel' || r.name === 'f_104207_') && this.mode === 'anim') {
        const vis = M.toVal(v);
        st.chan.set(obj.id + 'vis', vis);
      }
      if ((r.name === 'showModel' || r.name === 'f_104207_') && this.mode === 'build') obj.hidden = !M.toVal(v);
      return;
    }
  }

  invoke(st, r, recv, args, d, op, opts) {
    const owner = r.owner || this.cls.name;
    const name = r.name;
    // ---- AdvancedModelBox
    if (owner === BOX || owner.endsWith('/AdvancedModelBox') || owner.endsWith('/BasicModelPart')) {
      if (name === '<init>') {
        const b = newBox(args.find(a => a && a.t === 'str') ? args.find(a => a && a.t === 'str').v : null);
        const ints = args.filter(a => typeof a === 'number');
        if (ints.length >= 2) b.tex = [ints[0], ints[1]];
        if (this.mode === 'build') this.boxes.push(b);
        return b;
      }
      if (!isBox(recv)) return recv;
      if (this.mode === 'build') {
        switch (name) {
          case 'setPos': case 'setRotationPoint': case 'm_104227_':
            recv.pivot = args.map(M.toVal).map(x => (M.isNum(x) ? x : 0)); return;
          case 'addChild': if (isBox(args[0])) { args[0].parent = recv; recv.children.push(args[0]); } return;
          case 'setTextureOffset': case 'texOffs': recv.tex = [M.toVal(args[0]), M.toVal(args[1])]; return recv;
          case 'addBox': {
            const n = args.map(M.toVal);
            const f = n.slice(0, 6).map(x => (M.isNum(x) ? x : 0));
            let inflate = 0, mirror = recv.mirror;
            if (d.args.length >= 7 && d.args[6] === 'F') inflate = M.isNum(n[6]) ? n[6] : 0;
            if (d.args.length >= 7 && d.args[6] === 'Z') mirror = !!n[6];
            if (d.args.length >= 8 && d.args[7] === 'Z') mirror = !!n[7];
            recv.cubes.push({ uv: recv.tex.slice(), from: f.slice(0, 3), size: f.slice(3, 6), inflate, mirror });
            return recv;
          }
          case 'setScale': recv.scale = args.map(M.toVal).map(x => (M.isNum(x) ? x : 1)); return;
          case 'setTextureSize': return recv;
          case 'mirror': recv.mirror = true; return recv;
        }
        return;
      }
      if (this.mode === 'anim') {
        if (name === 'setScale') {
          ['sx', 'sy', 'sz'].forEach((c, i) => st.chan.set(recv.id + c, M.sub(args[i], 1)));
          return;
        }
        if (name === 'setPos' || name === 'setRotationPoint') {
          ['px', 'py', 'pz'].forEach((c, i) => st.chan.set(recv.id + c, M.sub(args[i], recv.pivot[i])));
          return;
        }
      }
      return name.startsWith('set') ? undefined : recv;
    }
    // ---- ModelAnimator
    if (owner === ANIMATOR) {
      if (this.mode !== 'animator') return name === 'setAnimation' ? 0 : undefined;
      return this.animatorCall(name, args);
    }
    // ---- helpers on the model (Citadel builtins or the model's own methods)
    if (op !== 'invokestatic' && recv && recv.t === 'this') {
      if (name === '<init>') {
        // super constructor: only run it when the superclass is another Alex's Mobs model
        const sup = this.chain.find(c => c.name === owner && c !== this.cls);
        const m = sup && sup.methods.find(mm => mm.name === '<init>' && matchParams(mm, r.desc));
        return m ? this.inline(st, m, [recv, ...args], opts) : undefined;
      }
      const own = this.findOwnMethod(name, r.desc);
      if (own && !(this.mode === 'anim' && name === 'animate')) {
        if (this.mode === 'build' && /^(setupAnim|animate|m_6973_)$/.test(name)) return;
        return this.inline(st, own, [recv, ...args], opts);
      }
      if (name === 'animate' && this.mode === 'anim') return;
      return this.citadel(st, name, args, d);
    }
    // ---- statics
    if (op === 'invokestatic') return this.staticCall(owner, name, args, d);
    // ---- entity methods
    if (recv && recv.t === 'ent') return this.ent.method(name, r.desc);
    if (name === '<init>') return { t: 'obj', cls: owner };
    // Minecraft.getInstance().getFrameTime()
    if (name === 'm_91296_' || name === 'getFrameTime' || name === 'getPartialTick') return 0;
    if (name === 'ordinal') return 0;
    if (d.ret === 'Z' || /^[FDIJ]$/.test(d.ret)) return 0;
    return UNK;
  }

  inline(st, method, args, opts) {
    if (st.depth > 8) return;
    // inline a helper: run it as a sub-call sharing channels
    const sub = { idx: 0, stack: [], locals: [], guard: st.guard, chan: st.chan, depth: st.depth + 1 };
    let slot = 0;
    const ptypes = ['this'].concat(method.params);
    for (let i = 0; i < args.length && i < ptypes.length; i++) { sub.locals[slot] = args[i]; slot += (ptypes[i] === 'double' || ptypes[i] === 'long') ? 2 : 1; }
    // run sub-call without forking (helpers are simple); unknown branches fall through
    let steps = 0;
    for (;;) {
      if (++steps > 50000) break;
      const ins = method.code[sub.idx];
      if (!ins) break;
      const r = this.step(method, sub, ins, { fork: false });
      if (r === 'ret') break;
      if (r && r.fork) { const b = r.fork[1]; Object.assign(sub, { idx: b.idx, stack: b.stack, locals: b.locals }); }
    }
    st.chan = sub.chan;
    return sub.ret;
  }

  staticCall(owner, name, args, d) {
    const a = args.map(M.toVal);
    if (owner.endsWith('/Maths') && name === 'rad') return M.mul(a[0], Math.PI / 180);
    if (owner === 'java/lang/Math' || owner.endsWith('/Mth')) {
      const map = {
        sin: 'sin', cos: 'cos', abs: 'abs', min: 'min', max: 'max', sqrt: 'sqrt', signum: 'signum', floor: 'floor', atan2: 'atan2', pow: 'pow',
        m_14031_: 'sin', m_14089_: 'cos', m_14154_: 'abs', m_14116_: 'sqrt', m_14036_: 'clamp', m_14008_: 'clamp', m_14143_: 'floor', m_14107_: 'floor',
      };
      if (name === 'toRadians') return M.mul(a[0], Math.PI / 180);
      if (name === 'toDegrees') return M.mul(a[0], 180 / Math.PI);
      if (name === 'm_14179_' || name === 'm_14139_') return M.add(a[1], M.mul(M.sub(a[2], a[1]), a[0])); // lerp(delta, start, end)
      if (name === 'm_14189_') return M.add(a[1], M.mul(M.sub(a[2], a[1]), a[0])); // rotLerp approx
      if (name === 'm_14177_' || name === 'm_14175_') return a[0]; // wrapDegrees
      if (name === 'm_14136_') return M.fn('atan2', a[0], a[1]);
      if (map[name]) return M.fn(map[name], ...a);
      return 0;
    }
    if (owner.endsWith('/ModelAnimator') && name === 'create') return { t: 'obj', cls: 'animator' };
    if (owner.endsWith('/ImmutableList') || owner.endsWith('/List')) return { t: 'arr', items: args };
    if (owner === 'java/lang/Float' && name === 'valueOf') return a[0];
    if (owner === 'java/lang/Boolean') return a[0];
    if (owner.endsWith('/Minecraft')) return { t: 'obj', cls: 'mc' };
    return d.ret.startsWith('L') ? UNK : 0;
  }

  // Citadel AdvancedEntityModel helpers (formulas from Citadel source).
  citadel(st, name, args, d) {
    const A = args.map(M.toVal);
    const addRot = (box, axis, v) => { if (isBox(box)) chanAdd(st, box, 'r' + axis, v); };
    const val = x => { x = M.toVal(x); return M.isNum(x) ? x : M.str(x); };
    const rec = (kind, box, extra) => { if (this.mode === 'anim' && isBox(box)) this.gaits.push(Object.assign({ kind, bone: box.id, guard: guardList(st.guard).slice() }, extra)); };
    const calc = (speed, degree, invert, offset, weight, f, f1) => {
      let r = M.add(M.mul(M.mul(M.fn('cos', M.add(M.mul(f, speed), offset)), degree), f1), M.mul(weight, f1));
      return M.isNum(invert) && invert ? M.neg(r) : (M.isNum(invert) ? r : M.ternary(invert, M.neg(r), r));
    };
    switch (name) {
      case 'walk': rec('walk', args[0], { axis: 'x', speed: val(A[1]), degree: val(A[2]), invert: val(A[3]), offset: val(A[4]), weight: val(A[5]), f: val(A[6]), f1: val(A[7]) }); if (this.mode === 'anim') addRot(args[0], 'x', calc(A[1], A[2], A[3], A[4], A[5], A[6], A[7])); return;
      case 'swing': rec('walk', args[0], { axis: 'y', speed: val(A[1]), degree: val(A[2]), invert: val(A[3]), offset: val(A[4]), weight: val(A[5]), f: val(A[6]), f1: val(A[7]) }); if (this.mode === 'anim') addRot(args[0], 'y', calc(A[1], A[2], A[3], A[4], A[5], A[6], A[7])); return;
      case 'flap': rec('walk', args[0], { axis: 'z', speed: val(A[1]), degree: val(A[2]), invert: val(A[3]), offset: val(A[4]), weight: val(A[5]), f: val(A[6]), f1: val(A[7]) }); if (this.mode === 'anim') addRot(args[0], 'z', calc(A[1], A[2], A[3], A[4], A[5], A[6], A[7])); return;
      case 'bob': {
        if (this.mode !== 'anim' || !isBox(args[0])) return;
        const [, speed, degree, bounce, f, f1] = A;
        rec('bob', args[0], { speed: val(speed), degree: val(degree), bounce: val(bounce), f: val(f), f1: val(f1) });
        const s = M.fn('sin', M.mul(f, speed));
        let bob = M.sub(M.mul(M.mul(s, f1), degree), M.mul(f1, degree));
        if (M.isNum(bounce) ? bounce : false) bob = M.neg(M.fn('abs', M.mul(M.mul(s, f1), degree)));
        chanAdd(st, args[0], 'py', bob);
        return;
      }
      case 'chainWave': case 'chainSwing': case 'chainFlap': {
        if (this.mode !== 'anim') return;
        const boxes = args[0] && args[0].t === 'arr' ? args[0].items : [];
        const [, speed, degree, rootOffset, f, f1] = A;
        const n = boxes.length || 1;
        const offset = M.div(M.mul(rootOffset, Math.PI), 2 * n);
        const axis = name === 'chainWave' ? 'x' : name === 'chainSwing' ? 'y' : 'z';
        boxes.forEach((b, i) => rec('chain', b, { axis, speed: val(speed), degree: val(degree), rootOffset: val(rootOffset), index: i, count: n, f: val(f), f1: val(f1) }));
        boxes.forEach((b, i) => addRot(b, axis, M.mul(M.mul(M.fn('cos', M.add(M.mul(f, speed), M.mul(offset, i))), f1), degree)));
        return;
      }
      case 'progressRotationPrev': case 'progressRotation': {
        if (this.mode !== 'anim') return;
        const [box, prog, x, y, z, div] = [args[0], A[1], A[2], A[3], A[4], A[5]];
        this.ent.noteMax(prog, div);
        const k = M.div(prog, div);
        addRot(box, 'x', M.mul(k, x)); addRot(box, 'y', M.mul(k, y)); addRot(box, 'z', M.mul(k, z));
        return;
      }
      case 'progressPositionPrev': case 'progressPosition': {
        if (this.mode !== 'anim' || !isBox(args[0])) return;
        const [prog, x, y, z, div] = [A[1], A[2], A[3], A[4], A[5]];
        this.ent.noteMax(prog, div);
        const k = M.div(prog, div);
        chanAdd(st, args[0], 'px', M.mul(k, x)); chanAdd(st, args[0], 'py', M.mul(k, y)); chanAdd(st, args[0], 'pz', M.mul(k, z));
        return;
      }
      case 'faceTarget': {
        if (this.mode !== 'anim') return;
        const [yaw, pitch, divisor] = [A[0], A[1], A[2]];
        const boxes = args[3] && args[3].t === 'arr' ? args[3].items : args.slice(3).filter(isBox);
        boxes.forEach(b => rec('face', b, { divisor: val(divisor), n: boxes.length }));
        const actual = M.mul(divisor, boxes.length || 1);
        const ya = M.div(M.div(yaw, 180 / Math.PI), actual);
        const pa = M.div(M.div(pitch, 180 / Math.PI), actual);
        boxes.forEach(b => { addRot(b, 'y', ya); addRot(b, 'x', pa); });
        return;
      }
      case 'setRotateAngle': case 'setRotationAngle': {
        if (!isBox(args[0])) return;
        if (this.mode === 'build') { args[0].rot = [A[1], A[2], A[3]].map(x => (M.isNum(x) ? x : 0)); return; }
        if (this.mode === 'anim') ['rx', 'ry', 'rz'].forEach((c, i) => st.chan.set(args[0].id + c, M.sub(A[i + 1], defaultOf(args[0], c))));
        return;
      }
      case 'resetToDefaultPose': if (this.mode === 'anim') st.chan = new Map(); return;
      case 'updateDefaultPose': case 'setMovementScale': return;
    }
    if (d.ret === 'Z' || /^[FDIJ]$/.test(d.ret)) return 0;
  }

  // -------- ModelAnimator recording
  animatorCall(name, args) {
    const A = args.map(M.toVal);
    switch (name) {
      case 'update': return;
      case 'setAnimation': {
        const a = args[0];
        const key = a && a.t === 'static' ? a.name : 'UNKNOWN';
        if (!this.anims.has(key)) this.anims.set(key, { owner: a && a.owner, frames: [], tick: 0, cur: null });
        this.curAnim = this.anims.get(key);
        return 1;
      }
      case 'startKeyframe': {
        const an = this.curAnim; if (!an) return;
        an.cur = { start: an.tick, end: an.tick + A[0], stationary: false, rot: new Map(), pos: new Map() };
        an.tick += M.isNum(A[0]) ? A[0] : 0;
        return;
      }
      case 'setStaticKeyframe': {
        const an = this.curAnim; if (!an) return;
        const dur = M.isNum(A[0]) ? A[0] : 0;
        an.frames.push({ start: an.tick, end: an.tick + dur, stationary: true, rot: new Map(), pos: new Map() });
        an.tick += dur;
        return;
      }
      case 'resetKeyframe': {
        const an = this.curAnim; if (!an) return;
        const dur = M.isNum(A[0]) ? A[0] : 0;
        an.frames.push({ start: an.tick, end: an.tick + dur, stationary: false, rot: new Map(), pos: new Map() });
        an.tick += dur; an.cur = null;
        return;
      }
      case 'rotate': case 'move': {
        const an = this.curAnim; if (!an || !an.cur || !isBox(args[0])) return;
        const map = name === 'rotate' ? an.cur.rot : an.cur.pos;
        const prev = map.get(args[0].id) || { box: args[0], v: [0, 0, 0] };
        const vals = [A[1], A[2], A[3]].map(x => (M.isNum(x) ? x : 0));
        map.set(args[0].id, { box: args[0], v: prev.v.map((p, i) => p + vals[i]) });
        return;
      }
      case 'endKeyframe': {
        const an = this.curAnim; if (!an) return;
        if (an.cur) { an.frames.push(an.cur); an.cur = null; }
        return;
      }
    }
  }
}

function matchParams(m, desc) {
  const d = parseDesc(desc);
  return m.params.length === d.args.length;
}

function boxChannel(field) {
  return {
    rotateAngleX: 'rx', rotateAngleY: 'ry', rotateAngleZ: 'rz',
    rotationPointX: 'px', rotationPointY: 'py', rotationPointZ: 'pz',
    f_104203_: 'rx', f_104204_: 'ry', f_104205_: 'rz', f_104200_: 'px', f_104201_: 'py', f_104202_: 'pz',
    scaleX: 'sx', scaleY: 'sy', scaleZ: 'sz',
  }[field] || null;
}
function defaultOf(box, ch) {
  switch (ch) {
    case 'rx': return box.rot[0]; case 'ry': return box.rot[1]; case 'rz': return box.rot[2];
    case 'px': return box.pivot[0]; case 'py': return box.pivot[1]; case 'pz': return box.pivot[2];
    case 'sx': return box.scale[0]; case 'sy': return box.scale[1]; case 'sz': return box.scale[2];
  }
  return 0;
}
function setDefault(box, ch, v) {
  if (!M.isNum(v)) v = 0;
  const i = { x: 0, y: 1, z: 2 }[ch[1]];
  if (ch[0] === 'r') box.rot[i] = v; else if (ch[0] === 'p') box.pivot[i] = v; else box.scale[i] = v;
}
function chanAdd(st, box, ch, v) {
  const k = box.id + ch;
  st.chan.set(k, M.add(st.chan.get(k) || 0, v));
}
function cloneState(st) {
  return { idx: st.idx, stack: st.stack.slice(), locals: st.locals.slice(), guard: st.guard, chan: new Map(st.chan), depth: st.depth, ret: st.ret };
}
// Guards are conjunction lists of literal Molang booleans. States split at a fork carry
// complementary literals at the same position, so the first differing literal decides a-vs-b.
function guardList(g) { return Array.isArray(g) ? g : (g === 1 ? [] : [M.str(g)]); }
function mergeGuards(a, b) {
  const A = guardList(a), B = guardList(b);
  let k = 0;
  while (k < A.length && k < B.length && A[k] === B[k]) k++;
  const common = A.slice(0, k);
  const restA = A.slice(k), restB = B.slice(k);
  const cond = restA.length ? restA[0] : (restB.length ? M.str(M.not(M.S(restB[0]))) : null);
  if (!restA.length || !restB.length) return { guard: common, cond };
  // same tail except complementary first literal -> drop it
  if (restA.length === 1 && restB.length === 1) return { guard: common, cond };
  return { guard: common.concat([`(${restA.join(' && ')}) || (${restB.join(' && ')})`]), cond: restA[0] };
}
function mergeStates(a, b, final) {
  const mg = mergeGuards(a.guard, b.guard);
  const g = mg.cond === null ? 1 : M.S(mg.cond);
  const out = cloneState(a);
  out.guard = mg.guard;
  const keys = new Set([...a.chan.keys(), ...b.chan.keys()]);
  out.chan = new Map();
  for (const k of keys) {
    const va = a.chan.has(k) ? a.chan.get(k) : 0;
    const vb = b.chan.has(k) ? b.chan.get(k) : 0;
    out.chan.set(k, M.same(va, vb) ? va : M.ternary(g, va, vb));
  }
  const mergeVal = (va, vb) => {
    if (va === vb) return va;
    const na = M.toVal(va), nb = M.toVal(vb);
    if ((M.isNum(na) || (na && na.t === 'sym')) && (M.isNum(nb) || (nb && nb.t === 'sym'))) return M.same(na, nb) ? na : M.ternary(g, na, nb);
    return va;
  };
  out.locals = a.locals.map((v, i) => mergeVal(v, b.locals[i]));
  out.stack = a.stack.map((v, i) => mergeVal(v, b.stack[i]));
  if (final) out.ret = mergeVal(a.ret, b.ret);
  return out;
}

module.exports = { Interp, parseDesc };
