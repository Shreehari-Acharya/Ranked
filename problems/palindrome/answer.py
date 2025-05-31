def isPalindrome(x):
    if x < 0:
        return False

    original = x
    reversed_num = 0

    while x > 0:
        reversed_num = reversed_num * 10 + x % 10
        x //= 10

    return original == reversed_num


if __name__ == "__main__":
    x = int(input())
    print(isPalindrome(x))
