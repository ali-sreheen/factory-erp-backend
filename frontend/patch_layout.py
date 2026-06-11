import codecs

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/index.html'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# 1. Change max width of project detail view
content = content.replace(
    '<div id="projectDetailView" class="hidden space-y-6 animate-fade-in max-w-6xl mx-auto">',
    '<div id="projectDetailView" class="hidden space-y-6 animate-fade-in max-w-[95%] mx-auto">'
)

# 2. Change grid layout
old_grid = '''                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-1 space-y-6">
                        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                            <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">معلومات أساسية</h3>'''
new_grid = '''                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                        <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">معلومات أساسية</h3>'''
content = content.replace(old_grid, new_grid)

# 3. Separate attachments into the second column
old_attachments = '''                        </div>
                        
                        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                            <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">المرفقات</h3>'''
new_attachments = '''                        </div>
                    
                    <div class="bg-white rounded-2xl shadow border border-slate-100 p-6">
                        <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">المرفقات</h3>'''
content = content.replace(old_attachments, new_attachments)

# 4. Remove col-span-2 and close the grid before the table
old_table = '''                        </div>
                    </div>

                    <div class="lg:col-span-2">
                        <div class="bg-white rounded-2xl shadow border border-slate-100 p-6 overflow-hidden">
                            <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">التفاصيل الهندسية</h3>'''
new_table = '''                        </div>
                </div>

                <div class="w-full">
                    <div class="bg-white rounded-2xl shadow border border-slate-100 p-6 overflow-hidden">
                        <h3 class="font-bold text-lg text-slate-800 mb-4 border-b pb-2">التفاصيل الهندسية</h3>'''
content = content.replace(old_table, new_table)

# 5. Remove the extra closing div for lg:col-span-2
old_table_end = '''                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ================= DEPARTMENTS VIEW ================= -->'''
new_table_end = '''                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

            <!-- ================= DEPARTMENTS VIEW ================= -->'''
# Wait, old_table_end has 5 closing divs from the end of table to the end of projectDetailView.
# Before:
# 1. </table>
# 2. </div> (overflow-x-auto)
# 3. </div> (bg-white ...)
# 4. </div> (lg:col-span-2)
# 5. </div> (grid)
# 6. </div> (projectDetailView)
# After:
# 1. </table>
# 2. </div> (overflow-x-auto)
# 3. </div> (bg-white ...)
# 4. </div> (w-full)
# 5. </div> (projectDetailView)
# So we need to remove one closing div.
content = content.replace('''                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>''', '''                                </table>
                            </div>
                        </div>
                    </div>
                </div>''')

# Update version
content = content.replace('script.js?v=19', 'script.js?v=20')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print("Layout patched successfully.")
