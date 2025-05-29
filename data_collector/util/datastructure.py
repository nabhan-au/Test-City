def flat_map(func, iterable):
    return [item for sub in iterable for item in func(sub)]