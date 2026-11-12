// Our own bird flight: every bird's `fly` gets wings held straight out (a posture close to the Java one, found by
// measuring each rig in Blockbench so the wingtips point sideways) plus a flap on the rotation axis that lifts the
// tip. Values are for the wing on the +x side in Blockbench; the other wing is mirrored (x, -y, -z).
//   R: the +x wing, L: its mirror, post: [x,y,z] posture, axis: 0/1/2 component that raises the tip,
//   len: wingbeat seconds, amp: half-swing degrees. Wing children stay at rest (straight wing).
'use strict';
const FLAP = {
  bald_eagle:   { R: 'wingR', L: 'wingL', post: [-90, 75, 15], axis: 1, len: 0.9, amp: 30 },
  seagull:      { R: 'right_wing', L: 'left_wing', post: [-90, 0, 90], axis: 2, len: 0.7, amp: 34 },
  soul_vulture: { R: 'rightWing', L: 'leftWing', post: [15, -90, -15], axis: 2, len: 0.85, amp: 30 },
  shoebill:     { R: 'rightWing', L: 'leftWing', post: [75, 0, -90], axis: 2, len: 0.75, amp: 32 },
  toucan:       { R: 'right_wing', L: 'left_wing', post: [-90, 0, 90], axis: 2, len: 0.45, amp: 40 },
  crow:         { R: 'wing_right', L: 'wing_left', post: [-90, 90, 0], axis: 1, len: 0.45, amp: 40 },
  potoo:        { R: 'right_wing', L: 'left_wing', post: [-90, 75, 30], axis: 2, len: 0.5, amp: 38 },
  blue_jay:     { R: 'rightWing', L: 'leftWing', post: [-90, 45, 75], axis: 2, len: 0.35, amp: 42 },
  sunbird:      { R: 'right_wing', L: 'left_wing', post: [0, -15, 0], axis: 2, len: 0.6, amp: 30 },
  hummingbird:  { R: 'wingR', L: 'wingL', post: [15, 0, 75], axis: 2, len: 0.125, amp: 55 },
};
const r2 = n => Math.round(n * 100) / 100 || 0;
const tkey = t => String(Math.round(t * 10000) / 10000);

// replaces the wing channels of a fly animation (and drops their children's keys) with posture + flap
function applyFlap(id, anim, children) {
  const f = FLAP[id];
  if (!f || !anim) return false;
  const K = 12, bones = anim.bones || (anim.bones = {});
  const R = {}, L = {};
  for (let k = 0; k <= K; k++) {
    const p = k / K;
    const s = Math.sin(2 * Math.PI * p) + 0.18 * Math.sin(4 * Math.PI * p - Math.PI / 2); // quicker downstroke
    const v = f.post.slice();
    v[f.axis] += f.amp * (s + 0.15);
    R[tkey(p * f.len)] = v.map(r2);
    L[tkey(p * f.len)] = [v[0], -v[1], -v[2]].map(r2);
  }
  bones[f.R] = { rotation: R };
  bones[f.L] = { rotation: L };
  for (const c of children || []) delete bones[c];
  // keep the loop in step with the wingbeat: a whole number of beats per animation
  const n = Math.max(1, Math.round((anim.animation_length || f.len) / f.len));
  anim.animation_length = r2(n * f.len);
  for (const b of Object.keys(bones)) if (b !== f.R && b !== f.L) {
    for (const ch of Object.values(bones[b])) if (ch && typeof ch === 'object' && !Array.isArray(ch))
      for (const t of Object.keys(ch)) if (+t > anim.animation_length + 1e-6) delete ch[t];
  }
  anim.loop = true;
  return true;
}
module.exports = { FLAP, applyFlap };
