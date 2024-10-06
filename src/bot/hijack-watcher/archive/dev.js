var chokidar = require("chokidar");
const llog = require("learninglab-log");
const fs = require("fs");
const OpenAI = require("openai");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { App } = require("@slack/bolt");
const Replicate = require("replicate");
const axios = require('axios');
const customConfig = require('../../custom/mod-hebrew');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function uploadToSlackFromUrl({ imageUrl, channel, thread_ts, client }) {
  try {
    const timestamp = Date.now();
    const filename = `replicate_${timestamp}.webp`;
    const tempDir = path.join(global.ROOT_DIR, '_temp');
    const imagePath = path.join(tempDir, filename);

    // Ensure the _temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download the image from the URL
    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'arraybuffer',  // Ensure the response is in binary form
    });

    // Save the image to a file
    fs.writeFileSync(imagePath, response.data);
    console.log(`Image downloaded and saved to ${imagePath}`);

    // Extract file size directly from the imagePath
    const fileSizeInBytes = fs.statSync(imagePath).size;

    // Step 1: Get the upload URL
    const uploadUrlResponse = await client.files.getUploadURLExternal({
      channels: channel,
      filename: filename,
      ...(thread_ts && { thread_ts }),  // Only include thread_ts if it exists
      length: fileSizeInBytes
    });

    if (!uploadUrlResponse.ok) {
      console.error("Failed to get upload URL:", uploadUrlResponse.error);
      return;
    }

    console.log("Upload URL obtained successfully:", uploadUrlResponse);

    const uploadUrl = uploadUrlResponse.upload_url;
    const file_id = uploadUrlResponse.file_id;

    // Step 2: Upload the file content to the URL
    const fileStream = fs.createReadStream(imagePath);
    await axios.post(uploadUrl, fileStream, {
      headers: {
        'Content-Type': 'image/webp', // Adjust the content type based on the file type
        'Content-Length': fileSizeInBytes  // Include the file size in bytes
      },
    });

    console.log("Image content uploaded successfully to Slack's server.");

    // Step 3: Complete the upload process
    const completeUploadResponse = await client.files.completeUploadExternal({
      files: [
        {
          id: file_id,
          title: "Generated Image"
        }
      ],
      initial_comment: "I've created this image for you",
      channel_id: channel,
      ...(thread_ts && { thread_ts }),  // Only include thread_ts if it exists
      // Ensure that the file is shared in the channel
      channels: [channel]
    });

    if (!completeUploadResponse.ok) {
      console.error("Failed to complete file upload:", completeUploadResponse.error);
      return;
    }

    console.log("Image upload completed successfully:", completeUploadResponse);

    // Step 4: Log file information to verify its existence
    const fileInfoResponse = await client.files.info({
      file: file_id
    });

    if (!fileInfoResponse.ok) {
      console.error("Failed to retrieve file info:", fileInfoResponse.error);
      return;
    }

    console.log("Retrieved file info:", fileInfoResponse);
    return fileInfoResponse
  } catch (error) {
    console.error("Error uploading image to Slack:", error);
  }
}


const extractUsername = (filePath) => {
  const fileName = path.basename(filePath, path.extname(filePath)); // Extract the file name without extension
  const parts = fileName.split("_");
  if (parts.length >= 2) {
    llog.magenta(`heard from ${parts[0]}_${parts[1]}`);
    return `${parts[0]}_${parts[1]}`;
  } else {
    return fileName;
  }
};



