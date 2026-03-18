def calculate(items):
    total = 0
    for item in items:        # line 3 — set your breakpoint here
        total += item['value']
    return total

data = [
    {'value': 10},
    {'value': None},          # this will crash
    {'value': 30},
]

result = calculate(data)
print('Result:', result)