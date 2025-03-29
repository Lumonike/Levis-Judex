s = input()
w = 0
l = 0
for i in s:
    if i == "W":
        w += 1
    else:
        l += 1
if w > l:
    print("W")
else:
    print("L")