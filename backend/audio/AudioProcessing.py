from scipy.io import wavfile
import numpy as np
from scipy.signal import spectrogram
from pydub import AudioSegment
from scipy.ndimage import maximum_filter
import os



class AudioProcessing:
    def __init__(self,audio_file_path: str):
        audio_path = audio_file_path
        audio = AudioSegment.from_file(audio_path)
        output_file,ext = os.path.splitext(audio_path)
        output_file+=".wav"
        if not audio_path.endswith(".wav") :
            audio.export(output_file, format="wav")
        self.sampling_rate,self.digital_audio = wavfile.read(output_file)
        self.Norm_int16 = 32768.0
        self.Norm_int32 = 2147483648.0
        self.mult = 2.28

    def Normalise(self,data: list):
        if data.dtype == np.int16:
            data = data.astype(np.float32) / self.Norm_int16
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / self.Norm_int32
        return data
    
    def converting_to_frequency_domain(self):
            if len(self.digital_audio.shape) > 1:
                self.digital_audio = self.digital_audio.mean(axis=1)

            data = self.Normalise(self.digital_audio)
            f, t, spd = spectrogram(data, fs=self.sampling_rate, nperseg=4096, noverlap=2048, window='hann')
            self.freq = f
            self.time = t
            self.spectral_density = 10 * np.log10(spd + 1e-10)

    def constellation_map(self):
        mean = np.mean(self.spectral_density, axis = 1, keepdims=True)
        standard_dev = np.std(self.spectral_density, axis = 1, keepdims=True)
        threshold = mean + self.mult*standard_dev
         
        local_max = maximum_filter(self.spectral_density, size = (25,80))
        is_peak = (self.spectral_density == local_max)
        is_loud = (self.spectral_density >= threshold)
        peaks = (is_loud & is_peak)
        f,t = np.where(peaks)
        peaks_list = list(zip(t, f))
        peaks_list.sort() 
        return peaks_list
    
    def fingerPrinting(self):
        peaks = self.constellation_map()
        valid_len = 20
        finger_P = []
        for i in range(len(peaks)):
            ti,fi = peaks[i]
            for j in range(1,valid_len+1):
                if i+j>=len(peaks):
                    break
                tj,fj = peaks[i+j]
                del_t = tj - ti
                if 0<=del_t<=200:
                    hash = [fi,fj,(tj-ti)]
                    finger_P.append([hash,ti])
        return finger_P

    def encode_hash(self, f1, f2, dt):
        return np.uint32(
            ((f1 & 0x3FF) << 22) |
            ((f2 & 0x3FF) << 12) |
            (dt & 0xFFF)
        )
    
    def hashing(self):
        fingerprints = self.fingerPrinting()
        encoded = {}

        for (f1, f2, dt), t1 in fingerprints:
            h = self.encode_hash(f1, f2, dt)
            if h not in encoded:
                encoded[h] = []
            encoded[h].append(t1)

        return encoded
