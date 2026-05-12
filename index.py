from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from ytmusicapi import YTMusic
import yt_dlp
import os
import re
import csv
import io
import requests

app = Flask(__name__, static_folder='static')
CORS(app)

SHEET_ID   = "1jEfiN_IXjPAu6-1HMYuZOhWyLMEUtyrhg4S_nl1T0AE"
SHEET1_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1"
SHEET2_URL = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet2"

ytmusic = YTMusic()

# ── HELPER ────────────────────────────────────────────────────────────────
def fetch_csv(url):
    res = requests.get(url, timeout=10)
    res.encoding = "utf-8"
    return list(csv.reader(io.StringIO(res.text)))

def extract_video_id(url):
    url = url.strip()
    m = re.search(r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})", url)
    if m:
        return m.group(1)
    if re.match(r"^[A-Za-z0-9_-]{11}$", url):
        return url
    return None

# ═══════════════════════════════════════════════════════════════════════
# LOGIN - baca Sheet1 CSV publik
# ═══════════════════════════════════════════════════════════════════════
@app.route("/api/login", methods=["POST"])
def login():
    data     = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    try:
        rows = fetch_csv(SHEET1_URL)
        for row in rows:
            if len(row) >= 2 and row[0].strip() == username and row[1].strip() == password:
                return jsonify({"success": True, "username": username})
        return jsonify({"success": False, "message": "Username atau password salah"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": f"Gagal baca sheet: {e}"}), 500

# ═══════════════════════════════════════════════════════════════════════
# PLAYLIST - baca Sheet2 (kolom = user, baris 1 = nama user, baris 2+ = link)
# ═══════════════════════════════════════════════════════════════════════
@app.route("/api/playlist/<username>")
def get_playlist(username):
    try:
        rows = fetch_csv(SHEET2_URL)
        if not rows:
            return jsonify([])

        headers = [c.strip() for c in rows[0]]
        col_idx = next((i for i, h in enumerate(headers) if h.lower() == username.lower()), None)

        if col_idx is None:
            return jsonify([])

        songs = []
        for row in rows[1:]:
            if col_idx < len(row) and row[col_idx].strip():
                link = row[col_idx].strip()
                vid  = extract_video_id(link)
                if vid:
                    songs.append({
                        "videoId":   vid,
                        "thumbnail": f"https://img.youtube.com/vi/{vid}/mqdefault.jpg",
                        "title":     "",
                        "artist":    "",
                    })
        return jsonify(songs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════
# SONG INFO - resolve judul dari videoId
# ═══════════════════════════════════════════════════════════════════════
@app.route("/api/song/<video_id>")
def get_song_info(video_id):
    try:
        r       = ytmusic.get_song(video_id)
        details = r.get("videoDetails", {})
        thumbs  = details.get("thumbnail", {}).get("thumbnails", [])
        return jsonify({
            "videoId":   video_id,
            "title":     details.get("title", "Unknown"),
            "artist":    details.get("author", "Unknown"),
            "thumbnail": thumbs[-1]["url"] if thumbs else f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        })
    except:
        return jsonify({
            "videoId":   video_id,
            "title":     "Unknown",
            "artist":    "Unknown",
            "thumbnail": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg",
        })

# ═══════════════════════════════════════════════════════════════════════
# SEARCH
# ═══════════════════════════════════════════════════════════════════════
@app.route("/api/search")
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    try:
        results = ytmusic.search(q, filter="songs", limit=12)
        return jsonify([{
            "videoId":   r["videoId"],
            "title":     r.get("title", "Unknown"),
            "artist":    r["artists"][0]["name"] if r.get("artists") else "Unknown",
            "thumbnail": r["thumbnails"][-1]["url"] if r.get("thumbnails") else "",
            "duration":  r.get("duration", ""),
        } for r in results if r.get("videoId")])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════
# RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════════════
@app.route("/api/recommendations")
def recommendations():
    try:
        charts = ytmusic.get_charts(country="ID")
        items  = charts.get("songs", {}).get("items", [])[:20]
        return jsonify([{
            "videoId":   r["videoId"],
            "title":     r.get("title", "Unknown"),
            "artist":    r["artists"][0]["name"] if r.get("artists") else "Unknown",
            "thumbnail": r["thumbnails"][-1]["url"] if r.get("thumbnails") else "",
            "duration":  r.get("duration", ""),
        } for r in items if r.get("videoId")])
    except:
        try:
            results = ytmusic.search("top hits indonesia 2024", filter="songs", limit=20)
            return jsonify([{
                "videoId":   r["videoId"],
                "title":     r.get("title", "Unknown"),
                "artist":    r["artists"][0]["name"] if r.get("artists") else "Unknown",
                "thumbnail": r["thumbnails"][-1]["url"] if r.get("thumbnails") else "",
                "duration":  r.get("duration", ""),
            } for r in results if r.get("videoId")])
        except Exception as e:
            return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════
# LYRICS
# ═══════════════════════════════════════════════════════════════════════
@app.route("/api/lyrics/<video_id>")
def get_lyrics(video_id):
    try:
        watch = ytmusic.get_watch_playlist(video_id)
        lid   = watch.get("lyrics")
        if lid:
            data = ytmusic.get_lyrics(lid)
            return jsonify({"lyrics": data.get("lyrics", "Lirik tidak tersedia")})
        return jsonify({"lyrics": "Lirik tidak tersedia untuk lagu ini."})
    except Exception as e:
        return jsonify({"lyrics": "Gagal memuat lirik."})

# ═══════════════════════════════════════════════════════════════════════
# DOWNLOAD
# ═══════════════════════════════════════════════════════════════════════
@app.route("/api/download/<video_id>")
def download_song(video_id):
    title    = request.args.get("title", video_id)
    safe     = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_')
    filename = f"PuriFy-{safe}.mp3"
    out_path = f"/tmp/{filename}"

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': out_path.replace('.mp3', '.%(ext)s'),
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
        'quiet': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
        return send_from_directory('/tmp', filename, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ═══════════════════════════════════════════════════════════════════════
# STATIC
# ═══════════════════════════════════════════════════════════════════════
@app.route("/")
def index():
    return send_from_directory('static', 'index.html')

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory('static', path)

if __name__ == "__main__":
    app.run(debug=True, port=5000)
