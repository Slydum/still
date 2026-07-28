# Install from a phone terminal

Place `still-github-ready.zip` in the root of your existing GitHub repository, then run:

```bash
mkdir -p /tmp/still-update
unzip -o still-github-ready.zip -d /tmp/still-update

rm -rf src public content
rm -f package.json index.html tsconfig.json IMPLEMENTATION_NOTES.md .gitignore

cp -a /tmp/still-update/. .
rm -rf /tmp/still-update still-github-ready.zip

npm install
npm run build

git add -A
git commit -m "Implement Still theme engine and quote library"
git push
```

This preserves the repository's `.git` folder and GitHub history while replacing the app source.
