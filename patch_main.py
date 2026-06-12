import sys

with open('main.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_endpoint = '''
@app.put("/api/items/{item_id}/move", response_model=schemas.Item)
def move_item(
    item_id: int,
    move_data: schemas.ItemMove,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.username != "admin":
        raise HTTPException(status_code=403, detail="غير مصرح لك بنقل البنود")
        
    updated_item = crud.move_item(
        db,
        item_id=item_id,
        new_category=move_data.new_category,
        new_subcategory=move_data.new_subcategory,
        user_id=current_user.id
    )
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return updated_item
'''

if 'def move_item' not in content:
    idx = content.find('@app.delete("/api/items/{item_id}"')
    if idx != -1:
        content = content[:idx] + new_endpoint + '\n' + content[idx:]

with open('main.py', 'w', encoding='utf-8') as f:
    f.write(content)
