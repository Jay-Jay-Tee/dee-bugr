# /tmp/test_debug.py — simple script for testing the DAP connection

def calculate(x, y):
    result = x + y          # line 4
    product = x * y         # line 5
    return result, product  # line 6

def main():
    a = 10                  # line 9  ← set breakpoint here
    b = 20                  # line 10
    total, mult = calculate(a, b)
    name = "Lucid"
    items = [1, 2, 3, 4, 5]
    print(f"Total: {total}, Product: {mult}")

main()