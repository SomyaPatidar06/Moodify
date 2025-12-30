try:
    from keybert import KeyBERT
    print("Loading KeyBERT model...")
    kw_model = KeyBERT('all-MiniLM-L6-v2')
    KEYBERT_AVAILABLE = True
except Exception as e:
    print(f"Warning: ML Engine could not load KeyBERT ({e}). Using simple fallback.")
    KEYBERT_AVAILABLE = False

def analyze_prompt(text):
    """
    Analyzes the user prompt to extract keywords and determine vibe.
    """
    if not text:
        return {'keywords': [], 'vibe': 'neutral'}

    if KEYBERT_AVAILABLE:
        try:
            # Extract keywords (top 1 or 2 to get the core subject)
            keywords = kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english', top_n=2)
            extracted_words = [kw[0] for kw in keywords]
        except Exception as e:
            print(f"Error during extraction: {e}")
            extracted_words = text.split()[:2]
    else:
        # Fallback: Simple split and keyword identifying
        # In a real scenario, we'd use NLTK or Spacy here if Torch fails
        words = text.lower().split()
        important_words = [w for w in words if len(w) > 3]
        extracted_words = important_words[:2]
    
    return {
        'keywords': extracted_words,
        'vibe': 'calm' # Placeholder vibe
    }
