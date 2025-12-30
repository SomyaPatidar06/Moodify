document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const userPrompt = document.getElementById('user-prompt');
    const statusMsg = document.getElementById('status-msg');
    const bgVideo = document.getElementById('bg-video');
    const micBtn = document.getElementById('mic-btn');

    // --- VOICE CONTROL ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        // Simplified Config for reliability
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('listening')) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch (e) {
                    console.error(e);
                    alert("Could not start microphone: " + e.message);
                }
            }
        });

        recognition.onstart = () => {
            micBtn.classList.add('listening');
            statusMsg.textContent = "Listening...";
        };

        recognition.onsoundstart = () => {
            // statusMsg.textContent = "Sound detected... processing";
        };

        recognition.onspeechstart = () => {
            // statusMsg.textContent = "Speech detected...";
        };

        recognition.onend = () => {
            micBtn.classList.remove('listening');
            if (statusMsg.textContent.includes("Listening") || statusMsg.textContent.includes("Sound")) {
                statusMsg.textContent = "";
            }
        };

        recognition.onnomatch = (event) => {
            statusMsg.textContent = "No speech recognized.";
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (interimTranscript) {
                statusMsg.textContent = `...${interimTranscript}`;
            }

            if (finalTranscript) {
                statusMsg.textContent = `Heard: "${finalTranscript}"`;
                userPrompt.value = finalTranscript;
                setTimeout(() => {
                    generateBtn.click();
                }, 500);
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            micBtn.classList.remove('listening');

            if (event.error === 'no-speech') {
                statusMsg.textContent = "No speech detected (Timeout).";
            } else if (event.error === 'audio-capture') {
                statusMsg.textContent = "No microphone found.";
            } else if (event.error === 'not-allowed') {
                statusMsg.textContent = "Microphone permission denied.";
            } else {
                statusMsg.textContent = `Voice Error: ${event.error}`;
            }
        };
    } else {
        micBtn.style.display = 'none';
        console.log("Web Speech API not supported.");
        statusMsg.textContent = "Voice control not supported.";
    }

    // --- UI/STATE VARIABLES ---
    let currentVibe = null; // Stores {prompt, audio: url, video: url}

    // --- FAVORITES SYSTEM ---
    const favBtn = document.getElementById('fav-btn');
    const favCard = document.getElementById('fav-card'); // .menu-card
    const closeFavBtn = document.getElementById('close-fav');
    const likeBtn = document.getElementById('like-btn');
    const favList = document.getElementById('fav-list');

    // Helper: Toggle Side-Panel (Ensures only one is open)
    function togglePanel(panelToShow) {
        // If the requested panel is already active, close it
        if (panelToShow.classList.contains('active')) {
            panelToShow.classList.remove('active');
            setTimeout(() => panelToShow.classList.add('hidden'), 600);
            return;
        }

        // Close any other open panels first
        const panels = document.querySelectorAll('.menu-card');
        panels.forEach(p => {
            if (p !== panelToShow && p.classList.contains('active')) {
                p.classList.remove('active');
                setTimeout(() => p.classList.add('hidden'), 600);
            }
        });

        // Open requested panel
        panelToShow.classList.remove('hidden');
        setTimeout(() => panelToShow.classList.add('active'), 10);
    }

    function loadFavorites() {
        const favs = JSON.parse(localStorage.getItem('moodify_favs')) || [];
        favList.innerHTML = '';

        if (favs.length === 0) {
            favList.innerHTML = '<p class="empty-msg">No saved vibes yet. Generate one and click ♡!</p>';
            return;
        }

        favs.forEach((fav, index) => {
            const item = document.createElement('div');
            item.className = 'fav-item';
            item.innerHTML = `
                <span class="fav-play-icon">▶</span>
                <span class="fav-text">${fav.prompt}</span>
                <span style="margin-left:auto; color:#aaa; font-size:0.8rem; cursor:pointer;" onclick="deleteFav(${index}, event)">✕</span>
            `;

            // Restore Vibe on Click
            item.addEventListener('click', (e) => {
                // Prevent trigger if delete was clicked
                if (e.target.innerText === '✕') return;

                restoreVibe(fav);
            });

            favList.appendChild(item);
        });
    }

    // Global delete function for onclick inline
    window.deleteFav = (index, e) => {
        e.stopPropagation();
        const favs = JSON.parse(localStorage.getItem('moodify_favs')) || [];
        favs.splice(index, 1);
        localStorage.setItem('moodify_favs', JSON.stringify(favs));
        loadFavorites();

        // If deleted current vibe, unlike logic
        if (currentVibe && !favs.some(f => f.prompt === currentVibe.prompt)) {
            likeBtn.classList.remove('liked');
            likeBtn.textContent = '♡';
        }
    };

    function restoreVibe(vibe) {
        userPrompt.value = vibe.prompt;

        // Update Video
        if (vibe.video_url) {
            bgVideo.src = vibe.video_url;
            bgVideo.style.opacity = "0";
            bgVideo.onloadeddata = () => bgVideo.style.opacity = "1";
        }

        // Update Audio
        if (vibe.audio_url) {
            bgAudio.src = vibe.audio_url;
            bgAudio.volume = musicVolSlider.value / 100;
            bgAudio.play().catch(e => console.log("Autoplay blocked", e));
            musicPlayIcon.src = "/static/assets/pause.png";
            musicPanel.classList.remove('hidden');
        }

        // Update heart state
        currentVibe = vibe;
        likeBtn.classList.add('liked');
        likeBtn.textContent = '♥';

        statusMsg.textContent = `Restored: ${vibe.keywords ? vibe.keywords.join(', ') : 'Saved Vibe'}`;
    }

    // Save Favorite
    likeBtn.addEventListener('click', () => {
        if (!currentVibe) {
            statusMsg.textContent = "Generate a vibe first to save it!";
            return;
        }

        const favs = JSON.parse(localStorage.getItem('moodify_favs')) || [];
        const existingIndex = favs.findIndex(f => f.prompt === currentVibe.prompt);

        if (existingIndex >= 0) {
            // Unsave
            favs.splice(existingIndex, 1);
            likeBtn.classList.remove('liked');
            likeBtn.textContent = '♡';
            statusMsg.textContent = "Removed from Favorites";
        } else {
            // Save
            favs.push(currentVibe);
            likeBtn.classList.add('liked');
            likeBtn.textContent = '♥';
            statusMsg.textContent = "Saved to Favorites!";

            // Animate Heart
            likeBtn.classList.add('pulse');
            setTimeout(() => likeBtn.classList.remove('pulse'), 500);
        }

        localStorage.setItem('moodify_favs', JSON.stringify(favs));
        loadFavorites();
    });

    // Open/Close Favs
    if (favBtn) {
        favBtn.addEventListener('click', () => {
            loadFavorites(); // Refresh list
            togglePanel(favCard);
        });
        closeFavBtn.addEventListener('click', () => togglePanel(favCard));
    }

    // --- POMODORO TIMER ---
    const timerCard = document.getElementById('timer-card');
    const focusBtn = document.getElementById('focus-btn');
    const closeTimerBtn = document.getElementById('close-timer');
    const timerDisplay = document.getElementById('timer-display');
    const startTimerBtn = document.getElementById('start-timer');
    const resetTimerBtn = document.getElementById('reset-timer');
    const toggleModeBtn = document.getElementById('toggle-mode');

    if (focusBtn && timerCard) {
        let workDuration = 25;
        let breakDuration = 5;
        let timeLeft = workDuration * 60;
        let timerId = null;
        let isWorkMode = true;

        const timePlusBtn = document.getElementById('time-plus');
        const timeMinusBtn = document.getElementById('time-minus');

        function updateDisplay() {
            const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const s = (timeLeft % 60).toString().padStart(2, '0');
            timerDisplay.textContent = `${m}:${s}`;
            if (timerId) document.title = `${m}:${s} - Focus`;
        }

        function updateToggleBtnText() {
            const targetModeStr = isWorkMode ? "Short Break" : "Focus";
            const targetTime = isWorkMode ? breakDuration : workDuration;
            toggleModeBtn.textContent = `Switch to ${targetModeStr} (${targetTime}:00)`;
        }

        function adjustTimer(amount) {
            if (isWorkMode) {
                workDuration = Math.max(1, Math.min(90, workDuration + amount));
                if (!timerId) {
                    timeLeft = workDuration * 60;
                    updateDisplay();
                }
            } else {
                breakDuration = Math.max(1, Math.min(30, breakDuration + amount));
                if (!timerId) {
                    timeLeft = breakDuration * 60;
                    updateDisplay();
                }
            }
            // Update the switch button text if it displays the *other* mode, 
            // but actually we only need to update it when we switch.
            // However, good practice to keep it synced or init correctly.
        }

        timePlusBtn.addEventListener('click', () => adjustTimer(1));
        timeMinusBtn.addEventListener('click', () => adjustTimer(-1));

        focusBtn.addEventListener('click', () => {
            togglePanel(timerCard);
        });

        closeTimerBtn.addEventListener('click', () => {
            togglePanel(timerCard);
            document.title = "Moodify";
        });

        startTimerBtn.addEventListener('click', () => {
            if (timerId) {
                clearInterval(timerId);
                timerId = null;
                startTimerBtn.textContent = "Start";
            } else {
                timerId = setInterval(() => {
                    if (timeLeft > 0) {
                        timeLeft--;
                        updateDisplay();
                    } else {
                        clearInterval(timerId);
                        timerId = null;
                        startTimerBtn.textContent = "Start";
                        const alertMsg = isWorkMode ? "Focus time over! Take a break." : "Break over! Back to work.";
                        alert(alertMsg);
                    }
                }, 1000);
                startTimerBtn.textContent = "Pause";
            }
        });

        resetTimerBtn.addEventListener('click', () => {
            clearInterval(timerId);
            timerId = null;
            startTimerBtn.textContent = "Start";
            timeLeft = isWorkMode ? workDuration * 60 : breakDuration * 60;
            updateDisplay();
            document.title = "Moodify";
        });

        toggleModeBtn.addEventListener('click', () => {
            isWorkMode = !isWorkMode;
            // Use variables instead of hardcoded
            timeLeft = isWorkMode ? workDuration * 60 : breakDuration * 60;
            updateToggleBtnText();
            resetTimerBtn.click();
        });
    }

    // --- MUSIC CONTROLS (Standard HTML5 Audio) ---
    const musicPanel = document.getElementById('music-panel');
    const bgAudio = document.getElementById('bg-audio');
    const musicPlayBtn = document.getElementById('music-play-btn');
    const musicPlayIcon = document.getElementById('music-play-icon');
    const musicVolSlider = document.getElementById('music-vol-slider');

    musicPlayBtn.addEventListener('click', () => {
        if (bgAudio.paused) {
            bgAudio.play();
            musicPlayIcon.src = "/static/assets/pause.png";
        } else {
            bgAudio.pause();
            musicPlayIcon.src = "/static/assets/play.png";
        }
    });

    musicVolSlider.addEventListener('input', (e) => {
        bgAudio.volume = e.target.value / 100;
    });

    generateBtn.addEventListener('click', async () => {
        const prompt = userPrompt.value.trim();
        if (!prompt) return;

        // UI Feedback
        statusMsg.textContent = "Analyzing vibes...";
        generateBtn.disabled = true;
        generateBtn.style.opacity = "0.7";

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt })
            });

            const data = await response.json();

            if (data.status === 'success') {
                statusMsg.textContent = `Found vibe: ${data.keywords.join(', ')}`;

                // Update Current Vibe State (For Favorites)
                currentVibe = {
                    prompt: prompt,
                    audio_url: data.audio_url,
                    video_url: data.video_url,
                    keywords: data.keywords
                };

                // Reset Like Button (New vibe generated)
                const favs = JSON.parse(localStorage.getItem('moodify_favs')) || [];
                const isSaved = favs.some(f => f.prompt === prompt);

                if (isSaved) {
                    likeBtn.classList.add('liked');
                    likeBtn.textContent = '♥';
                } else {
                    likeBtn.classList.remove('liked');
                    likeBtn.textContent = '♡';
                }

                // Show Music Panel (if not already visible)
                musicPanel.classList.remove('hidden');

                // Update Video
                if (data.video_url) {
                    bgVideo.src = data.video_url;
                    bgVideo.style.opacity = "0"; // Fade out briefly

                    bgVideo.onloadeddata = () => {
                        bgVideo.style.opacity = "1"; // Fade in new video
                    };
                }

                // Update Audio (Freesound)
                if (data.audio_url) {
                    console.log("Playing audio:", data.audio_url);
                    bgAudio.src = data.audio_url;
                    bgAudio.volume = musicVolSlider.value / 100;

                    try {
                        await bgAudio.play();
                        musicPlayIcon.src = "/static/assets/pause.png";
                    } catch (e) {
                        console.error("Auto-play blocked:", e);
                        statusMsg.textContent += " (Click Play)";
                        musicPlayIcon.src = "/static/assets/play.png";
                    }
                }

            } else {
                statusMsg.textContent = "Could not generate atmosphere. Try again.";
            }

        } catch (error) {
            console.error('Error:', error);
            statusMsg.textContent = "Something went wrong.";
        } finally {
            generateBtn.disabled = false;
            generateBtn.style.opacity = "1";
        }
    });

    // Allow Enter key to submit
    userPrompt.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateBtn.click();
        }
    });
});
