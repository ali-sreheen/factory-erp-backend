import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Add Notes to basic info section
paint_html = r'''                            <div class="mb-6">
                                <label class="block text-sm font-medium text-slate-700 mb-1">لون الدهان للمشروع (اختياري)</label>
                                <input type="text" id="pwPaintColor" class="w-full max-w-md px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" placeholder="مثال: أبيض مطفي / RAL 9010">
                            </div>'''
new_paint_html = '''                            <div class="mb-6">
                                <label class="block text-sm font-medium text-slate-700 mb-1">لون الدهان للمشروع (اختياري)</label>
                                <input type="text" id="pwPaintColor" class="w-full max-w-md px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" placeholder="مثال: أبيض مطفي / RAL 9010">
                            </div>
                            
                            <div class="mb-6">
                                <label class="block text-sm font-medium text-slate-700 mb-1">ملاحظات المشروع العامة</label>
                                <textarea id="pwNotes" rows="3" class="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" placeholder="أدخل الملاحظات العامة للمشروع هنا..."></textarea>
                            </div>'''
content = content.replace(paint_html, new_paint_html)


# 2. Add new columns to project details table headers
old_th = r'''                                            <th class="p-2 border-b w-20">العرض</th>
                                            <th class="p-2 border-b w-20">الطول</th>
                                            <th class="p-2 border-b w-20">العمق</th>
                                            <th class="p-2 border-b">نوع الزرفيل</th>
                                            <th class="p-2 border-b">المقطع</th>
                                            <th class="p-2 border-b">نوع الباب</th>
                                            <th class="p-2 border-b text-center">مقاوم حريق</th>
                                            <th class="p-2 border-b">تفصيل الشباك</th>
                                            <th class="p-2 border-b text-center">حذف</th>'''
new_th = '''                                            <th class="p-2 border-b w-20">العرض</th>
                                            <th class="p-2 border-b w-20">الطول</th>
                                            <th class="p-2 border-b w-20">العمق</th>
                                            <th class="p-2 border-b">نوع الزرفيل</th>
                                            <th class="p-2 border-b">المقطع</th>
                                            <th class="p-2 border-b">نوع الباب</th>
                                            <th class="p-2 border-b text-center">مقاوم حريق</th>
                                            <th class="p-2 border-b">الكشفة</th>
                                            <th class="p-2 border-b">الكشفة 2</th>
                                            <th class="p-2 border-b">تحت البلاط</th>
                                            <th class="p-2 border-b">ملاحظات</th>
                                            <th class="p-2 border-b">تفصيل الشباك</th>
                                            <th class="p-2 border-b text-center">حذف</th>'''
content = content.replace(old_th, new_th)


# 3. Add same columns to projectDetailView Table Header
old_pd_th = r'''                                            <th class="p-3">نوع الباب</th>
                                            <th class="p-3 text-center">حريق</th>
                                            <th class="p-3">تفصيل الشباك</th>'''
new_pd_th = '''                                            <th class="p-3">نوع الباب</th>
                                            <th class="p-3 text-center">حريق</th>
                                            <th class="p-3">الكشفة</th>
                                            <th class="p-3">الكشفة 2</th>
                                            <th class="p-3">تحت البلاط</th>
                                            <th class="p-3">ملاحظات</th>
                                            <th class="p-3">تفصيل الشباك</th>'''
content = content.replace(old_pd_th, new_pd_th)

# 4. Add Project notes display in viewProjectDetails
old_pd_notes = r'''                                <div class="flex justify-between"><span class="text-slate-500">مسؤول التنفيذ:</span> <span class="font-bold text-slate-800" id="pdAssignee"></span></div>
                            </div>
                        </div>'''
new_pd_notes = '''                                <div class="flex justify-between"><span class="text-slate-500">مسؤول التنفيذ:</span> <span class="font-bold text-slate-800" id="pdAssignee"></span></div>
                                <div class="flex justify-between col-span-1 md:col-span-2 mt-2 pt-2 border-t border-slate-100">
                                    <span class="text-slate-500 w-1/4">ملاحظات:</span>
                                    <span class="font-bold text-slate-800 w-3/4 whitespace-pre-wrap" id="pdNotes"></span>
                                </div>
                            </div>
                        </div>'''
content = content.replace(old_pd_notes, new_pd_notes)

# 5. increment v cache string to v=13
content = content.replace('script.js?v=12', 'script.js?v=13')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched index.html with new fields")
