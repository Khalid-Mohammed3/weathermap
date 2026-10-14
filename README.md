# WeatherMap
- **Student:** Khalid Mohammed Saleh Khalid
- **Student ID:** 202011276367
- **Department:** Software Engineering

An asynchronous, client-side **Single Page Application** built for the *Advanced Web Technologies* course (Project 2).
Type a city or place, and WeatherMap resolves its coordinates, moves the map there, and shows the current weather in an interactive popup, without ever reloading the page.

**Live demo:** `https://khalid-mohammed3.github.io/weathermap/`

## Features
- Geocoding with the Nominatim (OpenStreetMap) API, chained into the OpenWeatherMap Current Weather API.
- Leaflet map centred on Khartoum (15.5007, 32.5599) at zoom 6, with smooth `flyTo` animation to each result.
- Animated marker; the previous marker is removed on every new search.
- Popup with city name, temperature, clouds, humidity, wind speed and the official OpenWeatherMap icon.
- Loading spinner and user-friendly alert cards (empty input, place not found, 401 / 404 / 429 API errors, network failures).
- Map container fixed at 70% of the viewport height with a navy border and shadow.
- Responsive layout for mobile and desktop; custom-styled inputs with focus and hover transitions.
- **Bonus:** Share button (Web Share API, clipboard fallback) and **Favorites** saved in LocalStorage as quick-access chips.

## Tech stack
Semantic HTML5, CSS3, Vanilla JavaScript (ES6+, `fetch`, `async/await`). No frameworks, no jQuery, no d3.
Leaflet.js is used only as the map library (Option B in the spec).

## APIs used
| API | Purpose | Key needed |
|---|---|---|
| OpenWeatherMap Current Weather (`/data/2.5/weather`) | Weather data and icons | Yes (free) |
| Nominatim (OpenStreetMap) | Geocoding: place name to lat/lng | No |
| OpenStreetMap tiles via Leaflet | Map display | No |

## Setup
1. Create a free account at <https://openweathermap.org> and copy your API key from *API keys*.
   New keys can take up to two hours to activate.
2. Open `script.js` and replace the placeholder at the top:
   ```js
   const OWM_API_KEY = "YOUR_API_KEY_HERE";
   ```
3. Open `index.html` in a browser, or serve the folder locally:
   ```bash
   python -m http.server 8000
   ```
   then visit <http://localhost:8000>.

> The key is visible in front-end code because the project is purely client-side. Use a free-tier key only.

## Deploy on GitHub Pages
1. Push the files to a GitHub repository (`index.html`, `style.css`, `script.js`, `README.md` in the root).
2. In the repository go to **Settings → Pages**.
3. Under *Build and deployment*, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. After a minute the site is live at the URL shown on that page. Paste it in the "Live demo" line above.

## Project structure
```
weathermap/
├── index.html   # structure only (no inline JS or styles)
├── style.css    # all presentation
├── script.js    # all behaviour (listeners via addEventListener)
└── README.md
```

## How it works
1. **Phase 1:** the map initialises on Khartoum.
2. **Phase 2:** the form's submit event is intercepted (`preventDefault`) and the text is geocoded with Nominatim.
3. **Phase 3:** the coordinates are sent to OpenWeatherMap in a chained `fetch`.
4. **Phase 4:** the old marker is removed, a new one is placed, and the map flies to it.
5. **Phase 5:** a popup opens with the weather card, plus Share and Save buttons.

## Notes on rules
- No inline event handlers or inline styles in the HTML.
- All popup content is built with DOM methods and `textContent`, so API data is never injected as HTML.
