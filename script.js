"use strict";

/* ==========================================================================
   WeatherMap - asynchronous client-side SPA
   Map: Leaflet.js + OpenStreetMap (Option B)
   Geocoding: Nominatim | Weather: OpenWeatherMap Current Weather API
   ========================================================================== */

/* ---------- Configuration ---------- */
const OWM_API_KEY = "80de643cf3414bea96f25227fae9b84f"; 
const OWM_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather";
const OWM_ICON_URL = "https://openweathermap.org/img/wn/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const DEFAULT_VIEW = { lat: 15.5007, lng: 32.5599, zoom: 6 }; // Khartoum, Sudan
const RESULT_ZOOM = 10;
const FAVORITES_KEY = "weathermap:favorites";

/* ---------- State ---------- */
let map = null;
let marker = null;
const els = {};

/* ---------- Custom error type for messages shown to the user ---------- */
class AppError extends Error {}

/* ==========================================================================
   Startup (Phase 1: DOM setup & map init)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", init);

function init() {
  els.form = document.getElementById("search-form");
  els.input = document.getElementById("location-input");
  els.button = document.getElementById("submit-btn");
  els.spinner = document.getElementById("spinner");
  els.alerts = document.getElementById("alert-area");
  els.favorites = document.getElementById("favorites");
  els.favoritesList = document.getElementById("favorites-list");
  els.map = document.getElementById("map");

  try {
    initMap();
  } catch (err) {
    showAlert("error", "The map could not be loaded. Check your internet connection and reload the page.");
    console.error(err);
  }

  els.form.addEventListener("submit", handleSubmit);
  renderFavorites();
}

function initMap() {
  if (typeof L === "undefined") {
    throw new Error("Leaflet failed to load.");
  }
  map = L.map(els.map).setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

/* ==========================================================================
   Form handling (Phase 2 entry point)
   ========================================================================== */
async function handleSubmit(event) {
  event.preventDefault(); // never refresh the page
  const query = els.input.value.trim();

  clearAlerts();
  if (!query) {
    showAlert("error", "Please enter a city or place name first.");
    els.input.focus();
    return;
  }
  await searchLocation(query);
}

async function searchLocation(query) {
  clearAlerts();
  setLoading(true);
  try {
    const place = await geocode(query);                       // Phase 2
    const weather = await fetchWeather(place);                // Phase 3
    showOnMap(place, weather);                                // Phases 4 & 5
  } catch (err) {
    if (err instanceof AppError) {
      showAlert("error", err.message);
    } else if (err instanceof TypeError) {
      showAlert("error", "Network problem. Check your internet connection and try again.");
      console.error(err);
    } else {
      showAlert("error", "Something went wrong. Please try again.");
      console.error(err);
    }
  } finally {
    setLoading(false);
  }
}

/* ==========================================================================
   Phase 2: Asynchronous geocoding (Nominatim)
   ========================================================================== */
async function geocode(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    "accept-language": "en"
  });
  const response = await fetch(`${NOMINATIM_URL}?${params}`);

  if (!response.ok) {
    throw new AppError("The location service is not responding right now. Try again in a moment.");
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new AppError(`We couldn't find "${query}". Check the spelling or try a larger nearby city.`);
  }

  const best = results[0];
  return {
    lat: parseFloat(best.lat),
    lng: parseFloat(best.lon),
    displayName: best.display_name || query
  };
}

/* ==========================================================================
   Phase 3: Chained fetch to OpenWeatherMap
   ========================================================================== */
async function fetchWeather(place) {
  if (!OWM_API_KEY || OWM_API_KEY === "YOUR_API_KEY_HERE") {
    throw new AppError("The OpenWeatherMap API key is missing. Add your key to OWM_API_KEY in script.js.");
  }

  const params = new URLSearchParams({
    lat: place.lat,
    lon: place.lng,
    appid: OWM_API_KEY,
    units: "metric"
  });
  const response = await fetch(`${OWM_WEATHER_URL}?${params}`);

  if (response.status === 404) {
    throw new AppError("No weather data was found for this location.");
  }
  if (response.status === 401) {
    throw new AppError("The OpenWeatherMap API key was rejected. New keys can take up to two hours to activate.");
  }
  if (response.status === 429) {
    throw new AppError("Too many requests. Wait a minute, then try again.");
  }
  if (!response.ok) {
    throw new AppError("The weather service is not responding right now. Try again in a moment.");
  }

  const data = await response.json();
  return parseWeather(data, place);
}

/* Extract the nested JSON fields we need */
function parseWeather(data, place) {
  const condition = (data.weather && data.weather[0]) || {};
  const fallbackName = place.displayName.split(",")[0].trim();

  return {
    city: data.name || fallbackName,
    country: (data.sys && data.sys.country) || "",
    temp: Math.round(data.main.temp),
    humidity: data.main.humidity,
    wind: data.wind ? data.wind.speed : 0,
    clouds: data.clouds ? data.clouds.all : 0,
    description: condition.description || "No description",
    icon: condition.icon || "01d"
  };
}

/* ==========================================================================
   Phase 4: Center map & marker  |  Phase 5: InfoWindow (popup)
   ========================================================================== */
