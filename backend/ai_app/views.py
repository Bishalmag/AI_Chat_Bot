from rest_framework.decorators import api_view
from rest_framework.response import Response
from .utils import client
import base64
from django.views.decorators.csrf import csrf_exempt
@csrf_exempt

# CHAT
@api_view(['POST'])
def chat(request):
    msg = request.data.get('message')
    res = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": msg}]
    )
    return Response({"reply": res.choices[0].message.content})

# REASONING (heavier model, more thinking)
@api_view(['POST'])
def reason(request):
    msg = request.data.get('message')
    res = client.chat.completions.create(
        model="openai/gpt-oss-120b",  # bigger model, better reasoning
        messages=[{"role": "user", "content": msg}]
    )
    return Response({"reply": res.choices[0].message.content})

# IMAGE GEN
@api_view(['POST'])
def image(request):
    prompt = request.data.get('prompt')
    url = f"https://image.pollinations.ai/prompt/{prompt}"
    return Response({"url": url})

# VOICE: speech-to-text (Whisper)
@api_view(['POST'])
def transcribe(request):
    audio_file = request.FILES['audio']
    res = client.audio.transcriptions.create(
        model="whisper-large-v3",
        file=(audio_file.name, audio_file.read()),
    )
    return Response({"text": res.text})

# VOICE: text-to-speech
@api_view(['POST'])
def speak(request):
    text = request.data.get('text')
    res = client.audio.speech.create(
        model="canopylabs/orpheus-v1-english",
        voice="troy",
        input=text,
        response_format="wav"
    )
    audio_b64 = base64.b64encode(res.read()).decode()
    return Response({"audio_base64": audio_b64})