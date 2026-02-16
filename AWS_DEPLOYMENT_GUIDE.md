# BRR Liquor Portal - AWS EC2 Deployment Guide

## Prerequisites
- AWS EC2 instance (Ubuntu 22.04 or Amazon Linux 2023 recommended)
- Minimum: t2.small (2 GB RAM) or higher
- Security Group: Open ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
- SSH access as root

---

## Step 1: Connect to Your EC2 Instance

```bash
ssh -i your-key.pem root@your-ec2-public-ip
```

If you login as `ec2-user` or `ubuntu`, switch to root:
```bash
sudo su -
```

---

## Step 2: Update System & Install Dependencies

### For Ubuntu 22.04:
```bash
apt update && apt upgrade -y
apt install -y curl git nginx
```

### For Amazon Linux 2023:
```bash
yum update -y
yum install -y curl git nginx
```

---

## Step 3: Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

For Amazon Linux:
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs
```

Verify:
```bash
node -v    # Should show v20.x.x
npm -v     # Should show 10.x.x
```

---

## Step 4: Install PostgreSQL

### For Ubuntu:
```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
```

### For Amazon Linux:
```bash
yum install -y postgresql15-server
postgresql-setup --initdb
systemctl start postgresql
systemctl enable postgresql
```

### Create Database and User:
```bash
sudo -u postgres psql
```

Inside the PostgreSQL prompt, run:
```sql
CREATE USER brrliquor WITH PASSWORD 'YourStrongPassword123';
CREATE DATABASE brrliquor_db OWNER brrliquor;
GRANT ALL PRIVILEGES ON DATABASE brrliquor_db TO brrliquor;
\q
```

Replace `YourStrongPassword123` with your own strong password.

---

## Step 5: Clone the Application

```bash
cd /opt
git clone https://your-repo-url.git brr-liquor
cd brr-liquor
```

If you don't have the code in a Git repo, you can download it from Replit:
1. In your Replit project, click the three dots menu (top-left)
2. Select "Download as zip"
3. Upload the zip to your EC2 instance using `scp`:
```bash
# From your local machine:
scp -i your-key.pem brr-liquor.zip root@your-ec2-public-ip:/opt/

# On EC2:
cd /opt
apt install -y unzip    # or yum install -y unzip
unzip brr-liquor.zip -d brr-liquor
cd brr-liquor
```

---

## Step 6: Install Application Dependencies

```bash
npm install
```

---

## Step 7: Set Up Environment Variables

Create an `.env` file:
```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://brrliquor:YourStrongPassword123@localhost:5432/brrliquor_db
SESSION_SECRET=your-random-session-secret-at-least-32-chars-long
NODE_ENV=production
PORT=5000
EOF
```

Generate a random session secret:
```bash
# Run this to generate a random string and copy it into .env
openssl rand -hex 32
```

Update the `SESSION_SECRET` value in `.env` with the generated string.

---

## Step 8: Build the Application

```bash
npm run build
```

This creates a `dist/` folder with the production-ready files.

---

## Step 9: Set Up the Database Tables

```bash
npx drizzle-kit push
```

This will create all the required tables in your PostgreSQL database.

---

## Step 10: Test the Application

```bash
npm run start
```

The app should start on port 5000. Test it:
```bash
curl http://localhost:5000
```

If you see HTML output, it's working. Press `Ctrl+C` to stop it.

---

## Step 11: Set Up PM2 (Process Manager)

PM2 keeps your app running in the background and restarts it automatically if it crashes.

```bash
npm install -g pm2

cd /opt/brr-liquor
pm2 start dist/index.cjs --name brr-liquor --env production
pm2 save
pm2 startup
```

Useful PM2 commands:
```bash
pm2 status            # Check app status
pm2 logs brr-liquor   # View logs
pm2 restart brr-liquor  # Restart the app
pm2 stop brr-liquor   # Stop the app
```

---

## Step 12: Set Up Nginx (Reverse Proxy)

Nginx will handle incoming traffic on port 80 and forward it to your app on port 5000.

```bash
cat > /etc/nginx/sites-available/brr-liquor << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or EC2 public IP

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

Enable the site and restart Nginx:
```bash
ln -sf /etc/nginx/sites-available/brr-liquor /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t          # Test config
systemctl restart nginx
systemctl enable nginx
```

For Amazon Linux (Nginx config is in a different location):
```bash
# Put the server block content inside /etc/nginx/conf.d/brr-liquor.conf instead
cat > /etc/nginx/conf.d/brr-liquor.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

nginx -t
systemctl restart nginx
systemctl enable nginx
```

---

## Step 13: Open Firewall Ports

Make sure your EC2 Security Group allows:
- **Port 22** - SSH
- **Port 80** - HTTP
- **Port 443** - HTTPS (if using SSL)

In the AWS Console:
1. Go to EC2 > Security Groups
2. Select your instance's security group
3. Edit Inbound Rules
4. Add rules for ports 80 and 443 (source: 0.0.0.0/0)

---

## Step 14 (Optional): Set Up SSL with Let's Encrypt

If you have a domain name pointed to your EC2 instance:

```bash
apt install -y certbot python3-certbot-nginx    # Ubuntu
# OR
yum install -y certbot python3-certbot-nginx    # Amazon Linux

certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically configure SSL and set up auto-renewal.

---

## Your App Is Live!

Visit `http://your-ec2-public-ip` (or `https://your-domain.com` if you set up SSL).

Default login:
- Username: `admin`
- Password: `admin123`

**Important: Change the admin password after first login!**

---

## Quick Reference - Common Tasks

| Task | Command |
|------|---------|
| View app logs | `pm2 logs brr-liquor` |
| Restart app | `pm2 restart brr-liquor` |
| Stop app | `pm2 stop brr-liquor` |
| Check app status | `pm2 status` |
| Update code & redeploy | See below |

### To Update the App After Code Changes:
```bash
cd /opt/brr-liquor
git pull                    # If using git
npm install                 # Install any new dependencies
npm run build               # Rebuild
npx drizzle-kit push        # Update database if schema changed
pm2 restart brr-liquor      # Restart the app
```

---

## Troubleshooting

1. **App won't start**: Check logs with `pm2 logs brr-liquor`
2. **Database connection error**: Verify `DATABASE_URL` in `.env` and that PostgreSQL is running (`systemctl status postgresql`)
3. **Nginx 502 error**: Make sure the app is running on port 5000 (`pm2 status`)
4. **Can't connect from browser**: Check EC2 Security Group has port 80 open
