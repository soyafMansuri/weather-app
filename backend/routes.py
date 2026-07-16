"""
routes.py
----------
Contains all API route definitions for the Weather Forecast App.
Keeping routes in a separate file (instead of app.py) makes the project
modular and easier to scale (e.g. adding /forecast, /history, etc. later).
"""

import os
import requests
from flask import Blueprint, jsonify, request

# Blueprint lets us register these routes onto the main Flask app in app.py
weather_bp = Blueprint("weather_bp", __name__)

# Base URL for OpenWeather's "Current Weather Data" endpoint
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"


@weather_bp.route("/weather", methods=["GET"])
def get_weather():
    """
    GET /weather?city=London

    Fetches current weather data for the given city from OpenWeather API
    and returns a clean, frontend-friendly JSON response.
    """

    # 1. Read the city from query params
    city = request.args.get("city", "").strip()

    if not city:
        return jsonify({
            "success": False,
            "error": "City name is required. Example: /weather?city=London"
        }), 400

    # 2. Read API key from environment (loaded via .env in app.py)
    api_key = os.getenv("OPENWEATHER_API_KEY")

    if not api_key or api_key == "your_api_key_here":
        return jsonify({
            "success": False,
            "error": "Server misconfiguration: OpenWeather API key is missing. "
                     "Please set OPENWEATHER_API_KEY in your .env file."
        }), 500

    # 3. Build request params for OpenWeather
    params = {
        "q": city,
        "appid": api_key,
        "units": "metric"  # Celsius, m/s, hPa
    }

    try:
        response = requests.get(OPENWEATHER_BASE_URL, params=params, timeout=10)
    except requests.exceptions.RequestException as e:
        # Network-level error (no internet, DNS failure, timeout, etc.)
        return jsonify({
            "success": False,
            "error": f"Could not reach OpenWeather API: {str(e)}"
        }), 502

    # 4. Handle OpenWeather's own error responses
    if response.status_code == 404:
        return jsonify({
            "success": False,
            "error": f'City "{city}" not found. Please check the spelling and try again.'
        }), 404

    if response.status_code == 401:
        return jsonify({
            "success": False,
            "error": "Invalid API key. Please check your OPENWEATHER_API_KEY in .env"
        }), 401

    if response.status_code != 200:
        return jsonify({
            "success": False,
            "error": f"OpenWeather API returned an unexpected error (status {response.status_code})."
        }), response.status_code

    # 5. Parse and reshape the raw OpenWeather JSON into a clean structure
    raw = response.json()

    try:
        weather_data = {
            "success": True,
            "city": raw["name"],
            "country": raw["sys"]["country"],
            "temperature": round(raw["main"]["temp"]),
            "feels_like": round(raw["main"]["feels_like"]),
            "humidity": raw["main"]["humidity"],
            "pressure": raw["main"]["pressure"],
            "wind_speed": raw["wind"]["speed"],
            "visibility": raw.get("visibility", 0) / 1000,  # meters -> km
            "description": raw["weather"][0]["description"].title(),
            "main": raw["weather"][0]["main"],  # e.g. Rain, Clear, Clouds, Snow
            "icon": raw["weather"][0]["icon"],  # OpenWeather icon code
            "sunrise": raw["sys"]["sunrise"],
            "sunset": raw["sys"]["sunset"],
            "timezone": raw["timezone"],  # shift in seconds from UTC
            "dt": raw["dt"],  # current data calculation time (unix, UTC)
            "coord": raw.get("coord", {})
        }
    except (KeyError, IndexError) as e:
        return jsonify({
            "success": False,
            "error": f"Unexpected response format from OpenWeather API: missing {str(e)}"
        }), 500

    return jsonify(weather_data), 200


@weather_bp.route("/health", methods=["GET"])
def health_check():
    """Simple health check endpoint — useful for uptime monitoring / DevOps checks."""
    return jsonify({"status": "ok", "service": "weather-app-backend"}), 200
