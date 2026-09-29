// High-priority requirement H3 — emergency (break-glass) access flow, guardrails and resilience.
const { C, svgDoc, rect, text, arrow, lock } = require('./lib');

const W = 1920;
const H = 900;

function stepCard({ x, y, w, h, n, title, lines, hot = false }) {
  const fill = hot ? C.coralBg : C.white;
  const stroke = hot ? C.coral : C.tealLine;
  let o = rect({ x, y, w, h, r: 16, fill, stroke, sw: hot ? 2.2 : 1.6, shadow: true });
  o += `<circle cx="${x + 34}" cy="${y + 36}" r="18" fill="${hot ? C.coral : C.teal}"/>`;
  o += text({ x: x + 34, y: y + 42.5, lines: [{ t: String(n), weight: 800 }], size: 17, fill: C.white, anchor: 'middle' });
  o += text({ x: x + 62, y: y + 43, lines: [{ t: title, weight: 800 }], size: 18, fill: hot ? '#8C2A10' : C.ink, maxw: w - 74 });
  o += text({ x: x + 22, y: y + 84, lines, size: 14, fill: hot ? '#6B2A18' : C.text, lh: 1.42, maxw: w - 40 });
  return o;
}

function build() {
  let b = '';
  b += text({ x: 40, y: 54, lines: [{ t: 'Emergency Access (Break-Glass)', weight: 800 }], size: 30, fill: C.ink });
  b += text({ x: 40, y: 84, lines: ['High-priority requirement H3 · immediate access to critical data for authorized professionals, with full accountability afterwards'], size: 16, fill: C.muted });

  // Step cards
  const steps = [
    { title: 'Identify the patient', lines: ['Exact-match search only:', 'INS / MedX ID, or name +', 'birth date + sex', 'Minimal demographics to', 'confirm identity', 'No browsing, no wildcards'] },
    { title: 'Declare emergency', lines: ['Reason code (unconscious,', 'life-threatening, unable', 'to consent…)', 'Free-text justification', 'Accountability statement', '“I will be audited”'] },
    { title: 'Step-up MFA', lines: ['Passkey or smart card', '(e-CPS) in the last 15 min', 'Policy engine checks the', 'emergency_access', 'entitlement and the', "patient's opt-out"] },
    { title: 'Time-boxed grant', lines: ['4 hours · read-only', 'This patient only', 'Grant + audit event', 'written in the same', 'transaction', 'Renewable with a new reason'] },
    { title: 'Summary in < 1 s', hot: true, lines: ['International Patient', 'Summary: allergies, active', 'problems, medications,', 'blood group, implants,', 'advance directives, contacts', 'Full record: same grant'] },
  ];
  const cw = 328;
  const gap = 50;
  const y0 = 124;
  const ch = 232;
  steps.forEach((s, i) => {
    const x = 40 + i * (cw + gap);
    b += stepCard({ x, y: y0, w: cw, h: ch, n: i + 1, ...s });
    if (i < steps.length - 1) b += arrow({ points: [[x + cw + 6, y0 + ch / 2], [x + cw + gap - 6, y0 + ch / 2]], color: C.teal, sw: 3, marker: 'arr-teal' });
  });

  // Timing ribbon
  b += rect({ x: 40, y: 376, w: 1840, h: 44, r: 22, fill: C.petrol, stroke: C.petrol, sw: 1 });
  b += text({ x: 960, y: 404, lines: [{ t: 'Clinician: ≈ 30 seconds from search to data (human steps)   ·   System: p95 < 300 ms per API call   ·   Availability 99.99 %', weight: 700 }], size: 15, fill: C.white, anchor: 'middle' });

  // Guardrails
  b += text({ x: 40, y: 464, lines: [{ t: 'GUARDRAILS — ACCOUNTABILITY AFTER THE FACT (access is never blocked, always answered for)', weight: 800 }], size: 14, fill: C.coral });
  const guards = [
    ['Immutable audit', ['AuditEvent, purpose =', 'emergency treatment,', 'kept in the WORM trail']],
    ['Real-time alert', ['Privacy office alerted', 'through the SIEM the', 'moment access starts']],
    ['Patient informed', ['In-app + e-mail notice', 'within 24 h: who, when,', 'what was viewed']],
    ['Mandatory review', ['Privacy officer + medical', 'lead review every case', 'within 72 h']],
    ['Misuse detection', ['Behaviour analytics flag', 'outliers; sanctions and', 'account suspension']],
  ];
  guards.forEach(([t, ls], i) => {
    const x = 40 + i * (cw + gap);
    b += rect({ x, y: 482, w: cw, h: 128, r: 14, fill: C.coralBg, stroke: '#F4B6A3', sw: 1.5 });
    b += text({ x: x + 20, y: 514, lines: [{ t, weight: 800 }], size: 16.5, fill: '#8C2A10', maxw: cw - 40 });
    b += text({ x: x + 20, y: 543, lines: ls, size: 14, fill: '#6B2A18', lh: 1.4, maxw: cw - 40 });
  });

  // Resilience
  b += text({ x: 40, y: 656, lines: [{ t: 'RESILIENCE — WHY THE TIER-0 PATH KEEPS WORKING WHEN OTHER SERVICES ARE DEGRADED', weight: 800 }], size: 14, fill: C.teal });
  const res = [
    ['Isolated deployment', 'bulkhead with reserved capacity'],
    ['Pre-computed summary', 'projection, no joins at read time'],
    ['Multi-AZ replicas', '+ DR region serving reads (active)'],
    ['Local token validation', 'cached IdP signing keys'],
    ['Local policy decisions', 'OPA sidecar, cached bundles'],
    ['Audit via outbox', 'no dependency on the audit pipeline'],
  ];
  const rw = (1840 - 5 * 16) / 6;
  res.forEach(([t, s], i) => {
    const x = 40 + i * (rw + 16);
    b += rect({ x, y: 674, w: rw, h: 92, r: 14, fill: C.tealBg, stroke: C.tealLine, sw: 1.5 });
    b += lock({ x: x + 18, y: 690, color: C.teal, s: 0.95 });
    b += text({ x: x + 44, y: 706, lines: [{ t, weight: 800 }], size: 15, fill: C.petrol, maxw: rw - 56 });
    b += text({ x: x + 18, y: 740, lines: [s], size: 13, fill: C.text, maxw: rw - 30 });
  });

  // Footer
  b += rect({ x: 40, y: 796, w: 1840, h: 70, r: 14, fill: C.slateBg, stroke: C.slateLine, sw: 1.2 });
  b += text({ x: 64, y: 826, lines: [{ t: 'Who can break the glass?', weight: 800 }], size: 15, fill: C.ink });
  b += text({ x: 64, y: 850, lines: ['Verified practitioners holding the emergency_access entitlement (emergency medicine, on-call, EMS), granted by the MedX medical lead and reviewed quarterly. Patients may opt out where the law allows it.'], size: 14, fill: C.muted, maxw: 1790 });

  return svgDoc({ width: W, height: H, body: b, title: 'MedX — Emergency Access (Break-Glass)' });
}

module.exports = { name: 'medx-emergency-access-flow', title: 'MedX — Emergency Access (Break-Glass)', width: W, height: H, build };
