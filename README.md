# 🧠 Kalki Env – Full Stack Docker Dev Environment

A complete local development environment powered by **Docker Compose**, featuring:

- **Node.js (Express + Mongoose)** with hot-reload
- **PHP (Apache)** with MySQL and Adminer
- **MongoDB** with Mongo Express
- **phpMyAdmin**
- **Nginx reverse proxy** for clean hostnames
- **.env control** to toggle services on/off

---

## 🚀 Features

| Service | Port | Hostname | Description |
|----------|------|-----------|--------------|
| Node.js | 3000 | [node.kalkix.localhost](http://node.kalkix.localhost) | Node app (Express + Mongoose) |
| PHP | 8080 | [php.kalkix.localhost](http://php.kalkix.localhost) | PHP + Apache |
| MySQL | 3306 | — | Relational DB |
| MongoDB | 27017 | — | NoSQL DB |
| phpMyAdmin | 8081 | [phpmyadmin.localhost](http://phpmyadmin.localhost) | MySQL web UI |
| Adminer | 8083 | [adminer.localhost](http://adminer.localhost) | Lightweight DB UI |
| Mongo Express | 8082 | [mongo.localhost](http://mongo.localhost) | Mongo web UI |
| Nginx | 80 | — | Routes all hostnames |

---

## 🧩 Folder Structure

Kalki Env/
├── nodejs/ # Node.js app (index.js, package.json)
├── php/ # PHP app (index.php, etc.)
├── nginx.conf # Nginx routing config
├── php.Dockerfile # PHP image with mysqli, pdo_mysql
├── docker-compose.yml # Main stack definition
├── .env # All config/ports/credentials
├── compose.sh # Script for enabling/disabling services
└── README.md


---

## ⚙️ Setup Instructions

### 1️⃣ Install Requirements

- Docker Desktop

---

### 2️⃣ Configure `.env`

Edit `.env` to match your environment and control what runs:



