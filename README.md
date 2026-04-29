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

  <img width="1919" height="918" alt="Screenshot 2026-04-23 192721" src="https://github.com/user-attachments/assets/74dc219c-c46b-4c59-bb33-b950323be92d" />

<img width="1704" height="965" alt="Screenshot 2026-04-23 192830" src="https://github.com/user-attachments/assets/0e406271-5993-4935-b360-4faa82a2ddc6" />

<img width="1912" height="909" alt="Screenshot 2026-04-23 192839" src="https://github.com/user-attachments/assets/2f81887c-0f0f-4b7a-b5b0-0cbc63521f58" />

<img width="1308" height="1011" alt="Screenshot 2026-04-29 145337" src="https://github.com/user-attachments/assets/edc89adc-2e49-46db-a4fe-259ac78da32c" />

<img width="1704" height="965" alt="Screenshot 2026-04-23 192830" src="https://github.com/user-attachments/assets/0c29916f-2840-4ce4-a634-b1934ebe3747" />

<img width="1919" height="964" alt="Screenshot 2026-04-23 193808" src="https://github.com/user-attachments/assets/5c90354a-9179-4efd-aeac-f593ae4c8f44" />

<img width="1919" height="870" alt="Screenshot 2026-04-23 193652" src="https://github.com/user-attachments/assets/2e179bd6-7850-42dd-92fa-1427a8e9f77a" />

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

<img width="1919" height="937" alt="Screenshot 2026-04-23 204500" src="https://github.com/user-attachments/assets/f4cc9b9c-3c66-4bcd-b9c4-de6088aba6db" />

<img width="1912" height="904" alt="Screenshot 2026-04-23 204617" src="https://github.com/user-attachments/assets/e8e06764-a28a-4b92-8f30-67fc85e75075" />


<img width="1919" height="909" alt="Screenshot 2026-04-23 204541" src="https://github.com/user-attachments/assets/826c2122-5948-47dd-9e31-f96c61323183" />


<img width="1736" height="998" alt="Screenshot 2026-04-29 145327" src="https://github.com/user-attachments/assets/3222ec3c-31be-43cd-9f55-17e0f0d6069b" />

<img width="1271" height="987" alt="Screenshot 2026-04-29 145331" src="https://github.com/user-attachments/assets/e2306722-8d20-4848-b3c8-a12488aa00ae" />


<img width="1308" height="1011" alt="Screenshot 2026-04-29 145337" src="https://github.com/user-attachments/assets/fc163ca7-f93c-414c-b769-67c819ae1f0d" />


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

   <img width="1919" height="845" alt="Screenshot 2026-04-28 130839" src="https://github.com/user-attachments/assets/918ca290-4bab-4041-ad3c-7b7d5144a043" />


<img width="1919" height="885" alt="Screenshot 2026-04-28 130829" src="https://github.com/user-attachments/assets/fbf25f35-121b-4c69-8195-b31ed89a8658" />

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
