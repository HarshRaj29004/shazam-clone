import shutil
import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException,Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from db.db import db
from model.audio import Songs, AudioHashes
from audio.AudioProcessing import AudioProcessing
from pydub import AudioSegment,effects
import yt_dlp

router = APIRouter()

def downloading_song(url: str):
    temp_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'temp_dl_%(id)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        }],
        'quiet': True,
        'overwrites': True,
    }
    with yt_dlp.YoutubeDL(temp_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        file_name = ydl.prepare_filename(info)
        wav_file = os.path.splitext(file_name)[0] + ".wav"
        return wav_file, info.get('title'), info.get('uploader')

def temp_file_upload(file: UploadFile) -> str:
    unique_id = uuid.uuid4()
    suffix = os.path.splitext(file.filename)[1] or ".tmp"
    
    raw_tmp_path = f"temp_raw_{unique_id}{suffix}"
    final_wav_path = f"temp_{unique_id}.wav"

    try:
        # Dumped to disk
        with open(raw_tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Converter
        track = AudioSegment.from_file(raw_tmp_path)
        track.export(final_wav_path, format="wav")
        return final_wav_path

    finally:
        file.file.close()
        if os.path.exists(raw_tmp_path):
            os.remove(raw_tmp_path)



@router.post("/audio_upload")
async def audio_upload(url: str = Body(..., embed=True)):
    try:
        temp_file, title, channel = downloading_song(url)

        audio_clip = AudioSegment.from_file(temp_file)
        audio_clip = audio_clip.set_frame_rate(44100)
        audio_clip = audio_clip.set_channels(1)
        audio_clip = effects.normalize(audio_clip)

        processed_file = temp_file.replace(".wav", "_std.wav")
        audio_clip.export(processed_file, format="wav")

        processor = AudioProcessing(processed_file)
        processor.converting_to_frequency_domain()
        hashes = processor.hashing()

        # INSERT SONG
        song_res = db.table("songs").insert({
            "title": title,
            "channel": channel
        }).execute()

        song_id = song_res.data[0]["id"]

        # INSERT HASHES
        hash_payload = [
            {
                "song_id": song_id,
                "hash": int(h),
                "time_offset": int(t)
            }
            for h, offsets in hashes.items()
            for t in offsets
        ]

        db.table("audio_hashes").insert(hash_payload).execute()

        return {
            "status": "success",
            "song_id": song_id,
            "fingerprints_count": len(hash_payload)
        }

    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)
        if processed_file and os.path.exists(processed_file):
            os.remove(processed_file)

@router.post("/identify")
async def identify_song(file: UploadFile = File(...)):
    temp_file = None
    cropped_file = None 
    try:
        # Save upload
        temp_file = temp_file_upload(file)
        audio_clip = AudioSegment.from_file(temp_file)
        
        # Standardizes frequency bins
        audio_clip = audio_clip.set_frame_rate(44100).set_channels(1)
        
        # Normalize Volume 
        audio_clip = effects.normalize(audio_clip)
         
        audio_filename = os.path.splitext(temp_file)[0]
        cropped_file = f"{audio_filename}_processed.wav"
        audio_clip.export(cropped_file, format="wav")
        processor = AudioProcessing(cropped_file) 
        processor.converting_to_frequency_domain()
        hashes = processor.hashing()
        sorted_hashes = sorted(
            hashes.items(),
            key=lambda item: len(item[1]),  
            reverse=True
        )

        hash_pairs = []
        for h, times in sorted_hashes:
            for t in times:
                hash_pairs.append({"input_hash": int(h), "sample_time": int(t)})
        
        if not hash_pairs:
            return {"message": "No audio fingerprints found in recording."}

        result = db.rpc(
            "match_audio",
            {"input_hashes": hash_pairs}
        ).execute()

        match = result.data[0]

        if match["score"] < 20:
            return {"match_found": False, "message": "Low confidence match."}

        return {
            "match_found": True,
            "song_id": match["song_id"],
            "title": match["title"],
            "artist": match["channel"],
            "score": match["score"],
            "time_offset": match["time_diff"]
        }

    except Exception as e:
        print(f"SERVER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    finally:
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)
        if cropped_file and os.path.exists(cropped_file):
            os.remove(cropped_file)