import sys
import codecs
import re

path = 'c:/Users/hassa/Documents/ali/Factory-ERP/frontend/script.js'

with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# For addProjectDetailRow
old_add_row = r'''        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="الزرفيل"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="المقطع"></td>
        <td class="p-2"><input type="text" class="w-full px-2 py-1 border rounded" placeholder="نوع الباب"></td>'''

new_add_row = '''        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>الزرفيل</option>
                <option value="devon mortice lock">devon mortice lock</option>
                <option value="euroart mortice lock">euroart mortice lock</option>
                <option value="euroart roller">euroart roller</option>
                <option value="consort mortice lock">consort mortice lock</option>
                <option value="special">special</option>
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>المقطع</option>
                <option value="single rabbit with rubber">single rabbit with rubber</option>
                <option value="double rabbit with rubber">double rabbit with rubber</option>
                <option value="single rabbit">single rabbit</option>
                <option value="double rabbit">double rabbit</option>
            </select>
        </td>
        <td class="p-2">
            <select class="w-full px-2 py-1 border rounded bg-white text-sm">
                <option value="" disabled selected>نوع الباب</option>
                <option value="single leaf">single leaf</option>
                <option value="double leaf">double leaf</option>
            </select>
        </td>'''

content = content.replace(old_add_row, new_add_row)

# For editProject row
# We need to render selects dynamically setting 'selected' appropriately.
# Since we are interpolating strings in backticks in JS, we can use an inline conditional or write a small helper string block inside the tr.innerHTML literal.
# Let's replace the inputs in editProject:

old_edit_row = r'''                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.lock_type || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.profile_type || ''}"></td>
                    <td class="p-2"><input type="text" class="w-full p-2 border border-slate-300 rounded-lg text-sm" value="${d.door_type || ''}"></td>'''

new_edit_row = '''                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.lock_type ? 'selected' : ''}>الزرفيل</option>
                            <option value="devon mortice lock" ${d.lock_type === 'devon mortice lock' ? 'selected' : ''}>devon mortice lock</option>
                            <option value="euroart mortice lock" ${d.lock_type === 'euroart mortice lock' ? 'selected' : ''}>euroart mortice lock</option>
                            <option value="euroart roller" ${d.lock_type === 'euroart roller' ? 'selected' : ''}>euroart roller</option>
                            <option value="consort mortice lock" ${d.lock_type === 'consort mortice lock' ? 'selected' : ''}>consort mortice lock</option>
                            <option value="special" ${d.lock_type === 'special' ? 'selected' : ''}>special</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.profile_type ? 'selected' : ''}>المقطع</option>
                            <option value="single rabbit with rubber" ${d.profile_type === 'single rabbit with rubber' ? 'selected' : ''}>single rabbit with rubber</option>
                            <option value="double rabbit with rubber" ${d.profile_type === 'double rabbit with rubber' ? 'selected' : ''}>double rabbit with rubber</option>
                            <option value="single rabbit" ${d.profile_type === 'single rabbit' ? 'selected' : ''}>single rabbit</option>
                            <option value="double rabbit" ${d.profile_type === 'double rabbit' ? 'selected' : ''}>double rabbit</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <select class="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white">
                            <option value="" disabled ${!d.door_type ? 'selected' : ''}>نوع الباب</option>
                            <option value="single leaf" ${d.door_type === 'single leaf' ? 'selected' : ''}>single leaf</option>
                            <option value="double leaf" ${d.door_type === 'double leaf' ? 'selected' : ''}>double leaf</option>
                        </select>
                    </td>'''

content = content.replace(old_edit_row, new_edit_row)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)

print("Patched script.js to change text inputs to selects")
