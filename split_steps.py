import sys

with open('src/components/RegistrationForm.tsx', 'r') as f:
    content = f.read()

# --- Find Step 1 Start ---
s1_start_marker = '{/* STEP 1: PERSONAL DETAILS */}'
s1_start_idx = content.find(s1_start_marker)
if s1_start_idx == -1:
    print("Failed to find step 1")
    sys.exit(1)

# --- Find Step 2 Start ---
s2_start_marker = '{/* STEP 2: ADDRESS */}'
s2_start_idx = content.find(s2_start_marker)

# --- Find Step 3 Start ---
s3_start_marker = '{/* STEP 3: PARENTS & CONNECTION ADDRESS */}'
s3_start_idx = content.find(s3_start_marker)

# --- Find Step 4 Start ---
s4_start_marker = '{/* STEP 4: REVIEW & CONFIRM */}'
s4_start_idx = content.find(s4_start_marker)

# --- Find AnimatePresence End ---
end_marker = '</AnimatePresence>'
end_idx = content.find(end_marker)

pre_form = content[:s1_start_idx]
post_form = content[end_idx:]

old_step1 = content[s1_start_idx:s2_start_idx]
old_step2 = content[s2_start_idx:s3_start_idx]
old_step3 = content[s3_start_idx:s4_start_idx]
# old_step4 is deleted

# 1. Modify old_step1 to become step 2
new_step2 = old_step1.replace('step === 1 &&', 'step === 2 &&')
new_step2 = new_step2.replace('key="step1"', 'key="step2"')
new_step2 = new_step2.replace('Data Identitas Diri', 'Data Pribadi')
new_step2 = new_step2.replace('{/* STEP 1: PERSONAL DETAILS */}', '{/* STEP 2: DATA PRIBADI */}')

# Remove NIK block from new_step2
nik_start = new_step2.find('{/* NIK */}')
if nik_start != -1:
    nik_end = new_step2.find('</div>\n                </div>', nik_start) + len('</div>\n                </div>')
    # Find next div close
    nik_end = new_step2.find('</div>', nik_end) + len('</div>')
    # Maybe simpler: just use string replace for the NIK section if we can identify it.
    pass
