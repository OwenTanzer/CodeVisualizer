# Regression fixture for PR #1 review ("the public API cannot reliably
# select a nested function"): two different closures both named "inner"
# at different byte ranges. A position inside make_multiplier's `inner`
# also falls inside make_multiplier itself, so a naive "first containing
# function" lookup (or a name-based lookup) can incorrectly resolve the
# OUTER function, or the wrong "inner". Only an exact-range match
# disambiguates these correctly.
def make_adder(x):
    def inner(y):
        return x + y
    return inner


def make_multiplier(x):
    def inner(y):
        return x * y
    return inner
