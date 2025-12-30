from youtubesearchpython import VideosSearch
import random

print("Testing YouTube Search...")
try:
    search_query = "gym motivation mix nocopyright"
    videosSearch = VideosSearch(search_query, limit=10)
    results = videosSearch.result()
    
    if results and 'result' in results:
        print(f"Found {len(results['result'])} videos.")
        for v in results['result']:
            print(f"- {v['title']} ({v['id']})")
            
        selected = random.choice(results['result'])
        print(f"\nRandom Selection: {selected['title']} -> {selected['id']}")
    else:
        print("No results found.")
        
except Exception as e:
    print(f"CRITICAL ERROR: {e}")