const hijackWatcher = async ({ client, watchFolder, archiveFolder }) => {


  llog.green(`watchFolder: ${watchFolder}`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  var watcher = chokidar.watch(watchFolder, {
    ignored: /\.DS_Store/,
    persistent: true,
    awaitWriteFinish: true,
  });

  watcher
    .on("add", async function (filePath) {
      let start = new Date().getTime();

      try {
        if (!/\.(mp3|mp4|m4v|aac)$/.test(filePath)) {
          throw new Error("Unsupported file format");
        }

        // Check file duration
        const getDuration = (filePath) => {
          return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
              if (err) return reject(err);
              const duration = metadata.format.duration;
              resolve(duration);
            });
          });
        };

        const duration = await getDuration(filePath);

        console.log("File", filePath, "has been added");
        llog.cyan(`Going to move ${filePath} to ${archiveFolder}`);

        const fileName = path.basename(filePath); // Extract the file name from the path
        const destPath = path.join(archiveFolder, fileName);

        // Move the file to the archive folder
        await fs.promises.rename(filePath, destPath);

        if (duration <= 3.5) {
          llog.yellow(
            `File ${filePath} is too short (${duration} seconds). Skipping transcription.`,
          );
          return;
        }

        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(destPath),
          model: "whisper-1",
        });

        console.log(transcription.text);

        const baseNameWithoutExtension = path.basename(
          destPath,
          path.extname(destPath),
        );
        const transcriptionJsonPath = path.join(
          path.dirname(destPath),
          baseNameWithoutExtension + ".json",
        );
        const transcriptionTxtPath = path.join(
          path.dirname(destPath),
          baseNameWithoutExtension + ".txt",
        );

        fs.writeFileSync(
          transcriptionJsonPath,
          JSON.stringify(transcription, null, 4),
        );
        fs.writeFileSync(transcriptionTxtPath, transcription.text);

        const username = extractUsername(filePath);
        llog.blue(username)
        // Send transcription to Slack
        const result = await client.chat.postMessage({
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          text: `${transcription.text}`,
          username: username,
        });



          

        const ts = result.ts; // Get the timestamp of the posted message


      
       

        const imagePromptResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a helpful assistant." },
              { role: "user", content: `Please give me a prompt for stable diffusion that would be the best hero image for the following conversation transcript:\n\n"${transcription.text}". Please return ONLY THE PROMPT-nothing else` }
          ],
          max_tokens: 200,
        });

        const thePrompt = imagePromptResponse.choices[0].message.content.trim();

        const replicate = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN,
        });

        const input = {
          prompt: thePrompt,
          num_outputs: 1,
          aspect_ratio: "16:9",
          output_format: "webp",
          output_quality: 80
        };

        const output = await replicate.run("black-forest-labs/flux-schnell", { input });
        console.log(output);

        const imageUrl = output[0];  // Assuming the first output URL is the image
        const slackChannel = process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL;
        
        const uploadResult = await uploadToSlackFromUrl({
          imageUrl, 
          channel: slackChannel, 
          thread_ts: ts, 
          client
        });



        const annotationResponse = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a helpful assistant who helps people learn about AI, Teaching and Learning in a Higher Education context." },
              { role: "user", content: `Please provide helpful commentary on the following text by unpacking any unusual jargon or complicated ideas or peculiar literary allusions, etc., and by providing thoughts on next steps in the chain of thought:\n\n"${transcription.text}"` }
          ],
          max_tokens: 1000,
        });

        const annotationText = annotationResponse.choices[0].message.content.trim();

        // Post the German translation as a thread reply
        await client.chat.postMessage({
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          text: annotationText,
          thread_ts: ts,
          username: "Annotation Bot"
        });






        let stop = new Date().getTime();
        let durationInMilliseconds = stop - start;
        console.log(`Request took ${durationInMilliseconds} milliseconds`);
      } catch (error) {
        console.error("An error occurred:", error);
      }

      return { status: "complete" };
    })
    .on("change", function (filePath) {
      console.log("File", filePath, "has been changed");
    })
    .on("unlink", function (filePath) {
      console.log("File", filePath, "has been removed");
    })
    .on("error", function (error) {
      console.error("Error happened", error);
    });
};

module.exports = hijackWatcher;





const axios = require('axios');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const ffmpeg = require('fluent-ffmpeg');
const OpenAI = require('openai');
const Replicate = require('replicate');

const getDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

const moveFile = async (filePath, destPath) => {
  await fs.promises.rename(filePath, destPath);
  console.log(`File moved from ${filePath} to ${destPath}`);
};

