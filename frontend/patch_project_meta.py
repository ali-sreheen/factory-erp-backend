import codecs

# 1. Update index.html
path_html = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'
with codecs.open(path_html, 'r', 'utf-8') as f:
    html = f.read()

old_wizard_section = '''                            <div class="mb-6">
                                <label class="block text-sm font-medium text-slate-700 mb-1">لون الدهان للمشروع (اختياري)</label>
                                <input type="text" id="pwPaintColor" class="w-full max-w-md px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" placeholder="مثال: أبيض مطفي / RAL 9010">
                            </div>
                            
                            <div class="mb-6">
                                <label class="block text-sm font-medium text-slate-700 mb-1">ملاحظات المشروع العامة</label>
                                <textarea id="pwNotes" rows="3" class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" placeholder="أدخل الملاحظات العامة للمشروع هنا..."></textarea>
                            </div>'''

new_wizard_section = '''                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1">لون الدهان للمشروع (اختياري)</label>
                                    <input type="text" id="pwPaintColor" class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" placeholder="مثال: أبيض مطفي / RAL 9010">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1">نوع التصنيع</label>
                                    <select id="pwManufacturingType" class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white">
                                        <option value="" disabled selected>اختر نوع التصنيع...</option>
                                        <option value="حلوق فقط">حلوق فقط</option>
                                        <option value="حلوق + درف">حلوق + درف</option>
                                        <option value="درف فقط">درف فقط</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div class="md:col-span-1">
                                    <label class="block text-sm font-medium text-slate-700 mb-1">ملاحظات المشروع العامة</label>
                                    <textarea id="pwNotes" rows="3" class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" placeholder="أدخل الملاحظات العامة للمشروع هنا..."></textarea>
                                </div>
                                <div class="md:col-span-1">
                                    <label class="block text-sm font-medium text-slate-700 mb-1">تركيب المشروع</label>
                                    <select id="pwInstallationType" class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white">
                                        <option value="" disabled selected>اختر طريقة التركيب...</option>
                                        <option value="أرض مصنع">أرض مصنع</option>
                                        <option value="مع تركيب">مع تركيب</option>
                                        <option value="تصنيع بدون تجميع">تصنيع بدون تجميع</option>
                                    </select>
                                </div>
                            </div>'''

html = html.replace(old_wizard_section, new_wizard_section)

old_info_section = '''                                <div class="flex justify-between"><span class="text-slate-500">لون الدهان:</span> <span class="font-bold text-slate-800" id="pdPaint"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">مسؤول التنفيذ:</span> <span class="font-bold text-slate-800" id="pdAssignee"></span></div>'''

new_info_section = '''                                <div class="flex justify-between"><span class="text-slate-500">لون الدهان:</span> <span class="font-bold text-slate-800" id="pdPaint"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">نوع التصنيع:</span> <span class="font-bold text-slate-800" id="pdManufacturingType"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">تركيب المشروع:</span> <span class="font-bold text-slate-800" id="pdInstallationType"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">مسؤول التنفيذ:</span> <span class="font-bold text-slate-800" id="pdAssignee"></span></div>'''

html = html.replace(old_info_section, new_info_section)

html = html.replace('script.js?v=22', 'script.js?v=23')

with codecs.open(path_html, 'w', 'utf-8') as f:
    f.write(html)

# 2. Update script.js
path_js = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'
with codecs.open(path_js, 'r', 'utf-8') as f:
    js = f.read()

old_save_vars = '''        const paintColor = document.getElementById('pwPaintColor').value.trim();
        const notes = document.getElementById('pwNotes').value.trim();'''
new_save_vars = '''        const paintColor = document.getElementById('pwPaintColor').value.trim();
        const manufacturingType = document.getElementById('pwManufacturingType').value;
        const installationType = document.getElementById('pwInstallationType').value;
        const notes = document.getElementById('pwNotes').value.trim();'''

js = js.replace(old_save_vars, new_save_vars)

old_save_payload = '''            paint_color: paintColor || null,
            notes: notes || null,
            details: projectDetails'''
new_save_payload = '''            paint_color: paintColor || null,
            manufacturing_type: manufacturingType || null,
            installation_type: installationType || null,
            notes: notes || null,
            details: projectDetails'''

js = js.replace(old_save_payload, new_save_payload)

old_view_info = '''            document.getElementById('pdPaint').textContent = project.paint_color || '-';
            document.getElementById('pdAssignee').textContent = project.executive_manager ? project.executive_manager.full_name : 'غير محدد';'''
new_view_info = '''            document.getElementById('pdPaint').textContent = project.paint_color || '-';
            document.getElementById('pdManufacturingType').textContent = project.manufacturing_type || '-';
            document.getElementById('pdInstallationType').textContent = project.installation_type || '-';
            document.getElementById('pdAssignee').textContent = project.executive_manager ? project.executive_manager.full_name : 'غير محدد';'''

js = js.replace(old_view_info, new_view_info)

with codecs.open(path_js, 'w', 'utf-8') as f:
    f.write(js)

print("Project meta fields patched.")
