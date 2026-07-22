def safe_divide(a, b):
    try:
        assert b != 0, "divisor must not be zero"
        result = a / b
    except ZeroDivisionError:
        result = None
    except ValueError as e:
        raise RuntimeError("invalid input") from e
    else:
        result = round(result, 2)
    finally:
        print("done")
    return result
