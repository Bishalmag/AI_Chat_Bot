from groq import Groq
from django.conf import settings

client = Groq(api_key=settings.GROQ_API_KEY)