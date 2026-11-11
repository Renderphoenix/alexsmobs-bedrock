// Linear bytecode scanner: walks a method once (ignoring jumps) with a light operand stack and
// records every call with its (mostly constant) arguments. Good enough for registries,
// attribute builders, goal lists and static initializers, which are straight-line code.
'use strict';
const { parseDesc } = require('./interp');

function scan(method) {
  const calls = [];
  const puts = [];
  const S = [];
  const L = [];
  const pop = () => (S.length ? S.pop() : undefined);
  for (const ins of method.code) {
    const op = ins.op;
    let m;
    if ((m = op.match(/^([ifdal])const_(m1|\d)$/))) { S.push(m[2] === 'm1' ? -1 : +m[2]); continue; }
    if ((m = op.match(/^([ifdal])load(?:_(\d))?$/))) { const n = m[2] !== undefined ? +m[2] : +ins.args[0]; S.push(L[n] !== undefined ? L[n] : { t: 'local', n }); continue; }
    if ((m = op.match(/^([ifdal])store(?:_(\d))?$/))) { const n = m[2] !== undefined ? +m[2] : +ins.args[0]; L[n] = pop(); continue; }
    switch (op) {
      case 'bipush': case 'sipush': S.push(+ins.args[0]); break;
      case 'ldc': case 'ldc_w': case 'ldc2_w': {
        const r = ins.ref;
        if (r && r.kind === 'num') S.push(r.value);
        else if (r && r.kind === 'string') S.push({ t: 'str', v: r.value });
        else if (r && r.kind === 'class') S.push({ t: 'class', name: r.name });
        else S.push({ t: 'unk' });
        break;
      }
      case 'aconst_null': S.push(null); break;
      case 'new': S.push({ t: 'new', cls: ins.ref && ins.ref.name }); break;
      case 'dup': S.push(S[S.length - 1]); break;
      case 'dup_x1': { const a = pop(), b = pop(); S.push(a, b, a); break; }
      case 'pop': pop(); break;
      case 'pop2': pop(); pop(); break;
      case 'swap': { const a = pop(), b = pop(); S.push(a, b); break; }
      case 'getstatic': S.push({ t: 'static', owner: ins.ref.owner, name: ins.ref.name, desc: ins.ref.desc }); break;
      case 'putstatic': puts.push({ name: ins.ref.name, owner: ins.ref.owner, value: pop(), pc: ins.pc }); break;
      case 'getfield': { const o = pop(); S.push({ t: 'field', obj: o, name: ins.ref.name, desc: ins.ref.desc }); break; }
      case 'putfield': { const v = pop(); const o = pop(); puts.push({ name: ins.ref.name, obj: o, value: v, pc: ins.pc, field: true }); break; }
      case 'checkcast': break;
      case 'newarray': case 'anewarray': { const n = pop(); S.push({ t: 'arr', items: new Array(typeof n === 'number' ? n : 0).fill(0) }); break; }
      case 'iastore': case 'aastore': case 'fastore': case 'dastore': { const v = pop(), i = pop(), a = pop(); if (a && a.t === 'arr' && typeof i === 'number') a.items[i] = v; break; }
      case 'invokevirtual': case 'invokespecial': case 'invokestatic': case 'invokeinterface': {
        const r = ins.ref;
        const d = parseDesc(r.desc);
        const args = [];
        for (let i = d.args.length - 1; i >= 0; i--) args[i] = pop();
        const recv = op === 'invokestatic' ? null : pop();
        const call = { t: 'call', owner: r.owner, name: r.name, desc: r.desc, args, recv, pc: ins.pc, op };
        calls.push(call);
        if (op === 'invokespecial' && r.name === '<init>' && recv && recv.t === 'new') {
          recv.args = args; recv.done = true;
          if (S[S.length - 1] === recv) { /* dup'd copy stays as constructed object */ }
        } else if (d.ret !== 'V') S.push(call);
        break;
      }
      case 'invokedynamic': S.push({ t: 'indy', pc: ins.pc, bsm: ins.ref && ins.ref.bsm }); break;
      case 'fadd': case 'dadd': case 'iadd': { const b = pop(), a = pop(); S.push(typeof a === 'number' && typeof b === 'number' ? a + b : { t: 'unk' }); break; }
      case 'fmul': case 'dmul': case 'imul': { const b = pop(), a = pop(); S.push(typeof a === 'number' && typeof b === 'number' ? a * b : { t: 'unk' }); break; }
      case 'fdiv': case 'ddiv': { const b = pop(), a = pop(); S.push(typeof a === 'number' && typeof b === 'number' ? a / b : { t: 'unk' }); break; }
      case 'fsub': case 'dsub': case 'isub': { const b = pop(), a = pop(); S.push(typeof a === 'number' && typeof b === 'number' ? a - b : { t: 'unk' }); break; }
      case 'i2f': case 'i2d': case 'f2d': case 'd2f': case 'i2l': break;
      case 'areturn': case 'return': case 'ireturn': case 'freturn': case 'dreturn': S.length = 0; break;
      default:
        if (/^if|^goto|switch$/.test(op)) {
          // conditional jumps consume operands
          if (/^if_[ia]cmp/.test(op)) { pop(); pop(); } else if (/^if/.test(op)) pop(); else if (/switch$/.test(op)) pop();
        } else if (/^[fdil]cmp[lg]?$/.test(op)) { pop(); pop(); S.push({ t: 'unk' }); }
        else if (/neg$/.test(op)) { const a = pop(); S.push(typeof a === 'number' ? -a : a); }
        else if (/aload$/.test(op)) { pop(); pop(); S.push({ t: 'unk' }); }
        else if (op === 'arraylength' || op === 'instanceof') { pop(); S.push({ t: 'unk' }); }
        else if (op === 'iinc' || op === 'nop') { /* */ }
        else if (/^[ldif]2[ldif]$/.test(op)) { /* conversions */ }
        else if (/^[ilfd](and|or|xor|shl|shr|ushr|rem|div)$/.test(op)) { pop(); pop(); S.push({ t: 'unk' }); }
    }
  }
  return { calls, puts };
}

module.exports = { scan };
