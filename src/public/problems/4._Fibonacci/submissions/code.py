n = int(input())
fibo = [0 for _ in range(n)]
for i in range(n):
    if i==0:
        fibo[i] = 1
    elif i==1:
        fibo[i] = 1
    else:
        fibo[i] = (fibo[i-1] + fibo[i-2]) % 1000000007

for i in fibo:
    print(i, end=' ')