import sys

with open('frontend/script.js', 'r', encoding='utf-8') as f:
    content = f.read()

def check_brackets(text):
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}
    for i, char in enumerate(text):
        if char in "({[":
            stack.append((char, i))
        elif char in ")}]":
            if not stack:
                print(f"Extra closing bracket '{char}' at index {i}")
                return False
            top, _ = stack.pop()
            if top != pairs[char]:
                print(f"Mismatched bracket '{char}' at index {i}. Expected closing for '{top}'")
                return False
    if stack:
        print(f"Unclosed brackets: {stack}")
        return False
    print("Brackets balanced.")
    return True

check_brackets(content)
