import re

with open("src/App.tsx", "r") as f:
    content = f.read()

old_usage = """                <RegistrationForm
                  onSubmit={handleFormSubmit}
                  isSubmitting={isFormSubmitting}
                  initialData={editingStudent}
                  rooms={rooms}
                  recitationClasses={recitationClasses}
                  schoolClasses={schoolClasses}
                  students={students}
                  onCancel={() => {
                    setEditingStudent(null);
                    setActiveTab("list");
                  }}
                />"""

new_usage = """                <RegistrationForm
                  onSubmit={handleFormSubmit}
                  isSubmitting={isFormSubmitting}
                  initialData={editingStudent}
                  onCancel={() => {
                    setEditingStudent(null);
                    setActiveTab("list");
                  }}
                />"""

content = content.replace(old_usage, new_usage)

with open("src/App.tsx", "w") as f:
    f.write(content)
