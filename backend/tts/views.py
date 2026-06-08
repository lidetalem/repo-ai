import requests
from django.http import HttpResponse


def speak_amharic(request):
    text = request.GET.get('text', '')
    if not text:
        return HttpResponse('No text provided', status=400)

    url = 'https://translate.google.com/translate_tts'
    params = {
        'ie': 'UTF-8',
        'tl': 'am',
        'client': 'tw-ob',
        'q': text,
    }
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://translate.google.com/',
    }

    response = requests.get(url, params=params, headers=headers, stream=True, timeout=15)
    if response.status_code != 200:
        return HttpResponse('Failed to generate speech', status=502)

    return HttpResponse(response.content, content_type='audio/mpeg')
