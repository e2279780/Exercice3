// Chargement des variables d'environnement
require('dotenv').config();

const express = require('express');
const knex = require('knex');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const SECRET_KEY = process.env.SECRET_KEY || 'ma-cle-tres-secrete';

// Initialisation de la connexion à la base de données SQLite3
const db = knex({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite3',
  },
  useNullAsDefault: true,
});

const app = express();
app.use(express.json());

// Middleware de vérification du token d'authentification
function verifyToken(req, res, next) {
  const headerAuth = req.headers['authorization'];
  if (!headerAuth) {
    return res.status(401).json({ message: 'Token manquant.' });
  }
  // Extraction du token (format : Bearer token)
  const token = headerAuth.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token manquant.' });
  }
  jwt.verify(token, SECRET_KEY, (err, decodedToken) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide ou expiré.' });
    }
    req.user = decodedToken;
    next();
  });
}

// Middleware d'autorisation pour les administrateurs
function authorisationAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Accès refusé. Seuls les administrateurs peuvent effectuer cette action'
    });
  }
  next();
}

// --- VALIDATEURS ---

// Création d'un administrateur
const createAdmin = [
  body('username')
    .notEmpty().withMessage('Le nom d\'utilisateur est requis'),
  body('email')
    .isEmail().withMessage("L'adresse email n'est pas valide")
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
];

// Authentification d'un administrateur
const adminLogin = [
  body('username')
    .notEmpty().withMessage('Le nom d\'utilisateur est requis'),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
];

// Création d'un utilisateur (ou technicien)
const createUser = [
  body('username')
    .notEmpty().withMessage('Le nom d\'utilisateur est requis'),
  body('email')
    .isEmail().withMessage('L\'adresse email n\'est pas valide')
    .notEmpty().withMessage('L\'adresse email est requis')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis'),
  body('role')
    .isIn(['user', 'technician']).withMessage('Le rôle doit être "user" ou "technician"')
];

// Authentification d'un utilisateur/technicien
const userLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Le nom d\'utilisateur est requis'),
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
];

// Création d'un ticket
const createTicket = [
  body('title')
    .notEmpty().withMessage('Le titre est requis'),
  body('description')
    .notEmpty().withMessage('La description est requise'),
  body('status')
    .optional()
    .isIn(['open', 'in progress', 'closed']).withMessage('Statut invalide'),
  body('userId')
    .isInt({ min: 1 }).withMessage('ID utilisateur invalide')
    .custom(async (value) => {
      const userFound = await db('users').where('id', value).first();
      if (!userFound) throw new Error('Utilisateur non trouvé');
      return true;
    }),
  body('technicianId')
    .optional()
    .isInt({ min: 1 }).withMessage('ID technicien invalide')
    .custom(async (value) => {
      if (value) {
        const techFound = await db('users').where({ id: value, role: 'technician' }).first();
        if (!techFound) throw new Error('Technicien non trouvé');
      }
      return true;
    }).default(null),
  body('createdAt')
    .optional()
    .isISO8601().withMessage('Format de date invalide (YYYY-MM-DDTHH:MM:SSZ)')
    .toDate(),
  body('closedAt')
    .optional()
    .isISO8601().withMessage('Format de date invalide')
    .custom((value, { req }) => {
      if (value && !req.body.createdAt) {
        throw new Error('createdAt est requis quand closedAt est spécifié');
      }
      if (value && new Date(value) <= new Date(req.body.createdAt)) {
        throw new Error('closedAt doit être après createdAt');
      }
      if (value && req.body.status !== 'closed') {
        throw new Error('Le statut doit être "closed" quand closedAt est spécifié');
      }
      return true;
    }).default(null)
];

// Mise à jour d'un ticket existant
const updateTicket = [
  body('title')
    .notEmpty().withMessage('Le titre ne peut pas être vide'),
  body('description')
    .notEmpty().withMessage('La description ne peut pas être vide'),
  body('status')
    .optional()
    .isIn(['open', 'in progress', 'closed']).withMessage('Statut invalide'),
  body('technicianId')
    .optional()
    .isInt({ min: 1 }).withMessage('ID technicien invalide'),
  body('closedAt')
    .optional()
    .isISO8601().withMessage('Format de date invalide')
    .custom((value, { req }) => {
      if (value && req.body.status !== 'closed') {
        throw new Error('Le statut doit être "closed" quand closedAt est spécifié');
      }
      return true;
    })
];

// --- ROUTES ---

