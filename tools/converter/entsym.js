// Maps Java entity fields / methods read inside setupAnim to Molang.
// Progress fields (sitProgress, prevFlyProgress, ...) become client variables v.p_<key>
// that the generated pre_animation script ramps toward a target state.
'use strict';
const M = require('./molang');

// Vanilla SRG names (1.20.1) that show up in Alex's Mobs models.
const SRG = {
  f_19797_: 'v.age',                 // tickCount
  m_20096_: 'q.is_on_ground',        // onGround()
  m_20069_: 'q.is_in_water',         // isInWater()
  m_20072_: 'q.is_in_water',         // isInWaterOrBubble? close enough
  m_20077_: 'q.is_in_lava',          // isInLava()
  m_6162_: 'q.is_baby',              // isBaby()
  m_21825_: 'q.is_sitting',          // isInSittingPose()
  m_21827_: 'q.is_sitting',          // isOrderedToSit()
  m_6084_: 'q.is_alive',             // isAlive()
  m_20142_: 'v.am_running',          // isSprinting()
  m_5803_: 'q.is_sleeping',          // isSleeping()
  m_20159_: 'q.is_riding',           // isPassenger()
  m_20160_: 'q.has_rider',           // isVehicle()
  m_21824_: 'q.is_tamed',            // isTame()
  m_5912_: 'q.is_angry',             // isAggressive()
  m_20089_: 'q.is_sneaking',         // getPose? (rare)
  m_6047_: 'q.is_sneaking',          // isCrouching()
  m_6117_: 'q.is_using_item',        // isUsingItem()
  m_21223_: 'q.health',              // getHealth()
  m_21233_: 'q.max_health',          // getMaxHealth()
  f_20916_: 'q.hurt_time',           // hurtTime
  f_20919_: 'q.death_ticks',         // deathTime
  m_146909_: '0',                    // getXRot()
  m_146908_: '0',                    // getYRot()
  f_20883_: '0', f_20884_: '0',      // yBodyRot / prev
  f_20885_: '0', f_20886_: '0',      // yHeadRot / prev
};

// Keyword -> boolean Molang used both for direct boolean getters (isFlying()) and as
// the ramp target of progress fields (flyProgress).
const STATES = [
  [/sleep|nap|rest/, 'v.am_sleeping'],
  [/sit/, 'q.is_sitting'],
  [/swim|water|submerg|dive/, 'q.is_in_water'],
  [/fly|flight|flap|glid|air|hover|soar/, 'v.am_flying'],
  [/run|sprint|gallop|charg|dash/, 'v.am_running'],
  [/climb/, 'q.is_wall_climbing'],
  [/stand|rear|upright/, 'v.am_standing'],
  [/baby|child/, 'q.is_baby'],
  [/angry|aggress|attack|hostile|rage/, 'q.is_angry'],
  [/land|ground/, 'q.is_on_ground'],
  [/dig|burrow|bury/, 'v.am_digging'],
  [/eat|graz|feed|forag/, 'v.am_eating'],
  [/roll|curl|ball/, 'v.am_rolling'],
  [/hang|perch/, 'v.am_perching'],
  [/dance|danc/, 'v.am_dancing'],
];

function stateFor(name) {
  const n = name.toLowerCase();
  for (const [re, m] of STATES) if (re.test(n)) return m;
  return null;
}

function progressKey(fieldName) {
  let n = fieldName.replace(/^prev/, '').replace(/^last/, '');
  n = n.charAt(0).toLowerCase() + n.slice(1);
  return n.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

class EntitySyms {
  constructor() {
    this.progress = new Map(); // key -> {field, target, max}
    this.unknown = new Set();
  }
  field(name, desc) {
    if (SRG[name] !== undefined) return M.toVal(M.S(SRG[name]));
    if (/progress|amount|timer?$|ticks?$|angle|scale|pitch|yaw|lean|tilt/i.test(name) && /^[FDI]/.test(desc || 'F')) {
      if (/progress|amount/i.test(name)) {
        const key = progressKey(name);
        if (!this.progress.has(key)) this.progress.set(key, { field: name, target: stateFor(name), max: /amount/i.test(name) ? 1 : 5 });
        return M.S(`v.p_${key}`);
      }
      this.unknown.add(name);
      return 0;
    }
    if (desc === 'Z') {
      const s = stateFor(name);
      if (s) return M.S(s);
    }
    this.unknown.add(name);
    return 0;
  }
  method(name, desc) {
    if (SRG[name] !== undefined) return M.toVal(M.S(SRG[name]));
    const ret = (desc || '').split(')')[1] || 'V';
    if (/^(get|)(.*)(Progress|Amount)$/i.test(name) && /^[FD]/.test(ret)) {
      const key = progressKey(name.replace(/^get/, ''));
      if (!this.progress.has(key)) this.progress.set(key, { field: name, target: stateFor(name), max: /amount/i.test(name) ? 1 : 5 });
      return M.S(`v.p_${key}`);
    }
    if (ret === 'Z' && /^(is|has|can|should)/.test(name)) {
      const s = stateFor(name.replace(/^(is|has|can|should)/, ''));
      if (s) return M.S(s);
    }
    this.unknown.add(name + desc);
    return 0;
  }
  noteMax(sym, divisor) {
    const s = M.str(sym);
    const m = s.match(/v\.p_(\w+)/);
    if (m && this.progress.has(m[1]) && typeof divisor === 'number' && divisor > 0) {
      const pr = this.progress.get(m[1]);
      pr.max = Math.max(pr.max === 5 && !pr.seen ? 0 : pr.max, divisor);
      pr.seen = true;
    }
  }
}

module.exports = { EntitySyms, stateFor, SRG };
