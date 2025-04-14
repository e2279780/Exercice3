#  But du projet

Cet exercice consiste à développer une API REST qui permet à des utilisateurs de soumettre des tickets de support technique. L'API gère plusieurs types d'utilisateurs : administrateur, utilisateur standard et technicien.

---

##  Fonctionnalités

- Création d’un administrateur
- Connexion d’un administrateur
- Création d’un utilisateur ou technicien
- Connexion d’un utilisateur ou technicien
- Création de tickets
- Récupération de tous les tickets ou d’un ticket par son ID
- Mise à jour d’un ticket (technicien seulement)
- Suppression d’un ticket (admin seulement)
- Création de la base de données SQLite

---

## 🧩 Extensions et dépendances nécessaires

Il faut avoir les éléments suivants installés :

- Node.js
- Express
- SQLite3
- Knex
- bcrypt
- jsonwebtoken
- express-validator
- **REST Client** (extension Visual Studio Code pour tester les requêtes HTTP)

---

## Installation des dépendances

Dans le terminal, tapez la commande suivante pour installer tous les modules nécessaires :

```bash
npm install express sqlite3 knex bcrypt jsonwebtoken express-validator
Installation de l’extension REST Client
Dans Visual Studio Code :

Ouvrir l’onglet des extensions (Ctrl+Shift+X)

Rechercher REST Client

Installer l’extension (icône d’un nuage avec flèche)

🛠 Fichier db.js
Ce fichier est utilisé pour créer la base de données SQLite contenant les tables users et tickets.

Pour exécuter la création de la base :

bash
Copier
Modifier
node creation_db.js
 Fichier app.js
Ce fichier contient toutes les fonctionnalités de l'API (routes, logique métier, gestion JWT, etc.).

Pour lancer le serveur :

bash
Copier
Modifier
node app.js
Le serveur démarre sur http://localhost:3000.

 Fichier requests.http
Ce fichier est utilisé pour tester les requêtes HTTP avec l’extension REST Client. Il contient des exemples pour :

Créer un admin

Créer des utilisateurs / techniciens

Se connecter

Créer / consulter / modifier / supprimer des tickets

Fichier db.sqlite3
Ce fichier est généré automatiquement après l’exécution de creation_db.js. Il contient les données persistantes de l’application :

Table users

Table tickets
