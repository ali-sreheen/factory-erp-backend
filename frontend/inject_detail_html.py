import sys
import codecs

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

target = '            <!-- ================= DEPARTMENTS VIEW ================= -->'
replacement = '''            <!-- ================= PROJECT DETAIL VIEW ================= -->
            <div id="projectDetailView" class="hidden space-y-6 animate-fade-in max-w-6xl mx-auto">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
                    <div class="flex items-center gap-4">
                        <button onclick="showProjectsView()" class="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition flex items-center justify-center" title="العودة للقائمة">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                        <div>
                            <h2 class="text-3xl font-extrabold text-slate-900" id="pdTitle">تفاصيل المشروع</h2>
                            <p class="text-slate-500 text-sm mt-0.5" id="pdSubtitle">جاري التحميل...</p>
                        </div>
                    </div>
                    <div id="pdStatusBadge"></div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-1 space-y-6">
                        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                            <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">معلومات أساسية</h3>
                            <div class="space-y-3 text-sm">
                                <div class="flex justify-between"><span class="text-slate-500">رقم المشروع:</span> <span class="font-bold text-slate-800" id="pdNumber"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">المقاول:</span> <span class="font-bold text-slate-800" id="pdContractor"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">تاريخ التسليم:</span> <span class="font-bold text-slate-800" dir="ltr" id="pdDelivery"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">المهندس:</span> <span class="font-bold text-slate-800" id="pdEngineer"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">هاتف المهندس:</span> <span class="font-bold text-slate-800" dir="ltr" id="pdEngineerPhone"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">الموقع:</span> <span class="font-bold text-slate-800" id="pdLocation"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">لون الدهان:</span> <span class="font-bold text-slate-800" id="pdPaint"></span></div>
                                <div class="flex justify-between"><span class="text-slate-500">مسؤول التنفيذ:</span> <span class="font-bold text-slate-800" id="pdAssignee"></span></div>
                            </div>
                        </div>
                        
                        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                            <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">المرفقات</h3>
                            <div id="pdAttachments" class="space-y-2">
                                <!-- Attachments will be listed here -->
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-2">
                        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6 overflow-hidden">
                            <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">التفاصيل الهندسية</h3>
                            <div class="overflow-x-auto">
                                <table class="w-full text-right border-collapse text-sm">
                                    <thead>
                                        <tr class="bg-slate-50 text-slate-600 border-b">
                                            <th class="p-3">رقم الباب</th>
                                            <th class="p-3">العرض</th>
                                            <th class="p-3">الطول</th>
                                            <th class="p-3">العمق</th>
                                            <th class="p-3">الزرفيل</th>
                                            <th class="p-3">المقطع</th>
                                            <th class="p-3">نوع الباب</th>
                                            <th class="p-3">حريق</th>
                                            <th class="p-3">الشباك</th>
                                        </tr>
                                    </thead>
                                    <tbody id="pdEngineeringTableBody">
                                        <!-- Rows injected here -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ================= DEPARTMENTS VIEW ================= -->'''

if target in content:
    new_content = content.replace(target, replacement)
    with codecs.open(path, 'w', 'utf-8') as f:
        f.write(new_content)
    print("Successfully added project detail view to index.html")
else:
    print("Target not found in index.html")
