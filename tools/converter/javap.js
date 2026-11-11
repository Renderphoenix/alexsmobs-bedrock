// Parses `javap -c -p -constants` output into classes -> methods -> instructions.
// Results are cached in .tools/javap/<SimpleName>.txt so javap only runs once per class.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./config');

const cache = new Map();

function javapText(fqcn) {
  const file = path.join(C.JAVAP_DIR, fqcn.replace(/[/.$]/g, '_') + '.txt');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  let out = '';
  try {
    out = execFileSync('javap', ['-c', '-p', '-constants', '-cp', C.JAR_DIR, fqcn.replace(/\//g, '.')],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { out = ''; }
  fs.mkdirSync(C.JAVAP_DIR, { recursive: true });
  fs.writeFileSync(file, out);
  return out;
}

// Parse an operand comment like "// Method a/b/C.name:(FF)V" or "// float 24.0f"
function parseComment(c) {
  if (!c) return null;
  let m;
  if ((m = c.match(/^(Method|InterfaceMethod) (?:(\S+?)\.)?("?<?[\w$]+>?"?):(\S+)/))) {
    return { kind: 'method', owner: m[2] || null, name: m[3].replace(/"/g, ''), desc: m[4] };
  }
  if ((m = c.match(/^Field (?:(\S+?)\.)?([\w$]+):(\S+)/))) return { kind: 'field', owner: m[1] || null, name: m[2], desc: m[3] };
  if ((m = c.match(/^class (\S+)/))) return { kind: 'class', name: m[1] };
  if ((m = c.match(/^String (.*)$/))) return { kind: 'string', value: m[1].trim() };
  if ((m = c.match(/^float (\S+?)f?$/))) return { kind: 'num', value: parseFloat(m[1]) };
  if ((m = c.match(/^double (\S+?)d?$/))) return { kind: 'num', value: parseFloat(m[1]) };
  if ((m = c.match(/^int (\S+)$/))) return { kind: 'num', value: parseInt(m[1], 10) };
  if ((m = c.match(/^long (\S+?)l?$/))) return { kind: 'num', value: parseInt(m[1], 10) };
  if ((m = c.match(/^InvokeDynamic #([0-9]+)/))) return { kind: 'indy', bsm: +m[1] };
  return { kind: 'other', text: c };
}

function parseClass(fqcn) {
  fqcn = fqcn.replace(/\./g, '/');
  if (cache.has(fqcn)) return cache.get(fqcn);
  const txt = javapText(fqcn);
  const cls = { name: fqcn, superName: null, methods: [], fields: [], ok: !!txt };
  const lines = txt.replace(/\r/g, '').split('\n');
  const head = lines.find(l => /\b(class|interface|enum)\b/.test(l) && !l.trim().startsWith('//'));
  if (head) {
    const m = head.match(/extends ([\w.$]+)/);
    if (m) cls.superName = m[1].replace(/\./g, '/');
    const im = head.match(/implements (.+?)\s*\{?$/);
    cls.interfaces = im ? im[1].split(/,\s*(?![^<]*>)/).map(x => x.trim().replace(/<.*/, '').split('.').pop()) : [];
  }
  let cur = null;
  let sw = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^  \S/.test(line) && !/^  Code:/.test(line)) {
      // member declaration
      const decl = line.trim();
      const mm = decl.match(/([\w$<>]+)\(([^)]*)\)/);
      if (mm && decl.endsWith(';')) {
        cur = { name: mm[1], params: mm[2] ? mm[2].split(',').map(s => s.trim()) : [], decl, isStatic: /\bstatic\b/.test(decl.split('(')[0]), code: [], byPc: new Map() };
        if (decl.includes(cls.name.replace(/\//g, '.') + '(')) cur.name = '<init>';
        if (decl === 'static {};') cur.name = '<clinit>';
        cls.methods.push(cur);
      } else if (decl === 'static {};') {
        cur = { name: '<clinit>', params: [], decl, isStatic: true, code: [], byPc: new Map() };
        cls.methods.push(cur);
      } else if (decl.endsWith(';')) {
        const fm = decl.match(/([\w$.<>\[\]]+) ([\w$]+);$/);
        if (fm) cls.fields.push({ type: fm[1], name: fm[2], isStatic: /\bstatic\b/.test(decl) });
        cur = null;
      }
      continue;
    }
    if (!cur) continue;
    if (sw) {
      const t = line.trim();
      if (t === '}') { sw = null; continue; }
      const km = t.match(/^(-?\d+|default): (\d+)$/);
      if (km) {
        if (km[1] === 'default') sw.ins.default = +km[2];
        else sw.ins.cases.set(+km[1], +km[2]);
      }
      continue;
    }
    const im = line.match(/^\s+(\d+): ([a-z_0-9]+)\s*(.*)$/);
    if (!im) continue;
    const pc = +im[1];
    const op = im[2];
    let rest = im[3] || '';
    let comment = null;
    const ci = rest.indexOf('//');
    if (ci >= 0) { comment = rest.slice(ci + 2).trim(); rest = rest.slice(0, ci).trim(); }
    const ins = { pc, op, args: rest ? rest.split(/[,\s]+/).filter(Boolean) : [], ref: parseComment(comment) };
    if (op === 'tableswitch' || op === 'lookupswitch') { ins.cases = new Map(); ins.default = null; sw = { ins }; }
    cur.code.push(ins);
    cur.byPc.set(pc, cur.code.length - 1);
  }
  cache.set(fqcn, cls);
  return cls;
}

function findMethod(cls, name, pred) {
  return cls.methods.find(m => m.name === name && (!pred || pred(m)));
}

module.exports = { parseClass, findMethod, javapText };
