import re

with open("src/components/RegistrationForm.tsx", "r") as f:
    content = f.read()

# I will rewrite the whole component to be a single-step form with just Nama, Jenis Kelamin, and Kategori.
