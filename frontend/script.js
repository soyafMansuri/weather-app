/* =========================================================
   Skyline — Weather Forecast App
   Handles: API calls, rendering, theme toggle, search history,
   auto-refresh, and the weather-reactive background animation.
========================================================= */

// ---------- Config ----------
// Change this if your Flask backend runs on a different host/port.
const API_BASE_URL = "http://127.0.0.1:5000";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const HISTORY_KEY = "skyline_recent_searches";
const THEME_KEY = "skyline_theme";
const MAX_HISTORY = 6;

// ---------- DOM References ----------
const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const historyRow = document.getElementById("historyRow");

const loader = document.getElementById("loader");
const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");
const weatherCard = document.getElementById("weatherCard");
const emptyState = document.getElementById("emptyState");

const cityName = document.getElementById("cityName");
const dateTime = document.getElementById("dateTime");
const description = document.getElementById("description");
const weatherIcon = document.getElementById("weatherIcon");
const temperature = document.getElementById("temperature");
const feelsLike = document.getElementById("feelsLike");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");
const pressure = document.getElementById("pressure");
const visibility = document.getElementById("visibility");
const sunrise = document.getElementById("sunrise");
const sunset = document.getElementById("sunset");

const themeToggle = document.getElementById("themeToggle");
const precipLayer = document.getElementById("precipLayer");

let refreshTimer = null;
let lastSearchedCity = null;

// =========================================================
// Theme (Light / Dark) Toggle
// =========================================================
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggle.querySelector(".theme-toggle__icon").textContent =
    theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

themeToggle.addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// =========================================================
// Recent Search History (localStorage)
// =========================================================
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveToHistory(city) {
  let history = getHistory().filter(
    (c) => c.toLowerCase() !== city.toLowerCase()
  );
  history.unshift(city);
  history = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  historyRow.innerHTML = "";

  history.forEach((city) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "history-chip";
    chip.textContent = city;
    chip.addEventListener("click", () => {
      cityInput.value = city;
      fetchWeather(city);
    });
    historyRow.appendChild(chip);
  });
}

// =========================================================
// UI State Helpers
// =========================================================
function showLoader() {
  loader.classList.remove("hidden");
  errorBox.classList.add("hidden");
  weatherCard.classList.add("hidden");
  emptyState.classList.add("hidden");
}

function showError(message) {
  loader.classList.add("hidden");
  errorBox.classList.remove("hidden");
  weatherCard.classList.add("hidden");
  emptyState.classList.add("hidden");
  errorText.textContent = message;
}

function showWeatherCard() {
  loader.classList.add("hidden");
  errorBox.classList.add("hidden");
  weatherCard.classList.remove("hidden");
  emptyState.classList.add("hidden");
}

// =========================================================
// Formatting Helpers
// =========================================================
// Converts a unix timestamp (seconds) + timezone offset (seconds)
// into a readable local time string for the searched city.
function formatCityTime(unixSeconds, timezoneOffsetSeconds) {
  const utcMillis = unixSeconds * 1000 + timezoneOffsetSeconds * 1000;
  const date = new Date(utcMillis);
  return date.toUTCString().replace(" GMT", "");
}

function formatClockOnly(unixSeconds, timezoneOffsetSeconds) {
  const utcMillis = unixSeconds * 1000 + timezoneOffsetSeconds * 1000;
  const date = new Date(utcMillis);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Maps OpenWeather's "main" field to a simplified key used for
// background theming: clear | clouds | rain | snow | default
function mapWeatherKey(main) {
  const key = (main || "").toLowerCase();
  if (key.includes("clear")) return "clear";
  if (key.includes("cloud")) return "clouds";
  if (key.includes("rain") || key.includes("drizzle") || key.includes("thunderstorm")) return "rain";
  if (key.includes("snow")) return "snow";
  return "default";
}

// =========================================================
// Animated Precipitation (rain drops / snow flakes)
// =========================================================
function clearPrecipitation() {
  precipLayer.innerHTML = "";
}

function renderPrecipitation(weatherKey) {
  clearPrecipitation();

  if (weatherKey === "rain") {
    for (let i = 0; i < 40; i++) {
      const drop = document.createElement("div");
      drop.className = "drop";
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.animationDuration = `${0.6 + Math.random() * 0.6}s`;
      drop.style.animationDelay = `${Math.random() * 2}s`;
      precipLayer.appendChild(drop);
    }
  } else if (weatherKey === "snow") {
    for (let i = 0; i < 30; i++) {
      const flake = document.createElement("div");
      flake.className = "flake";
      const size = 3 + Math.random() * 4;
      flake.style.width = `${size}px`;
      flake.style.height = `${size}px`;
      flake.style.left = `${Math.random() * 100}%`;
      flake.style.animationDuration = `${6 + Math.random() * 6}s`;
      flake.style.animationDelay = `${Math.random() * 5}s`;
      precipLayer.appendChild(flake);
    }
  }
}

// =========================================================
// Render Weather Data into the Card
// =========================================================
function renderWeather(data) {
  const weatherKey = mapWeatherKey(data.main);

  // Update background theme + animated precipitation
  document.body.setAttribute("data-weather", weatherKey);
  renderPrecipitation(weatherKey);

  cityName.textContent = `${data.city}, ${data.country}`;
  dateTime.textContent = formatCityTime(data.dt, data.timezone);
  description.textContent = data.description;

  weatherIcon.src = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
  weatherIcon.alt = data.description;

  temperature.textContent = data.temperature;
  feelsLike.textContent = `Feels like ${data.feels_like}°C`;

  humidity.textContent = `${data.humidity}%`;
  windSpeed.textContent = `${data.wind_speed} m/s`;
  pressure.textContent = `${data.pressure} hPa`;
  visibility.textContent = `${data.visibility.toFixed(1)} km`;

  sunrise.textContent = formatClockOnly(data.sunrise, data.timezone);
  sunset.textContent = formatClockOnly(data.sunset, data.timezone);

  showWeatherCard();
}

// =========================================================
// Fetch Weather from Flask Backend
// =========================================================
async function fetchWeather(city) {
  if (!city || !city.trim()) return;

  showLoader();

  try {
    const response = await fetch(
      `${API_BASE_URL}/weather?city=${encodeURIComponent(city.trim())}`
    );
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Could not fetch weather data.");
    }

    renderWeather(data);
    saveToHistory(data.city);
    lastSearchedCity = data.city;
    scheduleAutoRefresh();
  } catch (err) {
    showError(err.message || "Unable to connect to the weather server.");
  }
}

// =========================================================
// Auto-refresh every 5 minutes for the last searched city
// =========================================================
function scheduleAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (lastSearchedCity) {
      fetchWeather(lastSearchedCity);
    }
  }, REFRESH_INTERVAL_MS);
}

// =========================================================
// Event Listeners
// =========================================================
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  fetchWeather(cityInput.value);
});

// =========================================================
// Init
// =========================================================
function init() {
  initTheme();
  renderHistory();

  // Auto-load the most recent search on page load, if any
  const history = getHistory();
  if (history.length > 0) {
    cityInput.value = history[0];
    fetchWeather(history[0]);
  }
}

init();
