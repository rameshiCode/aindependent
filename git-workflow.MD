## 🔹 Branches to Use

| Branch | Purpose |
|--------|---------|
| `master` | Stable, production-ready code (auto-deployed via GitHub Actions) |
| `develop` | Main development branch (new features merge here) |
| `feature/<name>` | Feature-specific branches (created from `develop`) |
| `bugfix/<name>` | Fixes for non-critical bugs (created from `develop`) |
| `hotfix/<name>` | Critical production fixes (created from `master`) |
| `release/<version>` | Pre-release testing branch |

---

## 🔥 Git Workflow

### **1️⃣ Start a New Feature**
```sh
git checkout develop  # Ensure you're on develop
git pull origin develop  # Get the latest changes
git checkout -b feature/<feature-name>  # Create a feature branch
# Example: git checkout -b feature/user-auth
```
🚀 _Work on the feature and commit regularly._  

```sh
git add .
git commit -m "Add <feature-name>"
git push origin feature/<feature-name>  # Push to remote repo
```

### **2️⃣ Merge Feature Into `develop`**
Once reviewed and tested, merge it:  
```sh
git checkout develop
git pull origin develop  # Ensure up-to-date
git merge feature/<feature-name>  # Merge the feature branch
git push origin develop  # Push the updated develop branch
git branch -d feature/<feature-name>  # Delete local feature branch
```

---

### **3️⃣ Prepare for Deployment**
Before deploying, finalize a release:  
```sh
git checkout -b release/<version> develop  # Example: release/v1.0
# Run final tests, fix minor bugs, update docs...
git checkout master
git merge release/<version>  # Merge into master
git push origin master  # Deploy (GitHub Actions will trigger)
git checkout develop
git merge release/<version>  # Keep develop updated
git push origin develop
git branch -d release/<version>
```

---

### **4️⃣ Fix Bugs**
For **non-critical bugs**, use `bugfix/`:
```sh
git checkout -b bugfix/<bug-name> develop
# Fix the issue...
git commit -m "Fix <bug-name>"
git push origin bugfix/<bug-name>
# Merge back to develop once tested
```

For **urgent production bugs**, use `hotfix/`:
```sh
git checkout -b hotfix/<bug-name> master
# Fix the issue...
git commit -m "Hotfix <bug-name>"
git push origin hotfix/<bug-name>
# Merge into both master and develop
git checkout master
git merge hotfix/<bug-name>
git push origin master  # Deploy
git checkout develop
git merge hotfix/<bug-name>
git push origin develop
git branch -d hotfix/<bug-name>
```

---


## ✅ Summary

1️⃣ `develop` → Main development branch.  
2️⃣ `feature/<name>` → Use for new features.  
3️⃣ `bugfix/<name>` → Non-critical bug fixes.  
4️⃣ `hotfix/<name>` → Urgent production fixes.  
5️⃣ `release/<version>` → Used before merging into `master`.  
6️⃣ `master` → **Production-ready, auto-deployed.**  

```sh
git checkout -b develop master
git checkout -b feature/example develop
git checkout -b bugfix/example develop
git checkout -b hotfix/example master
git checkout -b release/1.0 develop
```
---
🚀 Happy coding! 🎉

