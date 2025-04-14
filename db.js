// Connexion à la base de données SQLite avec Knex et création des tables
const db = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite3',
  },
  useNullAsDefault: true,
});

async function creerTables() {
  try {
    // Création de la table "users" si elle n'existe pas déjà
    const existsUsers = await db.schema.hasTable('users');
    if (!existsUsers) {
      await db.schema.createTable('users', (table) => {
        table.increments('id').primary();
        table.string('username').notNullable().unique();
        table.string('email').notNullable().unique();
        table.string('password').notNullable();
        table.string('role').defaultTo('user').notNullable();
      });
      console.log("Table 'users' créée.");
    } else {
      console.log("La table 'users' existe déjà.");
    }

    // Création de la table "tickets" si elle n'existe pas déjà
    const existsTickets = await db.schema.hasTable('tickets');
    if (!existsTickets) {
      await db.schema.createTable('tickets', (table) => {
        table.increments('id').primary();
        table.string('title').notNullable();
        table.string('description').notNullable();
        // Même remarque pour le status : on utilise une chaîne de caractères pour la validation au niveau de l'application.
        table.string('status').defaultTo('open').notNullable();
        table.integer('userId').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.integer('technicianId').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        table.timestamp('createdAt').defaultTo(db.fn.now()).notNullable();
        table.timestamp('closedAt').nullable();
      });
      console.log("Table 'tickets' créée.");
    } else {
      console.log("La table 'tickets' existe déjà.");
    }
  } catch (erreur) {
    console.error('Erreur lors de la création des tables :', erreur);
  } finally {
    // Fermeture de la connexion une fois les opérations terminées
    await db.destroy();
  }
}

creerTables();
