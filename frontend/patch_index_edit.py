import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Add id="wizardTitle"
content = content.replace('<h2 class="text-3xl font-extrabold text-slate-900">إضافة مشروع جديد</h2>',
                          '<h2 id="wizardTitle" class="text-3xl font-extrabold text-slate-900">إضافة مشروع جديد</h2>')

# 2. Add existing attachments container in step 3
attachments_section_old = r'''                            <div id="attachmentsList" class="mt-4 space-y-2">
                                <!-- Selected files show here -->
                            </div>'''
attachments_section_new = '''                            <div id="attachmentsList" class="mt-4 space-y-2">
                                <!-- Selected files show here -->
                            </div>
                            
                            <!-- Existing attachments for edit mode -->
                            <div id="existingAttachmentsContainer" class="mt-6 hidden">
                                <h4 class="text-sm font-bold text-slate-700 mb-3 border-b pb-1">المرفقات الحالية (انقر للحذف)</h4>
                                <div id="existingAttachmentsList" class="space-y-2"></div>
                            </div>'''
content = re.sub(attachments_section_old, attachments_section_new, content)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched index.html")
