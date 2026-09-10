# Planowanie Online — Netlify + Render

## 1. Serwer multiplayer na Render
1. Wrzuć repozytorium projektu na GitHub.
2. Na Render wybierz New → Web Service i wskaż repozytorium.
3. Root Directory: `server`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Po wdrożeniu skopiuj adres HTTPS, np. `https://planowanie-server.onrender.com`

## 2. Strona na Netlify
1. W folderze `frontend/config.js` wpisz:
   `window.PLANOWANIE_SERVER = "https://TWÓJ-SERWER.onrender.com";`
2. W Netlify wybierz Add new site → Deploy manually albo połącz repozytorium.
3. Publish directory: `frontend`
4. Otwórz domenę Netlify.

## 3. Gra
Gracze wchodzą na stronę Netlify, jedna osoba tworzy pokój, pozostali wpisują kod. Maksymalnie 4 osoby.
