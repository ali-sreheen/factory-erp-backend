#!/bin/bash

# ==============================================================================
# سكربت التثبيت والتهيئة التلقائية لنظام Factory ERP على Ubuntu 24.04 LTS
# ==============================================================================

# التأكد من تشغيل السكربت بصلاحيات root
if [ "$EUID" -ne 0 ]; then
  echo "يرجى تشغيل السكربت بصلاحيات root (استخدم sudo bash deploy.sh)"
  exit 1
fi

PROJECT_DIR="/var/www/factory-erp"
DB_NAME="factory_erp"
DB_USER="erp_user"

echo "=========================================="
echo "بدء تهيئة سيرفر Factory ERP..."
echo "=========================================="

# 1. تحديث النظام وتثبيت الحزم الأساسية
echo "[1/7] تحديث النظام وتثبيت المتطلبات..."
apt update && apt upgrade -y
apt install python3-pip python3-venv nginx git curl postgresql postgresql-contrib -y

# 2. إنشاء كلمة مرور عشوائية أو طلبها لقاعدة البيانات
echo "------------------------------------------"
read -sp "الرجاء إدخال كلمة مرور جديدة لقاعدة بيانات PostgreSQL (أو اضغط Enter لإنشاء واحدة عشوائية): " DB_PASS
echo
if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -base64 12)
  echo "تم إنشاء كلمة مرور عشوائية لقاعدة البيانات: $DB_PASS"
fi
echo "------------------------------------------"

# 3. إعداد قاعدة البيانات المحلية PostgreSQL
echo "[2/7] إعداد قاعدة بيانات PostgreSQL المحلية..."
# إعادة تشغيل للتأكد من عمل الخدمة
systemctl start postgresql
systemctl enable postgresql

# إنشاء قاعدة البيانات والمستخدم وصلاحياته
sudo -i -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "قاعدة البيانات موجودة مسبقاً"
sudo -i -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "المستخدم موجود مسبقاً"
sudo -i -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -i -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
# منح الصلاحيات الإضافية لنسخة PostgreSQL 15+ على مخطط public
sudo -i -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

# 4. إعداد ملفات المشروع والبيئة الافتراضية
echo "[3/7] تهيئة البيئة الافتراضية لـ Python..."
cd "$PROJECT_DIR" || { echo "خطأ: لم يتم العثور على مجلد المشروع في $PROJECT_DIR"; exit 1; }

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 5. إنشاء ملف البيئة .env
echo "[4/7] إنشاء ملف الإعدادات .env..."
cat <<EOF > .env
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
PORT=8000
EOF
chmod 600 .env

# 6. إعداد وتشغيل خدمة النظام (Systemd Service)
echo "[5/7] تهيئة وتشغيل خدمة الخلفية (FastAPI)..."
cat <<EOF > /etc/systemd/system/factory-erp.service
[Unit]
Description=Factory ERP FastAPI Application
After=network.target

[Service]
User=root
WorkingDirectory=$PROJECT_DIR
ExecStart=$PROJECT_DIR/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start factory-erp
systemctl enable factory-erp

# 7. تهيئة خادم Nginx
echo "[6/7] تهيئة خادم Nginx للوكيل العكسي والواجهة الأمامية..."
cat <<EOF > /etc/nginx/sites-available/factory-erp
server {
    listen 80;
    server_name _; # يستقبل الطلبات من أي IP أو Domain موجه للسيرفر

    # الواجهة الأمامية (ملفات الـ HTML والـ JS الثابتة)
    location / {
        root $PROJECT_DIR/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # الواجهة الخلفية (FastAPI APIs)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # توجيه الـ Docs الخاص بالـ API
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host \$host;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host \$host;
    }
}
EOF

# تفعيل الإعدادات
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/factory-erp /etc/nginx/sites-enabled/

# فحص إعدادات Nginx وإعادة تشغيله
nginx -t && systemctl restart nginx

echo "=========================================="
echo "[7/7] اكتمل التثبيت والتهيئة بنجاح! 🎉"
echo "رابط الواجهة الأمامية: http://<IP_السيرفر_الخاص_بك>"
echo "رابط لوحة التحكم بالـ API: http://<IP_السيرفر_الخاص_بك>/docs"
echo "=========================================="
