// Tiny expression builder: values are JS numbers (concrete) or {t:'sym', e:'molang'}.
'use strict';
const DEG = 180 / Math.PI;

function isNum(v) { return typeof v === 'number'; }
function fmt(n) {
  if (!isFinite(n)) return '0';
  const r = Math.round(n * 1e5) / 1e5;
  return Object.is(r, -0) ? '0' : String(r);
}
function S(e) { return { t: 'sym', e }; }
function str(v) {
  if (isNum(v)) return fmt(v);
  if (v && v.t === 'sym') return v.e;
  if (v && v.t === 'cmp') return `(${str(v.a)} - ${str(v.b)})`;
  return '0';
}
// wrap in parens unless atomic
function p(v) {
  const s = str(v);
  if (/^-?[\w.]+$/.test(s) || /^\(.*\)$/.test(s) && balanced(s.slice(1, -1))) return s;
  return `(${s})`;
}
function balanced(s) {
  let d = 0;
  for (const ch of s) { if (ch === '(') d++; else if (ch === ')') { d--; if (d < 0) return false; } }
  return d === 0;
}
function toVal(v) {
  if (isNum(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v && v.t === 'sym') {
    if (/^-?\d+(\.\d+)?(e-?\d+)?$/.test(v.e)) return parseFloat(v.e);
    return v;
  }
  if (v && v.t === 'cmp') return v;
  return 0;
}
function add(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a) && isNum(b)) return a + b;
  if (a === 0) return b;
  if (b === 0) return a;
  if (isNum(b) && b < 0) return S(`${str(a)} - ${fmt(-b)}`);
  return S(`${str(a)} + ${str(b)}`);
}
function sub(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a) && isNum(b)) return a - b;
  if (b === 0) return a;
  if (a === 0) return neg(b);
  return S(`${str(a)} - ${p(b)}`);
}
function mul(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a) && isNum(b)) return a * b;
  if (a === 0 || b === 0) return 0;
  if (a === 1) return b;
  if (b === 1) return a;
  if (a === -1) return neg(b);
  if (b === -1) return neg(a);
  return S(`${p(a)} * ${p(b)}`);
}
function div(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a) && isNum(b)) return b === 0 ? 0 : a / b;
  if (a === 0) return 0;
  if (b === 1) return a;
  if (isNum(b)) return mul(a, 1 / b);
  return S(`${p(a)} / ${p(b)}`);
}
function neg(a) {
  a = toVal(a);
  if (isNum(a)) return -a;
  return S(`-${p(a)}`);
}
function rem(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a) && isNum(b)) return b === 0 ? 0 : a % b;
  return S(`math.mod(${str(a)}, ${str(b)})`);
}
function fn(name, ...args) {
  const vs = args.map(toVal);
  if (vs.every(isNum)) {
    const n = vs;
    switch (name) {
      case 'sin': return Math.sin(n[0]);
      case 'cos': return Math.cos(n[0]);
      case 'abs': return Math.abs(n[0]);
      case 'sqrt': return Math.sqrt(Math.max(0, n[0]));
      case 'min': return Math.min(n[0], n[1]);
      case 'max': return Math.max(n[0], n[1]);
      case 'clamp': return Math.min(Math.max(n[0], n[1]), n[2]);
      case 'lerp': return n[0] + (n[1] - n[0]) * n[2];
      case 'signum': return Math.sign(n[0]);
      case 'floor': return Math.floor(n[0]);
      case 'trunc': return Math.trunc(n[0]);
      case 'atan2': return Math.atan2(n[0], n[1]);
      case 'pow': return Math.pow(n[0], n[1]);
    }
  }
  const a = vs.map(str);
  switch (name) {
    // Java trig takes radians; Molang trig takes degrees.
    case 'sin': return S(`math.sin(${p(vs[0])} * ${fmt(DEG)})`);
    case 'cos': return S(`math.cos(${p(vs[0])} * ${fmt(DEG)})`);
    case 'atan2': return S(`(math.atan2(${a[0]}, ${a[1]}) / ${fmt(DEG)})`);
    case 'signum': return S(`(${p(vs[0])} > 0 ? 1 : (${p(vs[0])} < 0 ? -1 : 0))`);
    case 'lerp': return S(`math.lerp(${a[0]}, ${a[1]}, ${a[2]})`);
    default: return S(`math.${name}(${a.join(', ')})`);
  }
}
function cond(op, a, b) {
  // returns number 0/1 if decidable else sym boolean
  a = toVal(a); b = toVal(b);
  if (isNum(a) && isNum(b)) {
    switch (op) {
      case '==': return a === b ? 1 : 0;
      case '!=': return a !== b ? 1 : 0;
      case '<': return a < b ? 1 : 0;
      case '<=': return a <= b ? 1 : 0;
      case '>': return a > b ? 1 : 0;
      case '>=': return a >= b ? 1 : 0;
    }
  }
  return S(`${p(a)} ${op} ${p(b)}`);
}
function not(c) {
  c = toVal(c);
  if (isNum(c)) return c ? 0 : 1;
  return S(`!${p(c)}`);
}
function and(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a)) return a ? b : 0;
  if (isNum(b)) return b ? a : 0;
  return S(`${p(a)} && ${p(b)}`);
}
function or(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a)) return a ? 1 : b;
  if (isNum(b)) return b ? 1 : a;
  return S(`${p(a)} || ${p(b)}`);
}
function ternary(c, a, b) {
  c = toVal(c); a = toVal(a); b = toVal(b);
  if (isNum(c)) return c ? a : b;
  if (isNum(a) && isNum(b) && a === b) return a;
  if (!isNum(a) && !isNum(b) && a.e === b.e) return a;
  return S(`(${p(c)} ? ${str(a)} : ${str(b)})`);
}
function same(a, b) {
  a = toVal(a); b = toVal(b);
  if (isNum(a) && isNum(b)) return Math.abs(a - b) < 1e-9;
  return str(a) === str(b);
}

module.exports = { S, str, p, fmt, add, sub, mul, div, neg, rem, fn, cond, not, and, or, ternary, toVal, isNum, same, DEG };
