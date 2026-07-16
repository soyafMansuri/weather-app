"""
app.py
------
Entry point of the Flask backend.
Responsible for:
  - Loading environment variables (.env)
  - Creating the Flask app
  - Enabling CORS (so the frontend can call the API from a different origin)
  - Registering the weather blueprint (routes.py)
  - Global error handlers
"""

import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from routes import weather_bp

# Load variables from .env into the environment (OPENWEATHER_API_KEY, etc.)
load_dotenv()


def create_app():
    """Application factory pattern — makes testing and scaling easier."""
    app = Flask(__name__)

    # Allow the frontend (served separately, e.g. via Live Server / different port)
    # to make requests to this API.
    CORS(app)

    # Register all /weather and /health routes
    app.register_blueprint(weather_bp)

    # ---------- Global Error Handlers ----------

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Endpoint not found."}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"success": False, "error": "Internal server error."}), 500

    @app.route("/")
    def index():
        return jsonify({
            "message": "Weather Forecast API is running.",
            "usage": "/weather?city=London"
        })

    return app


app = create_app()

if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True") == "True"

    app.run(host=host, port=port, debug=debug)
