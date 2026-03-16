# Rent_Edge

# RentEdge – Deployment Guide (AWS EC2)

This document describes the complete process used to deploy the **RentEdge application** on an **AWS EC2 Ubuntu server** using **Node.js, PostgreSQL, Drizzle ORM, and PM2**.

---

# Project Overview

RentEdge is a property management platform where landlords and tenants can manage rental properties, payments, and tenant information.

The application was deployed on **AWS EC2** with a **PostgreSQL database** and managed using **PM2** for production.

---

# Tech Stack

* Node.js
* Express.js
* PostgreSQL
* Drizzle ORM
* PM2 (Process Manager)
* AWS EC2
* Ubuntu Linux
* GitHub

---

# Deployment Architecture

```
User Browser
     ↓
AWS EC2 Instance
     ↓
PM2 (Process Manager)
     ↓
Node.js Express Server
     ↓
PostgreSQL Database
```

---

# 1. Launch EC2 Instance

Go to **AWS Console → EC2 → Launch Instance**

Configuration used:

* AMI: Ubuntu Server 24.04
* Instance Type: t2.large
* Key Pair: Existing SSH key
* Storage: Default
* Security Group Rules:

| Type       | Port |
| ---------- | ---- |
| SSH        | 22   |
| HTTP       | 80   |
| Custom TCP | 5000 |

---

# 2. EC2 User Data Script (Automated Setup)

During instance launch, a **User Data script** was used to automatically configure the environment.

```
#!/bin/bash

sudo apt update -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Install PM2 globally
sudo npm install -g pm2
```

This script prepares the server with:

* Node.js runtime
* Git
* PostgreSQL database
* PM2 process manager

---

# 3. Connect to EC2

```
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP
```

Example:

```
ssh -i rentedge.pem ubuntu@13.xxx.xxx.xxx
```

---

# 4. Clone GitHub Repository

```
git clone https://github.com/suyash700/Rent_Edge.git
cd Rent_Edge
```

---

# 5. Install Project Dependencies

```
npm install
```

---

# 6. Configure PostgreSQL Database

Open PostgreSQL shell:

```
sudo -u postgres psql
```

Create the application database:

```
CREATE DATABASE rentedge;
```

Exit PostgreSQL:

```
\q
```

---

# 7. Configure Environment Variables

Create `.env` file:

```
nano .env
```

Add:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/rentedge
PORT=5000
```

Save file.

---

# 8. Run Database Migration (Drizzle)

```
npx drizzle-kit push
```

This command creates all database tables from the schema.

---

# 9. Build the Application

```
npm run build
```

This compiles the frontend and backend for production.

---

# 10. Start Application

```
node -r dotenv/config dist/index.cjs
```

Server runs on:

```
http://EC2_PUBLIC_IP:5000
```

---

# 11. Run Application with PM2 (Production Mode)

Install PM2 globally:

```
sudo npm install -g pm2
```

Start application:

```
pm2 start "node -r dotenv/config dist/index.cjs" --name rentedge
```

Save PM2 process:

```
pm2 save
```

Enable PM2 auto-start on server reboot:

```
pm2 startup
```

---

# 12. Verify Application

Check running processes:

```
pm2 list
```

View logs:

```
pm2 logs rentedge
```

Monitor processes:

```
pm2 monit
```

---

# 13. Access the Application

Open in browser:

```
http://EC2_PUBLIC_IP:5000
```

Example:

```
http://13.xxx.xxx.xxx:5000
```

---

# Security Group Configuration

Ensure the EC2 security group allows:

| Type       | Port |
| ---------- | ---- |
| SSH        | 22   |
| Custom TCP | 5000 |

Source:

```
0.0.0.0/0
```

---

# Future Improvements

Production improvements that can be implemented:

* Configure **Nginx Reverse Proxy**
* Add **HTTPS using Let's Encrypt**
* Setup **CI/CD using GitHub Actions**
* Containerize application using **Docker**
* Deploy database using **AWS RDS**

---

# Repository

GitHub:

```
https://github.com/suyash700/Rent_Edge
```



---


