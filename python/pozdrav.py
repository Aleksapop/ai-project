def pozdrav(name, surname):
    print(f"Dobar dan, {surname} {name}")


def validiraj(text, polje):
    """Proverava da ime/prezime ima 3+ slova i nije broj."""
    if len(text) < 3:
        print(f"Greška: {polje} mora imati najmanje 3 slova.")
        return False
    if text.isdigit():
        print(f"Greška: {polje} ne sme biti broj.")
        return False
    return True


# unos od korisnika
while True:
    name = input("Unesi ime: ")
    surname = input("Unesi prezime: ")
    if validiraj(name, "Ime") and validiraj(surname, "Prezime"):
        break
    print("Pokušaj ponovo.\n")

pozdrav(name, surname)
