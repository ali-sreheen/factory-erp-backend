#!/bin/bash

# ==============================================================================
# سكربت النسخ الاحتياطي التلقائي لقاعدة بيانات PostgreSQL (Factory ERP)
# ==============================================================================

# المجلد الذي سيتم حفظ النسخ الاحتياطية فيه
BACKUP_DIR="/var/www/factory-erp-backend/backups"
DB_NAME="factory_erp"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql.gz"

# إنشاء مجلد النسخ الاحتياطية إذا لم يكن موجوداً
mkdir -p "$BACKUP_DIR"

echo "بدء عملية النسخ الاحتياطي لقاعدة البيانات..."

# تنفيذ pg_dump باسم مستخدم postgres لتجنب طلب كلمة المرور (Peer Authentication) وضغطه مباشرة
sudo -u postgres pg_dump "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "تم النسخ الاحتياطي بنجاح وحفظ الملف في: $BACKUP_FILE"
else
  echo "خطأ: فشل عملية النسخ الاحتياطي"
  exit 1
fi

# تنظيف وتوفير المساحة: حذف النسخ الاحتياطية التي مر عليها أكثر من 30 يوماً
echo "جاري فحص وحذف النسخ الاحتياطية القديمة (أقدم من 30 يوماً)..."
find "$BACKUP_DIR" -type f -name "backup_*.sql.gz" -mtime +30 -delete

echo "اكتملت عملية التنظيف بنجاح!"
