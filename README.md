# RentEdge – AWS Deployment (Production Architecture using CloudFormation)

## 📌 Project Overview

RentEdge is a full-stack property management platform that allows landlords and tenants to manage properties, payments, and tenant data.

This project demonstrates deployment of RentEdge using a **production-grade AWS architecture** with Infrastructure as Code (CloudFormation).

---

## 🏗️ Architecture Overview

### 🔹 Frontend

* Amazon S3 (Static Hosting)
* Amazon CloudFront (CDN)

### 🔹 Backend

* Application Load Balancer (ALB)
* EC2 Auto Scaling Group (Node.js + Express)
* PM2 for process management

### 🔹 Database

* Amazon RDS (PostgreSQL)
* Private subnet (secure access)

### 🔹 Networking

* VPC with public & private subnets
* Internet Gateway (IGW)
* NAT Gateway
* Route Tables

### 🔹 Security

* Security Groups (ALB → EC2 → RDS)
* Private database access

---

## 🧠 Architecture Flow

```
User → CloudFront → S3 (Frontend)
            ↓
         ALB (Public)
            ↓
     EC2 Auto Scaling (Private)
            ↓
        RDS (Private)
```

---

## 🚀 Deployment Steps

### 1️⃣ VPC Setup (CloudFormation)

* Created VPC (10.0.0.0/16)
* Created:

  * 2 Public Subnets (ap-south-1a, ap-south-1b)
  * 2 Private Subnets
* Attached Internet Gateway

---

### 2️⃣ Networking (NAT + Routing)

* Created NAT Gateway in public subnet
* Allocated Elastic IP
* Configured:

  * Public Route Table → IGW
  * Private Route Table → NAT

---

### 3️⃣ Security Groups

Created 3 Security Groups:

* ALB SG:

  * Allow HTTP (80) from internet

* EC2 SG:

  * Allow port 5000 only from ALB

* RDS SG:

  * Allow port 5432 only from EC2

---

### 4️⃣ Database (RDS)

* PostgreSQL instance (db.t3.micro)
* Deployed in private subnets
* Configured:

  * DB name: rentedge
  * Private access only
* Connected using security group

---

### 5️⃣ Backend Deployment (ALB + ASG)

#### Components:

* Application Load Balancer
* Target Group (port 5000)
* Launch Template
* Auto Scaling Group

#### EC2 Setup (UserData):

* Installed Node.js, Git, PostgreSQL
* Installed PM2
* Cloned GitHub repo
* Configured `.env`
* Ran:

  * npm install
  * drizzle migration
  * build
  * start server

---

### 6️⃣ Frontend Deployment (S3 + CloudFront)

#### Steps:

* Created S3 bucket
* Enabled static website hosting
* Uploaded frontend build files:

  * index.html
  * assets/
* Created CloudFront distribution

#### Fixes applied:

* Correct file structure (index.html at root)
* Fixed 403 AccessDenied (S3 public access)
* Added SPA routing fix:

  * 403 → /index.html
  * 404 → /index.html

---

### 7️⃣ Debugging & Fixes

Common issues solved:

* ❌ BucketPolicy blocked → Fixed via S3 permissions
* ❌ CloudFront origin error → Fixed domain format
* ❌ React routes not working → Added error response
* ❌ Missing assets → Corrected upload structure
* ❌ 403 AccessDenied → Allowed S3 read access

---

## 🧪 Final Result

* Frontend served via CloudFront ✅
* Backend accessible via ALB ✅
* Database securely connected ✅
* Full 3-tier architecture deployed ✅

---

## 💰 Cost Optimization (Important)

To avoid charges:

* Stop RDS instance
* Set Auto Scaling desired capacity = 0
* Delete NAT Gateway (major cost)
* Delete stacks when not in use

---

## 📂 Tech Stack

* Node.js
* Express.js
* PostgreSQL
* Drizzle ORM
* React
* AWS (EC2, RDS, S3, CloudFront, VPC, ALB)
* CloudFormation

---

## 🔮 Future Improvements

* CI/CD using CodePipeline + CodeDeploy
* HTTPS with ACM + Route53
* Docker + ECS/Kubernetes
* WAF for security
* Multi-AZ RDS

---

## 📌 Conclusion

This project demonstrates:

* Infrastructure as Code (CloudFormation)
* Production-grade AWS architecture
* Secure networking (private/public subnets)
* Scalable backend using Auto Scaling

---
