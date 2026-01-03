from AudioProcessing import AudioProcessing
import matplotlib.pyplot as plt
import os

if __name__ == "__main__":
    # --- 1. Setup ---
    # Replace with a path to a real audio file on your machine (.mp3 or .wav)
    TEST_FILE = "../music/Ikk Kudi Lofi Mix ｜ Udta Punjab ｜ Shahid Kapoor, Alia Bhatt ｜ Amit Trivedi, Shahid Mallya｜ Deepanshu [cY41M2xPkR0].wav"
    print(f"Processing: {TEST_FILE}...")
    print("Current Directory:", os.getcwd())
    # --- 2. Execution ---
    try:
        processor = AudioProcessing(TEST_FILE)
        
        # Step A: Convert to spectrogram
        processor.converting_to_frequency_domain()
        print(f"Spectrogram created. Shape: {processor.spectral_density.shape}")

        # Step B: Get Constellation Map (Peaks)
        peaks = processor.constellation_map()
        print(f"Peaks found: {len(peaks)}")

        # Step C: Generate Hashes
        hashes = processor.hashing()
        print(f"Total unique hashes generated: {len(hashes)}")
        
        # Print a sample of 5 hashes
        print("\nSample Hashes (Hash Value : [Time Offsets]):")
        for k, v in list(hashes.items())[:5]:
            print(f"{k} : {v}")

        # --- 3. Visualization (Crucial for debugging) ---
        print("\nGenerating visualization...")
        plt.figure(figsize=(12, 6))

        # Plot the Spectrogram
        # We flip vertically because spectrogram returns low freq at index 0 (bottom)
        plt.imshow(processor.spectral_density, aspect='auto', origin='lower', cmap='inferno', interpolation='nearest')
        
        # Plot the Peaks
        # unzip the peaks list into (time_indices, freq_indices)
        if peaks:
            t_idx, f_idx = zip(*peaks)
            plt.scatter(t_idx, f_idx, color='cyan', s=10, marker='x', label='Constellation Peaks')

        plt.title(f"Spectrogram & Constellation Map for {TEST_FILE}")
        plt.xlabel("Time Frames")
        plt.ylabel("Frequency Bins")
        plt.colorbar(label="Log Amplitude (dB)")
        plt.legend()
        plt.show()

    except Exception as e:
        print(f"An error occurred: {e}")