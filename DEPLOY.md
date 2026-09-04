# Deploy Your Updated Website

Your updated `index.html` (with new personas, API key verification, and polish) is ready. To publish it to https://yg674-dev.github.io/ai-persona-chat/, run these commands in **Terminal** (outside Cursor):

## Option A: Fresh clone and deploy (recommended)

```bash
cd ~
git clone https://github.com/yg674-dev/ai-persona-chat.git ai-deploy-temp
cp ~/ai-persona-chat/index.html ai-deploy-temp/index.html
cd ai-deploy-temp
git add index.html
git commit -m "Polish: API key verification, 6 new personas, professional refinements"
git push origin main
cd ..
rm -rf ai-deploy-temp
```

## Option B: Via GitHub web (no Terminal needed)

1. Go to https://github.com/yg674-dev/ai-persona-chat
2. Click **index.html**
3. Click the **pencil icon** (Edit)
4. Select all (Cmd+A) and delete
5. Open `~/ai-persona-chat/index.html` in a text editor
6. Copy all content (Cmd+A, Cmd+C)
7. Paste into the GitHub editor
8. Click **Commit changes**

---

After pushing, GitHub Pages may take **1–2 minutes** to update. Refresh https://yg674-dev.github.io/ai-persona-chat/ to see the changes.
