#!/usr/bin/env python3
"""
Format a "Good day" greeting using last name then first name.

Args:
    first_name: The first name of the person.
    last_name: The last name of the person.

Returns:
    A string of the greeting.
"""                                                     
def good_day(first_name: str, last_name: str) -> str:
    if not isinstance(first_name, str) or not first_name.strip():
        raise ValueError("`first_name` must be a non-empty string.")
    if not isinstance(last_name, str) or not last_name.strip():
        raise ValueError("`last_name` must be a non-empty string.")

    first = first_name.strip()
    last = last_name.strip()
    return f"Good day {last} {first}"


if __name__ == "__main__":
    import sys

    try:
        if len(sys.argv) >= 3:
            first_arg = sys.argv[1]
            last_arg = sys.argv[2]
            print(good_day(first_arg, last_arg))
        else:
            first_input = input("Enter first name: ")
            last_input = input("Enter last name: ")
            print(good_day(first_input, last_input))
    except ValueError as err:
        print(err)
        raise SystemExit(1)

