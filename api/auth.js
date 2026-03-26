
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
    avatar: "SG"
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
    avatar: "DM"
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
    avatar: "TE"
  }
];

function makeToken(member) {
  const payload = {
    id: member.id,
    email: member.email,
    plan: member.plan,
    exp: Date.now() + 86400000 // 24h
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function parseToken(token) {
  try {
    const p = JSON.parse(Buffer.from(token, 'base64').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

function safeMember(m) {
  return {
    id: m.id, name: m.name, email: m.email,
    plan: m.plan, planExpiry: m.planExpiry,
    industry: m.industry, state: m.state,
    naics: m.naics, memberSince: m.memberSince,
    avatar: m.avatar
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const action = req.query.action || req.query.type || '';

  try {

    // ── LOGIN ───────────────────────────────────────────
    if (action === 'login') {
      // Acepta body tanto de POST como query params (fallback)
      let email = '', password = '';

      if (req.method === 'POST' && req.body) {
        email    = (req.body.email    || '').trim().toLowerCase();
        password = (req.body.password || '');
      } else {
        email    = ((req.query.email    || '')).trim().toLowerCase();
        password =  (req.query.password || '');
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
          error: 'Email o contraseña incorrectos. Verifica tus credenciales de GovBidder Club.'
        });
      }

      if (new Date(member.planExpiry) < new Date()) {
        return res.status(403).json({
          success: false,
          error: 'Tu membresía ha expirado. Renueva en govbidderclub.com'
        });
      }

      return res.status(200).json({
        success: true,
        token: makeToken(member),
        member: safeMember(member)
      });
    }

    // ── VERIFY ──────────────────────────────────────────
    if (action === 'verify') {
      let token = '';
      if (req.method === 'POST' && req.body) {
        token = req.body.token || '';
      } else {
        token = req.query.token || '';
      }

      if (!token) {
        return res.status(400).json({ success: false, error: 'Token requerido' });
      }

      const payload = parseToken(token);
      if (!payload) {
        return res.status(401).json({ success: false, error: 'Sesión expirada' });
      }

      const member = MEMBERS.find(m => m.id === payload.id && m.active);
      if (!member) {
        return res.status(401).json({ success: false, error: 'Miembro no encontrado' });
      }

      return res.status(200).json({ success: true, member: safeMember(member) });
    }

    // ── LOGOUT ──────────────────────────────────────────
    if (action === 'logout') {
      return res.status(200).json({ success: true });
    }

    // ── TEST — para verificar que el endpoint funciona ──
    if (action === 'test') {
      return res.status(200).json({
        success: true,
        message: 'Auth API funcionando correctamente',
        members: MEMBERS.length,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(400).json({ success: false, error: `Acción inválida: ${action}` });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
