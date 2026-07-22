def classify(score):
    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 70:
        if score >= 75:
            grade = "C+"
        else:
            grade = "C"
    else:
        grade = "F"
    return grade