// Création d'un administrateur
app.post('/api/auth/create-admin', createAdmin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { username, email, password } = req.body;
    const adminExiste = await db('users')
      .where({ username })
      .orWhere({ email })
      .first();
    if (adminExiste) {
      return res.status(400).json({ error: 'Un admin avec ce nom ou email existe déjà' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [adminId] = await db('users').insert({
      username,
      email,
      password: hash,
      role: 'admin'
    });
    res.status(201).json({
      message: 'Administrateur créé avec succès',
      adminId
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création de l\'admin' });
  }
});

// Authentification d'un administrateur
app.post('/api/auth/admin', adminLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { username, password } = req.body;
    const admin = await db('users')
      .where({ username, role: 'admin' })
      .first();
    if (!admin) return res.status(401).json({ error: 'Administrateur non trouvé' });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Mot de passe incorrect"
      });
    }
    const token = jwt.sign({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      email: admin.email
    }, SECRET_KEY, { expiresIn: '1h' });
    res.json({
      id: admin.id,
      message: 'Administrateur connecté avec succès',
      token
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Création d'un utilisateur ou technicien
app.post('/api/auth/new', createUser, verifyToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { username, email, password, role } = req.body;
    const userExiste = await db('users')
      .where({ username })
      .orWhere({ email })
      .first();
    if (userExiste) {
      return res.status(409).json({
        success: false,
        error: 'Un utilisateur avec ce username ou email existe déjà'
      });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const [userId] = await db('users').insert({
      username,
      email,
      password: passwordHash,
      role
    });
    res.status(201).json({
      success: true,
      message: `${role} créé avec succès`,
      user: { id: userId, username, email, role }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Authentification d'un utilisateur/technicien
app.post('/api/auth/login', userLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { username, password } = req.body;
    const user = await db('users')
      .where({ username })
      .whereIn('role', ['user', 'technician'])
      .first();
    if (!user) return res.status(401).json({ error: "Utilisateur non trouvé" });
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Mot de passe incorrect'
      });
    }
    const token = jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email
    }, SECRET_KEY, { expiresIn: '1h' });
    res.json({
      id: user.id,
      message: 'Utilisateur/technicien connecté avec succès',
      token
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Création d'un ticket
app.post('/api/tickets', createTicket, verifyToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const ticketData = {
      title: req.body.title,
      description: req.body.description,
      status: req.body.status || 'open',
      userId: req.body.userId,
      technicianId: req.body.technicianId || null,
      createdAt: req.body.createdAt || new Date(),
      closedAt: req.body.closedAt || null
    };
    // Si closedAt est fourni, forcer le statut à "closed"
    if (ticketData.closedAt && ticketData.status !== 'closed') {
      ticketData.status = 'closed';
    }
    const [ticketId] = await db('tickets').insert(ticketData);
    res.status(201).json({
      success: true,
      message: 'Ticket créé avec succès',
      ticket: {
        id: ticketId,
        ...ticketData,
        createdAt: new Date(ticketData.createdAt).toISOString(),
        closedAt: ticketData.closedAt ? new Date(ticketData.closedAt).toISOString() : null
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la création du ticket'
    });
  }
});

// Récupération de la liste des tickets
app.get('/api/tickets', verifyToken, async (req, res) => {
  try {
    let tickets;
    if (req.user.role === 'technician') {
      tickets = await db('tickets');
    } else if (req.user.role === 'user') {
      tickets = await db('tickets').where('userId', req.user.id);
    } else {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupération des détails d'un ticket
app.get('/api/tickets/:id', verifyToken, async (req, res) => {
  const ticketId = parseInt(req.params.id);
  if (isNaN(ticketId)) return res.status(400).json({ error: 'ID de ticket invalide' });
  try {
    const ticket = await db('tickets').where({ id: ticketId }).first();
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });
    if (req.user.role === 'user' && ticket.userId !== req.user.id) {
      return res.status(403).json({ error: 'Accès interdit à ce ticket' });
    }
    // Le technicien et l'utilisateur propriétaire du ticket peuvent y accéder
    if (req.user.role === 'technician' || ticket.userId === req.user.id) {
      return res.json({ success: true, ticket });
    }
    return res.status(403).json({ error: 'Accès non autorisé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mise à jour d'un ticket (accès réservé aux techniciens)
app.put('/api/tickets/:id', verifyToken, updateTicket, async (req, res) => {
  if (req.user.role !== 'technician') {
    return res.status(403).json({ error: 'Seuls les techniciens peuvent mettre à jour un ticket.' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const ticketId = parseInt(req.params.id);
  if (isNaN(ticketId)) return res.status(400).json({ error: 'ID de ticket invalide.' });
  try {
    const ticket = await db('tickets').where({ id: ticketId }).first();
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé.' });
    const { title, description, status, technicianId, closedAt } = req.body;
    const updateData = {
      title,
      description,
      status,
      technicianId,
      closedAt: status === 'closed' ? closedAt : null
    };
    await db('tickets').where({ id: ticketId }).update(updateData);
    const updatedTicket = await db('tickets').where({ id: ticketId }).first();
    res.json({ success: true, ticket: updatedTicket });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Suppression d'un ticket (réservé aux administrateurs)
app.delete('/api/admin/tickets/:id', verifyToken, authorisationAdmin, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = await db('tickets').where('id', ticketId).first();
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket non trouvé'
      });
    }
    await db('tickets').where('id', ticketId).delete();
    res.json({
      success: true,
      message: 'Ticket supprimé avec succès',
      deletedTicket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la suppression du ticket'
    });
  }
});

// Démarrage du serveur
const port = 3000;
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
