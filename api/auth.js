// api/auth.js
// GovBidder Command Center — Auth con Free Trial 7 días

const PLANS = {
  trial:   { name: 'Free Trial',  days: 7,    price: 0   },
  elevate: { name: 'Elevate',     days: 9999, price: 69  },
  prime:   { name: 'Prime',       days: 9999, price: 119 },
  legacy:  { name: 'Legacy',      days: 9999, price: 219 },
};

// ── REGISTERED MEMBERS (paid plans) ──────────────────────
const MEMBERS = [
  {
    id: "001",
    name: "Santo González",
    email: "santo@govbidder.net",
    password: "GovBidder2025!",
    plan: "Legacy",
    planExpiry: "2026-12-31",
    industry: "Cleaning / Janitorial",
    state: "NJ",
    naics: "561720",
    memberSince: "2024-01-15",
    active: true,
    avatar: "SG",
    isTrial: false
  },
  {
    id: "002",
    name: "Demo Member",
    email: "demo@govbidderclub.com",
    password: "Demo2025!",
    plan: "Prime",
    planExpiry: "2026-12-31",
    industry: "IT Services",
    state: "NY",
    naics: "541519",
    memberSince: "2024-06-01",
    active: true,
    avatar: "DM",
    isTrial: false
  },
  {
    id: "003",
    name: "Test Elevate",
    email: "elevate@govbidderclub.com",
    password: "Elevate2025!",
    plan: "Elevate",
    planExpiry: "2026-12-31",
    industry: "Construction",
    state: "FL",
    naics: "236220",
    memberSince: "2025-01-01",
    active: true,
    avatar: "TE",
    isTrial: false
  }
];

// ── TOKEN HELPERS ─────────────────────────────────────────
function makeToken(payload) {
  return Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + 86400000 // 24h session
  })).toString('base64');
}

function parseToken(token) {
  try {
    const p = JSON.parse(Buffer.from(token, 'base64').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

// ── TRIAL HELPERS ─────────────────────────────────────────
function getTrialExpiry(startDate) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function isTrialExpired(startDate) {
  const expiry = new Date(getTrialExpiry(startDate));
  return new Date() > expiry;
}

function trialDaysLeft(startDate) {
  const expiry = new Date(getTrialExpiry(startDate));
  const diff   = expiry - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function safeMember(m, extra = {}) {
  return {
    id: m.id, name: m.name, email: m.email,
    plan: m.plan, planExpiry: m.planExpiry,
    industry: m.industry || '', state: m.state || 'NJ',
    naics: m.naics || '561720', memberSince: m.memberSince,
    avatar: m.avatar || m.name.substring(0,2).toUpperCase(),
    isTrial: m.isTrial || false,
    ...extra
  };
}

// ── MAIN HANDLER ─────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const action = req.query.action || '';

  try {

    // ── START FREE TRIAL ────────────────────────────────
    // Usuario nuevo — no necesita email/password
    // Solo nombre e industria opcionales
    if (action === 'start_trial') {
      let name = 'Guest User', industry = '', state = 'NJ', naics = '561720';

      if (req.method === 'POST' && req.body) {
        name     = req.body.name     || 'Guest User';
        industry = req.body.industry || '';
        state    = req.body.state    || 'NJ';
        naics    = req.body.naics    || '561720';
      }

      const now   = new Date().toISOString().split('T')[0];
      const trial = {
        id:          `trial_${Date.now()}`,
        name,
        email:       `trial_${Date.now()}@trial.govbidder`,
        plan:        'Free Trial',
        planExpiry:  getTrialExpiry(now),
        industry,
        state,
        naics,
        memberSince: now,
        active:      true,
        avatar:      name.substring(0,2).toUpperCase(),
        isTrial:     true,
        trialStart:  now,
        daysLeft:    7
      };

      const token = makeToken({
        id:         trial.id,
        email:      trial.email,
        plan:       trial.plan,
        isTrial:    true,
        trialStart: now
      });

      return res.status(200).json({
        success: true,
        token,
        member: trial,
        message: 'Trial de 7 días activado. ¡Bienvenido a GovBidder Command Center!'
      });
    }

    // ── LOGIN (paid members) ────────────────────────────
    if (action === 'login') {
      let email = '', password = '';

      if (req.method === 'POST' && req.body) {
        email    = (req.body.email    || '').trim().toLowerCase();
        password = (req.body.password || '');
      } else {
        email    = (req.query.email    || '').trim().toLowerCase();
        password = (req.query.password || '');
      }

      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
      }

      const member = MEMBERS.find(m =>
        m.email.toLowerCase() === email &&
        m.password === password &&
        m.active === true
      );

      if (!member) {
        return res.status(401).json({
          success: false,
          error: 'Email o contraseña incorrectos.'
        });
      }

      if (new Date(member.planExpiry) < new Date()) {
        return res.status(403).json({
          success: false,
          error: 'Tu membresía ha expirado. Renueva en govbidderclub.com',
          expired: true
        });
      }

      const token = makeToken({
        id:      member.id,
        email:   member.email,
        plan:    member.plan,
        isTrial: false
      });

      return res.status(200).json({
        success: true,
        token,
        member: safeMember(member)
      });
    }

    // ── VERIFY TOKEN ────────────────────────────────────
    if (action === 'verify') {
      let token = '';
      if (req.method === 'POST' && req.body) token = req.body.token || '';
      else token = req.query.token || '';

      if (!token) return res.status(400).json({ success: false, error: 'Token requerido' });

      const payload = parseToken(token);
      if (!payload) return res.status(401).json({ success: false, error: 'Sesión expirada' });

      // ── Verify trial token ──
      if (payload.isTrial) {
        if (isTrialExpired(payload.trialStart)) {
          return res.status(403).json({
            success: false,
            error: 'Tu trial de 7 días ha expirado.',
            trialExpired: true,
            plans: PLANS
          });
        }
        return res.status(200).json({
          success: true,
          member: {
            id:          payload.id,
            name:        'Trial User',
            email:       payload.email,
            plan:        'Free Trial',
            planExpiry:  getTrialExpiry(payload.trialStart),
            industry:    '',
            state:       'NJ',
            naics:       '561720',
            memberSince: payload.trialStart,
            avatar:      'TU',
            isTrial:     true,
            trialStart:  payload.trialStart,
            daysLeft:    trialDaysLeft(payload.trialStart)
          }
        });
      }

      // ── Verify paid member token ──
      const member = MEMBERS.find(m => m.id === payload.id && m.active);
      if (!member) return res.status(401).json({ success: false, error: 'Miembro no encontrado' });

      if (new Date(member.planExpiry) < new Date()) {
        return res.status(403).json({
          success: false,
          error: 'Tu membresía ha expirado.',
          expired: true
        });
      }

      return res.status(200).json({ success: true, member: safeMember(member) });
    }

    // ── LOGOUT ──────────────────────────────────────────
    if (action === 'logout') {
      return res.status(200).json({ success: true });
    }

    // ── TEST ────────────────────────────────────────────
    if (action === 'test') {
      return res.status(200).json({
        success: true,
        message: 'Auth API funcionando correctamente',
        members: MEMBERS.length,
        plans: Object.keys(PLANS),
        timestamp: new Date().toISOString()
      });
    }

    return res.status(400).json({ success: false, error: `Acción inválida: ${action}` });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