const generateTranscription = async (filePath, openai) => {
  return await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
  });
};

const saveTranscription = (destPath, transcription) => {
  const baseNameWithoutExtension = path.basename(destPath, path.extname(destPath));
  const transcriptionJsonPath = path.join(path.dirname(destPath), `${baseNameWithoutExtension}.json`);
  const transcriptionTxtPath = path.join(path.dirname(destPath), `${baseNameWithoutExtension}.txt`);

  fs.writeFileSync(transcriptionJsonPath, JSON.stringify(transcription, null, 4));
  fs.writeFileSync(transcriptionTxtPath, transcription.text);
  console.log(`Transcription saved at ${transcriptionTxtPath}`);
};

const sendSlackMessage = async ({ client, channel, text, thread_ts, username }) => {
  return await client.chat.postMessage({
    channel,
    text,
    thread_ts,
    username,
  });
};

const generateImagePrompt = async (transcriptionText, openai) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: `Please give me a prompt for stable diffusion that would be the best hero image for the following conversation transcript:\n\n"${transcriptionText}". Please return ONLY THE PROMPT-nothing else` }
    ],
    max_tokens: 200,
  });

  return response.choices[0].message.content.trim();
};

const generateImage = async (thePrompt, replicate) => {
  const input = {
    prompt: thePrompt,
    num_outputs: 1,
    aspect_ratio: "16:9",
    output_format: "webp",
    output_quality: 80
  };

  return await replicate.run("black-forest-labs/flux-schnell", { input });
};

const generateAnnotation = async (transcriptionText, openai) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant who helps people learn about AI, Teaching and Learning in a Higher Education context." },
      { role: "user", content: `Please provide helpful commentary on the following text by unpacking any unusual jargon or complicated ideas or peculiar literary allusions, etc., and by providing thoughts on next steps in the chain of thought:\n\n"${transcriptionText}"` }
    ],
    max_tokens: 1000,
  });

  return response.choices[0].message.content.trim();
};

const hijackWatcher = async ({ client, watchFolder, archiveFolder }) => {
  llog.green(`watchFolder: ${watchFolder}`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const watcher = chokidar.watch(watchFolder, {
    ignored: /\.DS_Store/,
    persistent: true,
    awaitWriteFinish: true,
  });

  watcher
    .on("add", async (filePath) => {
      let start = new Date().getTime();

      try {
        if (!/\.(mp3|mp4|m4v|aac)$/.test(filePath)) {
          throw new Error("Unsupported file format");
        }

        const duration = await getDuration(filePath);
        const fileName = path.basename(filePath);
        const destPath = path.join(archiveFolder, fileName);

        await moveFile(filePath, destPath);

        if (duration <= 3.5) {
          llog.yellow(`File ${filePath} is too short (${duration} seconds). Skipping transcription.`);
          return;
        }

        const transcription = await generateTranscription(destPath, openai);
        saveTranscription(destPath, transcription);

        const username = extractUsername(filePath);
        const slackResult = await sendSlackMessage({
          client,
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          text: transcription.text,
          username,
        });

        const ts = slackResult.ts;
        const thePrompt = await generateImagePrompt(transcription.text, openai);
        const output = await generateImage(thePrompt, replicate);
        const imageUrl = output[0];

        await uploadToSlackFromUrl({
          imageUrl,
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          thread_ts: ts,
          client,
        });

        const annotationText = await generateAnnotation(transcription.text, openai);
        await sendSlackMessage({
          client,
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          text: annotationText,
          thread_ts: ts,
          username: "Annotation Bot",
        });

        let stop = new Date().getTime();
        console.log(`Request took ${stop - start} milliseconds`);
      } catch (error) {
        console.error("An error occurred:", error);
      }

      return { status: "complete" };
    })
    .on("change", (filePath) => {
      console.log("File", filePath, "has been changed");
    })
    .on("unlink", (filePath) => {
      console.log("File", filePath, "has been removed");
    })
    .on("error", (error) => {
      console.error("Error happened", error);
    });
};

module.exports = hijackWatcher;
