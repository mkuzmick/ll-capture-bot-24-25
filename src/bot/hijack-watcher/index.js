var chokidar = require("chokidar");
const llog = require("learninglab-log");
const fs = require("fs");
const OpenAI = require("openai");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { App } = require("@slack/bolt");

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
