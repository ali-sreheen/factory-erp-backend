import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Add USERS_BASIC_URL constant
if 'const USERS_BASIC_URL' not in content:
    content = content.replace("const USERS_URL = `${API_HOST}/api/users`;",
                              "const USERS_URL = `${API_HOST}/api/users`;\nconst USERS_BASIC_URL = `${API_HOST}/api/users/basic`;")

# 2. Update loadAssignees to use USERS_BASIC_URL
load_assignees_old = '''async function loadAssignees() {
    try {
        const response = await authFetch(USERS_URL);'''
load_assignees_new = '''async function loadAssignees() {
    try {
        const response = await authFetch(USERS_BASIC_URL);'''
content = content.replace(load_assignees_old, load_assignees_new)

# 3. Update viewProjectDetails to use USERS_BASIC_URL
view_project_details_old = '''        if (p.executive_manager_id) {
            authFetch(USERS_URL).then(res => res.json()).then(users => {'''
view_project_details_new = '''        if (p.executive_manager_id) {
            authFetch(USERS_BASIC_URL).then(res => res.json()).then(users => {'''
content = content.replace(view_project_details_old, view_project_details_new)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Successfully updated script.js to use USERS_BASIC_URL")
