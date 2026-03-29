const MEMBERS = [
  {
    id: "001",
    name: "Santo González",
    email: "santo@govbidder.net",
    password: "GovBidder2025!",
    role: "admin",      // admin | member | user
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
    role: "member",     // miembro del club — ve Task Work y módulos exclusivos
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
    role: "user",       // usuario regular — NO ve módulos exclusivos
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
    role: m.role || 'user',
    plan: m.plan, planExpiry: m.planExpiry,
    industry: m.industry, state: m.state,
    naics: m.naics, memberSince: m.memberSince,
    avatar: m.avatar
  };
}

// ── SEND EMAIL VIA RESEND ─────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY no configurada en Vercel');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'GovBidder Club <noreply@govbidder.net>',
      to,
      subject,
      html
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error enviando email');
  return data;
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

    // ── REGISTER ─────────────────────────────────────────
    if (action === 'register') {
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
      }

      const {
        name, company, email, phone,
        state, naics, plan, message
      } = req.body || {};

      // Validaciones básicas
      if (!name || !email || !company) {
        return res.status(400).json({
          success: false,
          error: 'Nombre, empresa y email son requeridos'
        });
      }

      // Verificar que el email no esté ya registrado
      const exists = MEMBERS.find(m => m.email.toLowerCase() === email.trim().toLowerCase());
      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'Este email ya está registrado. Intenta iniciar sesión.'
        });
      }

      const submittedAt = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'full',
        timeStyle: 'short'
      });

      // ── Email a club@govbidder.net ──
      const adminHtml = `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#f4f6fb;padding:24px;">
          <div style="background:linear-gradient(135deg,#152978,#0f1e5c);border-radius:12px 12px 0 0;padding:24px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🦅</div>
            <div style="color:#fff;font-size:20px;font-weight:900;">GOV<span style="color:#E42D2C;">BIDDER</span> CLUB</div>
            <div style="color:rgba(255,255,255,.6);font-size:11px;letter-spacing:2px;margin-top:4px;">NUEVA SOLICITUD DE MEMBRESÍA</div>
          </div>
          <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;border:1px solid #e2e6f0;border-top:none;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td colspan="2" style="padding:0 0 14px;"><div style="background:#eef2ff;border-left:4px solid #E42D2C;border-radius:6px;padding:10px 14px;font-size:13px;font-weight:700;color:#152978;">📋 Datos del Solicitante</div></td></tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;width:140px;">NOMBRE</td>
                <td style="padding:10px 8px;font-size:13px;color:#1a1f36;font-weight:600;">${name}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;">EMPRESA</td>
                <td style="padding:10px 8px;font-size:13px;color:#1a1f36;font-weight:600;">${company}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;">EMAIL</td>
                <td style="padding:10px 8px;font-size:13px;color:#E42D2C;font-weight:600;">${email}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;">TELÉFONO</td>
                <td style="padding:10px 8px;font-size:13px;color:#1a1f36;">${phone || 'No proporcionado'}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;">ESTADO</td>
                <td style="padding:10px 8px;font-size:13px;color:#1a1f36;">${state || 'No especificado'}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;">NAICS</td>
                <td style="padding:10px 8px;font-size:13px;color:#1a1f36;">${naics || 'No especificado'}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;">PLAN SOLICITADO</td>
                <td style="padding:10px 8px;">
                  <span style="background:${plan==='Elevate'?'#fee2e2':plan==='Prime'?'#dbeafe':'#fef3c7'};color:${plan==='Elevate'?'#b91c1c':plan==='Prime'?'#1d4ed8':'#92400e'};font-size:11px;font-weight:800;padding:3px 12px;border-radius:10px;">${plan || 'No especificado'}</span>
                </td>
              </tr>
              ${message ? `<tr><td style="padding:10px 8px;font-size:11px;color:#6b7a99;font-weight:700;vertical-align:top;">MENSAJE</td><td style="padding:10px 8px;font-size:12px;color:#374151;line-height:1.6;">${message}</td></tr>` : ''}
            </table>

            <div style="margin-top:20px;background:#f8f9fc;border-radius:8px;padding:14px;font-size:11px;color:#6b7a99;">
              📅 Solicitud recibida: <strong>${submittedAt} EST</strong>
            </div>

            <div style="margin-top:16px;padding:14px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;font-size:12px;color:#b91c1c;font-weight:600;">
              ⚡ Acción requerida: Agrega manualmente al miembro en <code>api/auth.js</code> para activar su acceso.
            </div>
          </div>
        </div>
      `;

      // ── Email de confirmación al solicitante ──
      const userHtml = `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#f4f6fb;padding:24px;">
          <div style="background:linear-gradient(135deg,#0a0c14,#0f1e5c);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
            <div style="font-size:40px;margin-bottom:10px;">🦅</div>
            <div style="color:#fff;font-size:22px;font-weight:900;">GOV<span style="color:#E42D2C;">BIDDER</span> CLUB</div>
            <div style="color:rgba(255,255,255,.5);font-size:10px;letter-spacing:3px;margin-top:4px;">COMMAND CENTER</div>
          </div>
          <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;border:1px solid #e2e6f0;border-top:none;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">⏳</div>
            <div style="font-size:18px;font-weight:800;color:#1a1f36;margin-bottom:8px;">¡Solicitud Recibida!</div>
            <div style="font-size:13px;color:#6b7a99;line-height:1.7;margin-bottom:20px;">
              Hola <strong>${name}</strong>, hemos recibido tu solicitud para unirte a <strong>GovBidder Club</strong>.<br>
              Nuestro equipo la revisará y te contactará en las próximas <strong>24–48 horas</strong>.
            </div>
            <div style="background:#eef2ff;border-radius:10px;padding:16px;margin-bottom:20px;text-align:left;">
              <div style="font-size:10px;font-weight:700;color:#6b7a99;letter-spacing:1px;margin-bottom:10px;">TU SOLICITUD</div>
              <div style="font-size:12px;color:#374151;line-height:2;">
                📛 <strong>${name}</strong> — ${company}<br>
                📧 ${email}<br>
                🗺️ ${state || '—'} · NAICS ${naics || '—'}<br>
                ⭐ Plan solicitado: <strong>${plan || '—'}</strong>
              </div>
            </div>
            <a href="https://www.govbidderclub.com" style="display:inline-block;background:linear-gradient(135deg,#E42D2C,#a01e1d);color:#fff;padding:12px 28px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">Visitar GovBidder Club →</a>
            <div style="margin-top:20px;font-size:11px;color:#6b7a99;">
              ¿Preguntas? Escríbenos a <a href="mailto:club@govbidder.net" style="color:#E42D2C;">club@govbidder.net</a>
            </div>
          </div>
        </div>
      `;

      // Enviar ambos emails
      await sendEmail({
        to: 'club@govbidder.net',
        subject: `🦅 Nueva Solicitud de Membresía — ${name} (${company})`,
        html: adminHtml
      });

      await sendEmail({
        to: email.trim(),
        subject: '✅ GovBidder Club — Solicitud recibida, en revisión',
        html: userHtml
      });

      return res.status(200).json({
        success: true,
        message: 'Solicitud enviada. Revisaremos tu información en 24-48 horas.'
      });
    }

    // ── ALLIANCE APPLICATION ─────────────────────────────────
    if (action === 'alliance') {
      if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método no permitido' });

      const { name, company, po, cost, status, desc, memberEmail, memberPlan, apoyo, neta } = req.body || {};

      if (!name || !company || !po || !cost || !status || !desc) {
        return res.status(400).json({ success: false, error: 'Todos los campos son requeridos' });
      }

      const submittedAt = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short'
      });

      const html = `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#f4f6fb;padding:24px;">
          <div style="background:linear-gradient(135deg,#152978,#0f1e5c);border-radius:12px 12px 0 0;padding:24px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🤝</div>
            <div style="color:#fff;font-size:20px;font-weight:900;">GOV<span style="color:#E42D2C;">BIDDER</span> ALLIANCE</div>
            <div style="color:rgba(255,255,255,.6);font-size:11px;letter-spacing:2px;margin-top:4px;">NUEVA SOLICITUD DE FONDOS</div>
          </div>
          <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;border:1px solid #e2e6f0;border-top:none;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td colspan="2" style="padding:0 0 14px;">
                <div style="background:#eef2ff;border-left:4px solid #E42D2C;border-radius:6px;padding:10px 14px;font-size:13px;font-weight:700;color:#152978;">📋 Datos del Solicitante</div>
              </td></tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;width:160px;">NOMBRE</td>
                <td style="padding:9px 8px;font-size:13px;color:#1a1f36;font-weight:600;">${name}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">EMPRESA</td>
                <td style="padding:9px 8px;font-size:13px;color:#1a1f36;font-weight:600;">${company}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">EMAIL MIEMBRO</td>
                <td style="padding:9px 8px;font-size:13px;color:#E42D2C;font-weight:600;">${memberEmail}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">PLAN</td>
                <td style="padding:9px 8px;">
                  <span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:800;padding:2px 10px;border-radius:10px;">${memberPlan}</span>
                </td>
              </tr>
              <tr><td colspan="2" style="padding:14px 0 10px;">
                <div style="background:#eef2ff;border-left:4px solid #152978;border-radius:6px;padding:10px 14px;font-size:13px;font-weight:700;color:#152978;">💰 Detalles del Contrato</div>
              </td></tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">VALOR PO</td>
                <td style="padding:9px 8px;font-size:15px;font-weight:900;color:#1a1f36;">$${Number(po).toLocaleString()}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">COSTO PRODUCTOS</td>
                <td style="padding:9px 8px;font-size:15px;font-weight:900;color:#1a1f36;">$${Number(cost).toLocaleString()}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">GOVBIDDER APORTA</td>
                <td style="padding:9px 8px;font-size:14px;font-weight:800;color:#152978;">$${apoyo}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">UTILIDAD NETA</td>
                <td style="padding:9px 8px;font-size:14px;font-weight:800;color:#16a34a;">$${neta}</td>
              </tr>
              <tr style="border-bottom:1px solid #f4f6fb;">
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;">ESTADO</td>
                <td style="padding:9px 8px;font-size:12px;font-weight:700;color:#1a1f36;">${status}</td>
              </tr>
              <tr>
                <td style="padding:9px 8px;font-size:11px;color:#6b7a99;font-weight:700;vertical-align:top;">DESCRIPCIÓN</td>
                <td style="padding:9px 8px;font-size:12px;color:#374151;line-height:1.6;">${desc}</td>
              </tr>
            </table>
            <div style="margin-top:16px;background:#f8f9fc;border-radius:8px;padding:12px;font-size:11px;color:#6b7a99;">
              📅 Solicitud recibida: <strong>${submittedAt} EST</strong>
            </div>
            <div style="margin-top:12px;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:12px;font-size:12px;color:#b91c1c;font-weight:600;">
              ⚡ Acción requerida: Revisar elegibilidad del miembro y contactar en 24-48 horas.
            </div>
          </div>
        </div>`;

      await sendEmail({
        to: 'club@govbidder.net',
        subject: `🤝 Solicitud Alliance — ${name} (${company}) · PO: $${Number(po).toLocaleString()}`,
        html
      });

      return res.status(200).json({ success: true, message: 'Solicitud enviada correctamente.' });
    }

    // ── TEST ─────────────────────────────────────────────
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
