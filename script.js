
const AQICN_TOKEN = window.AQICN_TOKEN;       
const OPENWEATHER_KEY = window.OPENWEATHER_KEY;

function isIndia(name) {
  return name.toLowerCase().includes("india") || name.toLowerCase().includes(", in");
}

async function getCoordinates(city) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.length) throw new Error("City not found");

  return {
    lat: data[0].lat,
    lon: data[0].lon,
    name: `${data[0].name}, ${data[0].country}`
  };
}

async function getAQIData(city) {
  const url = `https://api.waqi.info/feed/${encodeURIComponent(city)}/?token=${AQICN_TOKEN}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status !== "ok") throw new Error("AQI data not available");

  const iaqi = json.data.iaqi || {};
  const cityName = json.data.city.name;

  return {
    aqi: json.data.aqi,        
    pm25: iaqi.pm25?.v ?? "--",
    pm10: iaqi.pm10?.v ?? "--",
    source: isIndia(cityName)
      ? "CPCB (India) via AQICN"
      : "AQICN Global Monitoring Network"
  };
}

async function getWeatherData(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.cod !== 200) throw new Error("Weather data not available");

  return {
    temp: Math.round(data.main.temp),
    humidity: data.main.humidity,
    wind: Math.round(data.wind.speed * 3.6), // km/h
    pressure: data.main.pressure,
    condition: data.weather[0].main
  };
}

const citySearchInput = document.getElementById("citySearch");
const searchBtn = document.getElementById("searchBtn");
const refreshBtn = document.getElementById("refreshBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const errorText = document.getElementById("errorText");

const locationElement = document.getElementById("location");
const aqiNumber = document.getElementById("aqiNumber");
const aqiStatus = document.getElementById("aqiStatus");
const pm25Value = document.getElementById("pm25Value");
const pm10Value = document.getElementById("pm10Value");
const temperature = document.getElementById("temperature");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");
const pressure = document.getElementById("pressure");
const weatherCondition = document.getElementById("weatherCondition");
const lastUpdated = document.getElementById("lastUpdated");

function showLoading(msg = "Loading...") {
  loadingMessage.textContent = msg;
  loadingOverlay.style.display = "flex";
}
function hideLoading() {
  loadingOverlay.style.display = "none";
}
function showError(msg) {
  errorText.textContent = msg;
  errorMessage.style.display = "flex";
  setTimeout(() => (errorMessage.style.display = "none"), 5000);
}
function updateTime() {
  const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  lastUpdated.textContent = `Updated: ${t}`;
}

function aqiCategory(aqi) {
  if (aqi <= 50) return { label: "Good", color: "#10b981" };
  if (aqi <= 100) return { label: "Moderate", color: "#f59e0b" };
  if (aqi <= 150) return { label: "Unhealthy (SG)", color: "#f97316" };
  if (aqi <= 200) return { label: "Unhealthy", color: "#ef4444" };
  if (aqi <= 300) return { label: "Very Unhealthy", color: "#8b5cf6" };
  return { label: "Hazardous", color: "#7c3aed" };
}

function updateDashboard(data) {
  locationElement.textContent = data.name;

  aqiNumber.textContent = data.aqi;
  const cat = aqiCategory(data.aqi);
  aqiStatus.textContent = cat.label;
  aqiNumber.style.color = cat.color;

  pm25Value.innerHTML = `${data.pm25}<span class="pollutant-unit">µg/m³</span>`;
  pm10Value.innerHTML = `${data.pm10}<span class="pollutant-unit">µg/m³</span>`;

  temperature.innerHTML = `${data.temp}<span class="weather-unit">°C</span>`;
  humidity.innerHTML = `${data.humidity}<span class="weather-unit">%</span>`;
  windSpeed.innerHTML = `${data.wind}<span class="weather-unit">km/h</span>`;
  pressure.innerHTML = `${data.pressure}<span class="weather-unit">hPa</span>`;
  weatherCondition.textContent = data.condition;

  updateAQICardBackground(data.aqi);
  updateScaleMarker(data.aqi); 
  updateTime();
}

function updateAQICardBackground(aqi) {
    const card = document.getElementById("aqiCard");
    if (!card) return;

    card.className = "card aqi-effect";

    if (aqi <= 50) card.classList.add("aqi-good");
    else if (aqi <= 100) card.classList.add("aqi-moderate");
    else if (aqi <= 200) card.classList.add("aqi-poor");
    else if (aqi <= 300) card.classList.add("aqi-unhealthy");
    else if (aqi <= 400) card.classList.add("aqi-severe");
    else card.classList.add("aqi-hazardous");
}




let currentCity = null;

async function loadCity(city) {
  try {
    showLoading("Fetching live AQI & weather...");
    const loc = await getCoordinates(city);
    const aqi = await getAQIData(city);
    const weather = await getWeatherData(loc.lat, loc.lon);

    updateDashboard({
      name: loc.name,
      aqi: aqi.aqi,
      pm25: aqi.pm25,
      pm10: aqi.pm10,
      temp: weather.temp,
      humidity: weather.humidity,
      wind: weather.wind,
      pressure: weather.pressure,
      condition: weather.condition
    });

    currentCity = city;
  } catch (e) {
    showError(e.message);
  } finally {
    hideLoading();
  }
}

function updateScaleMarker(aqi) {
  const marker = document.getElementById("scaleMarker");
  const tooltip = document.getElementById("scaleTooltip");
  if (!marker) return;

  const cappedAQI = Math.min(Math.max(aqi, 0), 500);
  const percent = (cappedAQI / 500) * 100;

  marker.style.left = percent + "%";

  const cat = aqiCategory(aqi);
  tooltip.innerHTML = `<strong>AQI: ${aqi}</strong><br>${cat.label}`;
}

searchBtn.addEventListener("click", () => {
  const city = citySearchInput.value.trim();
  if (city) loadCity(city);
});
refreshBtn.addEventListener("click", () => currentCity && loadCity(currentCity));
citySearchInput.addEventListener("keypress", e => {
  if (e.key === "Enter") {
    const city = citySearchInput.value.trim();
    if (city) loadCity(city);
  }
});

// document.addEventListener("DOMContentLoaded", () => {
//   loadCity("New York");
// });
