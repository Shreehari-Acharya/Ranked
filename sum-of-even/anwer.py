def sum_of_even(arr):
    return sum(x for x in arr if x % 2 == 0)

if __name__ == "__main__":
    n = int(input())
    arr = list(map(int, input().split()))
    print(sum_of_even(arr))