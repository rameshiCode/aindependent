import os
import sys

from dotenv import load_dotenv

# Add the backend directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Load environment variables from .env file
load_dotenv()

# Set test environment variable
os.environ["TESTING"] = "1"

# Optional: Set a mock OpenAI API key for testing if not already set
if not os.environ.get("OPENAI_API_KEY"):
    os.environ["OPENAI_API_KEY"] = "test_api_key"

# Optional: Set mock Stripe keys if not already set
if not os.environ.get("STRIPE_SECRET_KEY"):
    os.environ["STRIPE_SECRET_KEY"] = "test_stripe_secret_key"
if not os.environ.get("STRIPE_PUBLISHABLE_KEY"):
    os.environ["STRIPE_PUBLISHABLE_KEY"] = "test_stripe_publishable_key"
if not os.environ.get("STRIPE_WEBHOOK_SECRET"):
    os.environ["STRIPE_WEBHOOK_SECRET"] = "test_stripe_webhook_secret"
