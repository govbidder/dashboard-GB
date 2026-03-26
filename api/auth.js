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

// ── SIMPLE TOKEN GENERATOR ────────────────────────────────
function generateToken(member) {
  const payload = {
    id: member.id,
    email: member.email,
    plan: member.plan,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  // Simple base64 encoding (for MVP — use proper JWT in production)
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action } = req.query;

  // ── LOGIN ─────────────────────────────────────────────
  if (action === 'login' && req.method === 'POST') {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    }

    const member = MEMBERS.find(m =>
      m.email.toLowerCase() === email.toLowerCase() &&
      m.password === password &&
      m.active
    );

    if (!member) {
      return res.status(401).json({
        success: false,
        error: 'Email o contraseña incorrectos. Verifica tus credenciales de GovBidder Club.'
      });
    }

    // Check plan expiry
    if (new Date(member.planExpiry) < new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Tu membresía ha expirado. Renueva en govbidderclub.com'
      });
    }

    const token = generateToken(member);

    return res.status(200).json({
      success: true,
      token,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        plan: member.plan,
        planExpiry: member.planExpiry,
        industry: member.industry,
        state: member.state,
        naics: member.naics,
        memberSince: member.memberSince,
        avatar: member.avatar
      }
    });
  }

  // ── VERIFY TOKEN ──────────────────────────────────────
  if (action === 'verify' && req.method === 'POST') {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Token requerido' });

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Sesión expirada. Por favor inicia sesión.' });
    }

    const member = MEMBERS.find(m => m.id === payload.id && m.active);
    if (!member) {
      return res.status(401).json({ success: false, error: 'Miembro no encontrado o inactivo.' });
    }

    return res.status(200).json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        plan: member.plan,
        planExpiry: member.planExpiry,
        industry: member.industry,
        state: member.state,
        naics: member.naics,
        memberSince: member.memberSince,
        avatar: member.avatar
      }
    });
  }

  // ── LOGOUT ────────────────────────────────────────────
  if (action === 'logout') {
    return res.status(200).json({ success: true, message: 'Sesión cerrada' });
  }

  return res.status(400).json({ success: false, error: 'Acción inválida' });
}
