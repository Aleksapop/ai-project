def euro_to_dollars(euros: float, rate: float = 1.08) -> float:
    """
    Convert an amount from euros to US dollars.

    :param euros: Amount in euros.
    :param rate: Conversion rate (1 euro = rate dollars). Default is 1.08.
    :return: Equivalent amount in US dollars.
    """
    return euros * rate


if __name__ == "__main__":
    try:
        euros_input = float(input("Enter amount in euros: "))
        rate_input = input("Enter conversion rate (press Enter to use default 1.08): ").strip()

        if rate_input:
            rate_value = float(rate_input)
        else:
            rate_value = 1.08

        dollars = euro_to_dollars(euros_input, rate_value)
        print(f"{euros_input} EUR = {dollars:.2f} USD (rate: {rate_value})")
    except ValueError:
        print("Please enter valid numeric values for amount and rate.")
