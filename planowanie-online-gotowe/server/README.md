# Planowanie Online v2

## Nowe zasady
- Pełna talia 52 kart.
- Cała liczba kart w ręce jest rozdzielana równo według wariantu: 2 graczy = 26 lew, 3 = 16 lew, 4 = 13 lew.
- Każda kolejna runda ma o jedną kartę mniej, aż do 1.
- Przed każdą rundą odsłaniany jest jeden atut.
- Deklaracje są składane po kolei; suma deklaracji nie może być równa liczbie kart (hak).
- Obowiązkowe dokładanie do koloru.
- Najwyższy atut wygrywa lewę; bez atutu wygrywa najwyższa karta koloru wyjścia.
- Trafiona deklaracja: 10 + liczba wygranych lew. Nietrafiona: 0.
- Panel „Kartka wyników” przypomina fizyczną kartkę, na której zapisujemy deklaracje, liczbę kart, lewy i punkty.

## Wdrożenie
Server: Render, root `server`, `npm install`, `npm start`.
Frontend: Netlify, publish directory `frontend`.
Po wdrożeniu Render wpisz jego adres do `frontend/config.js` jako `window.PLANOWANIE_SERVER`.
