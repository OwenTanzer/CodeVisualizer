def find_first_even(numbers):
    index = 0
    while index < len(numbers):
        if numbers[index] % 2 != 0:
            index += 1
            continue
        return numbers[index]
    for extra in numbers:
        if extra > 1000:
            break
    return None