function showOnMap(place, weather) {
  // Clear the previous marker from map memory
  if (marker) {
    map.removeLayer(marker);
    marker = null;
  }

  const pinIcon = L.divIcon({
    className: "weather-pin",
    html: '<span class="pin-dot"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14]
  });

  marker = L.marker([place.lat, place.lng], { icon: pinIcon, title: weather.city }).addTo(map);
  marker.bindPopup(buildPopup(weather), { maxWidth: 260, autoPanPadding: [20, 20] });

  // Smooth animated centering, then open the popup
  map.once("moveend", () => {
    if (marker) marker.openPopup();
  });
  map.flyTo([place.lat, place.lng], RESULT_ZOOM, { duration: 1.6 });
}

/* Build the popup as a DOM node (no innerHTML with API data) */
function buildPopup(weather) {
  const card = createEl("div", "popup-card");

  const head = createEl("div", "popup-head");
  head.append(createEl("h2", "popup-city", weather.city));
  if (weather.country) head.append(createEl("p", "popup-country", weather.country));

  const main = createEl("div", "popup-main");
  const icon = createEl("img", "popup-icon");
  icon.src = `${OWM_ICON_URL}${weather.icon}@2x.png`;
  icon.alt = weather.description;
  main.append(icon, createEl("span", "popup-temp", `${weather.temp}°C`));

  const desc = createEl("p", "popup-desc", weather.description);

  const stats = createEl("ul", "popup-stats");
  stats.append(
    statItem("Clouds", `${weather.clouds}%`),
    statItem("Humidity", `${weather.humidity}%`),
    statItem("Wind", `${weather.wind} m/s`)
  );

  const actions = createEl("div", "popup-actions");
  const shareBtn = createEl("button", "popup-btn", "Share");
  shareBtn.type = "button";
  shareBtn.addEventListener("click", () => shareWeather(weather));

  const saveBtn = createEl("button", "popup-btn", "Save city");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => saveFavorite(weather.city));

  actions.append(shareBtn, saveBtn);
  card.append(head, main, desc, stats, actions);
  return card;
}

function statItem(label, value) {
  const li = createEl("li", "popup-stat");
  li.append(createEl("span", "popup-stat-value", value), createEl("span", "popup-stat-label", label));
  return li;
}

/* ==========================================================================
   Bonus: Share Weather (Web Share API with clipboard fallback)
   ========================================================================== */
async function shareWeather(weather) {
  const text =
    `Weather in ${weather.city}: ${weather.temp}°C, ${weather.description}. ` +
    `Humidity ${weather.humidity}%, wind ${weather.wind} m/s, clouds ${weather.clouds}%.`;

  try {
    if (navigator.share) {
      await navigator.share({ title: `Weather in ${weather.city}`, text });
      return;
    }
    await navigator.clipboard.writeText(text);
    showAlert("success", "Weather message copied. Paste it into any chat.", true);
  } catch (err) {
    if (err && err.name === "AbortError") return; // user closed the share sheet
    showAlert("error", "Sharing isn't available in this browser. Copy the details from the card instead.");
  }
}

/* ==========================================================================
   Bonus: Favorites (LocalStorage)
   ========================================================================== */
function getFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (err) {
    return [];
  }
}

function setFavorites(list) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch (err) {
    showAlert("error", "Your favorites could not be saved in this browser.");
  }
}

function saveFavorite(city) {
  const list = getFavorites();
  if (list.some((name) => name.toLowerCase() === city.toLowerCase())) {
    showAlert("success", `${city} is already in your favorites.`, true);
    return;
  }
  list.push(city);
  setFavorites(list);
  renderFavorites();
  showAlert("success", `${city} saved to favorites.`, true);
}

function removeFavorite(city) {
  setFavorites(getFavorites().filter((name) => name !== city));
  renderFavorites();
}

function renderFavorites() {
  const list = getFavorites();
  els.favoritesList.replaceChildren();
  els.favorites.classList.toggle("hidden", list.length === 0);

  list.forEach((city) => {
    const chip = createEl("div", "chip");

    const nameBtn = createEl("button", "chip-name", city);
    nameBtn.type = "button";
    nameBtn.addEventListener("click", () => {
      els.input.value = city;
      searchLocation(city);
    });

    const removeBtn = createEl("button", "chip-remove", "×");
    removeBtn.type = "button";
    removeBtn.setAttribute("aria-label", `Remove ${city} from favorites`);
    removeBtn.addEventListener("click", () => removeFavorite(city));

    chip.append(nameBtn, removeBtn);
    els.favoritesList.append(chip);
  });
}

/* ==========================================================================
   UI helpers: loading state and alert cards
   ========================================================================== */
function setLoading(isLoading) {
  els.spinner.classList.toggle("hidden", !isLoading);
  els.button.disabled = isLoading;
}

function showAlert(type, message, autoDismiss = false) {
  const alert = createEl("div", `alert alert-${type}`);
  alert.setAttribute("role", type === "error" ? "alert" : "status");
  alert.append(createEl("p", "alert-text", message));

  const close = createEl("button", "alert-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss message");
  close.addEventListener("click", () => alert.remove());
  alert.append(close);

  els.alerts.append(alert);
  if (autoDismiss) setTimeout(() => alert.remove(), 3500);
}

function clearAlerts() {
  els.alerts.replaceChildren();
}

function createEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
