from flask import Flask, render_template, request, jsonify
from ml_engine import analyze_prompt
import os
import requests
import random
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate():
    data = request.json
    user_prompt = data.get('prompt', '')
    
    # Analyze prompt using ML
    analysis_result = analyze_prompt(user_prompt)
    
    # Real Pexels API Call
    api_key = os.getenv('PEXELS_API_KEY')
    video_url = ''
    
    if api_key and analysis_result['keywords']:
        try:
            # IMPROVED QUERY LOGIC:
            # 1. Use the main keyword alone (cleaner results than adding vibe).
            search_query = user_prompt
            if analysis_result['keywords']:
                search_query = analysis_result['keywords'][0]

            print(f"Searching Pexels for: {search_query}")

            headers = {'Authorization': api_key}
            # Fetch a few more to filter
            params = {'query': search_query, 'per_page': 15, 'orientation': 'landscape', 'size': 'medium'}
            
            response = requests.get('https://api.pexels.com/videos/search', headers=headers, params=params)
            data = response.json()
            
            # RETRY LOGIC: If no results, try just the last word of the keyword (usually the noun)
            # e.g. "driving thunderstorm" -> "thunderstorm"
            if not data.get('videos') and ' ' in search_query:
                fallback_query = search_query.split()[-1]
                print(f"No results. Retrying with: {fallback_query}")
                params['query'] = fallback_query
                response = requests.get('https://api.pexels.com/videos/search', headers=headers, params=params)
                data = response.json()

            if data.get('videos'):
                videos = data['videos']
                # Filter for HD if possible (width >= 1280)
                hd_videos = [v for v in videos if v['width'] >= 1280]
                
                # Pick the best one. 
                # If we have HD videos, pick the first one.
                if hd_videos:
                    video_url = hd_videos[0]['video_files'][0]['link']
                    # Try to find high quality specific link if available
                    for vf in hd_videos[0]['video_files']:
                         if vf['quality'] == 'hd' and vf['width'] >= 1280:
                             video_url = vf['link']
                             break
                else:
                    # Fallback to whatever we found
                    video_url = videos[0]['video_files'][0]['link']
                    
        except Exception as e:
            print(f"Error fetching from Pexels: {e}")

            
        except Exception as e:
            print(f"Error fetching from Pexels: {e}")

    # Fallback/Default Video
    if not video_url:
        video_map = {
            'rain': 'https://videos.pexels.com/video-files/856882/856882-hd_1920_1080_30fps.mp4',
            'calm': 'https://videos.pexels.com/video-files/856882/856882-hd_1920_1080_30fps.mp4',
            'nature': 'https://videos.pexels.com/video-files/1536322/1536322-hd_1920_1080_30fps.mp4',
            'city': 'https://videos.pexels.com/video-files/1722882/1722882-hd_1920_1080_30fps.mp4',
            'study': 'https://videos.pexels.com/video-files/3205634/3205634-hd_1920_1080_25fps.mp4',
            'space': 'https://videos.pexels.com/video-files/3129957/3129957-hd_1920_1080_25fps.mp4',
        }
        
        video_url = video_map.get('calm')
        for key in video_map:
            if key in user_prompt.lower():
                video_url = video_map[key]
                break

    # --- AUDIO LOGIC REMOVED (Request: Single Mode YouTube Only) ---
    # audio_url is no longer generated.

    # --- AUDIO LOGIC (Restored Freesound) ---
    freesound_key = os.getenv('FREESOUND_API_KEY')
    audio_url = ""
    
    # Map vibe to specific Freesound queries for better results
    sound_map = {
        'gym': 'gym ambience', 
        'workout': 'fitness gym',
        'rain': 'rain loop',
        'thunderstorm': 'thunderstorm loop',
        'forest': 'forest birds loop',
        'nature': 'nature ambience',
        'ocean': 'ocean waves loop',
        'city': 'city traffic ambience',
        'cafe': 'coffee shop ambience',
        'study': 'library ambience',
        'party': 'party crowd ambience'
    }
    
    # Determine search term
    search_term = "ambience" # fallback
    check_list = analysis_result['keywords'] + user_prompt.lower().split()
    for word in check_list:
        if word.lower() in sound_map:
            search_term = sound_map[word.lower()]
            break
    if search_term == "ambience":
         search_term = f"{user_prompt} ambience"

    print(f"Searching Freesound for: {search_term}")

    if freesound_key:
        try:
            # Search for sounds
            fs_url = "https://freesound.org/apiv2/search/text/"
            params = {
                'query': search_term,
                'token': freesound_key,
                'fields': 'id,name,previews',
                'filter': 'duration:[15 TO 300]' # Avoid too short/long
            }
            fs_response = requests.get(fs_url, params=params)
            fs_data = fs_response.json()
            
            if fs_data.get('results'):
                # Randomly pick from top 3 results for variety
                import random
                results = fs_data['results'][:5]
                if results:
                    selected_sound = random.choice(results)
                    # Prefer high quality MP3
                    if 'previews' in selected_sound:
                        audio_url = selected_sound['previews'].get('preview-hq-mp3') or selected_sound['previews'].get('preview-lq-mp3')
                        print(f"Selected Audio: {selected_sound['name']}")
        except Exception as e:
            print(f"Freesound Error: {e}")

    # Fallback Audio (Local or reliable URL if API fails)
    if not audio_url:
        # Default to a nice rain sound if all else fails
        audio_url = "https://cdn.freesound.org/previews/532/532299_11634568-lq.mp3"

    return jsonify({
        'status': 'success',
        'keywords': analysis_result['keywords'],
        'vibe': analysis_result['vibe'],
        'video_url': video_url,
        'audio_url': audio_url # RESTORED
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
