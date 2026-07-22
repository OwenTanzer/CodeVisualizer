def summarize(records):
    active = list(filter(lambda r: r.active, records))
    scores = map(lambda r: r.score, active)
    total = reduce(lambda acc, s: acc + s, scores, 0)
    return build_summary(total, len(active))


def build_summary(total, count):
    average = total / count if count else 0
    return {"total": total, "count": count, "average": average}
