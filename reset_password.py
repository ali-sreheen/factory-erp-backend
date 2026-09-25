"""
أداة سريعة لإعادة ضبط وتحديث كلمات المرور لمستخدمي النظام
الاستخدام:
    python reset_password.py "اسم_المستخدم" "كلمة_المرور_الجديدة"
أو التشغيل المباشر التفاعلي:
    python reset_password.py
"""
import sys
import os

# Ensure current directory is on sys.path
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# UTF-8 encoding support for Arabic in terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        pass

from core.database import SessionLocal
import crud
import auth

def reset_password(username: str, new_password: str):
    db = SessionLocal()
    try:
        user = crud.get_user_by_username(db, username)
        if not user:
            print(f"❌ خطأ: اسم المستخدم '{username}' غير مسجل في قاعدة البيانات.")
            users = crud.get_all_users(db)
            print("المستخدمون المتاحون حالياً:")
            for u in users:
                print(f"  - {u.username} (معرف: {u.id})")
            return False

        hashed_pwd = auth.get_password_hash(new_password)
        user.hashed_password = hashed_pwd
        user.is_approved = 1  # Make sure account is approved
        db.commit()
        db.refresh(user)
        print(f"✅ تم بنجاح تحديث كلمة المرور للمستخدم '{user.username}'!")
        print(f"   اسم الدخول: {user.username}")
        print(f"   كلمة المرور الجديدة: {new_password}")
        print(f"   الحالة: مفعل وموافق عليه (Approved)")
        return True
    finally:
        db.close()

def main():
    if len(sys.argv) >= 3:
        username = sys.argv[1].strip()
        new_password = sys.argv[2].strip()
        reset_password(username, new_password)
    elif len(sys.argv) == 2 and sys.argv[1] in ["--list", "-l", "list"]:
        db = SessionLocal()
        users = crud.get_all_users(db)
        print("قائمة المستخدمين المسجلين في النظام:")
        for u in users:
            print(f"  - المعرف: {u.id} | اسم المستخدم: {u.username} | مفعل: {u.is_approved == 1}")
        db.close()
    else:
        print("=== أداة إدارة كلمات المرور - Factory ERP ===")
        db = SessionLocal()
        users = crud.get_all_users(db)
        print("المستخدمون المسجلون:")
        for idx, u in enumerate(users, start=1):
            print(f"  [{idx}] {u.username}")
        db.close()
        
        target_name = input("أدخل اسم المستخدم أو رقمه: ").strip()
        if target_name.isdigit() and 1 <= int(target_name) <= len(users):
            target_name = users[int(target_name) - 1].username
            
        new_pwd = input(f"أدخل كلمة المرور الجديدة لـ ({target_name}): ").strip()
        if not new_pwd:
            print("❌ تم إلغاء العملية: لم يتم إدخال كلمة مرور.")
            return
            
        reset_password(target_name, new_pwd)

if __name__ == "__main__":
    main()
