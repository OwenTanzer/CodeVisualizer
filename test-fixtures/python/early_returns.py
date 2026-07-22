def first_match(items, predicate):
    if not items:
        return None
    for item in items:
        if predicate(item):
            return item
        if item is None:
            return None
    return items[-1]
