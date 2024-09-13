#!/bin/bash

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "Error: jq is not installed."
  echo "Please install jq to format the JSON response."
  echo "For macOS (with Homebrew): brew install jq"
  echo "For Ubuntu/Debian: sudo apt-get install jq"
  echo "For Fedora/CentOS: sudo dnf install jq"
  exit 1
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
  echo "Error: ffmpeg is not installed."
  echo "Please install ffmpeg for audio processing."
  echo "For macOS (with Homebrew): brew install ffmpeg"
  echo "For Ubuntu/Debian: sudo apt-get install ffmpeg"
  echo "For Fedora/CentOS: sudo dnf install ffmpeg"
  exit 1
fi

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY is not set."
  echo "Please set it in your .zshrc or equivalent shell config file."
  echo "For example, add the following line to your .zshrc:"
  echo 'export OPENAI_API_KEY="your_api_key_here"'
  exit 1
fi

# Check if a file was passed as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <audio-file>"
  exit 1
fi

# Get the file path and extension
input_file="$1"
output_file="${input_file%.*}-word-level.json"
file_extension="${input_file##*.}"

# Allowed file extensions
allowed_extensions="m4a mp4 m4v mov mp3 aiff wav"

# Check if the input file exists
if [ ! -f "$input_file" ]; then
  echo "Error: File '$input_file' not found!"
  exit 1
fi

# Check if the file extension is allowed
if ! echo "$allowed_extensions" | grep -q "$file_extension"; then
  echo "Error: File extension '$file_extension' is not supported!"
  echo "Supported extensions: $allowed_extensions"
  exit 1
fi

# If the file is not m4a, convert it to m4a (AAC), extracting only audio
if [ "$file_extension" != "m4a" ]; then
  converted_file="${input_file%.*}.m4a"
  echo "Converting $input_file to AAC (m4a) format (audio only)..."
  
  # Extract audio only and save as m4a
  ffmpeg -i "$input_file" -vn -c:a aac -b:a 128k "$converted_file"
  
  if [ $? -ne 0 ]; then
    echo "Error: Failed to convert $input_file to AAC (m4a) format!"
    exit 1
  fi
  
  # Set the converted file as the input file for further processing
  input_file="$converted_file"
  echo "Conversion successful. Processing $converted_file..."
fi

# Check the file size (in bytes), 25 MB is 26214400 bytes (macOS stat version)
file_size=$(stat -f%z "$input_file")
max_size=26214400

# Function to send a file to the Whisper API
transcribe_file() {
  local file="$1"
  local output="$2"

  response=$(curl --silent --request POST \
    --url https://api.openai.com/v1/audio/transcriptions \
    --header "Authorization: Bearer $OPENAI_API_KEY" \
    --header 'Content-Type: multipart/form-data' \
    --form file=@"$file" \
    --form "timestamp_granularities[]=word" \
    --form model=whisper-1 \
    --form response_format="verbose_json")

  # Check if the response contains an error
  if echo "$response" | grep -q 'error'; then
    echo "Error in API request for file $file: $response"
    exit 1
  fi

  # Append the JSON response to the output file
  echo "$response" | jq '.' >> "$output"
  echo "Transcription with timestamps for $file saved to $output"
}

# If the file is larger than 25MB, split it using ffmpeg
if [ "$file_size" -gt "$max_size" ]; then
  echo "File is larger than 25 MB, splitting into smaller chunks..."

  # Split the file into 25MB chunks (ffmpeg time-based split)
  duration=$(ffmpeg -i "$input_file" 2>&1 | grep Duration | awk '{print $2}' | tr -d ,)
  echo "Duration: $duration"
  
  # Calculate the split interval (in seconds, rough estimate based on file size)
  chunk_time=$(echo "scale=0; ($duration * $max_size) / $file_size" | bc)

  ffmpeg -i "$input_file" -f segment -segment_time "$chunk_time" -c copy "${input_file%.*}_part_%03d.${input_file##*.}"

  echo "Audio has been split into smaller chunks."

  # Process each chunk with Whisper API
  for chunk in ${input_file%.*}_part_*.${input_file##*.}; do
    chunk_output="${chunk%.*}.json"
    transcribe_file "$chunk" "$chunk_output"
  done

  # Combine all JSON chunk responses into a single file
  jq -s '.' ${input_file%.*}_part_*.json > "$output_file"
  echo "All chunk transcriptions combined into $output_file"

else
  # Send the audio file to the Whisper API for transcription if under 25 MB
  transcribe_file "$input_file" "$output_file"
fi
