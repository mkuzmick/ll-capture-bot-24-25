var chokidar = require("chokidar");
const llog = require("learninglab-log");
const fs = require("fs");
const OpenAI = require("openai");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { App } = require("@slack/bolt");
const Replicate = require("replicate");
const axios = require('axios');

// const extractUsername = (filePath) => {
//   const fileName = path.basename(filePath, path.extname(filePath)); // Extract the file name without extension
//   const parts = fileName.split("_");
//   if (parts.length >= 2) {
//     return `${parts[0]}_${parts[1]}`;
//   } else {
//     return fileName;
//   }
// };

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



const hijackWatcher = async ({ watchFolder, archiveFolder }) => {


  llog.green(`watchFolder: ${watchFolder}`);
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Initialize Slack app
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
    port: process.env.PORT || 3000,
  });

  // Start the app
  (async () => {
    await app.start();
    console.log("⚡️ Slack app is running!");
  })();

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
        const result = await app.client.chat.postMessage({
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
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 80
        };

        const output = await replicate.run("black-forest-labs/flux-schnell", { input });
        console.log(output);


        const timestamp = Date.now();
        const filename = `replicate_${timestamp}.webp`;
        const tempDir = path.join(global.ROOT_DIR, '_temp');
        const imagePath = path.join(tempDir, filename);

// Ensure the _temp directory exists
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }


        // Download the image using Axios
        const imageUrl = output[0];  // Assuming the first output URL is the image
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer',  // Ensure the response is in binary form
        });

        // Save the image to a file
        fs.writeFileSync(imagePath, response.data);

        console.log(`Image downloaded and saved to ${imagePath}`);

        const fileSizeInBytes = fs.statSync(imagePath).size;


                

                // Step 1: Get the upload URL
        const uploadUrlResponse = await app.client.files.getUploadURLExternal({
          channels: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          filename: filename,
          thread_ts: ts,
          length: fileSizeInBytes
        });

        if (!uploadUrlResponse.ok) {
          console.error("Failed to get upload URL:", uploadUrlResponse.error);
          return;
        }

        console.log("Upload URL obtained successfully:", uploadUrlResponse);

        const uploadUrl = uploadUrlResponse.upload_url;
        const file_id = uploadUrlResponse.file_id;

        const fileStream = fs.createReadStream(imagePath);
        // Step 2: Upload the file content to the URL
        await axios.post(uploadUrl, fileStream, {
          headers: {
              'Content-Type': 'image/webp', // Adjust the content type based on the file type
              'Content-Length': fileSizeInBytes  // Include the file size in bytes
          },
      });
      

        console.log("Image content uploaded successfully to Slack's server.");

        // Step 3: Complete the upload process
        

        const completeUploadResponse = await app.client.files.completeUploadExternal({
          files: [
              {
                  id: file_id,
                  title: "Generated Image"
              }
          ],
          initial_comment: "I've created this image for you",
          channel_id: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          thread_ts: ts,
          // Ensure that the file is shared in the channel
          channels: [process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL]
      });

      


        if (!completeUploadResponse.ok) {
          console.error("Failed to complete file upload:", completeUploadResponse.error);
          return;
        }

        console.log("Image upload completed successfully:", completeUploadResponse);

        // Step 4: Log file information to verify its existence
        const fileInfoResponse = await app.client.files.info({
          file: file_id
        });

        if (!fileInfoResponse.ok) {
          console.error("Failed to retrieve file info:", fileInfoResponse.error);
          return;
        }

        console.log("Retrieved file info:", fileInfoResponse);





                // Request a German translation from OpenAI
        const translationResponse1 = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a helpful assistant who translates text to German." },
              { role: "user", content: `Translate the following text to German:\n\n"${transcription.text}"` }
          ],
          max_tokens: 1000,
        });

        const germanTranslation = translationResponse1.choices[0].message.content.trim();

        // Post the German translation as a thread reply
        await app.client.chat.postMessage({
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          text: germanTranslation,
          thread_ts: ts,
          username: "Lukas"
        });

        // Request a French translation from OpenAI
        const translationResponse2 = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a helpful assistant who translates text to French." },
              { role: "user", content: `Translate the following text to French:\n\n"${transcription.text}"` }
          ],
          max_tokens: 1000,
        });

        const frenchTranslation = translationResponse2.choices[0].message.content.trim();

        // Post the French translation as a thread reply
        await app.client.chat.postMessage({
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          text: frenchTranslation,
          thread_ts: ts,
          username: "Élodie"
        });

        // Request a Spanish translation from OpenAI
        const translationResponse3 = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
              { role: "system", content: "You are a helpful assistant who translates text to Spanish." },
              { role: "user", content: `Translate the following text to Spanish:\n\n"${transcription.text}"` }
          ],
          max_tokens: 1000,
        });

        const spanishTranslation = translationResponse3.choices[0].message.content.trim();

        // Post the Spanish translation as a thread reply
        await app.client.chat.postMessage({
          channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
          text: spanishTranslation,
          thread_ts: ts,
          username: "Carlos"
        });

// Request a Mandarin Chinese translation from OpenAI
const translationResponse4 = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
      { role: "system", content: "You are a helpful assistant who translates text to Mandarin Chinese." },
      { role: "user", content: `Translate the following text to Mandarin Chinese:\n\n"${transcription.text}"` }
  ],
  max_tokens: 1000,
});

const mandarinTranslation = translationResponse4.choices[0].message.content.trim();

// Post the Mandarin Chinese translation as a thread reply
await app.client.chat.postMessage({
  channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
  text: mandarinTranslation,
  thread_ts: ts,
  username: "Mei"
});

const translationResponse5 = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
      { role: "system", content: "You are a Comparative Literature graduate student who is steeped in literary and cultural theory and is extremely intelligent. You are critical of poor translations." },
      { role: "user", content: `please evaluate the following translations of the English text and give a few specific critiques of unusual choices--or praise good choices:\noriginal:\n"${transcription.text}"\ntranslations: ${frenchTranslation} \n${germanTranslation} \n${spanishTranslation} \n${mandarinTranslation} \n` }
  ],
  max_tokens: 1000,
});

const evaluation = translationResponse5.choices[0].message.content.trim();

// Post the Mandarin Chinese translation as a thread reply
await app.client.chat.postMessage({
  channel: process.env.SLACK_UTIL_SAVE_YOUR_TRANSCRIPTS_CHANNEL,
  text: evaluation,
  thread_ts: ts,
  username: "The CompLit Critic"
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
