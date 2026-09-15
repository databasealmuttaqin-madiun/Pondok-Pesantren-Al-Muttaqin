import re

with open("src/components/NfcRegisterPanel.tsx", "r") as f:
    content = f.read()

content = content.replace('      return str. " ");', '      return str.trim();')
content = content.replace('      const studentNickNormalized = s ? cleanAndNormalizeString(s) : "";\n', '')
content = content.replace('        studentNickNormalized === scanNormalized\n', '')
content = content.replace('        studentNameNormalized === scanNormalized ||', '        studentNameNormalized === scanNormalized')

with open("src/components/NfcRegisterPanel.tsx", "w") as f:
    f.write(content)
