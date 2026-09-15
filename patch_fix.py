import re

# Fix supabaseClient.ts
with open("src/supabaseClient.ts", "r") as f:
    content = f.read()

content = content.replace("  };\n};\n}", "  };\n}")

with open("src/supabaseClient.ts", "w") as f:
    f.write(content)

# Fix SiswaLulusMutasiPanel.tsx
with open("src/components/SiswaLulusMutasiPanel.tsx", "r") as f:
    content = f.read()

content = content.replace("          String(s.id).includes(q)\n          false", "          String(s.id).includes(q)")

with open("src/components/SiswaLulusMutasiPanel.tsx", "w") as f:
    f.write(content)
