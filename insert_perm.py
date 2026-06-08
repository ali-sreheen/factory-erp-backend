import sqlite3
db_path = "inventory_v4.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Ensure user 1 exists
cursor.execute("SELECT id FROM users WHERE username='علي السريحين'")
user = cursor.fetchone()
if not user:
    print("User not found")
else:
    user_id = user[0]
    cursor.execute("INSERT OR REPLACE INTO user_permissions (id, user_id, department_name, can_edit) VALUES (1, ?, 'ألواح صاج', 1)", (user_id,))
    conn.commit()
    print("Permission inserted")

cursor.execute("SELECT * FROM user_permissions")
print("User Permissions:", cursor.fetchall())
