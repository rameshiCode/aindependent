# Option 1: Create a new common module for shared functionality

# Create a new file: app/services/openai_client.py
"""
Common module that provides OpenAI client functionality.
This breaks the circular dependency between openai.py and profile_extractor.py
"""
import logging
import os

import httpx
from openai import AsyncOpenAI

# Configure logging
logger = logging.getLogger(__name__)

# Initialize client variables
api_key = None
openai_client = None


def initialize_openai_client():
    """Initialize the OpenAI client with proper settings"""
    global api_key, openai_client

    # Get API key from environment variables
    possible_key_names = [
        "OPENAI_API_KEY",
        "OPENAI_KEY",
        "OPENAI_SECRET_KEY",
        "OPENAI_TOKEN",
        "openai_api_key",
    ]

    for key_name in possible_key_names:
        value = os.environ.get(key_name)
        if value:
            logger.info(f"Found key using name: {key_name}")
            api_key = value
            break

    if not api_key:
        logger.error("OpenAI API key not found in any expected variable names!")
        return None

    try:
        # Create custom HTTP client with improved settings
        http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=30.0),
            verify=True,
        )
        openai_client = AsyncOpenAI(api_key=api_key, http_client=http_client)
        logger.info("OpenAI client initialized successfully")
        return openai_client
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {str(e)}")
        logger.exception("Detailed exception:")
        return None


def get_openai_client():
    """Get the OpenAI client, initializing it if necessary"""
    global openai_client

    if not openai_client:
        initialize_openai_client()

    return openai_client


# Initialize client on module import
initialize_openai_client()
