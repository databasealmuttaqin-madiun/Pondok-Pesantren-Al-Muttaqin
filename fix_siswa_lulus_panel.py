with open("src/components/SiswaLulusMutasiPanel.tsx", "r") as f:
    c = f.read()

# Fix interface declarations
c = c.replace("export interfaceany {\n  id: any| number;", "export interface SiswaLulus {\n  id: string | number;", 1)
c = c.replace("export interfaceany {\n  id: any| number;", "export interface SiswaMutasi {\n  id: string | number;", 1)
c = c.replace("interfaceanyMutasiPanelProps", "interface SiswaLulusMutasiPanelProps")
c = c.replace("export default functionanyMutasiPanel", "export default function SiswaLulusMutasiPanel")
c = c.replace("}:anyMutasiPanelProps)", "}: SiswaLulusMutasiPanelProps)")

# Fix state types
c = c.replace("useState<SiswaLulus |any | null>", "useState<SiswaLulus | SiswaMutasi | null>")
c = c.replace("(item:any |any)", "(item: SiswaLulus | SiswaMutasi)")

# Fix (editingItem asany)
c = c.replace("(editingItem asany)", "(editingItem as any)")
c = c.replace("(viewingItem asany)", "(viewingItem as any)")
c = c.replace("newItem:any = {", "newItem: any = {")
c = c.replace("} asany;", "} as any;")

with open("src/components/SiswaLulusMutasiPanel.tsx", "w") as f:
    f.write(c)

print("Updated SiswaLulusMutasiPanel.tsx")
