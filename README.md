# 🚀 RentEdge – End-to-End AWS CI/CD Deployment

## 📌 Project Overview

RentEdge is a property management platform that enables landlords and tenants to manage properties, payments, and tenant interactions.

This project demonstrates a **production-style deployment** of RentEdge using AWS services with a fully automated **CI/CD pipeline**.

---

## 🧰 Tech Stack

* **Frontend & Backend**: Node.js, Express.js
* **Database**: PostgreSQL
* **ORM**: Drizzle ORM
* **Process Manager**: PM2
* **Cloud**: AWS (EC2, S3, IAM, CodeBuild, CodeDeploy, CodePipeline)
* **CI/CD**: GitHub + AWS CodePipeline

---

## 🏗️ Architecture

```
Developer (GitHub - CICD Branch)
        ↓
CodePipeline (Orchestration)
        ↓
CodeBuild (Build & Package)
        ↓
S3 (Artifacts Storage)
        ↓
CodeDeploy (Deployment)
        ↓
EC2 Instance (Node.js + PM2)
        ↓
PostgreSQL Database
```

---

## ☁️ Infrastructure Setup (CloudFormation)

We used AWS CloudFormation to provision:

* Custom VPC
* Public Subnet
* Internet Gateway
* Route Table
* EC2 Instance
* IAM Roles
* S3 Bucket
* CodeBuild Project
* CodeDeploy Application & Deployment Group

### Key Components

* **VPC CIDR**: 10.0.0.0/16
* **Public Subnet**: 10.0.1.0/24
* **Ports Open**:

  * 22 (SSH)
  * 5000 (Application)

---

## 🖥️ EC2 Setup (User Data Script)

```bash
#!/bin/bash
apt update -y
apt install -y ruby wget nodejs npm git

# Install CodeDeploy Agent
cd /home/ubuntu
wget https://aws-codedeploy-ap-south-1.s3.ap-south-1.amazonaws.com/latest/install
chmod +x install
./install auto
service codedeploy-agent start
```

---

## 📦 Application Deployment (Manual Phase)

### 1. Connect to EC2

```bash
ssh -i key.pem ubuntu@<EC2-IP>
```

### 2. Clone Repository

```bash
git clone https://github.com/suyash700/Rent_Edge.git
cd Rent_Edge
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Setup PostgreSQL

```bash
sudo -u postgres psql
CREATE DATABASE rentedge;
\q
```

### 5. Configure Environment Variables

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/rentedge
PORT=5000
```

### 6. Run Migration

```bash
npx drizzle-kit push
```

### 7. Build & Run App

```bash
npm run build
node -r dotenv/config dist/index.cjs
```

### 8. Run with PM2

```bash
pm2 start "node -r dotenv/config dist/index.cjs" --name rentedge
pm2 save
pm2 startup
```

---

## ⚙️ CI/CD Setup

### 🔹 1. CodeBuild

* Source: GitHub (CICD branch)
* Buildspec: `buildspec.yml`
* Output: S3 artifact

---

### 🔹 2. CodeDeploy

* Deployment Type: In-place
* Deployment Group: EC2 (tag-based)

#### appspec.yml

```yaml
version: 0.0
os: linux

files:
  - source: /
    destination: /home/ubuntu/rentedge

hooks:
  AfterInstall:
    - location: scripts/permissions.sh
      runas: root

  ApplicationStart:
    - location: scripts/start.sh
      runas: ubuntu
```

---

### 🔹 3. Deployment Scripts

#### permissions.sh

```bash
#!/bin/bash
chown -R ubuntu:ubuntu /home/ubuntu/rentedge
```

#### start.sh

```bash
#!/bin/bash
cd /home/ubuntu/rentedge

npm install
npm run build
npx drizzle-kit push || true

pm2 delete all || true
pm2 start "node -r dotenv/config dist/index.cjs" --name rentedge
pm2 save
```

---

### 🔹 4. CodePipeline

Pipeline Stages:

1. **Source** → GitHub (CICD branch)
2. **Build** → CodeBuild
3. **Deploy** → CodeDeploy

---

## 🔁 CI/CD Flow

```
git push → CodePipeline triggered
        → CodeBuild runs
        → Artifact stored in S3
        → CodeDeploy deploys to EC2
        → App restarts via PM2
```

---

## 🌐 Access Application

```
http://<EC2-PUBLIC-IP>:5000
```

---

## 🧪 Troubleshooting

### ❌ App not running

```bash
pm2 logs rentedge
```

### ❌ Port issue

* Check Security Group (port 5000 open)

### ❌ DB error

```bash
npx drizzle-kit push
```

---

## 🔐 Improvements (Future Work)

* Use **Elastic IP** for static access
* Configure **Nginx + HTTPS (Let's Encrypt)**
* Move DB to **AWS RDS**
* Add **Docker & ECS deployment**
* Implement **Auto Scaling + Load Balancer**

---

## 🎯 Conclusion

This project demonstrates:

* Infrastructure as Code (CloudFormation)
* Automated CI/CD pipeline using AWS
* Zero manual deployment workflow
* Production-ready architecture

---

## 📎 Repository

https://github.com/suyash700/Rent_Edge

---
