import shutil
import os
import uuid
from fastapi import APIRouter, UploadFile, File,  HTTPException,Body
from db.db import db
from audio.AudioProcessing import AudioProcessing
from pydub import AudioSegment,effects
import yt_dlp
import subprocess

router = APIRouter()

SAMPLE_RATE = 44100
SAMPLE_WIDTH = 2  
CHANNELS = 1
BYTES_PER_SEC = SAMPLE_RATE * SAMPLE_WIDTH * CHANNELS
CHUNK_DURATION_SEC = 5
CHUNK_SIZE = BYTES_PER_SEC * CHUNK_DURATION_SEC
READ_SIZE = 4096  
BATCH = 1000

def downloading_song(url: str):
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        stream_url = info["url"]
        title = info.get("title", "Unknown")
        channel = info.get("uploader", "Unknown")
        yt_url = info.get("webpage_url")

    ffmpeg_cmd = [
        "ffmpeg",
        "-loglevel", "error",
        "-reconnect", "1",
        "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        "-vn",
        "-i", stream_url,
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "-ar", str(SAMPLE_RATE),
        "-ac", str(CHANNELS),
        "-"
    ]

    process = subprocess.Popen(
        ffmpeg_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        bufsize=10**6
    )

    return process, title, channel, yt_url



def temp_file_upload(file: UploadFile) -> str:
    unique_id = uuid.uuid4()
    suffix = os.path.splitext(file.filename)[1] or ".tmp"
    
    raw_tmp_path = f"temp_raw_{unique_id}{suffix}"
    final_wav_path = f"temp_{unique_id}.wav"

    try:
        # DUMPED TO DISK
        with open(raw_tmp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # CONVERTER
        track = AudioSegment.from_file(raw_tmp_path)
        track.export(final_wav_path, format="wav")
        return final_wav_path

    finally:
        file.file.close()
        if os.path.exists(raw_tmp_path):
            os.remove(raw_tmp_path)




@router.post("/audio_upload")
async def audio_upload(url: str = Body(..., embed=True)):
    process = None
    buffer = bytearray()
    full_audio = bytearray()
    chunk_count = 0

    try:
        process, title, channel, youtube_url = downloading_song(url)

        # *****CHUNK PROCESSING*****
        while True:
            data = process.stdout.read(READ_SIZE)
            if not data:
                print("*STREAM ENDED*")
                break

            buffer.extend(data)

            while len(buffer) >= CHUNK_SIZE:
                chunk = buffer[:CHUNK_SIZE]
                buffer = buffer[CHUNK_SIZE:]

                chunk_count += 1
                # print(f"Chunk: {chunk_count}")

                full_audio.extend(chunk)

                # *****PREVIEW MATCH*****
                if chunk_count%10 == 0:
                    preview_file = f"temp_chunk_{uuid.uuid4()}.wav"

                    AudioSegment(
                        data=bytes(full_audio),
                        sample_width=SAMPLE_WIDTH,
                        frame_rate=SAMPLE_RATE,
                        channels=CHANNELS
                    ).export(preview_file, format="wav")

                    try:
                        processor = AudioProcessing(preview_file)
                        processor.converting_to_frequency_domain()
                        hashes = processor.hashing()

                        hash_pairs = [
                            {"input_hash": int(h), "sample_time": int(t)}
                            for h, times in hashes.items()
                            for t in times
                        ]

                        if hash_pairs:
                            res = db.rpc(
                                "match_audio",
                                {"input_hashes": hash_pairs}
                            ).execute()

                            if res.data and res.data[0]["score"] >= 25:
                                print("MATCH FOUND!!. Stopping stream.")

                                process.kill()
                                process.wait(timeout=3)

                                return {
                                    "status": "Already Exists",
                                    "song_id": res.data[0]["song_id"],
                                    "title": res.data[0]["title"]
                                }

                        print("*NO MATCH FOUND*")

                    finally:
                        if os.path.exists(preview_file):
                            os.remove(preview_file)

        # *****FINAL INDEXING***** 
        print("*INDEXING FULL SONG*")

        final_file = f"temp_final_{uuid.uuid4()}.wav"
        AudioSegment(
            data=bytes(full_audio),
            sample_width=SAMPLE_WIDTH,
            frame_rate=SAMPLE_RATE,
            channels=CHANNELS
        ).export(final_file, format="wav")

        processor = AudioProcessing(final_file)
        processor.converting_to_frequency_domain()
        final_hashes = processor.hashing()

        song_res = db.table("songs").insert({
            "title": title,
            "channel": channel,
            "url": youtube_url,
        }).execute()

        song_id = song_res.data[0]["id"]
        hash_payload = [
            {
                "song_id": song_id,
                "hash": int(h),
                "time_offset": int(t)
            }
            for h, offsets in final_hashes.items()
            for t in offsets
        ]

        # *****BATCH INSERT*****
        for i in range(0, len(hash_payload), BATCH):
            db.table("audio_hashes").insert(hash_payload[i:i + BATCH]).execute()

        print(f"Indexed successfully: {title}")
        return {
            "status": "Success",
            "song_id": song_id,
            "title": title
        }

    except Exception as e:
        if process:
            process.kill()
        print("ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if "final_file" in locals() and os.path.exists(final_file):
            os.remove(final_file)


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
        
        # print(result)
        match1 = result.data[0]
        match2 = result.data[1]
        match3 = result.data[2]

        # if match1["score"] < 20:
        #     return {"match_found": False, "message": "Low confidence match."}

        return {
            "match_found": True,
            "match_1": match1,
            "match_2": match2,
            "match_3": match3,
        }

    except Exception as e:
        print(f"SERVER ERROR: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    finally:
        if temp_file and os.path.exists(temp_file):
            os.remove(temp_file)
        if cropped_file and os.path.exists(cropped_file):
            os.remove(cropped_file)